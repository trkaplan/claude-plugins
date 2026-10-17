import type { ModelCompleteRequest, Register } from 'claude-code'

import { LIMITS, TEXT, digest, estimateTokens, langOf, modelOf, parseNames, prompt, retry, styleOf, system } from './lib'

export const register: Register = (on, options) => {
  const lang = langOf(options.language)
  const model = modelOf(options.model)
  const style = styleOf(options.format)
  const t = TEXT[lang]
  // The session's current name, so suggestions differ from it: every name /rename is given.
  let current: string | undefined

  // The typeahead says the name is optional and what a bare run does.
  on('command.describe', { command: 'rename' }, async ($, e, next) => {
    const base = await next(e)
    return { ...base, description: t.description, argumentHint: t.hint }
  })

  const call = (text: string): ModelCompleteRequest => ({
    model,
    system: system(lang, style),
    prompt: text,
    maxTokens: 400,
    effort: 'low',
    timeoutMs: 90_000,
  })

  // /rename <name>: the built-in, untouched. Bare /rename: suggest and pick, then run the
  // built-in /rename <pick> as a command of its own; the event is never rewritten.
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
      if (go !== t.go) return { text: t.warnCancelled }
    }

    let names: string[]
    $.ui.status(t.status)
    try {
      const reply = await $.model.complete(call(request))
      if (!reply.isAnswered) return { text: `${t.failed} (${reply.reason}).` }
      names = parseNames(reply.text, { current, style })
      if (names.length < 2) {
        const again = await $.model.complete(call(`${request}\n\n${retry(style)}`))
        if (again.isAnswered) names = parseNames(again.text, { current, style })
      }
    } finally {
      $.ui.status(undefined)
    }
    if (names.length < 2) return { text: `${t.unparsed}.` }

    let choice: string
    try {
      choice = (await $.ui.ask(t.question, { header: t.header, options: names })).trim()
    } catch (err: unknown) {
      return { text: `${t.cancelled} (${err instanceof Error ? err.message : String(err)})` }
    }
    if (!choice) return { text: t.blank }

    current = choice
    // After this run ends, so the built-in runs once the session is idle, as if typed.
    $.clock.after(0, () => {
      $.command.run({ command: 'rename', args: choice }).catch((err: unknown) => $.ui.log(`better-rename: ${String(err)}`))
    })
    return {}
  }).catch(($, e, next) => next(e)) // on any failure of ours, the built-in /rename runs
}
