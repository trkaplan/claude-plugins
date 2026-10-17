import type { SessionMessage } from 'claude-code'

export type Lang = 'en' | 'tr'

// How the session is condensed for the model (sized for Haiku's 200k window).
export const LIMITS = {
  // Last N prompts are sent with their replies.
  recentTurns: 8,
  // An earlier prompt: its head and tail survive, a pasted file in between is cut.
  earlierHead: 450,
  earlierTail: 150,
  // A recent prompt and the replies to it.
  recentPromptHead: 2_400,
  recentPromptTail: 600,
  replyHead: 1_200,
  replyTail: 800,
  // Above this estimate the person is asked before the call is made.
  warnTokens: 30_000,
  // Hard ceiling of the whole digest.
  maxChars: 400_000,
}

// A compaction summary stands in for the history before it: it is sent whole.
const SUMMARY = /^\s*(this session is being continued from a previous conversation|<summary>)/i

// Engine wrappers that are not the person's own words.
const NOISE = /<(system-reminder|local-command-stdout|local-command-caveat|task-notification)>[\s\S]*?<\/\1>/g

export function clean(text: string): string {
  return text
    .replace(NOISE, ' ')
    .replace(/<command-name>([\s\S]*?)<\/command-name>[\s\S]*?<command-args>([\s\S]*?)<\/command-args>/g, '$1 $2')
    .replace(/<command-(message|name|args)>[\s\S]*?<\/command-\1>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function headTail(text: string, head: number, tail: number): string {
  if (text.length <= head + tail + 20) return text
  const cut = text.length - head - tail
  return `${text.slice(0, head)} [... ${cut} characters cut ...] ${text.slice(-tail)}`
}

type Turn = { prompt: string; replies: string[]; tools: string[] }

// Groups the transcript into turns: a prompt the person typed, and what came back until the next one.
export function turns(messages: readonly SessionMessage[]): { summaries: string[]; turns: Turn[] } {
  const summaries: string[] = []
  const out: Turn[] = []
  for (const m of messages) {
    if (m.role === 'user') {
      if (SUMMARY.test(m.text)) {
        summaries.push(m.text.trim())
        continue
      }
      const text = clean(m.text)
      if (text) out.push({ prompt: text, replies: [], tools: [] })
      continue
    }
    const last = out.at(-1)
    if (!last) continue
    const text = clean(m.text)
    if (text) last.replies.push(text)
    for (const use of m.toolUses) if (!last.tools.includes(use.tool)) last.tools.push(use.tool)
  }
  return { summaries, turns: out }
}

// The digest: every compaction summary whole, every earlier prompt in short,
// the last few prompts with their replies.
export function digest(messages: readonly SessionMessage[], limits = LIMITS): string {
  const { summaries, turns: all } = turns(messages)
  const recentFrom = Math.max(0, all.length - limits.recentTurns)

  const build = (scale: number) => {
    const parts: string[] = []
    if (summaries.length) parts.push(`<compaction-summary>\n${summaries.join('\n\n')}\n</compaction-summary>`)
    const earlier = all.slice(0, recentFrom)
    if (earlier.length) {
      const head = Math.max(60, Math.floor(limits.earlierHead * scale))
      const tail = Math.floor(limits.earlierTail * scale)
      parts.push(
        `<earlier-prompts>\n${earlier.map((t, i) => `${i + 1}. ${headTail(t.prompt, head, tail)}`).join('\n')}\n</earlier-prompts>`,
      )
    }
    const recent = all.slice(recentFrom)
    if (recent.length) {
      const lines = recent.map(t => {
        const prompt = headTail(t.prompt, limits.recentPromptHead, limits.recentPromptTail)
        const reply = headTail(t.replies.join(' '), limits.replyHead, limits.replyTail)
        const tools = t.tools.length ? `\nTOOLS: ${t.tools.join(', ')}` : ''
        return `USER: ${prompt}${reply ? `\nASSISTANT: ${reply}` : ''}${tools}`
      })
      parts.push(`<recent-turns>\n${lines.join('\n\n')}\n</recent-turns>`)
    }
    return parts.join('\n\n')
  }

  let scale = 1
  let out = build(scale)
  while (out.length > limits.maxChars && scale > 0.1) {
    scale *= 0.7
    out = build(scale)
  }
  return out.length > limits.maxChars ? out.slice(-limits.maxChars) : out
}

// A rough token estimate: about 3.5 characters per token across English and Turkish text.
export const estimateTokens = (chars: number) => Math.ceil(chars / 3.5)

export type Style = 'title' | 'kebab'

const FORMAT_RULE: Record<Style, Record<Lang, string>> = {
  title: {
    en: '- English, written as a short title in sentence case: words separated by spaces, first word and proper names capitalized, no trailing period.',
    tr: '- Turkish, written as a short title in sentence case: words separated by spaces, first word and proper names capitalized, Turkish letters kept (ı, ş, ğ, ü, ö, ç), no trailing period.',
  },
  kebab: {
    en: '- English, lowercase, words joined by hyphens (kebab-case), ASCII only.',
    tr: '- Turkish, lowercase, words joined by hyphens (kebab-case), ASCII only: write Turkish letters plainly (ı->i, ş->s, ğ->g, ü->u, ö->o, ç->c).',
  },
}

const EXAMPLE: Record<Style, { good: string; bad: string; reply: string }> = {
  title: {
    good: 'Fix webpack build error',
    bad: 'Fix a build problem',
    reply: '{"names": ["First name", "Second name", "Third name", "Fourth name"]}',
  },
  kebab: {
    good: 'fix-webpack-build-error',
    bad: 'fix-a-build-problem',
    reply: '{"names": ["name-one", "name-two", "name-three", "name-four"]}',
  },
}

export function system(lang: Lang, style: Style = 'title'): string {
  const ex = EXAMPLE[style]
  return `You suggest names for a Claude Code session, so its owner can find it again later.
The input holds the whole session: a compaction summary if the session was compacted, every earlier prompt of the user in short, and the last turns in full.
Rules:
- Name what the WHOLE session was about, not only its last turns. If it spans several topics, cover the main ones.
${FORMAT_RULE[style][lang]}
- Each name 2-7 words, at most 60 characters, searchable and specific.
- Keep technical terms, tool, product, project and file names (e.g. "${ex.good}", not "${ex.bad}").
- No generic names ("New session", "Untitled", "Chat", "Misc", "General questions").
- Never put personal data or secrets in a name (emails, tokens, passwords, keys).
- If a current name is given, every suggestion must differ from it.
- Give 4 distinct suggestions: one covering the whole session, the others with different emphasis.
- Reply with exactly one JSON object and nothing else: ${ex.reply}`
}

export function prompt(session: string, current?: string): string {
  const name = current ? `<current-name>${current}</current-name>\n\n` : ''
  return `${name}<session>\n${session}\n</session>\n\nReply with the JSON object only.`
}

export const retry = (style: Style = 'title') =>
  `Your previous reply could not be parsed. Reply with ONLY {"names": [...]} holding 4 ${style === 'kebab' ? 'kebab-case names' : 'short titles'}.`

type Key =
  | 'empty' | 'status' | 'failed' | 'unparsed' | 'question' | 'header' | 'cancelled' | 'blank'
  | 'description' | 'hint' | 'warn' | 'go' | 'stop' | 'warnCancelled'

export const TEXT: Record<Lang, Record<Key, string>> = {
  en: {
    empty: 'The session has no messages yet, nothing to name.',
    status: 'rename: preparing suggestions...',
    failed: 'Could not get name suggestions',
    unparsed: 'The model did not return usable names',
    question: 'Which name for this session?',
    header: 'Name',
    cancelled: 'Rename cancelled.',
    blank: 'Empty name, nothing changed.',
    description: 'Run it bare: suggests 4 names from the whole session. Or give a name to rename directly',
    hint: '[name] optional',
    warn: 'Suggesting names will send about {tokens} tokens to {model}. Continue?',
    go: 'Continue',
    stop: 'Cancel',
    warnCancelled: 'Cancelled at the token warning, nothing was sent.',
  },
  tr: {
    empty: 'Oturumda henüz mesaj yok, isim önerilemiyor.',
    status: 'rename: öneriler hazırlanıyor...',
    failed: 'İsim önerisi alınamadı',
    unparsed: 'Model kullanılabilir isim döndürmedi',
    question: 'Bu oturum için hangi isim?',
    header: 'İsim',
    cancelled: 'İsim seçimi iptal edildi.',
    blank: 'Boş isim, değişiklik yapılmadı.',
    description: 'Boş çalıştır: oturumun tamamına bakıp 4 isim önerir. İsim verirsen doğrudan o isimle adlandırır',
    hint: '[isim] opsiyonel',
    warn: 'İsim önerisi için yaklaşık {tokens} token {model} modeline gönderilecek. Devam edilsin mi?',
    go: 'Devam',
    stop: 'İptal',
    warnCancelled: 'Token uyarısında iptal edildi, hiçbir şey gönderilmedi.',
  },
}

export const langOf = (value: unknown): Lang => (value === 'tr' ? 'tr' : 'en')
export const styleOf = (value: unknown): Style => (value === 'kebab-case' ? 'kebab' : 'title')
export const modelOf = (value: unknown): 'haiku' | 'sonnet' => (value === 'sonnet' ? 'sonnet' : 'haiku')

const NAME = /^[a-z0-9]+(?:-[a-z0-9]+){1,9}$/
const GENERIC = new Set(['new-session', 'new-thread', 'untitled', 'untitled-session', 'no-title', 'general-chat', 'misc', 'chat-session'])

// The names in a model reply: the JSON object (or a bare array), else only lines that
// already look like names (kebab-case, or a listed or quoted title), so a prose sentence
// never becomes an option. Generic names and the current name are compared by their
// kebab form, so case and punctuation never make a repeat look new.
export function parseNames(reply: string, options: { current?: string; max?: number; style?: Style } = {}): string[] {
  const max = options.max ?? 4
  const style = options.style ?? 'title'
  let raw: string[] = []
  const json = reply.match(/\{[^{}]*\}/)?.[0] ?? reply.match(/\[[^[\]]*\]/)?.[0]
  if (json) {
    try {
      const parsed: unknown = JSON.parse(json)
      const list: unknown = Array.isArray(parsed) ? parsed : (parsed as { names?: unknown }).names
      if (Array.isArray(list)) raw = list.filter((x): x is string => typeof x === 'string')
    } catch {
      raw = []
    }
  }
  if (raw.length === 0) {
    raw = reply
      .split('\n')
      .map(line => line.trim())
      .flatMap(line => {
        const listed = /^(?:[-*]\s+|\d+[.)]\s+)/.test(line) || /^["'`]/.test(line)
        const bare = line.replace(/^(?:[-*]\s+|\d+[.)]\s+)/, '').replace(/^["'`]+|["'`,]+$/g, '')
        if (/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+$/.test(bare)) return [bare]
        return style === 'title' && listed && !/[:?!]$/.test(bare) ? [bare] : []
      })
  }
  const current = options.current ? normalize(options.current) : undefined
  const seen = new Set<string>()
  const names: string[] = []
  for (const r of raw) {
    const key = normalize(r)
    if (!NAME.test(key) || GENERIC.has(key) || key === current || seen.has(key)) continue
    const name = style === 'kebab' ? key : title(r)
    if (!name) continue
    seen.add(key)
    names.push(name)
  }
  return names.slice(0, max)
}

// A title as shown: one line, single spaces, no wrapping quotes or trailing period, at
// most 60 characters cut at a word boundary.
export function title(name: string): string {
  let t = name
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/[.。]+$/, '')
    .trim()
  if (t.length > 60) t = t.slice(0, 61).replace(/\s+\S*$/, '').trim()
  return t
}

const TR: Record<string, string> = { ı: 'i', İ: 'i', ş: 's', Ş: 's', ğ: 'g', Ğ: 'g', ü: 'u', Ü: 'u', ö: 'o', Ö: 'o', ç: 'c', Ç: 'c' }

export function normalize(name: string): string {
  return name
    .replace(/[ıİşŞğĞüÜöÖçÇ]/g, c => TR[c] ?? c)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
}
