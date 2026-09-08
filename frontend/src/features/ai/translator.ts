import { SOMALI_ENGLISH_LEXICON, ENGLISH_SOMALI_LEXICON, type LexEntry } from './lexicon'

export interface LocalWordMeaning {
  word: string
  meaning: string
  pos?: string
  note?: string
}

export interface LocalTranslation {
  translation: string
  wordMeanings: LocalWordMeaning[]
  unknown: string[]
  coverage: number
  direction: 'so-en' | 'en-so'
}

interface Token {
  text: string
  isWord: boolean
}

const WORD_RE = /[\p{L}\p{N}'-]+/gu

interface PhraseEntry {
  key: string
  words: string[]
  translation: string
  meaningObj: LocalWordMeaning
}

const SO_PHRASES: PhraseEntry[] = SOMALI_ENGLISH_LEXICON.filter((e) => e.so.includes(' '))
  .map((entry) => {
    const translation = entry.en.join(' / ')
    return {
      key: entry.so.toLowerCase(),
      words: entry.so.toLowerCase().split(/\s+/),
      translation,
      meaningObj: { word: entry.so, meaning: translation, pos: entry.pos, note: entry.note },
    }
  })
  .sort((a, b) => b.words.length - a.words.length)

const EN_PHRASES: PhraseEntry[] = []
for (const entry of SOMALI_ENGLISH_LEXICON) {
  for (const en of entry.en) {
    if (en.includes(' ') && !en.includes('(')) {
      EN_PHRASES.push({
        key: en.toLowerCase(),
        words: en.toLowerCase().split(/\s+/),
        translation: entry.so,
        meaningObj: { word: en.toLowerCase(), meaning: entry.so },
      })
    }
  }
}
EN_PHRASES.sort((a, b) => b.words.length - a.words.length)

const SO_SINGLE = new Map<string, LexEntry>()
for (const entry of SOMALI_ENGLISH_LEXICON) {
  if (!entry.so.includes(' ')) SO_SINGLE.set(entry.so.toLowerCase(), entry)
}

interface PhraseMatch {
  span: number
  key: string
  translation: string
  meaningObj: LocalWordMeaning
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  let last = 0
  for (const m of text.matchAll(WORD_RE)) {
    if (m.index! > last) tokens.push({ text: text.slice(last, m.index!), isWord: false })
    tokens.push({ text: m[0], isWord: true })
    last = m.index! + m[0].length
  }
  if (last < text.length) tokens.push({ text: text.slice(last), isWord: false })
  return tokens
}

function matchPhrase(tokens: Token[], start: number, direction: 'so-en' | 'en-so'): PhraseMatch | null {
  const phrases = direction === 'so-en' ? SO_PHRASES : EN_PHRASES
  for (const p of phrases) {
    let k = 0
    let j = start
    let ok = true
    while (k < p.words.length) {
      if (j >= tokens.length) {
        ok = false
        break
      }
      const tok = tokens[j]
      j++
      if (!tok.isWord) continue
      if (tok.text.toLowerCase() !== p.words[k]) {
        ok = false
        break
      }
      k++
    }
    if (ok && k === p.words.length) {
      return {
        span: j - start,
        key: p.key,
        translation: p.translation,
        meaningObj: p.meaningObj,
      }
    }
  }
  return null
}

const SO_DEFINITE_SUFFIXES = ['ga', 'ka', 'ta', 'da', 'ha']
const EN_INFLECTED_SUFFIXES = ['ing', 'es', 'ed', 's']

function lookupWord(
  token: string,
  direction: 'so-en' | 'en-so',
): { key: string; meaning: string; meaningObj: LocalWordMeaning } | null {
  const lower = token.toLowerCase()
  if (direction === 'so-en') {
    let entry = SO_SINGLE.get(lower)
    let matched = lower
    if (!entry) {
      for (const suffix of SO_DEFINITE_SUFFIXES) {
        if (lower.length > suffix.length + 2 && lower.endsWith(suffix)) {
          const base = lower.slice(0, -suffix.length)
          const candidate = SO_SINGLE.get(base)
          if (candidate) {
            entry = candidate
            matched = `${base} (${suffix})`
            break
          }
        }
      }
    }
    if (!entry) return null
    const meaning = entry.en.join(' / ')
    return {
      key: lower,
      meaning,
      meaningObj: {
        word: matched,
        meaning,
        pos: entry.pos,
        note: matched !== lower ? `infl. form of "${entry.so}"` : entry.note,
      },
    }
  }
  let so = ENGLISH_SOMALI_LEXICON[lower]
  let matched = lower
  if (!so) {
    for (const suffix of EN_INFLECTED_SUFFIXES) {
      if (lower.length > suffix.length + 2 && lower.endsWith(suffix)) {
        const base = lower.slice(0, -suffix.length)
        const candidate = ENGLISH_SOMALI_LEXICON[base]
        if (candidate) {
          so = candidate
          matched = base
          break
        }
      }
    }
  }
  if (!so || so.length === 0) return null
  const meaning = so.join(' / ')
  const note = SOMALI_ENGLISH_LEXICON.find((e) => e.en.some((x) => x.toLowerCase() === lower))?.note
  return { key: lower, meaning, meaningObj: { word: matched, meaning, note: matched !== lower ? `form of "${matched}"` : note } }
}

export function translateLocal(text: string, direction: 'so-en' | 'en-so'): LocalTranslation {
  const tokens = tokenize(text)
  const out: string[] = []
  const wordMeanings: LocalWordMeaning[] = []
  const seen = new Set<string>()
  const unknown: string[] = []
  let wordCount = 0
  let knownCount = 0

  const addMeaning = (key: string, obj: LocalWordMeaning) => {
    if (seen.has(key)) return
    seen.add(key)
    wordMeanings.push(obj)
  }

  let i = 0
  while (i < tokens.length) {
    const t = tokens[i]
    if (!t.isWord) {
      out.push(t.text)
      i++
      continue
    }
    wordCount++

    const phrase = matchPhrase(tokens, i, direction)
    if (phrase) {
      knownCount++
      out.push(phrase.translation)
      addMeaning(phrase.key, phrase.meaningObj)
      i += phrase.span
      continue
    }

    const hit = lookupWord(t.text, direction)
    if (hit) {
      knownCount++
      out.push(hit.meaning)
      addMeaning(hit.key, hit.meaningObj)
    } else {
      const lower = t.text.toLowerCase()
      if (!seen.has(lower)) {
        seen.add(lower)
        unknown.push(t.text)
      }
      out.push(t.text)
    }
    i++
  }

  return {
    translation: out.join('').replace(/[ \t]{2,}/g, ' ').trim(),
    wordMeanings,
    unknown: [...new Set(unknown)],
    coverage: wordCount === 0 ? 0 : knownCount / wordCount,
    direction,
  }
}
