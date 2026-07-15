#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

log() {
  printf '%s [keynv-installer] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

die() {
  log "$*" >&2
  exit 1
}

usage() {
  printf '%s\n' \
    'usage: auto-installer.sh [options]' \
    '  --repo-url URL' \
    '  --channel stable|release|branch' \
    '  --branch NAME' \
    '  --install-root PATH' \
    '  --runtime-env PATH'
}

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd -- "$SCRIPT_DIR/../.." && pwd)
REPO_URL=https://github.com/keynv-labs/keynv.git
UPDATE_CHANNEL=release
UPDATE_BRANCH=main
INSTALL_ROOT=/opt/keynv
CONFIG_DIR=/etc/keynv
STATE_DIR=/var/lib/keynv
LIBEXEC_DIR=/usr/local/libexec/keynv
SYSTEMD_DIR=/etc/systemd/system
RUNTIME_ENV_SOURCE=

while (($#)); do
  case "$1" in
    --repo-url)
      (($# >= 2)) || die "missing value for --repo-url"
      REPO_URL=$2
      shift 2
      ;;
    --channel)
      (($# >= 2)) || die "missing value for --channel"
      UPDATE_CHANNEL=$2
      shift 2
      ;;
    --branch)
      (($# >= 2)) || die "missing value for --branch"
      UPDATE_BRANCH=$2
      shift 2
      ;;
    --install-root)
      (($# >= 2)) || die "missing value for --install-root"
      INSTALL_ROOT=$2
      shift 2
      ;;
    --runtime-env)
      (($# >= 2)) || die "missing value for --runtime-env"
      RUNTIME_ENV_SOURCE=$2
      shift 2
      ;;
    --help | -h)
      usage
      exit 0
      ;;
    *)
      die "unknown option: $1"
      ;;
  esac
done

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

validate_scalar() {
  local name=$1
  local value=$2
  [[ -n "$value" ]] || die "$name must not be empty"
  [[ "$value" != *$'\n'* && "$value" != *$'\r'* ]] || die "$name contains a newline"
}

write_update_config() {
  local target=$1
  local temp
  temp=$(mktemp)
  printf '%s\n' \
    "KEYNV_REPO_URL=$REPO_URL" \
    "KEYNV_INSTALL_ROOT=$INSTALL_ROOT" \
    "KEYNV_CONFIG_DIR=$CONFIG_DIR" \
    "KEYNV_STATE_DIR=$STATE_DIR" \
    "KEYNV_RUNTIME_ENV=$CONFIG_DIR/runtime.env" \
    "KEYNV_COMPOSE_OVERRIDE=$CONFIG_DIR/compose.update.yml" \
    "KEYNV_UPDATE_CHANNEL=$UPDATE_CHANNEL" \
    "KEYNV_UPDATE_BRANCH=$UPDATE_BRANCH" \
    'KEYNV_HEALTH_TIMEOUT=120' \
    'KEYNV_KEEP_RELEASES=3' \
    'KEYNV_KEEP_BACKUPS=3' \
    'KEYNV_SERVER_IMAGE_REPOSITORY=keynv-server' \
    'KEYNV_WEB_IMAGE_REPOSITORY=keynv-web' > "$temp"
  install -m 0600 "$temp" "$target"
  rm -f "$temp"
}

[[ "$(uname -s)" == Linux ]] || die "this installer supports Linux only"
[[ ${EUID:-$(id -u)} -eq 0 ]] || die "run as root"
[[ "$(ps -p 1 -o comm= | tr -d ' ')" == systemd ]] || die "systemd must be PID 1"

for command in git docker flock install systemctl stat; do
  require_command "$command"
done

docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required"
systemctl enable --now docker.service
docker info >/dev/null 2>&1 || die "Docker daemon is unavailable"

validate_scalar REPO_URL "$REPO_URL"
validate_scalar UPDATE_CHANNEL "$UPDATE_CHANNEL"
validate_scalar UPDATE_BRANCH "$UPDATE_BRANCH"
validate_scalar INSTALL_ROOT "$INSTALL_ROOT"
[[ "$INSTALL_ROOT" == /* ]] || die "--install-root must be absolute"
case "$UPDATE_CHANNEL" in
  stable | release | branch) ;;
  *) die "--channel must be stable, release, or branch" ;;
esac
git check-ref-format --branch "$UPDATE_BRANCH" >/dev/null 2>&1 || die "invalid branch name"

for file in \
  "$REPO_ROOT/deploy/scripts/auto-updater.sh" \
  "$REPO_ROOT/deploy/systemd/compose.update.yml" \
  "$REPO_ROOT/deploy/systemd/keynv.service" \
  "$REPO_ROOT/deploy/systemd/keynv-update.service" \
  "$REPO_ROOT/deploy/systemd/keynv-update.timer" \
  "$REPO_ROOT/deploy/.env.example"; do
  [[ -f "$file" ]] || die "installer asset not found: $file"
done

install -d -m 0755 "$INSTALL_ROOT" "$INSTALL_ROOT/releases" "$CONFIG_DIR" "$LIBEXEC_DIR"
install -d -m 0700 "$STATE_DIR" "$STATE_DIR/backups"
install -m 0755 "$REPO_ROOT/deploy/scripts/auto-installer.sh" "$LIBEXEC_DIR/auto-installer.sh"
install -m 0755 "$REPO_ROOT/deploy/scripts/auto-updater.sh" "$LIBEXEC_DIR/auto-updater.sh"
install -m 0644 "$REPO_ROOT/deploy/systemd/compose.update.yml" "$CONFIG_DIR/compose.update.yml"
install -m 0644 "$REPO_ROOT/deploy/systemd/keynv.service" "$SYSTEMD_DIR/keynv.service"
install -m 0644 "$REPO_ROOT/deploy/systemd/keynv-update.service" "$SYSTEMD_DIR/keynv-update.service"
install -m 0644 "$REPO_ROOT/deploy/systemd/keynv-update.timer" "$SYSTEMD_DIR/keynv-update.timer"

if [[ -n "$RUNTIME_ENV_SOURCE" ]]; then
  [[ -f "$RUNTIME_ENV_SOURCE" ]] || die "runtime env not found: $RUNTIME_ENV_SOURCE"
  if [[ "$(readlink -f "$RUNTIME_ENV_SOURCE")" != "$(readlink -m "$CONFIG_DIR/runtime.env")" ]]; then
    install -m 0600 "$RUNTIME_ENV_SOURCE" "$CONFIG_DIR/runtime.env"
  else
    chmod 0600 "$CONFIG_DIR/runtime.env"
  fi
elif [[ ! -f "$CONFIG_DIR/runtime.env" ]]; then
  install -m 0600 "$REPO_ROOT/deploy/.env.example" "$CONFIG_DIR/runtime.env"
else
  chmod 0600 "$CONFIG_DIR/runtime.env"
fi

write_update_config "$CONFIG_DIR/update.conf"
systemctl daemon-reload
KEYNV_UPDATE_CONFIG="$CONFIG_DIR/update.conf" "$LIBEXEC_DIR/auto-updater.sh" update
systemctl enable --now keynv.service
systemctl enable --now keynv-update.timer

log "installation complete"
log "runtime config: $CONFIG_DIR/runtime.env"
log "update channel: $UPDATE_CHANNEL"
"$LIBEXEC_DIR/auto-updater.sh" status
