---
name: verify-change
description: Verify or review changes in shift-app, including completion checks, regression checks, unused-code cleanup, and pre-commit readiness. Use only for this repository.
---

# Verify a Shift App Change

Inspect the diff and choose checks by affected boundary. Do not report a skipped
check as passed, and do not add tests merely to increase a count.

## Required baseline

From the repository root, run:

```bash
vp check
vp exec knip
vp run -r --cache test
```

Run `git diff --check` and inspect the full diff. Confirm that deleted APIs,
dependencies, names, and paths have no remaining callers using `rg`; do not treat
a predicted zero-hit search as proof without also reading the relevant composer
or manifest.

## Add checks by scope

- Pure logic or schema changes: `vp run -r coverage` and confirm the configured
  thresholds still cover the changed module.
- Web, routing, UI, or build configuration: `vp run web#build`.
- Worker code or Cloudflare configuration: follow the `change-cloudflare` skill.
- Dependency or workspace changes: verify `pnpm-lock.yaml`, then run
  `vp install --frozen-lockfile` and `vp exec knip`.
- Formatting-only or documentation-only changes: run `vp fmt --check .`; add
  broader checks only when executable configuration or commands changed.

For a behavior change, add the smallest regression test that fails without the
change. Prefer boundary behavior and pure rules over snapshots or duplicate
happy-path assertions.
