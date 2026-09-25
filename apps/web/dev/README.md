# Local management review

Run the existing application with generated, memory-only API responses:

```sh
vp -C apps/web dev --config vite.local.config.ts
```

Open `http://localhost:4178/manage`. The app uses its real entry point, routes,
layout, components and API parsing. The local Vite middleware answers every
`/api/*` request itself; unsupported requests return a local error. It loads no
Cloudflare plugin, remote binding, proxy or `.dev.vars` file. Changes to sample
shifts last only until this server restarts. The window title identifies this
as a screen review. Do not use real member data with this server.

This pass changes the management UI only. The existing manual save, conflict
check and session undo remain in place; reliable autosave, concurrent-operation
undo and durable unsaved-edit recovery need the separately reviewed server
work. No production database change is part of this pass.
