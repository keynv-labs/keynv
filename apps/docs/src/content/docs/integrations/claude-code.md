---
title: Claude Code
description: Installer writes .claude/settings.local.json with PreToolUse permission denies + a PostToolUse(Bash) hook running `keynv redact-stream`.
---

## Install

```bash
cd path/to/your/project
keynv install claude-code
```

This writes (or merges into) `.claude/settings.local.json`:

- **`permissions.deny`** — `Read(.env)`, `Read(*.pem)`, `Read(id_rsa*)`, `Read(*credentials*)`, plus globstar variants for `~/.aws/credentials`, `~/.kube/config`, etc. Claude refuses these paths at the file-tool layer.
- **`hooks.PostToolUse`** with matcher `Bash` and command `keynv redact-stream` — every bash subprocess's stdout/stderr passes through the redactor before Claude reads it. Postgres URIs, AWS keys, GitHub PATs, JWTs, RSA private-key blocks, and high-entropy strings get masked as `<REDACTED:postgres-uri>` etc.

A `__keynv_managed__` tracker key is written so `keynv uninstall claude-code` removes only the entries we added — your own permission denies and hooks are preserved.

## What Claude actually sees

When you tell Claude "connect to the database":

```
> bash: keynv exec -- mysql -p@billing.dev.db_password -h db.example.com
```

Claude's tool input log records exactly that — the alias literal `@billing.dev.db_password` and nothing else. The `keynv exec` wrapper resolves the alias and fork-execs `mysql -psuper-secret-value-xyz -h db.example.com` in a curated subprocess. The bash tool's output goes through the PostToolUse redactor; whatever the subprocess prints, Claude sees only the masked version.

## Verify the install

```bash
cat .claude/settings.local.json | head -20
# {
#   "permissions": {
#     "deny": [
#       "Read(*.env)",
#       "Read(.aws/credentials)",
#       …
#     ]
#   },
#   "hooks": {
#     "PostToolUse": [
#       {
#         "matcher": "Bash",
#         "hooks": [{ "type": "command", "command": "keynv redact-stream" }]
#       }
#     ]
#   },
#   "__keynv_managed__": { … }
# }
```

Open Claude Code and try:

```
read .env
```

Claude responds: *"I can't access that file — it's blocked by your settings."* The Read tool is denied at the platform layer, before the file is opened.

## Uninstall

```bash
keynv uninstall claude-code
```

Removes the `__keynv_managed__` set: deny entries we added (yours stay), the redact-stream hook (other PostToolUse hooks stay).

## Limitations

- The PostToolUse redactor runs after the bash subprocess executes. The agent's tool channel sees the redacted output, but if the subprocess wrote secrets to a file, that file still has the value. Use `keynv exec` for subprocesses that write secrets — the substituted argv is what reaches disk, not the alias.
- The `permissions.deny` list is path-glob-based. A determined Claude session that lists a directory and reads a file by an unexpected path can still slip through; the deny list is a defense-in-depth layer, not the primary mechanism. Aliases-in-code-not-values is the primary mechanism.
