import { expect, test } from 'claude-code/testing'
import type { CommandRunInput, ModelUsage } from 'claude-code'

const run: CommandRunInput = {
  command: 'rename',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: false, columns: 120 },
}
const usage: ModelUsage = {
  input_tokens: 0,
  output_tokens: 0,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
}

test('/rename (no args) answers when the session is empty', async ($, on) => {
  on('session.messages', async () => ({ value: [] }))
  const r = await $.command.run(run)
  expect(r.text).toBe('The session has no messages yet, nothing to name.')
})

test('/rename (no args) sends the whole session to the model and reports a failed call', async ($, on) => {
  let sent = ''
  on('session.messages', async () => ({
    value: [
    { role: 'user' as const, text: 'ilk konu: session buddy', toolUses: [] },
    { role: 'assistant' as const, text: 'tamam', toolUses: [] },
    { role: 'user' as const, text: 'son konu: chrome gecmisi', toolUses: [] },
    ],
  }))
  on('model.complete', async (_$, e) => {
    sent = e.prompt
    return { value: { isAnswered: false as const, reason: 'empty-reply' as const, usage } }
  })
  const r = await $.command.run(run)
  expect(sent.includes('ilk konu: session buddy')).toBe(true)
  expect(sent.includes('son konu: chrome gecmisi')).toBe(true)
  expect(r.text).toBe('Could not get name suggestions (empty-reply).')
})

test('/rename with a name passes straight to the original', async ($, on) => {
  let got = ''
  on('command.run', async (_$, e) => {
    got = e.args
    return { text: 'renamed' }
  })
  const r = await $.command.run({ ...run, args: 'benim-ismim' })
  expect(got).toBe('benim-ismim')
  expect(r.text).toBe('renamed')
})

test('language tr answers in Turkish', { options: { language: 'tr' } }, async ($, on) => {
  on('session.messages', async () => ({ value: [] }))
  const r = await $.command.run(run)
  expect(r.text).toBe('Oturumda henuz mesaj yok, isim onerilemiyor.')
})
