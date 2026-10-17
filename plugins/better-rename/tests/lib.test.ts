import { describe, expect, test } from 'claude-code/testing'
import type { SessionMessage } from 'claude-code'

import { LIMITS, clean, digest, normalize, parseNames, system, title } from '../hooks/lib'

const msg = (role: 'user' | 'assistant', text: string): SessionMessage => ({ role, text, toolUses: [] })

describe('parseNames (kebab)', () => {
  const kebab = { style: 'kebab' as const }
  test('reads the JSON object and normalizes', () => {
    const names = parseNames('{"names": ["Giriş yönlendirme hatası", "karanlik-tema-ayari", "karanlik-tema-ayari", "x"]}', kebab)
    expect(names).toEqual(['giris-yonlendirme-hatasi', 'karanlik-tema-ayari'])
  })

  test('reads a bare array', () => {
    expect(parseNames('["alpha-beta","gamma-delta"]', kebab)).toEqual(['alpha-beta', 'gamma-delta'])
  })

  test('falls back only to kebab-case lines, never to prose', () => {
    const reply = 'Here are four suggestions:\n1. webpack-build-fix\n- `fix-login-redirect-bug`\nI hope these help!'
    expect(parseNames(reply, kebab)).toEqual(['webpack-build-fix', 'fix-login-redirect-bug'])
  })

  test('does not glue two brackets together', () => {
    expect(parseNames('["a-b-c","d-e-f"] and also [note]', kebab)).toEqual(['a-b-c', 'd-e-f'])
  })

  test('drops generic names and the current name', () => {
    expect(parseNames('{"names":["new-session","old-name","fresh-name"]}', { ...kebab, current: 'Old Name' })).toEqual(['fresh-name'])
  })

  test('keeps leading digits', () => {
    expect(parseNames('{"names":["2fa-rollout","2024-budget-migration"]}', kebab)).toEqual(['2fa-rollout', '2024-budget-migration'])
  })
})

describe('parseNames (title)', () => {
  test('keeps the title as written, Turkish letters included', () => {
    const names = parseNames('{"names": ["Karanlık tema ayarı", "Giriş yönlendirme hatası."]}')
    expect(names).toEqual(['Karanlık tema ayarı', 'Giriş yönlendirme hatası'])
  })

  test('drops repeats, generic names and the current name without regard to case', () => {
    const names = parseNames('{"names":["New session","Old name","Fresh name","fresh-name","Another one"]}', { current: 'old-name' })
    expect(names).toEqual(['Fresh name', 'Another one'])
  })

  test('falls back to listed lines, never to prose', () => {
    const reply = 'Here are four suggestions:\n1. Webpack build fix\n- "Fix login redirect bug"\nI hope these help!'
    expect(parseNames(reply)).toEqual(['Webpack build fix', 'Fix login redirect bug'])
  })

  test('cuts a long title at a word boundary', () => {
    expect(title('One two three four five six seven eight nine ten eleven twelve thirteen')).toBe('One two three four five six seven eight nine ten eleven')
  })

  test('the system prompt follows the style', () => {
    expect(system('tr', 'title').includes('Turkish letters kept')).toBe(true)
    expect(system('tr', 'kebab').includes('kebab-case')).toBe(true)
  })
})

describe('normalize', () => {
  test('converts Turkish characters and strips accents', () => {
    expect(normalize('Çiğ Şöğüş İsim')).toBe('cig-sogus-isim')
    expect(normalize('Café Déjà Vu')).toBe('cafe-deja-vu')
  })
})

describe('digest', () => {
  test('keeps every earlier prompt, and the recent turns with replies', () => {
    const many = Array.from({ length: 60 }, (_, i) => [msg('user', `prompt-${i}`), msg('assistant', `reply-${i}`)]).flat()
    const out = digest(many)
    expect(out.includes('1. prompt-0')).toBe(true)
    expect(out.includes('prompt-51')).toBe(true)
    expect(out.includes('reply-10')).toBe(false)
    expect(out.includes('ASSISTANT: reply-59')).toBe(true)
  })

  test('sends a compaction summary whole', () => {
    const summary = `This session is being continued from a previous conversation. ${'s'.repeat(8_000)} END-OF-SUMMARY`
    const out = digest([msg('user', summary), msg('user', 'next prompt'), msg('assistant', 'ok')])
    expect(out.includes('END-OF-SUMMARY')).toBe(true)
    expect(out.includes('s'.repeat(8_000))).toBe(true)
  })

  test('cuts the middle of a pasted file in an earlier prompt', () => {
    const paste = `HEAD ${'x'.repeat(50_000)} TAIL`
    const turns = [msg('user', paste), ...Array.from({ length: LIMITS.recentTurns }, (_, i) => msg('user', `p${i}`))]
    const out = digest(turns)
    expect(out.includes('HEAD')).toBe(true)
    expect(out.includes('TAIL')).toBe(true)
    expect(out.length < 2_000).toBe(true)
  })

  test('drops engine wrappers', () => {
    expect(clean('<system-reminder>secret</system-reminder> hello <local-command-stdout>x</local-command-stdout>')).toBe('hello')
    expect(clean('<command-name>/rename</command-name> <command-message>rename</command-message> <command-args>foo</command-args>')).toBe('/rename foo')
  })
})
