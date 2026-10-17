import type { SessionMessage } from 'claude-code'

export type Lang = 'en' | 'tr'

// Total character budget of the digest sent to the model.
const BUDGET = 60_000
const USER_CAP = 1_500
const ASSISTANT_CAP = 300

const clip = (text: string, cap: number) =>
  text.length <= cap ? text : `${text.slice(0, cap)} [...]`

// Condenses the whole session: user messages generously, assistant messages
// briefly, tool calls by name only. Over budget, every message is shortened
// proportionally, so topics from the start to the end all reach the model.
export function digest(messages: readonly SessionMessage[]): string {
  const build = (scale: number) =>
    messages
      .map(m => {
        const tools = m.toolUses.map(t => t.tool).join(', ')
        const cap = Math.max(40, Math.floor((m.role === 'user' ? USER_CAP : ASSISTANT_CAP) * scale))
        const text = clip(m.text.trim(), cap)
        if (!text && !tools) return ''
        const who = m.role === 'user' ? 'USER' : 'ASSISTANT'
        return `${who}: ${text}${tools ? ` (tools: ${tools})` : ''}`
      })
      .filter(Boolean)
      .join('\n')

  let scale = 1
  let out = build(scale)
  while (out.length > BUDGET && scale > 0.05) {
    scale *= 0.7
    out = build(scale)
  }
  return out.length > BUDGET ? out.slice(0, BUDGET) : out
}

const LANGUAGE_RULE: Record<Lang, string> = {
  en: '- English, lowercase, words joined by hyphens (kebab-case), ASCII only.',
  tr: '- Turkish, lowercase, words joined by hyphens (kebab-case), ASCII only: write Turkish letters plainly (ı->i, ş->s, ğ->g, ü->u, ö->o, ç->c).',
}

export function system(lang: Lang): string {
  return `You suggest names for a Claude Code session.
Rules:
- Consider the WHOLE session, not only the last messages. If it spans several topics, also suggest names that cover the main ones.
${LANGUAGE_RULE[lang]}
- Each name 2-7 words, at most 60 characters. Be concrete: use tool, project and topic names.
- Give 4 distinct suggestions: one covering the whole session, the others with different emphasis.
- Return only a JSON array and nothing else. Example: ["topic-one","topic-two","topic-three","topic-four"]`
}

export const TEXT: Record<Lang, Record<'empty' | 'status' | 'failed' | 'unparsed' | 'question' | 'header' | 'cancelled' | 'blank' | 'description', string>> = {
  en: {
    empty: 'The session has no messages yet, nothing to name.',
    status: 'rename: preparing suggestions...',
    failed: 'Could not get name suggestions',
    unparsed: 'Could not read the model reply',
    question: 'Which name for this session? (type your own under Other)',
    header: 'Name',
    cancelled: 'Rename cancelled.',
    blank: 'Empty name, nothing changed.',
    description: 'Without a name: reads the whole session and offers 4 names; with a name: renames directly',
  },
  tr: {
    empty: 'Oturumda henuz mesaj yok, isim onerilemiyor.',
    status: 'rename: oneriler hazirlaniyor...',
    failed: 'Isim onerisi alinamadi',
    unparsed: 'Modelin cevabi anlasilamadi',
    question: 'Bu oturum icin hangi isim? (Other ile kendin yazabilirsin)',
    header: 'Isim',
    cancelled: 'Isim secimi iptal edildi.',
    blank: 'Bos isim, degisiklik yapilmadi.',
    description: 'Isim vermezsen oturumun tamamina bakip 4 isim onerir; isimle yazarsan dogrudan o isimle adlandirir',
  },
}

export const langOf = (value: unknown): Lang => (value === 'tr' ? 'tr' : 'en')

// Pulls the name list out of the model reply; falls back to lines when the JSON is broken.
export function parseNames(reply: string, max = 4): string[] {
  const match = reply.match(/\[[\s\S]*\]/)
  let raw: unknown[] = []
  if (match) {
    try {
      const parsed: unknown = JSON.parse(match[0])
      if (Array.isArray(parsed)) raw = parsed
    } catch {
      raw = []
    }
  }
  if (raw.length === 0) raw = reply.split('\n')
  const names = raw
    .filter((x): x is string => typeof x === 'string')
    .map(normalize)
    .filter(n => n.length >= 3)
  return [...new Set(names)].slice(0, max)
}

const TR: Record<string, string> = { ı: 'i', İ: 'i', ş: 's', Ş: 's', ğ: 'g', Ğ: 'g', ü: 'u', Ü: 'u', ö: 'o', Ö: 'o', ç: 'c', Ç: 'c' }

export function normalize(name: string): string {
  return name
    .replace(/[ıİşŞğĞüÜöÖçÇ]/g, c => TR[c] ?? c)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^[\s\-*\d.)"'`]+/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
}
