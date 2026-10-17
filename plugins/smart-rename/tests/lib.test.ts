import { describe, expect, test } from 'claude-code/testing'
import type { SessionMessage } from 'claude-code'

import { digest, normalize, parseNames } from '../hooks/lib'

const msg = (role: 'user' | 'assistant', text: string): SessionMessage => ({ role, text, toolUses: [] })

describe('smart-rename', () => {
  test('parseNames reads a JSON array and normalizes', () => {
    const names = parseNames('Iste: ["Session Buddy Eylül kaydı", "chrome-gecmis-arsivi", "chrome-gecmis-arsivi", "x"]')
    expect(names).toEqual(['session-buddy-eylul-kaydi', 'chrome-gecmis-arsivi'])
  })

  test('parseNames falls back to lines', () => {
    expect(parseNames('1. birinci-isim\n2. ikinci isim\n')).toEqual(['birinci-isim', 'ikinci-isim'])
  })

  test('normalize strips accents', () => {
    expect(normalize('Café Déjà Vu')).toBe('cafe-deja-vu')
  })

  test('normalize converts Turkish characters', () => {
    expect(normalize('Çiğ Şöğüş İsim')).toBe('cig-sogus-isim')
  })

  test('digest keeps the start and the end of a long session', () => {
    const many = Array.from({ length: 400 }, (_, i) => msg(i % 2 ? 'assistant' : 'user', `konu-${i} ${'a'.repeat(2000)}`))
    const out = digest(many)
    expect(out.length <= 60_000).toBe(true)
    expect(out.includes('konu-0 ')).toBe(true)
    expect(out.includes('konu-398 ')).toBe(true)
  })
})
