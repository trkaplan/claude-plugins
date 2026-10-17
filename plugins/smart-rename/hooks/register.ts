import type { ModelCompleteRequest, Register } from 'claude-code'

import { LIMITS, RETRY, TEXT, digest, estimateTokens, langOf, modelOf, parseNames, prompt, system } from './lib'

export const register: Register = (on, options) => {
  const lang = langOf(options.language)
  const model = modelOf(options.model)
  const t = TEXT[lang]
  // The session's current name, so suggestions differ from it: the title a resumed
  // session starts with, then every name /rename is given.
  let current: string | undefined

  on('classic.SessionStart', async ($, e, next) => {
    if (e.session_title) current = e.session_title
    return next(e)
  }).catch(($, e, next) => next(e))

  // The typeahead says the name is optional and what a bare run does.
  on('command.describe', { command: 'rename' }, async ($, e, next) => {
    const base = await next(e)
    return { ...base, description: t.description, argumentHint: t.hint }
  })

  const call = (text: string): ModelCompleteRequest => ({
    model,
    system: system(lang),
    prompt: text,
    maxTokens: 400,
    effort: 'low',
    timeoutMs: 90_000,
  })

  // /rename <name>: the built-in, untouched. Bare /rename: suggest, pick, then the built-in with the pick.
  on('command.run', { command: 'rename' }, async ($, e, next) => {
    const given = e.args.trim()
    if (given) {
      current = given
      return next(e)
    }

    const messages = await $.session.messages()
    const session = digest(messages)
    if (!session) return { text: t.empty }

    const request = prompt(session, current)
    const tokens = estimateTokens(request.length)
    if (tokens > LIMITS.warnTokens) {
      const go = await $.ui
        .ask(t.warn.replace('{tokens}', tokens.toLocaleString('en-US')).replace('{model}', model), { options: [t.go, t.stop] })
        .catch(() => t.stop)
      if (go !== t.go) return { text: t.cancelled }
    }

    let names: string[]
    $.ui.status(t.status)
    try {
      const reply = await $.model.complete(call(request))
      if (!reply.isAnswered) return { text: `${t.failed} (${reply.reason}).` }
      names = parseNames(reply.text, { current })
      if (names.length < 2) {
        const again = await $.model.complete(call(`${request}\n\n${RETRY}`))
        if (again.isAnswered) names = parseNames(again.text, { current })
      }
    } finally {
      $.ui.status(undefined)
    }
    if (names.length < 2) return { text: `${t.unparsed}.` }

    let choice: string
    try {
      choice = (await $.ui.ask(t.question, { header: t.header, options: names })).trim()
    } catch {
      return { text: t.cancelled }
    }
    if (!choice) return { text: t.blank }

    current = choice
    return next({ ...e, args: choice })
  }).catch(($, e, next) => next(e)) // on any failure of ours, the built-in /rename runs
}
