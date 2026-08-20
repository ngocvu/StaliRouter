# StaliRouter CLI

**Local AI router optimized for [api.stali.vn](https://api.stali.vn)**

## One-line install (Mac / Linux / Windows)

```bash
npm install -g https://api.stali.vn/install/stalirouter-bundle.tgz && stalirouter
```

Or:

```bash
curl -fsSL https://api.stali.vn/install/stalirouter.sh | bash
```

Windows:

```powershell
irm https://api.stali.vn/install/stalirouter.ps1 | iex
```

> `npm install -g stalirouter` works only **after** publishing to npm registry (not yet).  
> Use the tarball URL above until then.

Legacy bin alias: `9router`

## Publish to npm (maintainers)

```bash
cd cli && npm login && npm publish --access public
```

## Publish install bundle to api.stali.vn

```bash
npm run cli:publish-bundle
# → https://api.stali.vn/install/stalirouter-bundle.tgz
```
