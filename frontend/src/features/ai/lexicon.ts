/** Trusted Somali ↔ English lexical reference for translation pipeline */
export interface LexEntry {
  so: string
  en: string[]
  pos?: string
  note?: string
}

export const SOMALI_ENGLISH_LEXICON: LexEntry[] = [
  { so: 'school', en: ['school'], pos: 'n', note: 'Borrowing; also dugsi' },
  { so: 'dugsi', en: ['school', 'madrasah'], pos: 'n' },
  { so: 'macallin', en: ['teacher', 'instructor'], pos: 'n' },
  { so: 'macallimo', en: ['female teacher'], pos: 'n' },
  { so: 'arday', en: ['student', 'pupil'], pos: 'n' },
  { so: 'ardayad', en: ['female student'], pos: 'n' },
  { so: 'ardayda', en: ['the students'], pos: 'n' },
  { so: 'wiilka', en: ['the boy'], pos: 'n' },
  { so: 'gabadha', en: ['the girl'], pos: 'n' },
  { so: 'fasal', en: ['class', 'classroom'], pos: 'n' },
  { so: 'buug', en: ['book'], pos: 'n' },
  { so: 'qalin', en: ['pen'], pos: 'n' },
  { so: 'warqad', en: ['paper', 'letter'], pos: 'n' },
  { so: 'imtaxaan', en: ['exam', 'test'], pos: 'n' },
  { so: 'imtixaan', en: ['exam', 'test'], pos: 'n' },
  { so: 'su\'aal', en: ['question'], pos: 'n' },
  { so: 'suaal', en: ['question'], pos: 'n' },
  { so: 'jawaab', en: ['answer', 'reply'], pos: 'n' },
  { so: 'cashar', en: ['lesson'], pos: 'n' },
  { so: 'waxbarasho', en: ['education', 'learning'], pos: 'n' },
  { so: 'aqoon', en: ['knowledge'], pos: 'n' },
  { so: 'faham', en: ['understanding', 'comprehension'], pos: 'n' },
  { so: 'akhris', en: ['reading'], pos: 'n' },
  { so: 'qoraal', en: ['writing'], pos: 'n' },
  { so: 'hadal', en: ['speech', 'talk'], pos: 'n' },
  { so: 'luuqad', en: ['language'], pos: 'n' },
  { so: 'Ingiriisi', en: ['English'], pos: 'n' },
  { so: 'Soomaali', en: ['Somali'], pos: 'n' },
  { so: 'magac', en: ['name'], pos: 'n' },
  { so: 'waalid', en: ['parent'], pos: 'n' },
  { so: 'hooyo', en: ['mother'], pos: 'n' },
  { so: 'aabe', en: ['father'], pos: 'n' },
  { so: 'wiil', en: ['boy', 'son'], pos: 'n' },
  { so: 'gabadh', en: ['girl', 'daughter'], pos: 'n' },
  { so: 'saaxiib', en: ['friend'], pos: 'n' },
  { so: 'guriga', en: ['the house', 'home'], pos: 'n' },
  { so: 'guri', en: ['house', 'home'], pos: 'n' },
  { so: 'magaalo', en: ['city', 'town'], pos: 'n' },
  { so: 'Muqdisho', en: ['Mogadishu'], pos: 'n' },
  { so: 'Soomaaliya', en: ['Somalia'], pos: 'n' },
  { so: 'subaax', en: ['morning'], pos: 'n' },
  { so: 'subax', en: ['morning'], pos: 'n' },
  { so: 'galab', en: ['afternoon'], pos: 'n' },
  { so: 'habeen', en: ['night'], pos: 'n' },
  { so: 'maanta', en: ['today'], pos: 'adv' },
  { so: 'berri', en: ['tomorrow'], pos: 'adv' },
  { so: 'shalay', en: ['yesterday'], pos: 'adv' },
  { so: 'wacan', en: ['good', 'fine'], pos: 'adj' },
  { so: 'fiican', en: ['good', 'nice', 'well'], pos: 'adj' },
  { so: 'fiicanahay', en: ['I am fine'], pos: 'phrase' },
  { so: 'wanaagsan', en: ['good'], pos: 'adj' },
  { so: 'subax wanaagsan', en: ['good morning'], pos: 'phrase' },
  { so: 'galab wanaagsan', en: ['good afternoon'], pos: 'phrase' },
  { so: 'habeen wanaagsan', en: ['good night'], pos: 'phrase' },
  { so: 'caafimaad qabo', en: ['take care', 'get well'], pos: 'phrase' },
  { so: 'xun', en: ['bad'], pos: 'adj' },
  { so: 'weyn', en: ['big', 'large'], pos: 'adj' },
  { so: 'yar', en: ['small', 'young'], pos: 'adj' },
  { so: 'cusub', en: ['new'], pos: 'adj' },
  { so: 'duug', en: ['old'], pos: 'adj' },
  { so: 'dheere', en: ['tall', 'long'], pos: 'adj' },
  { so: 'gaaban', en: ['short'], pos: 'adj' },
  { so: 'kulul', en: ['hot', 'warm'], pos: 'adj' },
  { so: 'qabow', en: ['cold'], pos: 'adj' },
  { so: 'fudud', en: ['easy', 'light'], pos: 'adj' },
  { so: 'adag', en: ['difficult', 'hard'], pos: 'adj' },
  { so: 'muhiim', en: ['important'], pos: 'adj' },
  { so: 'sax', en: ['correct', 'right'], pos: 'adj' },
  { so: 'qalad', en: ['mistake', 'error', 'wrong'], pos: 'n' },
  { so: 'waqti', en: ['time'], pos: 'n' },
  { so: 'saacad', en: ['hour', 'clock'], pos: 'n' },
  { so: 'maalinta', en: ['the day'], pos: 'n' },
  { so: 'toddobaad', en: ['week'], pos: 'n' },
  { so: 'bil', en: ['month'], pos: 'n' },
  { so: 'sanad', en: ['year'], pos: 'n' },
  { so: 'biyo', en: ['water'], pos: 'n' },
  { so: 'cunto', en: ['food'], pos: 'n' },
  { so: 'caafimaad', en: ['health'], pos: 'n' },
  { so: 'nabad', en: ['peace', 'safety'], pos: 'n' },
  { so: 'jacayl', en: ['love'], pos: 'n' },
  { so: 'farxad', en: ['happiness', 'joy'], pos: 'n' },
  { so: 'cabsi', en: ['fear'], pos: 'n' },
  { so: 'shaqo', en: ['work', 'job'], pos: 'n' },
  { so: 'lacag', en: ['money'], pos: 'n' },
  { so: 'suuq', en: ['market'], pos: 'n' },
  { so: 'baabuur', en: ['car'], pos: 'n' },
  { so: 'diyaarad', en: ['airplane'], pos: 'n' },
  { so: 'badda', en: ['the sea'], pos: 'n' },
  { so: 'cirka', en: ['the sky'], pos: 'n' },
  { so: 'qorrax', en: ['sun'], pos: 'n' },
  { so: 'dayax', en: ['moon'], pos: 'n' },
  { so: 'roob', en: ['rain'], pos: 'n' },
  { so: 'dabayl', en: ['wind'], pos: 'n' },
  { so: 'geed', en: ['tree'], pos: 'n' },
  { so: 'ubax', en: ['flower'], pos: 'n' },
  { so: 'xayawaan', en: ['animal'], pos: 'n' },
  { so: 'bisad', en: ['cat'], pos: 'n' },
  { so: 'ey', en: ['dog'], pos: 'n' },
  { so: 'lo\'', en: ['cattle', 'cow'], pos: 'n' },
  { so: 'ari', en: ['goat', 'sheep (goats/sheep)'], pos: 'n' },
  { so: 'midab', en: ['color'], pos: 'n' },
  { so: 'cagaar', en: ['green'], pos: 'adj' },
  { so: 'cas', en: ['red'], pos: 'adj' },
  { so: 'cadaan', en: ['white'], pos: 'adj' },
  { so: 'madow', en: ['black'], pos: 'adj' },
  { so: 'huruud', en: ['yellow'], pos: 'adj' },
  { so: 'buluug', en: ['blue'], pos: 'adj' },
  { so: 'kowaad', en: ['first'], pos: 'adj' },
  { so: 'labaad', en: ['second'], pos: 'adj' },
  { so: 'saddexaad', en: ['third'], pos: 'adj' },
  { so: 'hal', en: ['one'], pos: 'num' },
  { so: 'laba', en: ['two'], pos: 'num' },
  { so: 'saddex', en: ['three'], pos: 'num' },
  { so: 'afar', en: ['four'], pos: 'num' },
  { so: 'shan', en: ['five'], pos: 'num' },
  { so: 'lix', en: ['six'], pos: 'num' },
  { so: 'toddoba', en: ['seven'], pos: 'num' },
  { so: 'siddeed', en: ['eight'], pos: 'num' },
  { so: 'sagaal', en: ['nine'], pos: 'num' },
  { so: 'toban', en: ['ten'], pos: 'num' },
  { so: 'boqol', en: ['hundred'], pos: 'num' },
  { so: 'kun', en: ['thousand'], pos: 'num' },
  { so: 'haan', en: ['yes'], pos: 'interj' },
  { so: 'maya', en: ['no'], pos: 'interj' },
  { so: 'mahadsanid', en: ['thank you'], pos: 'phrase' },
  { so: 'mahaadsanid', en: ['thank you'], pos: 'phrase' },
  { so: 'fadaad', en: ['please'], pos: 'adv' },
  { so: 'fadlan', en: ['please'], pos: 'adv' },
  { so: 'soo dhawoow', en: ['welcome'], pos: 'phrase' },
  { so: 'nabad gelyo', en: ['goodbye', 'peace be with you'], pos: 'phrase' },
  { so: 'iska warran', en: ['how are you'], pos: 'phrase' },
  { so: 'waan fiicanahay', en: ['I am fine'], pos: 'phrase' },
  { so: 'magacaa', en: ['what is your name'], pos: 'phrase' },
  { so: 'magacaygu waa', en: ['my name is'], pos: 'phrase' },
  { so: 'aan', en: ['I (subject marker)', 'let us'], pos: 'part', note: 'Context-dependent particle' },
  { so: 'waan', en: ['I (declarative)'], pos: 'part' },
  { so: 'waxaan', en: ['I (focus)'], pos: 'part' },
  { so: 'waa', en: ['is / are'], pos: 'part', note: 'Focus/declarative marker' },
  { so: 'waxay', en: ['she / it / they'], pos: 'part' },
  { so: 'magacaygu', en: ['my name'], pos: 'n' },
  { so: 'aad', en: ['you', 'very'], pos: 'pron', note: 'Can mean you or intensifier very' },
  { so: 'isaga', en: ['he', 'him'], pos: 'pron' },
  { so: 'iyada', en: ['she', 'her'], pos: 'pron' },
  { so: 'annaga', en: ['we', 'us'], pos: 'pron' },
  { so: 'idinka', en: ['you (plural)'], pos: 'pron' },
  { so: 'iyaga', en: ['they', 'them'], pos: 'pron' },
  { so: 'kan', en: ['this (m)'], pos: 'det' },
  { so: 'tan', en: ['this (f)'], pos: 'det' },
  { so: 'kaas', en: ['that (m)'], pos: 'det' },
  { so: 'taas', en: ['that (f)'], pos: 'det' },
  { so: 'maxaa', en: ['what'], pos: 'pron' },
  { so: 'yaa', en: ['who'], pos: 'pron' },
  { so: 'xaggee', en: ['where'], pos: 'adv' },
  { so: 'goorma', en: ['when'], pos: 'adv' },
  { so: 'sidee', en: ['how'], pos: 'adv' },
  { so: 'maxaad', en: ['what (do you)'], pos: 'pron' },
  { so: 'in', en: ['that', 'to'], pos: 'conj', note: 'Subordinator; meaning depends on clause' },
  { so: 'laakiin', en: ['but'], pos: 'conj' },
  { so: 'ama', en: ['or'], pos: 'conj' },
  { so: 'iyo', en: ['and'], pos: 'conj' },
  { so: 'sababtoo ah', en: ['because'], pos: 'conj' },
  { so: 'haddii', en: ['if'], pos: 'conj' },
  { so: 'ka dib', en: ['after', 'then'], pos: 'adv' },
  { so: 'kahor', en: ['before'], pos: 'adv' },
  { so: 'hadda', en: ['now'], pos: 'adv' },
  { so: 'weli', en: ['still', 'yet'], pos: 'adv' },
  { so: 'marwalba', en: ['always'], pos: 'adv' },
  { so: 'marna', en: ['never'], pos: 'adv' },
  { so: 'badanaa', en: ['often', 'usually'], pos: 'adv' },
  { so: 'qor', en: ['write'], pos: 'v' },
  { so: 'akhri', en: ['read'], pos: 'v' },
  { so: 'akhriyaan', en: ['read'], pos: 'v', note: 'They read' },
  { so: 'dhagayso', en: ['listen'], pos: 'v' },
  { so: 'hadal', en: ['speak', 'talk'], pos: 'v' },
  { so: 'sheeg', en: ['tell', 'say'], pos: 'v' },
  { so: 'weydii', en: ['ask'], pos: 'v' },
  { so: 'baran', en: ['learn', 'study'], pos: 'v' },
  { so: 'baranayaa', en: ['I am learning'], pos: 'v' },
  { so: 'baro', en: ['teach', 'learn'], pos: 'v', note: 'Context: baro can be teach or learn' },
  { so: 'faham', en: ['understand'], pos: 'v' },
  { so: 'hel', en: ['get', 'find'], pos: 'v' },
  { so: 'siin', en: ['give'], pos: 'v' },
  { so: 'qaad', en: ['take'], pos: 'v' },
  { so: 'imid', en: ['came', 'come (past)'], pos: 'v' },
  { so: 'tag', en: ['go'], pos: 'v' },
  { so: 'joog', en: ['stay', 'be present'], pos: 'v' },
  { so: 'samee', en: ['do', 'make'], pos: 'v' },
  { so: 'raac', en: ['follow'], pos: 'v' },
  { so: 'caawin', en: ['help'], pos: 'v' },
  { so: 'bilow', en: ['start', 'begin'], pos: 'v' },
  { so: 'dhamee', en: ['finish', 'complete'], pos: 'v' },
  { so: 'xasuuso', en: ['remember'], pos: 'v' },
  { so: 'illoob', en: ['forget'], pos: 'v' },
  { so: 'jecel', en: ['like', 'love'], pos: 'v' },
  { so: 'neceb', en: ['hate', 'dislike'], pos: 'v' },
  { so: 'ogow', en: ['know'], pos: 'v' },
  { so: 'arag', en: ['see'], pos: 'v' },
  { so: 'maqal', en: ['hear'], pos: 'v' },
  { so: 'cun', en: ['eat'], pos: 'v' },
  { so: 'cab', en: ['drink'], pos: 'v' },
  { so: 'seexo', en: ['sleep'], pos: 'v' },
  { so: 'tooso', en: ['wake up'], pos: 'v' },
  { so: 'orod', en: ['run'], pos: 'v' },
  { so: 'socod', en: ['walk'], pos: 'v' },
  { so: 'ciyaar', en: ['play'], pos: 'v' },
  { so: 'shaqee', en: ['work'], pos: 'v' },
  { so: 'iibi', en: ['sell'], pos: 'v' },
  { so: 'iibsado', en: ['buy'], pos: 'v' },
  { so: 'fur', en: ['open'], pos: 'v' },
  { so: 'xidhid', en: ['close'], pos: 'v' },
  { so: 'gulaal', en: ['enter'], pos: 'v' },
  { so: 'bax', en: ['exit', 'go out'], pos: 'v' },
  { so: 'attendance', en: ['attendance'], pos: 'n' },
  { so: 'imaansho', en: ['attendance', 'presence'], pos: 'n' },
  { so: 'maqnasho', en: ['absence'], pos: 'n' },
  { so: 'daahid', en: ['lateness'], pos: 'n' },
  { so: 'natiijo', en: ['result'], pos: 'n' },
  { so: 'darajo', en: ['grade', 'mark', 'rank'], pos: 'n' },
  { so: 'shahaado', en: ['certificate', 'diploma'], pos: 'n' },
  { so: 'maamul', en: ['administration', 'management'], pos: 'n' },
  { so: 'hogaamiye', en: ['leader', 'manager'], pos: 'n' },
  { so: 'lacag bixin', en: ['payment'], pos: 'n' },
  { so: 'deyn', en: ['debt'], pos: 'n' },
  { so: 'bill', en: ['scholarship note / NB'], pos: 'n', note: 'In school finance context NB/scholarship' },
]

