import { lookupLexical } from '@/features/ai/lexicon'
import { translateLocal } from '@/features/ai/translator'
import { api } from '@/services/api'
import { serviceError } from './errors'

export type AiTool =
  | 'translate'
  | 'grammar'
  | 'presentation'
  | 'debate'
  | 'speech'
  | 'practice_questions'
  | 'essay'
  | 'english_speak'
  | 'somali_speak'
  | 'discussion_topic'
  | 'english_knowledge'
  | 'multilingual_translate'

export type AiToolType =
  | 'translate'
  | 'grammar'
  | 'presentation'
  | 'debate'
  | 'speech'
  | 'practice_questions'
  | 'essay'
  | 'english_speaking'
  | 'somali_speaking'
  | 'discussion_topic'
  | 'multilingual_translate'

export interface AiInvokeOptions {
  direction?: 'so-en' | 'en-so' | 'auto'
  topic?: string
  level?: 'beginner' | 'intermediate' | 'advanced'
  count?: number
  conversationId?: string
}

export interface TranslateResult {
  tool: 'translate'
  original: string
  translation: string
  wordMeanings: Array<{ word: string; meaning: string }>
  alternatives?: string[]
  uncertainty?: string
  direction?: string
  dictionaryHints?: string[]
}

export interface AiInvokeResponse {
  success: boolean
  conversationId?: string
  result: TranslateResult | Record<string, unknown>
  error?: string
}

export interface AiResponse {
  original: string
  translation?: string
  meanings?: { word: string; meaning: string }[]
  alternatives?: string[]
  corrected?: string
  content?: string
  uncertainty?: string
  tips?: string[]
  wordMeanings?: Array<{ word: string; meanings?: string[]; meaning?: string; note?: string }>
  unknown?: string[]
  coverage?: number
  result?: unknown
}

export async function invokeAiAssistant(
  tool: AiTool,
  input: string,
  options?: AiInvokeOptions,
): Promise<AiInvokeResponse> {
  const { data, error } = await api.functions.invoke('ai-assistant', {
    body: { tool, input, options },
  })

  if (error) throw serviceError(error, 'AI assistant request failed')
  if (data?.error) throw new Error(String(data.error))
  return data as AiInvokeResponse
}

export async function translate(
  text: string,
  direction: 'so-en' | 'en-so' | 'auto' = 'auto',
  conversationId?: string,
) {
  return invokeAiAssistant('translate', text, { direction, conversationId })
}

