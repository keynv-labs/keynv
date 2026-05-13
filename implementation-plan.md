# Implementation Plan (Phased)

---

## Phase 1: Documentation Cleanup
_Tahmini süre: 10dk · 1 commit_

Remove deprecated `install <agent>` references from docs. Bu komut `0.1.0-rc.8`'de kaldırıldı, dokümanlar hala bahsediyor.

| # | File | Değişiklik |
|---|------|-----------|
| 1a | `docs/01-architecture.md:67` | `install <agent>` satırını kaldır |
| 1b | `docs/02-threat-model.md:153` | "Per-agent installers" → "`keynv init` walks `.env` files" |

---

## Phase 2: Release Pipeline — darwin-x64
_Tahmini süre: 10dk · 1 commit_

ROADMAP "Bun binaries × 5 platforms" diyor, şu an release.yml'de 4 tane var. Eksik: macOS Intel (darwin-x64).

| # | File | Değişiklik |
|---|------|-----------|
| 2a | `.github/workflows/release.yml` | `bun-darwin-x64` runner ekle (`macos-13`) |

---

## Phase 3: Code Quality
_Tahmini süre: 45dk · 1-2 commit_

API version fix + test coverage for recently refactored commands.

| # | File | Değişiklik |
|---|------|-----------|
| 3a | `apps/server/src/index.ts:8` | `VERSION` → `'0.1.0-rc.11'` |
| 3b | `apps/cli/src/commands/secret.test.ts` | New: unit tests for secret CRUD |
| 3c | `apps/cli/src/commands/member.test.ts` | New: unit tests for member CRUD |

---

## Özet

```
Phase 1: 📝 Docs cleanup          (10dk)  ── 2 files
Phase 2: 🚀 Release pipeline      (10dk)  ── 1 file
Phase 3: ✅ Code quality          (45dk)  ── 3 files
                               ─────────
                  Toplam:         ~65dk
```

Her phase bağımsız, sırayla ilerleyelim. Onaylıyor musun?
