# claude-plugins

Claude Code mods and skills by [Tuncay Kaplan](https://github.com/trkaplan). This repository is a Claude Code plugin marketplace: every plugin lives in its own folder under `plugins/` and installs with one line.

## Plugins

| Plugin | Kind | What it does |
| --- | --- | --- |
| [smart-rename](plugins/smart-rename) | mod | Bare `/rename` reads the whole session and offers 4 names to pick from |

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install <plugin> --marketplace trkaplan/claude-plugins
```

Answer `y` to add the marketplace, then pick a scope (user scope = every session). For example:

```
/plugin install smart-rename --marketplace trkaplan/claude-plugins
```

To update later: `claude plugin update <plugin>`, then `/reload-plugins` in a running session.

## Adding a plugin (for the maintainer)

1. Put it in `plugins/<name>/` with its own `.claude-plugin/plugin.json` (a mod adds `hooks/`, a skill adds `skills/<skill>/SKILL.md`).
2. Add an entry to `.claude-plugin/marketplace.json` with `"source": "./plugins/<name>"`.
3. Run `claude plugin validate .` and, for a mod, `claude plugin test plugins/<name>`.

## License

MIT