export async function runAiTool(
  tool: AiToolType,
  prompt: string,
  opts?: { direction?: 'so-en' | 'en-so'; targetLang?: string; profileId?: string },
): Promise<AiResponse> {
  const mapped: AiTool =
    tool === 'english_speaking'
      ? 'english_speak'
      : tool === 'somali_speaking'
        ? 'somali_speak'
        : (tool as AiTool)

  const isTranslate = mapped === 'translate'
  const isMultilingual = mapped === 'multilingual_translate'
  const local =
    isTranslate && opts?.direction
      ? translateLocal(prompt, opts.direction)
      : isMultilingual && opts?.targetLang
        ? opts.targetLang.toLowerCase().includes('english')
          ? translateLocal(prompt, 'so-en')
          : opts.targetLang.toLowerCase().includes('somali')
            ? translateLocal(prompt, 'en-so')
            : undefined
        : undefined

  let failureCode: string | undefined

  try {
    const lexicalHints =
      mapped === 'translate' && opts?.direction ? lookupLexical(prompt, opts.direction) : undefined

    const { data, error } = await api.functions.invoke('ai-assistant', {
      body: {
        tool: mapped,
        prompt,
        direction: opts?.direction,
        targetLang: opts?.targetLang,
        lexicalHints,
      },
    })

    if (error || !data || data.error) {
      const dataCode = (data as { code?: string } | null)?.code
      const errorCode = (error as { context?: { code?: string } } | null)?.context?.code
      failureCode = dataCode ?? errorCode
      throw new Error('AI call failed')
    }
    const result = (data.result ?? data) as Record<string, unknown>
    const meaningsRaw = (result.wordMeanings ?? result.meanings) as
      | Array<{ word: string; meaning?: string; meanings?: string[] }>
      | undefined
    const aiMeanings =
      meaningsRaw?.map((m) => ({
        word: m.word,
        meaning: m.meaning ?? m.meanings?.join('; ') ?? '',
      })) ?? []

    const mergedMeanings = [
      ...(local?.wordMeanings ?? []),
      ...aiMeanings.filter(
        (m) => !(local?.wordMeanings ?? []).some((l) => l.word.toLowerCase() === m.word.toLowerCase()),
      ),
    ]

    if (isTranslate) {
      const aiTranslation = typeof result.translation === 'string' ? result.translation.trim() : ''
      return {
        original: prompt,
        translation: aiTranslation || local?.translation || prompt,
        meanings: mergedMeanings,
        wordMeanings: mergedMeanings,
        alternatives:
          aiTranslation && local && local.translation !== aiTranslation ? [local.translation] : undefined,
        uncertainty:
          typeof result.uncertainty === 'string'
            ? result.uncertainty
            : local && local.unknown.length
              ? `Dictionary does not cover: ${local.unknown.join(', ')}`
              : undefined,
        unknown: local?.unknown,
        coverage: local?.coverage,
        result,
      }
    }

    if (isMultilingual) {
      return {
        original: prompt,
        translation: typeof result.translation === 'string' ? result.translation : undefined,
        content:
          typeof result.translation === 'string'
            ? undefined
            : typeof result.content === 'string'
              ? result.content
              : undefined,
        uncertainty: typeof result.uncertainty === 'string' ? result.uncertainty : undefined,
        result,
      }
    }

    return {
      original: prompt,
      meanings: mergedMeanings,
      alternatives: Array.isArray(result.alternatives) ? (result.alternatives as string[]) : undefined,
      corrected: typeof result.corrected === 'string' ? result.corrected : undefined,
      content:
        typeof result.content === 'string'
          ? result.content
          : typeof result.output === 'string'
            ? result.output
            : undefined,
      uncertainty: typeof result.uncertainty === 'string' ? result.uncertainty : undefined,
      tips: Array.isArray(result.tips) ? (result.tips as string[]) : undefined,
      wordMeanings: mergedMeanings,
      result,
    }
  } catch {
    /* fallback below */
  }

  if (local) {
    return {
      original: prompt,
      translation: local.translation,
      meanings: local.wordMeanings,
      wordMeanings: local.wordMeanings,
      alternatives: [],
      uncertainty:
        (failureCode === 'AI_RATE_LIMITED'
          ? 'Gemini free-tier limit reached for now — showing dictionary translation. Try again in a minute. '
          : 'AI translator is temporarily unavailable — showing dictionary translation. ') +
        (local.unknown.length ? `Dictionary does not cover: ${local.unknown.join(', ')}` : ''),
      unknown: local.unknown,
      coverage: local.coverage,
    }
  }

  if (isMultilingual) {
    return {
      original: prompt,
      uncertainty:
        failureCode === 'AI_RATE_LIMITED'
          ? 'Gemini free-tier limit reached for this minute — please wait a moment and try again.'
          : 'AI translator is not available right now. Deploy the ai-assistant edge function with a GEMINI_API_KEY to use it.',
    }
  }

  return {
    original: prompt,
    content: `Working draft for ${tool}:\n\n${prompt}`,
    alternatives: [],
    uncertainty: 'AI edge function unavailable — showing local fallback.',
    tips: ['Deploy the ai-assistant edge function for full results.'],
  }
}

export async function listAiConversations(profileId: string) {
  const { data, error } = await api
    .from('ai_conversations')
    .select('*')
    .eq('profile_id', profileId)
    .order('updated_at', { ascending: false })

  if (error) throw serviceError(error, 'Failed to load AI conversations')
  return data ?? []
}

export async function getAiMessages(conversationId: string) {
  const { data, error } = await api
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) throw serviceError(error, 'Failed to load AI messages')
  return data ?? []
}
