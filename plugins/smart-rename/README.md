# smart-rename

A Claude Code mod that makes `/rename` suggest names from the whole session.

- **`/rename`** run bare (the name is optional) reads the **whole** session, asks a model for 4 names, and shows them in a picker. Move with the arrow keys and press Enter to rename. Type your own under **Other**; a typed name is used exactly as you wrote it.
- **`/rename my-name`** works exactly like the built-in.
- If anything in the mod fails, the built-in `/rename` runs instead.

Type `/ren` and Tab: there is only one `/rename`, and the menu says the name is optional.

## Install

```
/plugin install smart-rename --marketplace trkaplan/claude-plugins
```

Answer `y` to add the marketplace and pick a scope (user scope = every session). Requires a Claude Code build with mods (function hooks); built and tested on 2.1.296.

## Options

| Option | Values | Default | What it sets |
| --- | --- | --- | --- |
| `language` | `en`, `tr` | `en` | Language of the suggested names and the mod's messages |
| `model` | `haiku`, `sonnet` | `haiku` | Model that suggests the names |

Change them in `/config` or during install.

## What the model sees

The session is condensed before it is sent, so a long session stays cheap while its beginning is never dropped:

1. **Compaction summaries, whole.** After `/compact` the earlier history lives in one summary; it is sent in full.
2. **Every earlier prompt you typed, in short.** Prompts are usually short, so most go whole. A long one (a pasted file, a log) keeps its first 450 and last 150 characters.
3. **The last 8 turns in full:** each prompt (up to 3,000 characters) with the assistant's reply (up to 2,000) and the names of the tools it used.

Engine wrappers (system reminders, command output) are left out. Above about 30,000 estimated tokens the mod asks before it sends anything.

The reply must be a JSON object of 4 kebab-case names. Every name is checked (lowercase letters, digits, hyphens; generic names like `new-session` and the session's current name are dropped). If fewer than 2 survive, the model is asked once more; prose is never offered as a name.

## Cost and privacy

Every bare `/rename` makes one model call (two if the first reply is unusable) with the condensed session described above: your prompts, the assistant's replies and tool names. The call goes to the same provider and account your session already uses, and is billed like any other request. With the default `haiku` model a typical call is a few thousand tokens. `/rename <name>` sends nothing.

## Development

```
claude plugin validate plugins/smart-rename
claude plugin test plugins/smart-rename
```
