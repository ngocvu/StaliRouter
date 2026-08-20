# StaliRouter CLI

**Local AI router optimized for [api.stali.vn](https://api.stali.vn)**

## Install

```bash
npm install -g stalirouter && stalirouter
```

Coexists with upstream **`9router`** (decolua) — separate global bin, data dir, and process scope:

| | `9router` | `stalirouter` |
|---|---|---|
| Command | `9router` | `stalirouter` |
| Data | `~/.9router` | `~/.stalirouter` |
| Default port | `20128` | auto-picks next free port if `20128` taken |

Optional: reuse old 9router data → `STALIROUTER_LEGACY_DATA=1 stalirouter`

## One-line install script

```bash
curl -fsSL https://api.stali.vn/install/stalirouter.sh | bash
```

## Publish (maintainers)

```bash
cd cli && npm publish --access public
```
