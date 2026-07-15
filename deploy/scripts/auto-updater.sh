#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

log() {
  printf '%s [keynv-updater] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

die() {
  log "$*" >&2
  exit 1
}

KEYNV_REPO_URL=https://github.com/keynv-labs/keynv.git
KEYNV_INSTALL_ROOT=/opt/keynv
KEYNV_CONFIG_DIR=/etc/keynv
KEYNV_STATE_DIR=/var/lib/keynv
KEYNV_RUNTIME_ENV=/etc/keynv/runtime.env
KEYNV_COMPOSE_OVERRIDE=/etc/keynv/compose.update.yml
KEYNV_UPDATE_CHANNEL=release
KEYNV_UPDATE_BRANCH=main
KEYNV_HEALTH_TIMEOUT=120
KEYNV_KEEP_RELEASES=3
KEYNV_KEEP_BACKUPS=3
KEYNV_SERVER_IMAGE_REPOSITORY=keynv-server
KEYNV_WEB_IMAGE_REPOSITORY=keynv-web
CONFIG_FILE=${KEYNV_UPDATE_CONFIG:-/etc/keynv/update.conf}

load_config() {
  local file=$1
  local line key value
  [[ -f "$file" ]] || die "update config not found: $file"
  while IFS= read -r line || [[ -n "$line" ]]; do
    line=${line%$'\r'}
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" == *=* ]] || die "invalid config line in $file"
    key=${line%%=*}
    value=${line#*=}
    case "$key" in
      KEYNV_REPO_URL | KEYNV_INSTALL_ROOT | KEYNV_CONFIG_DIR | KEYNV_STATE_DIR | KEYNV_RUNTIME_ENV | KEYNV_COMPOSE_OVERRIDE | KEYNV_UPDATE_CHANNEL | KEYNV_UPDATE_BRANCH | KEYNV_HEALTH_TIMEOUT | KEYNV_KEEP_RELEASES | KEYNV_KEEP_BACKUPS | KEYNV_SERVER_IMAGE_REPOSITORY | KEYNV_WEB_IMAGE_REPOSITORY)
        printf -v "$key" '%s' "$value"
        ;;
      *)
        die "unsupported config key: $key"
        ;;
    esac
  done < "$file"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

secure_file() {
  local file=$1
  local owner mode mode_value
  owner=$(stat -c '%u' "$file")
  mode=$(stat -c '%a' "$file")
  mode_value=$((8#$mode))
  [[ "$owner" == 0 ]] || die "$file must be owned by root"
  (( (mode_value & 0022) == 0 )) || die "$file must not be group/world writable"
}

validate_config() {
  [[ ${EUID:-$(id -u)} -eq 0 ]] || die "run as root"
  [[ "$KEYNV_INSTALL_ROOT" == /* ]] || die "KEYNV_INSTALL_ROOT must be absolute"
  [[ "$KEYNV_CONFIG_DIR" == /* ]] || die "KEYNV_CONFIG_DIR must be absolute"
  [[ "$KEYNV_STATE_DIR" == /* ]] || die "KEYNV_STATE_DIR must be absolute"
  [[ "$KEYNV_RUNTIME_ENV" == /* ]] || die "KEYNV_RUNTIME_ENV must be absolute"
  [[ "$KEYNV_COMPOSE_OVERRIDE" == /* ]] || die "KEYNV_COMPOSE_OVERRIDE must be absolute"
  [[ "$KEYNV_HEALTH_TIMEOUT" =~ ^[0-9]+$ ]] || die "KEYNV_HEALTH_TIMEOUT must be numeric"
  [[ "$KEYNV_KEEP_RELEASES" =~ ^[0-9]+$ ]] || die "KEYNV_KEEP_RELEASES must be numeric"
  [[ "$KEYNV_KEEP_BACKUPS" =~ ^[0-9]+$ ]] || die "KEYNV_KEEP_BACKUPS must be numeric"
  (( KEYNV_HEALTH_TIMEOUT >= 30 )) || die "KEYNV_HEALTH_TIMEOUT must be at least 30"
  (( KEYNV_KEEP_RELEASES >= 2 )) || die "KEYNV_KEEP_RELEASES must be at least 2"
  (( KEYNV_KEEP_BACKUPS >= 1 )) || die "KEYNV_KEEP_BACKUPS must be at least 1"
  case "$KEYNV_UPDATE_CHANNEL" in
    stable | release | branch) ;;
    *) die "KEYNV_UPDATE_CHANNEL must be stable, release, or branch" ;;
  esac
  git check-ref-format --branch "$KEYNV_UPDATE_BRANCH" >/dev/null 2>&1 || die "invalid KEYNV_UPDATE_BRANCH"
  [[ -f "$KEYNV_RUNTIME_ENV" ]] || die "runtime env not found: $KEYNV_RUNTIME_ENV"
  [[ -f "$KEYNV_COMPOSE_OVERRIDE" ]] || die "compose override not found: $KEYNV_COMPOSE_OVERRIDE"
  secure_file "$CONFIG_FILE"
  secure_file "$KEYNV_RUNTIME_ENV"
  secure_file "$KEYNV_COMPOSE_OVERRIDE"
}

init_paths() {
  install -d -m 0755 "$KEYNV_INSTALL_ROOT" "$KEYNV_INSTALL_ROOT/releases"
  install -d -m 0700 "$KEYNV_STATE_DIR" "$KEYNV_STATE_DIR/backups"
  install -d -m 0755 /run/lock
}

repository_dir() {
  printf '%s/repository' "$KEYNV_INSTALL_ROOT"
}

release_dir() {
  printf '%s/releases/%s' "$KEYNV_INSTALL_ROOT" "$1"
}

state_file() {
  printf '%s/%s' "$KEYNV_STATE_DIR" "$1"
}

read_state() {
  local file
  file=$(state_file "$1")
  [[ -s "$file" ]] || return 0
  tr -d '\r\n' < "$file"
}

write_state() {
  local name=$1
  local value=$2
  local target temp
  target=$(state_file "$name")
  temp=$(mktemp "$KEYNV_STATE_DIR/.state.XXXXXX")
  printf '%s\n' "$value" > "$temp"
  chmod 0600 "$temp"
  mv -f "$temp" "$target"
}

ensure_repository() {
  local repo
  repo=$(repository_dir)
  if [[ ! -d "$repo/.git" ]]; then
    [[ ! -e "$repo" ]] || die "repository path exists but is not a managed clone: $repo"
    log "creating managed repository"
    git clone --no-checkout "$KEYNV_REPO_URL" "$repo"
  fi
  git -C "$repo" remote set-url origin "$KEYNV_REPO_URL"
  git -C "$repo" fetch --force --prune --tags origin '+refs/heads/*:refs/remotes/origin/*'
}

resolve_target() {
  local repo tag
  repo=$(repository_dir)
  TARGET_LABEL=
  TARGET_SHA=
  case "$KEYNV_UPDATE_CHANNEL" in
    branch)
      git -C "$repo" show-ref --verify --quiet "refs/remotes/origin/$KEYNV_UPDATE_BRANCH" || die "remote branch not found: $KEYNV_UPDATE_BRANCH"
      TARGET_LABEL="branch:$KEYNV_UPDATE_BRANCH"
      TARGET_SHA=$(git -C "$repo" rev-parse "refs/remotes/origin/$KEYNV_UPDATE_BRANCH^{commit}")
      ;;
    stable)
      while IFS= read -r tag; do
        if [[ "$tag" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
          TARGET_LABEL=$tag
          break
        fi
      done < <(git -C "$repo" for-each-ref --sort=-creatordate --format='%(refname:strip=2)' refs/tags)
      [[ -n "$TARGET_LABEL" ]] || die "no stable release tag found"
      TARGET_SHA=$(git -C "$repo" rev-parse "$TARGET_LABEL^{commit}")
      ;;
    release)
      while IFS= read -r tag; do
        if [[ "$tag" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z][0-9A-Za-z.-]*)?(\+[0-9A-Za-z.-]+)?$ ]]; then
          TARGET_LABEL=$tag
          break
        fi
      done < <(git -C "$repo" for-each-ref --sort=-creatordate --format='%(refname:strip=2)' refs/tags)
      [[ -n "$TARGET_LABEL" ]] || die "no release tag found"
      TARGET_SHA=$(git -C "$repo" rev-parse "$TARGET_LABEL^{commit}")
      ;;
  esac
  [[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || die "resolved target is not a commit"
}

prepare_release() {
  local sha=$1
  local repo release actual dirty
  repo=$(repository_dir)
  release=$(release_dir "$sha")
  if [[ -e "$release" ]]; then
    [[ -e "$release/.git" ]] || die "release path is not a Git worktree: $release"
    actual=$(git -C "$release" rev-parse HEAD)
    [[ "$actual" == "$sha" ]] || die "release worktree has an unexpected commit: $release"
  else
    git -C "$repo" worktree add --detach "$release" "$sha"
  fi
  dirty=$(git -C "$release" status --porcelain --untracked-files=all)
  [[ -z "$dirty" ]] || die "release worktree is dirty: $release"
}

compose_for() {
  local release=$1
  local sha=$2
  shift 2
  local server_image="$KEYNV_SERVER_IMAGE_REPOSITORY:$sha"
  local web_image="$KEYNV_WEB_IMAGE_REPOSITORY:$sha"
  local -a command=(docker compose --project-directory "$release/deploy" -f "$release/deploy/docker-compose.yml" -f "$KEYNV_COMPOSE_OVERRIDE" --env-file "$KEYNV_RUNTIME_ENV")
  env KEYNV_SERVER_IMAGE="$server_image" KEYNV_WEB_IMAGE="$web_image" "${command[@]}" "$@"
}

build_release() {
  local sha=$1
  local release
  release=$(release_dir "$sha")
  compose_for "$release" "$sha" config >/dev/null
  log "building images for ${sha:0:12}"
  compose_for "$release" "$sha" build --pull keynv-server keynv-web
}

wait_for_stack() {
  local release=$1
  local sha=$2
  local deadline=$((SECONDS + KEYNV_HEALTH_TIMEOUT))
  local service id status healthy
  while (( SECONDS < deadline )); do
    healthy=true
    for service in keynv-server keynv-web; do
      id=$(compose_for "$release" "$sha" ps -q "$service" 2>/dev/null || true)
      if [[ -z "$id" ]]; then
        healthy=false
        continue
      fi
      status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || true)
      if [[ "$status" != healthy ]]; then
        healthy=false
      fi
      if [[ "$status" == exited || "$status" == dead ]]; then
        compose_for "$release" "$sha" ps >&2 || true
        return 1
      fi
    done
    if [[ "$healthy" == true ]]; then
      return 0
    fi
    sleep 2
  done
  compose_for "$release" "$sha" ps >&2 || true
  return 1
}

discover_volume() {
  local release=$1
  local sha=$2
  local service=$3
  local id
  id=$(compose_for "$release" "$sha" ps -q "$service")
  [[ -n "$id" ]] || return 1
  docker inspect --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}' "$id"
}

snapshot_volume() {
  local volume=$1
  local backup_dir=$2
  local archive=$3
  docker run --rm --network none -v "$volume:/source:ro" -v "$backup_dir:/backup" alpine:3.20 sh -c 'tar -C /source -czf "/backup/$1" .' sh "$archive"
}

restore_volume() {
  local volume=$1
  local backup_dir=$2
  local archive=$3
  docker run --rm --network none -v "$volume:/target" -v "$backup_dir:/backup:ro" alpine:3.20 sh -c 'find /target -mindepth 1 -maxdepth 1 -exec rm -rf {} + && tar -C /target -xzf "/backup/$1"' sh "$archive"
}

resume_release() {
  local release=$1
  local sha=$2
  compose_for "$release" "$sha" up -d --no-build --remove-orphans
  wait_for_stack "$release" "$sha"
}

backup_current() {
  local release=$1
  local sha=$2
  local timestamp
  timestamp=$(date -u +%Y%m%dT%H%M%SZ)
  BACKUP_PATH="$KEYNV_STATE_DIR/backups/$timestamp-$sha"
  BACKUP_SERVER_VOLUME=$(discover_volume "$release" "$sha" keynv-server)
  BACKUP_WEB_VOLUME=$(discover_volume "$release" "$sha" keynv-web)
  [[ -n "$BACKUP_SERVER_VOLUME" ]] || die "server data volume not found"
  [[ -n "$BACKUP_WEB_VOLUME" ]] || die "web data volume not found"
  install -d -m 0700 "$BACKUP_PATH"
  docker image inspect alpine:3.20 >/dev/null 2>&1 || docker pull alpine:3.20
  log "stopping stack for a consistent snapshot"
  if ! compose_for "$release" "$sha" --profile backup stop; then
    resume_release "$release" "$sha" || true
    return 1
  fi
  if ! snapshot_volume "$BACKUP_SERVER_VOLUME" "$BACKUP_PATH" server-data.tar.gz; then
    resume_release "$release" "$sha" || true
    return 1
  fi
  if ! snapshot_volume "$BACKUP_WEB_VOLUME" "$BACKUP_PATH" web-data.tar.gz; then
    resume_release "$release" "$sha" || true
    return 1
  fi
  printf '%s\n' "$BACKUP_SERVER_VOLUME" > "$BACKUP_PATH/server-volume"
  printf '%s\n' "$BACKUP_WEB_VOLUME" > "$BACKUP_PATH/web-volume"
  chmod 0600 "$BACKUP_PATH"/*
}

rollback_failed_update() {
  local candidate_release=$1
  local candidate_sha=$2
  local previous_release=$3
  local previous_sha=$4
  local result=0
  set +e
  log "rolling back failed update"
  compose_for "$candidate_release" "$candidate_sha" --profile backup down --remove-orphans
  restore_volume "$BACKUP_SERVER_VOLUME" "$BACKUP_PATH" server-data.tar.gz || result=1
  restore_volume "$BACKUP_WEB_VOLUME" "$BACKUP_PATH" web-data.tar.gz || result=1
  compose_for "$previous_release" "$previous_sha" up -d --no-build --remove-orphans || result=1
  wait_for_stack "$previous_release" "$previous_sha" || result=1
  set -e
  return "$result"
}

activate_release() {
  local sha=$1
  local label=$2
  local previous_sha=$3
  local backup_path=$4
  local release temp_link
  release=$(release_dir "$sha")
  if [[ -n "$previous_sha" ]]; then
    write_state previous-sha "$previous_sha"
    write_state previous-backup "$backup_path"
  fi
  write_state current-sha "$sha"
  write_state current-ref "$label"
  temp_link="$KEYNV_INSTALL_ROOT/.current.$$"
  rm -f "$temp_link"
  ln -s "$release" "$temp_link"
  mv -Tf "$temp_link" "$KEYNV_INSTALL_ROOT/current"
}

sync_service_files() {
  local release=$1
  local source
  source="$release/deploy/scripts/auto-updater.sh"
  [[ -f "$source" ]] && install -m 0755 "$source" /usr/local/libexec/keynv/auto-updater.sh
  source="$release/deploy/scripts/auto-installer.sh"
  [[ -f "$source" ]] && install -m 0755 "$source" /usr/local/libexec/keynv/auto-installer.sh
  source="$release/deploy/systemd/compose.update.yml"
  [[ -f "$source" ]] && install -m 0644 "$source" "$KEYNV_COMPOSE_OVERRIDE"
  for source in "$release"/deploy/systemd/*.service "$release"/deploy/systemd/*.timer; do
    [[ -f "$source" ]] || continue
    install -m 0644 "$source" "/etc/systemd/system/$(basename "$source")"
  done
  systemctl daemon-reload
}

prune_releases() {
  local current_sha previous_sha directory sha kept=0
  local -a directories
  current_sha=$(read_state current-sha)
  previous_sha=$(read_state previous-sha)
  mapfile -t directories < <(find "$KEYNV_INSTALL_ROOT/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -nr | cut -d' ' -f2-)
  for directory in "${directories[@]}"; do
    sha=$(basename "$directory")
    if [[ "$sha" == "$current_sha" || "$sha" == "$previous_sha" || $kept -lt $KEYNV_KEEP_RELEASES ]]; then
      ((kept += 1))
      continue
    fi
    git -C "$(repository_dir)" worktree remove --force "$directory" || continue
    docker image rm "$KEYNV_SERVER_IMAGE_REPOSITORY:$sha" "$KEYNV_WEB_IMAGE_REPOSITORY:$sha" >/dev/null 2>&1 || true
  done
  git -C "$(repository_dir)" worktree prune
}

prune_backups() {
  local previous_backup directory kept=0
  local -a directories
  previous_backup=$(read_state previous-backup)
  mapfile -t directories < <(find "$KEYNV_STATE_DIR/backups" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -nr | cut -d' ' -f2-)
  for directory in "${directories[@]}"; do
    if [[ "$directory" == "$previous_backup" || $kept -lt $KEYNV_KEEP_BACKUPS ]]; then
      ((kept += 1))
      continue
    fi
    rm -rf -- "$directory"
  done
}

update_stack() {
  local current_sha current_release candidate_release
  ensure_repository
  resolve_target
  current_sha=$(read_state current-sha)
  if [[ "$current_sha" == "$TARGET_SHA" ]]; then
    log "already current: $TARGET_LABEL (${TARGET_SHA:0:12})"
    return 0
  fi
  log "target resolved: $TARGET_LABEL (${TARGET_SHA:0:12})"
  prepare_release "$TARGET_SHA"
  build_release "$TARGET_SHA"
  candidate_release=$(release_dir "$TARGET_SHA")
  BACKUP_PATH=
  BACKUP_SERVER_VOLUME=
  BACKUP_WEB_VOLUME=
  if [[ -n "$current_sha" ]]; then
    [[ "$current_sha" =~ ^[0-9a-f]{40}$ ]] || die "invalid current state"
    current_release=$(release_dir "$current_sha")
    [[ -d "$current_release" ]] || die "current release is missing: $current_release"
    if ! backup_current "$current_release" "$current_sha"; then
      die "snapshot failed; previous release was resumed"
    fi
  fi
  log "starting candidate ${TARGET_SHA:0:12}"
  if ! compose_for "$candidate_release" "$TARGET_SHA" up -d --no-build --remove-orphans; then
    if [[ -n "$current_sha" ]]; then
      rollback_failed_update "$candidate_release" "$TARGET_SHA" "$current_release" "$current_sha" || die "candidate failed and automatic rollback needs manual recovery"
    else
      compose_for "$candidate_release" "$TARGET_SHA" --profile backup down --remove-orphans || true
    fi
    die "candidate failed to start"
  fi
  if ! wait_for_stack "$candidate_release" "$TARGET_SHA"; then
    if [[ -n "$current_sha" ]]; then
      rollback_failed_update "$candidate_release" "$TARGET_SHA" "$current_release" "$current_sha" || die "health check failed and automatic rollback needs manual recovery"
    else
      compose_for "$candidate_release" "$TARGET_SHA" --profile backup down --remove-orphans || true
    fi
    die "candidate health check failed"
  fi
  activate_release "$TARGET_SHA" "$TARGET_LABEL" "$current_sha" "$BACKUP_PATH"
  if ! sync_service_files "$candidate_release"; then
    log "service file refresh failed; application update remains active" >&2
  fi
  prune_releases
  prune_backups
  log "update complete: $TARGET_LABEL (${TARGET_SHA:0:12})"
}

start_stack() {
  local sha release
  sha=$(read_state current-sha)
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || die "no installed release"
  release=$(release_dir "$sha")
  [[ -d "$release" ]] || die "installed release is missing: $release"
  compose_for "$release" "$sha" config >/dev/null
  compose_for "$release" "$sha" up -d --no-build --remove-orphans
  wait_for_stack "$release" "$sha" || die "stack health check failed"
  log "stack is healthy: ${sha:0:12}"
}

stop_stack() {
  local sha release
  sha=$(read_state current-sha)
  [[ -n "$sha" ]] || return 0
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || die "invalid current state"
  release=$(release_dir "$sha")
  [[ -d "$release" ]] || return 0
  compose_for "$release" "$sha" --profile backup down --remove-orphans
  log "stack stopped"
}

show_status() {
  local sha ref
  sha=$(read_state current-sha)
  ref=$(read_state current-ref)
  printf 'channel=%s\nbranch=%s\nref=%s\nsha=%s\n' "$KEYNV_UPDATE_CHANNEL" "$KEYNV_UPDATE_BRANCH" "$ref" "$sha"
  if [[ "$sha" =~ ^[0-9a-f]{40}$ ]]; then
    compose_for "$(release_dir "$sha")" "$sha" ps
  fi
}

main() {
  local action=${1:-update}
  require_command git
  require_command docker
  require_command flock
  require_command install
  require_command systemctl
  docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required"
  load_config "$CONFIG_FILE"
  validate_config
  init_paths
  exec 9>/run/lock/keynv-update.lock
  flock -n 9 || die "another keynv operation is running"
  case "$action" in
    update) update_stack ;;
    start) start_stack ;;
    stop) stop_stack ;;
    status) show_status ;;
    *) die "usage: auto-updater.sh [update|start|stop|status]" ;;
  esac
}

main "$@"
