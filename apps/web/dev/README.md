# Local management review

Run the existing application with generated, memory-only API responses:

```sh
vp -C apps/web dev --config vite.local.config.ts
```

Open `http://localhost:4178/manage`. The app uses its real entry point, routes,
layout, components and API parsing. The local Vite middleware answers every
`/api/*` request itself; unsupported requests return a local error. It loads no
Cloudflare plugin, remote binding, proxy or `.dev.vars` file. Changes to sample
shifts and member tags last only until this server restarts. The window title identifies this
as a screen review. Do not use real member data with this server.

This is a local screen-review fixture. It does not persist edits or represent
production data. Use the normal Worker preview to verify API behavior.

## Calendar coworker UI preview

Open `http://localhost:4178/dev/coworkers.html` with the same local server.
This preview supplies fictional member data directly to the real attendance
drawer/dialog. Use the people button to open the list; attendance icons reveal
their labels on hover, keyboard focus, or tap. `?case=empty` shows an empty list,
and `?case=long` exercises scrolling and long names.
`?case=current-long` and `?case=ended-long` add 36 fictional
members to the current or ended group, respectively. Time is fixed at 10:30 JST
on November 1, 2026. The standalone preview supplies its own data; the normal
calendar retrieves authorized coworkers only when the member list is opened.
