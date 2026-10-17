import { expect, mock, test } from 'claude-code/testing'
import type { CommandRunInput, ModelUsage } from 'claude-code'

const run: CommandRunInput = {
  command: 'rename',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: false, columns: 120 },
}
const usage: ModelUsage = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }

test('bare /rename answers when the session is empty', async ($, on) => {
  on('session.messages', async () => ({ value: [] }))
  const r = await $.command.run(run)
  expect(r.text).toBe('The session has no messages yet, nothing to name.')
})

test('bare /rename sends the whole session to haiku and reports a failed call', async ($, on) => {
  let sent = ''
  let model = ''
  on('session.messages', async () => ({
    value: [
      { role: 'user' as const, text: 'first topic: login redirect', toolUses: [] },
      { role: 'assistant' as const, text: 'ok', toolUses: [] },
      { role: 'user' as const, text: 'last topic: dark mode toggle', toolUses: [] },
    ],
  }))
  on('model.complete', async (_$, e) => {
    sent = e.prompt
    model = e.model
    return { value: { isAnswered: false as const, reason: 'empty-reply' as const, usage } }
  })
  const r = await $.command.run(run)
  expect(model).toBe('haiku')
  expect(sent.includes('first topic: login redirect')).toBe(true)
  expect(sent.includes('last topic: dark mode toggle')).toBe(true)
  expect(r.text).toBe('Could not get name suggestions (empty-reply).')
})

test('a prose reply is retried once, then reported', async ($, on) => {
  let calls = 0
  on('session.messages', async () => ({ value: [{ role: 'user' as const, text: 'hello', toolUses: [] }] }))
  on('model.complete', async () => {
    calls++
    return { value: { isAnswered: true as const, text: 'Sure! Here are some ideas for you.', usage } }
  })
  const r = await $.command.run(run)
  expect(calls).toBe(2)
  expect(r.text).toBe('The model did not return usable names.')
})

test('/rename with a name passes straight to the built-in', async ($, on) => {
  let got = ''
  on('command.run', async (_$, e) => {
    got = e.args
    return { text: 'renamed' }
  })
  const r = await $.command.run({ ...run, args: 'my-name' })
  expect(got).toBe('my-name')
  expect(r.text).toBe('renamed')
})

test('language tr and model sonnet', { options: { language: 'tr', model: 'sonnet' } }, async ($, on) => {
  let model = ''
  on('session.messages', async () => ({ value: [{ role: 'user' as const, text: 'merhaba', toolUses: [] }] }))
  on('model.complete', async (_$, e) => {
    model = e.model
    return { value: { isAnswered: false as const, reason: 'empty-reply' as const, usage } }
  })
  const r = await $.command.run(run)
  expect(model).toBe('sonnet')
  expect(r.text).toBe('İsim önerisi alınamadı (empty-reply).')
})

test('a picked title runs the built-in /rename with it', async ($, on) => {
  const runs: string[] = []
  on('session.messages', async () => ({ value: [{ role: 'user' as const, text: 'login redirect', toolUses: [] }] }))
  on('model.complete', async () => ({
    value: { isAnswered: true as const, text: '{"names":["Fix login redirect bug","Add dark mode toggle"]}', usage },
  }))
  const clock = mock.clock(on)
  on('tool.call', { tool: 'AskUserQuestion' }, async (_$, e) => {
    const q = (e as unknown as { questions: { question: string; options: { label: string }[] }[] }).questions[0]
    return { result: { questions: [q], answers: { [q.question]: q.options[0].label } } } as never
  })
  on('command.run', async (_$, e, next) => {
    if (e.args) {
      runs.push(e.args)
      return { text: 'renamed' }
    }
    return next(e)
  })
  await $.command.run(run)
  await clock.advance(1)
  expect(runs).toEqual(['Fix login redirect bug'])
})

test('format kebab-case asks for kebab names', { options: { format: 'kebab-case' } }, async ($, on) => {
  let system = ''
  on('session.messages', async () => ({ value: [{ role: 'user' as const, text: 'hello', toolUses: [] }] }))
  on('model.complete', async (_$, e) => {
    system = e.system ?? ''
    return { value: { isAnswered: false as const, reason: 'empty-reply' as const, usage } }
  })
  await $.command.run(run)
  expect(system.includes('kebab-case')).toBe(true)
})
