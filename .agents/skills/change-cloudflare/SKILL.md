---
name: change-cloudflare
description: Change or verify shift-app Cloudflare Worker configuration, bindings, Durable Objects, D1 migrations, preview behavior, or deployment readiness. Not for ordinary UI-only work.
---

# Change Shift App Cloudflare Infrastructure

Read `docs/architecture.md`, `docs/development.md`, and the affected
`apps/api/wrangler.jsonc` section before editing. Verify current Cloudflare
behavior from official documentation when changing version-sensitive fields.

## Invariants

- Keep secrets out of tracked configuration and command output. Local secrets
  belong in ignored `.dev.vars`; remote secrets use Wrangler secret management.
- Do not add `nodejs_compat`. Reassess this only if the compatibility date or a
  dependency requirement changes.
- Treat Durable Object class names, bindings, migrations, and exports as
  persistent identity. Never rename or delete them as cleanup without an
  explicit data-migration decision.
- Generate D1 migrations from schema changes, inspect the SQL, and apply only to
  local D1 unless the user explicitly authorizes a remote migration.
- Never edit generated Worker types directly.

## Verification

After binding, compatibility, or Wrangler changes, run:

```bash
vp -C apps/api run cf-typegen
vp -C apps/api run cf-typegen:check
vp check
vp run -r --cache test
vp run deployCheck
```

For runtime or routing changes, start `vp -C apps/web preview` and smoke the
smallest public and protected endpoints that prove Worker-first routing and JSON
handling. Stop the preview process afterward. A dry run or preview is not a
production deployment.
