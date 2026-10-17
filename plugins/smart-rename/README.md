# smart-rename

A Claude Code mod that makes `/rename` suggest names.

The built-in `/rename` without a name only looks at the last few messages. With this mod:

- **`/rename`** (no name) reads the **whole** session, asks Sonnet for 4 names, and shows them in a picker. Move with the arrow keys and press Enter to rename. Type your own under **Other**.
- **`/rename my-name`** works exactly like the built-in.
- If anything in the mod fails, the built-in `/rename` runs instead.

Type `/ren` and Tab: there is only one `/rename`, and its description in the menu says what it does now.

## Install

```
/plugin install smart-rename --marketplace trkaplan/claude-plugins
```

Answer `y` to add the marketplace and pick a scope (user scope = every session).

## Options

| Option | Values | Default |
| --- | --- | --- |
| `language` | `en`, `tr` | `en` |

`language` sets the language of the suggested names and the mod's messages. Change it in `/config` or during install.

## How it works

The mod hooks the `rename` command. With arguments it passes straight through. Without, it condenses the session (user messages up to 1,500 characters, assistant messages up to 300, tool calls by name, everything shortened proportionally past 60,000 characters so the beginning of the session is never dropped), makes one `$.model.complete` call, and runs the built-in `/rename` with the name you pick.

The picker is Claude Code's own question dialog, which holds at most 4 options plus Other.

## Development

```
claude plugin validate plugins/smart-rename
claude plugin test plugins/smart-rename
```

Requires a Claude Code build with mods (function hooks).
