import type { Register } from 'claude-code'

import { TEXT, digest, langOf, parseNames, system } from './lib'

const MODEL = 'sonnet'

export const register: Register = (on, options) => {
  const lang = langOf(options.language)
  const t = TEXT[lang]

  // The typeahead describes /rename by what it now does.
  on('command.describe', { command: 'rename' }, async ($, e, next) => {
    const base = await next(e)
    return { ...base, description: t.description }
  })

  // /rename <name>: the built-in, untouched. Bare /rename: suggest, pick, then the built-in with the pick.
  on('command.run', { command: 'rename' }, async ($, e, next) => {
    if (e.args.trim()) return next(e)

    const messages = await $.session.messages()
    if (messages.length === 0) return { text: t.empty }

    $.ui.status(t.status)
    const reply = await $.model.complete({
      model: MODEL,
      system: system(lang),
      prompt: `Suggest names for this session transcript.\n\n<session>\n${digest(messages)}\n</session>`,
      maxTokens: 400,
      effort: 'low',
      timeoutMs: 90_000,
    })
    $.ui.status(undefined)

    if (!reply.isAnswered) return { text: `${t.failed} (${reply.reason}).` }
    const names = parseNames(reply.text)
    if (names.length < 2) return { text: `${t.unparsed}: ${reply.text.slice(0, 200)}` }

    let choice: string
    try {
      choice = await $.ui.ask(t.question, { header: t.header, options: names })
    } catch {
      return { text: t.cancelled }
    }
    choice = choice.trim()
    if (!choice) return { text: t.blank }

    return next({ ...e, args: choice })
  }).catch(($, e, next) => next(e)) // on any failure of ours, the built-in /rename runs
}
