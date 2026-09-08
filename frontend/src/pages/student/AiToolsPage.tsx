import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Languages,
  SpellCheck,
  Presentation,
  Swords,
  Mic,
  ListChecks,
  PenLine,
  MessageSquare,
  Volume2,
  MessagesSquare,
  ArrowLeftRight,
  Copy,
  Check,
  BookOpen,
  Sparkles,
  AlertTriangle,
  CornerDownLeft,
  Globe,
} from 'lucide-react'
import { toast } from 'sonner'
import { runAiTool, type AiResponse, type AiToolType } from '@/services/ai'
import { translateLocal, type LocalWordMeaning } from '@/features/ai/translator'
import { useAuth } from '@/providers/AuthProvider'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn, getErrorMessage } from '@/lib/utils'

const TOOLS: { id: AiToolType; label: string; icon: typeof Languages; blurb: string }[] = [
  { id: 'translate', label: 'Translate', icon: Languages, blurb: 'SO ↔ EN with word meanings' },
  { id: 'multilingual_translate', label: 'Translator', icon: Globe, blurb: 'Professional translation to any language' },
  { id: 'grammar', label: 'Grammar', icon: SpellCheck, blurb: 'Correct and improve writing' },
  { id: 'presentation', label: 'Presentation', icon: Presentation, blurb: 'Structured talk outlines' },
  { id: 'debate', label: 'Debate', icon: Swords, blurb: 'Motion, claims, rebuttals' },
  { id: 'speech', label: 'Speech', icon: Mic, blurb: 'Draft and delivery tips' },
  { id: 'practice_questions', label: 'Practice Questions', icon: ListChecks, blurb: 'Study drills' },
  { id: 'essay', label: 'Essay', icon: PenLine, blurb: 'Essay outlines and structure' },
  { id: 'english_speaking', label: 'English Speaking', icon: Volume2, blurb: 'Speaking practice drills' },
  { id: 'somali_speaking', label: 'Somali Speaking', icon: MessageSquare, blurb: 'Af-Soomaali drills' },
  { id: 'discussion_topic', label: 'Discussion Topic', icon: MessagesSquare, blurb: 'Class discussion starters' },
]

const GRADIENTS: Record<AiToolType, string> = {
  translate: 'from-emerald-500 to-teal-600',
  multilingual_translate: 'from-blue-500 to-indigo-600',
  grammar: 'from-violet-500 to-purple-600',
  presentation: 'from-amber-500 to-orange-600',
  debate: 'from-rose-500 to-red-600',
  speech: 'from-sky-500 to-blue-600',
  practice_questions: 'from-fuchsia-500 to-pink-600',
  essay: 'from-lime-500 to-green-600',
  english_speaking: 'from-indigo-500 to-blue-700',
  somali_speaking: 'from-teal-500 to-emerald-600',
  discussion_topic: 'from-cyan-500 to-sky-600',
}

const POS_LABELS: Record<string, string> = {
  n: 'noun',
  v: 'verb',
  adj: 'adjective',
  adv: 'adverb',
  pron: 'pronoun',
  det: 'determiner',
  conj: 'conjunction',
  num: 'number',
  phrase: 'phrase',
  interj: 'interjection',
  part: 'particle',
}

const LANGUAGES = ['English', 'Somali', 'Arabic', 'French', 'Swahili', 'Spanish']

function LangPill({
  label,
  code,
  active,
  onClick,
}: {
  label: string
  code: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition',
        active
          ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30'
          : 'bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700',
      )}
    >
      <span className="text-xs font-bold uppercase tracking-wide">{code}</span>
      {label}
    </button>
  )
}

