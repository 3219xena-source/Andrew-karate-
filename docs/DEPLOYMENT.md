# Deployment

The game is a fully static site. There is no backend, no database, no API key
and no runtime network request — the whole thing runs in the browser from files.

## Build

```bash
npm ci
npm run build      # type-checks, then writes dist/
npm run preview    # serves dist/ at http://127.0.0.1:4173
```

`dist/` is the complete deployable artefact.

## Base path

`vite.config.ts` sets `base: './'`, so the build works both at a domain root and
in a subdirectory without reconfiguration. Character artwork is resolved at
runtime against `import.meta.env.BASE_URL`, so it follows the same rule.

If you deploy to a fixed subpath and prefer absolute URLs, set
`base: '/your-subpath/'` and rebuild.

## Static hosts

All four need the same two facts: **build command** `npm run build`, **publish
directory** `dist`.

### Cloudflare Pages
Connect the repository, set the build command and output directory as above, and
set the Node version to 20 or newer. No further configuration.

### Netlify
```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"
[build.environment]
  NODE_VERSION = "20"
```

### Vercel
Framework preset **Vite**; the defaults match. Or `vercel.json`:
```json
{ "buildCommand": "npm run build", "outputDirectory": "dist" }
```

### GitHub Pages
Because Pages serves from `/<repo>/`, either keep `base: './'` (works as-is) or
set it explicitly. A minimal workflow:

```yaml
name: Deploy
on: { push: { branches: [main] } }
permissions: { contents: read, pages: write, id-token: write }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: github-pages
    steps:
      - uses: actions/deploy-pages@v4
```

## Single-file build

For an offline copy or a host with a strict content-security policy:

```bash
npm run bundle             # dist/tasmania-martial-arts-championship.html
npm run verify:standalone  # builds it, then boots it in a browser and checks it
```

One self-contained HTML file with the CSS and JS inlined. It makes zero network
requests. Note that it inlines only code — if character PNGs are present they
remain separate files and must be served alongside it, or the game falls back to
its generated placeholder portraits.

## Deployment status

**Not deployed.** No hosting credentials or project access were available in the
build environment, so no public URL exists. The build and the local preview are
both verified; see `docs/TEST_REPORT.md`.
