---
title: Aider
description: Writes a marker-bracketed block in .aiderignore so Aider's file tools skip credential paths.
---

## Install

```bash
cd path/to/your/project
keynv install aider
```

Writes (or refreshes) a `# >>> keynv >>>` block in `.aiderignore`. Aider already supports `.aiderignore` as a project-level ignore list; we append the keynv-managed credential globs.

## Verify

```bash
aider --read-only      # start aider in read-only mode for a quick test
> /add .env
# Aider says: "Cannot add .env — matches .aiderignore"
```

## Uninstall

```bash
keynv uninstall aider
```

## Layered with `keynv exec`

For DB migrations, deploy scripts, or anything that needs a credential, prefix the command Aider runs in your shell:

```bash
keynv exec -- aider --message "add a migration that creates the users table"
```

Aider sees its command output filtered through the wrapper's redactor — postgres URIs, AWS keys, JWTs are masked before they enter Aider's context.