export const ENGLISH_SOMALI_LEXICON: Record<string, string[]> = Object.create(null)

for (const entry of SOMALI_ENGLISH_LEXICON) {
  for (const en of entry.en) {
    const key = en.toLowerCase()
    if (!ENGLISH_SOMALI_LEXICON[key]) ENGLISH_SOMALI_LEXICON[key] = []
    if (!ENGLISH_SOMALI_LEXICON[key].includes(entry.so)) {
      ENGLISH_SOMALI_LEXICON[key].push(entry.so)
    }
  }
}

export function lookupLexical(text: string, direction: 'so-en' | 'en-so') {
  const tokens = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)

  const meanings: { word: string; meanings: string[]; note?: string }[] = []
  const seen = new Set<string>()

  if (direction === 'so-en') {
    for (const entry of SOMALI_ENGLISH_LEXICON) {
      const needle = entry.so.toLowerCase()
      if (text.toLowerCase().includes(needle) && !seen.has(needle)) {
        seen.add(needle)
        meanings.push({ word: entry.so, meanings: entry.en, note: entry.note })
      }
    }
    // also single-token exact
    for (const t of tokens) {
      const hit = SOMALI_ENGLISH_LEXICON.find((e) => e.so.toLowerCase() === t)
      if (hit && !seen.has(hit.so.toLowerCase())) {
        seen.add(hit.so.toLowerCase())
        meanings.push({ word: hit.so, meanings: hit.en, note: hit.note })
      }
    }
  } else {
    for (const t of tokens) {
      const so = ENGLISH_SOMALI_LEXICON[t]
      if (so && !seen.has(t)) {
        seen.add(t)
        const note = SOMALI_ENGLISH_LEXICON.find((e) => e.en.map((x) => x.toLowerCase()).includes(t))?.note
        meanings.push({ word: t, meanings: so, note })
      }
    }
  }

  return meanings
}
