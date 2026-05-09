---
title: Cursor
description: Writes a project-level .cursorignore inside marker comments so Cursor's file tools skip credential paths.
---

## Install

```bash
cd path/to/your/project
keynv install cursor
```

Appends (or refreshes) a `# >>> keynv >>>` block in `.cursorignore` listing every credential path Cursor's file tools should skip: dotenv variants, raw key material, SSH private keys, generic credential containers, cloud-provider credential paths.

## Verify

```bash
cat .cursorignore
```

Expected output starts with whatever you authored, followed by:

```
# >>> keynv >>>
.env
.env.*
*.env
**/.env
…
.aws/credentials
**/.aws/credentials
.kube/config
**/.kube/config
# <<< keynv <<<
```

Open Cursor and ask "read the .env file"; the file does not appear in Cursor's file picker, and the Read tool returns "file not in workspace" instead of the contents.

## Uninstall

```bash
keynv uninstall cursor
```

Removes the marker block; everything you authored above and below is preserved.

## Layered with `keynv exec`

The `.cursorignore` is one layer. The other is the universal `keynv exec --`:

```bash
keynv exec -- npm run db:migrate
# Cursor's bash tool records the @alias in its input;
# the subprocess runs with the resolved value.
```

The redactor is not auto-piped through Cursor's bash output today — Cursor's hook surface is more limited than Claude Code's. For now, run sensitive commands directly through `keynv exec`; the resolved values then go through the wrapper's own stdout redactor before printing.
