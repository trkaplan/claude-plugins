# claude-plugins

A Claude Code plugin marketplace (`trkaplan`). Each plugin lives in `plugins/<name>/` and is listed in `.claude-plugin/marketplace.json`. Skills will be added here later as plugins of their own.

## better-rename

A mod (TypeScript function hooks, `hooks/register.ts` + `hooks/lib.ts`) that hooks the built-in `/rename`: run bare, it suggests 4 names from the whole session and runs `/rename <pick>`.

It is submitted to Anthropic's plugin directory, which tracks `main` (scheduled checks, auto-publish on). Every commit on `main` that changes `plugins/better-rename/` becomes a candidate version and is scanned; the `MOD_RUNS_COMMAND` policy hold comes back on each version, so a reviewer looks at every release.

## Workflow

- Work on a branch; merge to `main` only when a release is ready.
- Raise `version` in `plugins/<name>/.claude-plugin/plugin.json` with every release.
- Before pushing:
  - `claude plugin validate --strict plugins/<name>`
  - `claude plugin test plugins/<name>`
  - type-check the hooks and tests
- Try changes live with `claude --plugin-dir plugins/<name>`, with the installed copy disabled so two copies do not hook the same command.
- Keep the README in sync with the code: the directory scan and reviewers compare them. The README must state what the plugin reads, sends, and runs (see "Hooks this mod adds", "Commands it runs", "Cost and privacy", "What it reads").
- No em dash in user-facing text. Use generic examples (such as `Fix login redirect bug`) in docs and tests, never names from real sessions.
- Keep `.DS_Store` and other OS files out of the plugin folders; the directory blocks them.
