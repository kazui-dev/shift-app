# Shift App Project Instructions

## Project

This is a pnpm monorepo for a mobile-first shift-management PWA. The web app and
Hono API are built together with Vite+, the Cloudflare Vite plugin, Workers, D1,
and Durable Objects. Read `docs/architecture.md` before changing boundaries and
`docs/development.md` before changing tooling or deployment workflows.

## Toolchain

- Use `vp` as the entry point for development, checks, tests, builds, package
  execution, preview, and deployment. Keep pnpm as the lockfile and workspace
  implementation. Do not introduce Bun, npm, Turborepo, ESLint, or Prettier.
- Oxc lint and format configuration lives in the root `vite.config.ts`. Do not
  add standalone Oxc configuration unless a consumer cannot read Vite+ config.
- Keep Vite+, its Vite alias, Vitest, and Cloudflare Vite integrations aligned as
  described in `docs/development.md`.
- Never hand-edit `apps/api/worker-configuration.d.ts` or
  `apps/web/src/routeTree.gen.ts`.

## Architecture

- `apps/web` owns the SPA. Put all HTTP details and boundary parsing in
  `apps/web/src/api`; React components must not call `fetch` directly.
- `packages/ui` owns reusable shadcn/ui components and global design tokens.
  App-specific compositions stay in `apps/web`.
- `packages/shared` owns cross-boundary Valibot schemas, types, and pure shared
  logic. `packages/db` owns Drizzle schema only.
- `apps/api/src/routes` owns HTTP composition, `domain` owns pure business logic,
  `services` owns external I/O workflows, and `durable-objects` owns stateful
  coordination. Keep tests under `apps/api/test`, not beside production files.
- API routes use plural resource nouns. Nest only canonical child collections;
  put current-user resources under `/me`. Use `PUT` for replaceable singleton
  resources and `PATCH` for partial state changes.
- Treat authentication, authorization, same-origin checks, and Valibot parsing as
  server-side boundaries. UI visibility is never authorization.
- Do not add `nodejs_compat`; the configured compatibility date supplies the
  required behavior.

## Implementation

- Preserve the existing strict TypeScript contract. Narrow unknown values at
  boundaries instead of using `any`, non-null assertions, suppression comments,
  or unchecked casts.
- Treat files installed from the shadcn/ui registry as maintained generated
  source. Preserve the registry's public exports and allow the narrow lint
  suppression it requires; do not rewrite a component only to satisfy a rule
  that conflicts with the upstream shadcn shape.
- Keep names short and domain-specific. Split files by responsibility when a
  module mixes route composition, queries, commands, and pure rules.
- Add tests for changed behavior and boundary semantics. Pure domain logic must
  retain 100% statement, branch, function, and line coverage. Remove tests that
  duplicate the same behavior without protecting a distinct regression.
- Preserve unrelated working-tree changes. Do not commit, deploy, mutate remote
  resources, or apply remote D1 migrations unless the user explicitly asks.

## Verification

Use the repository skill at `.agents/skills/verify-change/SKILL.md` when a task
asks to verify, review, finish, or prepare changes. Use
`.agents/skills/change-cloudflare/SKILL.md` for Worker configuration, bindings,
Durable Objects, D1 migrations, preview, or deployment work.

## Code Review Rules

- Flag imports that violate the ownership boundaries above.
- Flag API input used before validation or authorization enforced only by the UI.
- Flag generated-file edits without the generating command and schema changes
  without migration review.
- Flag compatibility aliases, duplicate configuration, dead dependencies, and
  tests that assert implementation trivia rather than behavior.