export function StudentAiToolsPage() {
  const { user } = useAuth()
  const [tool, setTool] = useState<AiToolType>('translate')
  const [input, setInput] = useState('')
  const [direction, setDirection] = useState<'so-en' | 'en-so'>('so-en')
  const [targetLanguage, setTargetLanguage] = useState('English')
  const [result, setResult] = useState<AiResponse | null>(null)
  const [copied, setCopied] = useState(false)

  const run = useMutation({
    mutationFn: () =>
      runAiTool(tool, input, {
        direction: tool === 'translate' ? direction : undefined,
        targetLang: tool === 'multilingual_translate' ? targetLanguage : undefined,
        profileId: user!.profile.id,
      }),
    onSuccess: (data) => setResult(data),
    onError: (e) => {
      if (tool !== 'translate') toast.error(getErrorMessage(e))
    },
  })

  const active = TOOLS.find((t) => t.id === tool)!
  const ActiveIcon = active.icon

  const wordCount = useMemo(
    () => input.trim() ? input.trim().split(/\s+/).filter(Boolean).length : 0,
    [input],
  )

  const sourceLang = direction === 'so-en' ? 'Soomaali' : 'English'
  const translateTarget = direction === 'so-en' ? 'English' : 'Soomaali'

  const handleSwap = () => {
    setDirection((d) => (d === 'so-en' ? 'en-so' : 'so-en'))
    setResult(null)
  }

  const handleRun = () => {
    if (!input.trim()) return
    if (tool === 'translate') {
      const local = translateLocal(input, direction)
      setResult({
        original: input,
        translation: local.translation,
        meanings: local.wordMeanings,
        wordMeanings: local.wordMeanings,
        unknown: local.unknown,
        coverage: local.coverage,
        uncertainty: local.unknown.length
          ? `Dictionary does not cover: ${local.unknown.join(', ')}`
          : undefined,
      })
    }
    run.mutate()
  }

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Could not copy text')
    }
  }

  const meanings = (result?.wordMeanings ?? result?.meanings ?? []) as LocalWordMeaning[]

  return (
    <div>
      <PageHeader
        title="AI Tools"
        description="Premium learning assistants for Somali Star Academy students."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {TOOLS.map((t) => {
          const Icon = t.icon
          const selected = tool === t.id
          return (
            <motion.button
              key={t.id}
              type="button"
              whileHover={{ y: -2 }}
              onClick={() => {
                setTool(t.id)
                setResult(null)
              }}
              className={cn(
                'rounded-2xl border p-3.5 text-left transition',
                selected
                  ? 'border-brand-500 bg-brand-50/70 shadow-sm ring-2 ring-brand-500/20 dark:border-brand-500 dark:bg-brand-950/50'
                  : 'border-ink-200 bg-white hover:border-ink-300 dark:border-ink-800 dark:bg-ink-900 dark:hover:border-ink-700',
              )}
            >
              <span
                className={cn(
                  'inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm',
                  GRADIENTS[t.id],
                )}
              >
                <Icon className="h-4.5 w-4.5" />
              </span>
              <p className="mt-2.5 text-sm font-semibold text-ink-900 dark:text-white">{t.label}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{t.blurb}</p>
            </motion.button>
          )
        })}
      </div>

      <Card className="mt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                'mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm',
                GRADIENTS[tool],
              )}
            >
              <ActiveIcon className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-xl font-semibold text-ink-900 dark:text-white">{active.label}</h3>
              <p className="text-sm text-ink-500">{active.blurb}</p>
            </div>
          </div>
        </div>

        {tool === 'translate' ? (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink-200 bg-white px-3.5 py-3 dark:border-ink-800 dark:bg-ink-950">
              <LangPill label="Somali" code="SO" active={direction === 'so-en'} onClick={() => { setDirection('so-en'); setResult(null) }} />
              <button
                type="button"
                onClick={handleSwap}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-ink-100 text-ink-600 transition hover:bg-brand-100 hover:text-brand-700 dark:bg-ink-800 dark:text-ink-300"
                aria-label="Swap languages"
              >
                <ArrowLeftRight className="h-4 w-4" />
              </button>
              <LangPill label="English" code="EN" active={direction === 'en-so'} onClick={() => { setDirection('en-so'); setResult(null) }} />
              <span className="ml-auto hidden text-xs text-ink-400 sm:inline">
                <Sparkles className="mr-1 inline h-3.5 w-3.5 text-brand-500" />
                Dictionary-powered translation — always accurate for covered words
              </span>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-ink-200 bg-white transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 dark:border-ink-800 dark:bg-ink-950">
                <div className="flex items-center justify-between px-4 pt-3">
                  <span className="text-sm font-semibold text-ink-700 dark:text-ink-200">{sourceLang}</span>
                  <span className="text-xs text-ink-400">{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
                </div>
                <textarea
                  className="min-h-44 w-full resize-none bg-transparent px-4 py-3 text-base leading-relaxed text-ink-900 outline-none placeholder:text-ink-400 dark:text-ink-100"
                  placeholder={`Enter ${sourceLang.toLowerCase()} text…`}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleRun()
                  }}
                />
                <div className="flex items-center justify-between px-4 pb-3">
                  <span className="hidden text-[11px] text-ink-400 sm:inline">
                    <CornerDownLeft className="mr-1 inline h-3 w-3" /> Ctrl+Enter to translate
                  </span>
                  <Button size="sm" loading={run.isPending} disabled={!input.trim()} onClick={handleRun}>
                    <Languages className="h-4 w-4" />
                    Translate
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-950">
                <div className="flex items-center justify-between px-4 pt-3">
                  <span className="text-sm font-semibold text-ink-700 dark:text-ink-200">{translateTarget}</span>
                  {result?.translation && (
                    <button
                      type="button"
                      onClick={() => copyText(result.translation!)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-ink-500 transition hover:bg-ink-100 hover:text-ink-800 dark:hover:bg-ink-800 dark:hover:text-ink-100"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  )}
                </div>
                <p
                  className={cn(
                    'min-h-44 whitespace-pre-wrap px-4 py-3 text-base leading-relaxed',
                    result?.translation
                      ? 'text-ink-900 dark:text-ink-100'
                      : 'text-ink-400 dark:text-ink-500',
                  )}
                >
                  {result?.translation ?? `Translation in ${translateTarget} will appear here…`}
                </p>
              </div>
            </div>

            {result && typeof result.coverage === 'number' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-ink-500">
                  <span>Dictionary coverage</span>
                  <span className="font-semibold">{Math.round(result.coverage * 100)}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round(result.coverage * 100)}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            )}

            {!!result?.unknown?.length && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-300/60 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  Not in dictionary: <span className="font-semibold">{result.unknown.join(', ')}</span>
                </span>
              </div>
            )}

            {!!meanings.length && (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  <h4 className="text-sm font-semibold text-ink-900 dark:text-white">Word dictionary</h4>
                  <span className="text-xs text-ink-400">({meanings.length} {meanings.length === 1 ? 'entry' : 'entries'})</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {meanings.map((m) => (
                    <div
                      key={m.word}
                      className="rounded-xl border border-ink-200 bg-white p-3 transition hover:border-brand-300 dark:border-ink-800 dark:bg-ink-950 dark:hover:border-brand-700"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-ink-900 dark:text-white">{m.word}</span>
                        {m.pos && (
                          <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                            {POS_LABELS[m.pos] ?? m.pos}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-700 dark:text-ink-200">{m.meaning}</p>
                      {m.note && <p className="mt-1 text-xs italic text-ink-400">{m.note}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result?.uncertainty && (
              <div className="rounded-xl border border-accent-400/40 bg-accent-50/50 px-3.5 py-2.5 text-sm text-accent-700 dark:bg-accent-950/30 dark:text-accent-300">
                <span className="font-semibold">Note: </span>
                {result.uncertainty}
              </div>
            )}
          </div>
        ) : tool === 'multilingual_translate' ? (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-ink-200 bg-white px-3.5 py-3 dark:border-ink-800 dark:bg-ink-950">
              <Globe className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              <span className="text-sm font-semibold text-ink-700 dark:text-ink-200">Translate to</span>
              {LANGUAGES.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setTargetLanguage(l)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-semibold transition',
                    targetLanguage === l
                      ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30'
                      : 'bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700',
                  )}
                >
                  {l}
                </button>
              ))}
              <input
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                placeholder="Or type any language…"
                className="ml-auto w-40 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-ink-200 bg-white transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 dark:border-ink-800 dark:bg-ink-950">
                <div className="flex items-center justify-between px-4 pt-3">
                  <span className="text-sm font-semibold text-ink-700 dark:text-ink-200">Source (auto-detected)</span>
                  <span className="text-xs text-ink-400">{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
                </div>
                <textarea
                  className="min-h-44 w-full resize-none bg-transparent px-4 py-3 text-base leading-relaxed text-ink-900 outline-none placeholder:text-ink-400 dark:text-ink-100"
                  placeholder="Enter text in any language…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleRun()
                  }}
                />
                <div className="flex items-center justify-between px-4 pb-3">
                  <span className="hidden text-[11px] text-ink-400 sm:inline">
                    <CornerDownLeft className="mr-1 inline h-3 w-3" /> Ctrl+Enter to translate
                  </span>
                  <Button size="sm" loading={run.isPending} disabled={!input.trim()} onClick={handleRun}>
                    <Globe className="h-4 w-4" />
                    Translate to {targetLanguage || 'language'}
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-950">
                <div className="flex items-center justify-between px-4 pt-3">
                  <span className="text-sm font-semibold text-ink-700 dark:text-ink-200">{targetLanguage || 'Target'}</span>
                  {result?.translation && (
                    <button
                      type="button"
                      onClick={() => copyText(result.translation!)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-ink-500 transition hover:bg-ink-100 hover:text-ink-800 dark:hover:bg-ink-800 dark:hover:text-ink-100"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  )}
                </div>
                <p
                  className={cn(
                    'min-h-44 whitespace-pre-wrap px-4 py-3 text-base leading-relaxed',
                    result?.translation
                      ? 'text-ink-900 dark:text-ink-100'
                      : 'text-ink-400 dark:text-ink-500',
                  )}
                >
                  {result?.translation ?? `Translation in ${targetLanguage || 'the target language'} will appear here…`}
                </p>
              </div>
            </div>

            <p className="flex items-center gap-2 text-xs text-ink-400">
              <Sparkles className="h-3.5 w-3.5 text-brand-500" />
              Detects the source language automatically and translates naturally, keeping names, numbers, dates and formatting unchanged.
            </p>

            {result?.uncertainty && (
              <div className="rounded-xl border border-accent-400/40 bg-accent-50/50 px-3.5 py-2.5 text-sm text-accent-700 dark:bg-accent-950/30 dark:text-accent-300">
                <span className="font-semibold">Note: </span>
                {result.uncertainty}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4">
            <textarea
              className="mt-1 min-h-32 w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-ink-700 dark:bg-ink-950 dark:text-ink-100"
              placeholder="Enter text…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <Button className="mt-3" disabled={!input.trim()} loading={run.isPending} onClick={handleRun}>
              Run {active.label}
            </Button>

            {result && (
              <motion.div
                className="mt-4 grid gap-4 lg:grid-cols-2"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="rounded-2xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-950">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Original</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink-900 dark:text-ink-100">{result.original}</p>
                </div>
                {(result.corrected || result.content) && (
                  <div className="rounded-2xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-950">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                      {result.corrected ? 'Corrected' : 'Output'}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-ink-900 dark:text-ink-100">
                      {result.corrected || result.content}
                    </p>
                  </div>
                )}
                {!!result.tips?.length && (
                  <div className="rounded-2xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-950">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Tips</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-700 dark:text-ink-200">
                      {result.tips.map((t) => <li key={t}>{t}</li>)}
                    </ul>
                  </div>
                )}
                {!!result.alternatives?.length && (
                  <div className="rounded-2xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-950">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Alternatives</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-700 dark:text-ink-200">
                      {result.alternatives.map((a) => <li key={a}>{a}</li>)}
                    </ul>
                  </div>
                )}
                {result.uncertainty && (
                  <div className="rounded-2xl border border-accent-400/40 bg-accent-50/50 p-4 text-sm text-accent-700 lg:col-span-2 dark:bg-accent-950/30 dark:text-accent-300">
                    <span className="font-semibold">Note: </span>
                    {result.uncertainty}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
