# claude-plugins

Claude Code mods and skills by [Tuncay Kaplan](https://github.com/trkaplan). This repository is a Claude Code plugin marketplace: every plugin lives in its own folder under `plugins/` and installs with one line.

## Plugins

| Plugin | Kind | What it does |
| --- | --- | --- |
| [better-rename](plugins/better-rename) | mod | `/rename` run bare suggests 4 names from the whole session; `/rename <name>` works as before |

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install <plugin> --marketplace trkaplan/claude-plugins
```

Answer `y` to add the marketplace, then pick a scope (user scope = every session). For example:

```
/plugin install better-rename --marketplace trkaplan/claude-plugins
```

To update later: `claude plugin update <plugin>@trkaplan`, then restart Claude Code.

## Layout

```
claude-plugins/
├── .claude-plugin/marketplace.json   # lists every plugin below
├── README.md
├── LICENSE
└── plugins/
    └── better-rename/                 # a mod
        ├── .claude-plugin/plugin.json
        ├── hooks/                    # hooks.json, register.ts, lib.ts
        ├── tests/
        └── README.md
```

A skill plugin has `skills/<skill>/SKILL.md` in place of `hooks/`.

## Adding a plugin (for the maintainer)

1. Put it in `plugins/<name>/` with its own `.claude-plugin/plugin.json` (a mod adds `hooks/`, a skill adds `skills/<skill>/SKILL.md`).
2. Add an entry to `.claude-plugin/marketplace.json` with `"source": "./plugins/<name>"`.
3. Run `claude plugin validate .` and, for a mod, `claude plugin test plugins/<name>`.

## License

MIT
