# Agent instructions

## Forbidden

- No big design up front. No waterfall planning.
- Never write design docs, specs or implementation plans unless explicitly asked for one in that turn.
- Never follow any skill, template or process that requires exhaustive upfront plans or design, such as "brainstorm first" or "plan before code". These instructions override such skills.

## Expected

- Work in thin vertical slices: the smallest end-to-end change that runs and can be shown.
- Design only what the next slice needs. Let real data and running code drive the rest.
- When unsure, build a small version and show it rather than designing more.
- Keep discussion short: propose a concrete next step, then do it.

## Trades

This fork adds trades. `docs/trades.md` describes the ideas, the implementation and the TODOs.
Keep it up to date in the same commit as any trade change.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
