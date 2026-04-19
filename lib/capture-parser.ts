import * as chrono from 'chrono-node'
import Fuse from 'fuse.js'

// ─── Context types ────────────────────────────────────────────────────────────

export interface KnownPersonContext {
  id: string
  name: string
  normalizedName: string
  mentionCount: number
  valueLinks: { valueId: string; valueName: string; strength: string }[]
}

export interface ActivityContext {
  id: string
  name: string
  normalizedName: string
  timeType: string
  valueLinks: { valueId: string; valueName: string; strength: string }[]
}

export interface UserContext {
  knownPeople: KnownPersonContext[]
  activities: ActivityContext[]
  taskSuggestions: { id: string; name: string; normalizedName: string }[]
  values: { id: string; name: string; normalizedName: string }[]
  userName: string
}

// ─── Result type ──────────────────────────────────────────────────────────────

export interface ParsedCapture {
  direction: 'forward' | 'backward'
  outcome: 'captured' | 'captured_dated' | 'scheduled_soft' | 'scheduled_hard' | 'tickler' | 'outside_request' | 'commitment' | 'logged'
  cleanedName: string
  rawInput: string
  date: string | null
  time: string | null
  endTime: string | null
  duration: number | null
  person: { id: string; name: string } | null
  unrecognizedName: string | null
  activityMatch: { id: string; name: string; valueLinks: { valueId: string; valueName: string; strength: string }[]; timeType: string } | null
  valueLinks: { valueId: string; valueName: string; strength: string }[]
  timeType: string | null
  feelings: string[]
  isOutsideRequest: boolean
  isCommitment: boolean
  confidence: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FEELING_WORDS = [
  'fun', 'hard', 'meaningful', 'tedious', 'peaceful', 'stressful', 'satisfying',
  'draining', 'playful', 'frustrating', 'rewarding', 'boring', 'exhausting',
  'relaxing', 'productive', 'enjoyable', 'difficult', 'easy', 'intense', 'calm',
  'focused', 'energized', 'tired', 'distracted', 'motivated', 'proud', 'anxious',
  'great', 'good', 'rough', 'slow', 'fast', 'deep', 'creative',
]

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, half: 0.5, 'a half': 0.5,
  'an hour': 60, 'a couple': 2,
}

const BACKWARD_STARTS = [
  'log this', 'i just', 'just had', 'just finished', 'just did', 'just went',
  'had ', 'spent ', 'ate ', 'went ', 'took ', 'finished ', 'did ',
  'was ', 'made ', 'gave ', 'got ', 'saw ', 'met ', 'talked ',
  'i did ', 'i was ', 'i had ', 'i spent ', 'i ate ', 'i went ',
  'i took ', 'i finished ', 'i made ', 'i gave ', 'i got ', 'i saw ',
  'i met ', 'i talked ', 'i felt ', 'i slept ', 'i woke ',
]

const FORWARD_VERBS = [
  'call', 'schedule', 'review', 'pick up', 'send', 'email', 'buy', 'write',
  'fix', 'book', 'plan', 'set up', 'look into', 'follow up', 'check', 'ask',
  'remind', 'text', 'message', 'build', 'design', 'think about', 'reach out',
  'register', 'submit', 'file', 'pay', 'order', 'cancel', 'reschedule', 'confirm',
]

const HARD_KEYWORDS = [
  'appointment', 'meeting', 'dentist', 'court', 'flight', 'doctor', 'therapy',
  'therapy session', 'interview', 'surgery', 'procedure',
]

const CALENDAR_WORDS = new Set([
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december',
  'today', 'tomorrow', 'yesterday', 'tonight', 'weekend',
])

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad2(n: number) { return String(n).padStart(2, '0') }

function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${pad2(Math.floor(total / 60) % 24)}:${pad2(total % 60)}`
}

function stripText(text: string, phrase: string): string {
  return text.replace(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ')
    .replace(/\s+/g, ' ').trim()
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseCapture(rawInput: string, ctx: UserContext, now: Date = new Date()): ParsedCapture {
  let working = rawInput.trim()

  // Preserve double-quoted strings as literal text (not parsed for dates/times)
  // e.g. Remind me tomorrow to book a hotel for "May 1-3" → "May 1-3" stays in the name
  const quotedFragments: string[] = []
  working = working.replace(/"([^"]+)"/g, (_, content) => {
    quotedFragments.push(content)
    return `__QUOTED_${quotedFragments.length - 1}__`
  })

  const explicitLog = working.toLowerCase().startsWith('log this')
  // Strip "log this" prefix
  if (explicitLog) {
    working = working.slice(8).replace(/^[\s:,\-–]+/, '').trim()
  }
  const rawLower = working.toLowerCase()

  // ─── Stage 1: Duration ──────────────────────────────────────────────────────
  let duration: number | null = null

  // Normalize word numbers to digits before duration parsing
  const wordNumRe = new RegExp(
    `\\b(${Object.keys(WORD_NUMBERS).filter(k => k.includes(' ') === false).join('|')})\\s+(hours?|minutes?|mins?|hrs?)\\b`,
    'gi'
  )
  working = working.replace(wordNumRe, (_, word, unit) => {
    const val = WORD_NUMBERS[word.toLowerCase()]
    if (val !== undefined) return `${val} ${unit}`
    return _
  })

  const durationRules: [RegExp, (m: RegExpMatchArray) => number][] = [
    [/\bfor\s+(\d+(?:\.\d+)?)\s+hours?\b/i, m => Math.round(parseFloat(m[1]) * 60)],
    [/\bfor\s+(\d+)\s+(?:minutes?|mins?)\b/i, m => parseInt(m[1])],
    [/\bfor\s+(?:an?|one)\s+hour\b/i, () => 60],
    [/\bfor\s+(?:a\s+)?half\s+hour\b/i, () => 30],
    [/\b(\d+(?:\.\d+)?)\s+hours?\b/i, m => Math.round(parseFloat(m[1]) * 60)],
  ]

  for (const [re, calc] of durationRules) {
    const m = re.exec(working)
    if (m) {
      duration = calc(m)
      working = working.slice(0, m.index) + ' ' + working.slice(m.index! + m[0].length)
      working = working.replace(/\s+/g, ' ').trim()
      break
    }
  }

  // ─── Stage 1: Date/time ─────────────────────────────────────────────────────
  let date: string | null = null
  let time: string | null = null
  let endTime: string | null = null

  const chronoResults = chrono.parse(working, now, { forwardDate: false })
  if (chronoResults.length > 0) {
    const result = chronoResults[0]
    const s = result.start
    // Only set date if the user explicitly mentioned a date (not just a time)
    // chrono always fills year/month/day with defaults — isCertain checks user intent
    if (s.isCertain('day') || s.isCertain('month') || s.isCertain('weekday')) {
      date = `${s.get('year')}-${pad2(s.get('month')!)}-${pad2(s.get('day')!)}`
    }
    if (s.isCertain('hour')) {
      time = `${pad2(s.get('hour')!)}:${pad2(s.get('minute') ?? 0)}`
    }
    working = (working.slice(0, result.index) + ' ' + working.slice(result.index + result.text.length))
      .replace(/\s+/g, ' ').trim()
  }

  // End time from duration
  if (time && duration) {
    endTime = addMinutes(time, duration)
  }

  // ─── Stage 2: People matching ───────────────────────────────────────────────
  let person: { id: string; name: string } | null = null
  let unrecognizedName: string | null = null
  let personValueLinks: { valueId: string; valueName: string; strength: string }[] = []

  const selfName = ctx.userName.toLowerCase().trim()
  const sortedPeople = [...ctx.knownPeople].sort((a, b) => b.name.length - a.name.length)

  for (const p of sortedPeople) {
    if (selfName && p.normalizedName === selfName) continue
    if (working.toLowerCase().includes(p.normalizedName)) {
      person = { id: p.id, name: p.name }
      personValueLinks = p.valueLinks
      // Person is linked via the person field — don't strip their name from the item text.
      // Previous stripping logic caused bugs when other names followed (e.g. "with Erin and Agnes"
      // became "and Agnes"). The full original text is a better item name.
      break
    }
  }

  // Unrecognized name detection (capitalized non-calendar words not at sentence start)
  if (!person) {
    const nameRe = /\b((?:Dr\.|Mr\.|Ms\.|Mrs\.)\s*)?([A-Z][a-z]{1,}(?:\s+[A-Z][a-z]{1,})?)\b/g
    const firstToken = rawInput.trim().split(/\s+/)[0]
    let nm: RegExpExecArray | null
    while ((nm = nameRe.exec(rawInput)) !== null) {
      const candidate = nm[0].trim()
      const lower = candidate.toLowerCase()
      if (candidate === firstToken && !nm[1]) continue
      if (CALENDAR_WORDS.has(lower)) continue
      if (ctx.knownPeople.some(p => p.normalizedName === lower)) continue
      if (candidate.length < 3) continue
      unrecognizedName = candidate
      break
    }
  }

  // ─── Stage 3: Activity matching ─────────────────────────────────────────────
  let activityMatch: ParsedCapture['activityMatch'] = null

  const fuseItems = [
    ...ctx.activities.map(a => ({ ...a, _type: 'activity' })),
    ...ctx.taskSuggestions.map(t => ({
      id: t.id, name: t.name, normalizedName: t.normalizedName,
      timeType: 'B', valueLinks: [], _type: 'suggestion',
    })),
  ]

  if (fuseItems.length > 0 && working.length >= 3) {
    const fuse = new Fuse(fuseItems, {
      keys: ['normalizedName'],
      threshold: 0.4,
      includeScore: true,
      minMatchCharLength: 3,
    })
    const results = fuse.search(working.toLowerCase())
    if (results.length > 0) {
      const best = results[0]
      const score = best.score ?? 1
      const item = best.item
      const lengthRatio = item.name.length / working.length
      if (score < 0.4 && (lengthRatio >= 0.4 || score < 0.3)) {
        const activity = ctx.activities.find(a => a.id === item.id)
        activityMatch = {
          id: item.id,
          name: item.name,
          timeType: item.timeType,
          valueLinks: activity?.valueLinks ?? [],
        }
      }
    }
  }

  // ─── Stage 4: Direction ─────────────────────────────────────────────────────
  let direction: 'forward' | 'backward' = explicitLog ? 'backward' : 'forward'
  let directionCertain = explicitLog

  const startsBackward = BACKWARD_STARTS.some(s => rawLower.startsWith(s))
  const hasJustEarly = /\bjust\b/.test(rawLower.slice(0, Math.ceil(rawLower.length / 2)))

  if (startsBackward || hasJustEarly) {
    direction = 'backward'
    directionCertain = true
  }

  const startsForward = FORWARD_VERBS.some(v =>
    rawLower.startsWith(v + ' ') || rawLower === v
  )
  const hasFutureMarker = /\b(need\s+to|have\s+to|should|want\s+to|going\s+to|will)\b/.test(rawLower)

  if (startsForward || hasFutureMarker) {
    direction = 'forward'
    directionCertain = true
  }

  // Future date forces forward
  if (date) {
    const d = new Date(date + 'T12:00:00')
    if (d > now) { direction = 'forward'; directionCertain = true }
  }

  // ─── Stage 5: Feelings ──────────────────────────────────────────────────────
  const feelings: string[] = []

  // "that was X" pattern
  const thatWas = /\bthat\s+was\s+([\w\s,]+?)(?:\.|$)/i.exec(rawInput)
  if (thatWas) {
    for (const w of thatWas[1].split(/[\s,]+/)) {
      if (FEELING_WORDS.includes(w.toLowerCase()) && !feelings.includes(w.toLowerCase()))
        feelings.push(w.toLowerCase())
    }
    working = working.replace(thatWas[0], '').replace(/\s+/g, ' ').trim()
  }

  // After comma/dash/and at end
  const feelingRe = new RegExp(
    `(?:[,\\-–]|\\band\\b)\\s*(${FEELING_WORDS.join('|')})(?:\\s+(?:and|,)\\s*(${FEELING_WORDS.join('|')}))?`,
    'gi'
  )
  let fm: RegExpExecArray | null
  while ((fm = feelingRe.exec(working)) !== null) {
    for (const cap of fm.slice(1)) {
      if (cap && FEELING_WORDS.includes(cap.toLowerCase()) && !feelings.includes(cap.toLowerCase()))
        feelings.push(cap.toLowerCase())
    }
    working = working.slice(0, fm.index) + working.slice(fm.index + fm[0].length)
    working = working.replace(/\s+/g, ' ').trim()
    feelingRe.lastIndex = 0
  }

  // ─── Stage 6: Outside request / commitment ──────────────────────────────────
  let isOutsideRequest = false
  let isCommitment = false

  if (/\b\w[\w\s]*?\s+asked\s+me\s+to\b/i.test(rawInput)) isOutsideRequest = true
  if (/\b\w[\w\s]*?\s+wants?\s+me\s+to\b/i.test(rawInput)) isOutsideRequest = true
  if (/\bi\s+told\s+\w[\w\s]*?\s+i\s+(?:would|will|'d)\b/i.test(rawInput)) isCommitment = true
  if (/\bi\s+promised\b/i.test(rawInput)) isCommitment = true

  // Clean "me to" from start of working text (leftover from "X asked me to ...")
  working = working.replace(/^me\s+to\s+/i, '')

  // ─── Stage 7: Time type ─────────────────────────────────────────────────────
  let timeType: string | null = activityMatch?.timeType ?? null
  let timeTypeInferred = false

  if (!timeType) {
    const verbMap: [RegExp, string][] = [
      [/\b(dinner|lunch|coffee|date\s+night|happy\s+hour|hang\s+out|visit|party|gathering|family\s+time)\b/i, 'C'],
      [/\b(call|email|text|message|send|reply|respond|reach\s+out)\b/i, 'B'],
      [/\b(review|write|build|design|plan|think\s+about|analyze|create|code|develop|draft)\b/i, 'A'],
      [/\b(pick\s+up|buy|go\s+to|drive|drop\s+off|shop|grocery|groceries|register|file|pay)\b/i, 'B'],
      [/\b(exercise|run|yoga|meditate|therapy|workout|gym|stretch)\b/i, 'D'],
      [/\b(nap|rest|relax|read|walk|leisure|stroll|recharge)\b/i, '0'],
      [/\b(meeting|appointment|dentist|court|doctor|interview)\b/i, 'B'],
    ]
    for (const [re, tt] of verbMap) {
      if (re.test(rawInput)) { timeType = tt; timeTypeInferred = true; break }
    }
    if (!timeType) timeType = 'B'
  }

  // ─── Cleaned name ────────────────────────────────────────────────────────────
  let cleanedName = working.replace(/\s+/g, ' ').replace(/^[,\-–\s]+|[,\-–\s]+$/g, '').trim()
  // Restore quoted fragments back into the cleaned name
  for (let i = 0; i < quotedFragments.length; i++) {
    cleanedName = cleanedName.replace(`__QUOTED_${i}__`, quotedFragments[i])
  }
  if (cleanedName.length > 0) cleanedName = cleanedName[0].toUpperCase() + cleanedName.slice(1)
  if (!cleanedName) cleanedName = rawInput.trim()

  // ─── Outcome ─────────────────────────────────────────────────────────────────
  let outcome: ParsedCapture['outcome']

  if (explicitLog || direction === 'backward') {
    outcome = 'logged'
  } else if (isOutsideRequest) {
    outcome = 'outside_request'
  } else if (isCommitment) {
    outcome = 'commitment'
  } else if (date && time) {
    outcome = HARD_KEYWORDS.some(k => rawLower.includes(k)) ? 'scheduled_hard' : 'scheduled_soft'
  } else if (date) {
    const parsedDate = new Date(date + 'T12:00:00')
    const weekOut = new Date(now); weekOut.setDate(weekOut.getDate() + 7)
    if (parsedDate > weekOut && /\bremind\s+me\b/i.test(rawInput)) {
      outcome = 'tickler'
    } else {
      outcome = 'captured_dated'
    }
  } else {
    outcome = 'captured'
  }

  // ─── Value links ─────────────────────────────────────────────────────────────
  const valueLinks = [...personValueLinks]
  if (activityMatch) {
    for (const vl of activityMatch.valueLinks) {
      if (!valueLinks.find(v => v.valueId === vl.valueId)) valueLinks.push(vl)
    }
  }

  // Match value names directly mentioned in the text (whole-word, case-insensitive)
  const lowerInput = rawInput.toLowerCase()
  for (const val of ctx.values) {
    if (valueLinks.find(v => v.valueId === val.id)) continue // already linked
    const pattern = new RegExp(`\\b${escapeRegex(val.normalizedName)}\\b`, 'i')
    if (pattern.test(lowerInput)) {
      valueLinks.push({ valueId: val.id, valueName: val.name, strength: 'moderate' })
    }
  }

  // ─── Confidence ──────────────────────────────────────────────────────────────
  let confidence = 0
  if (date || time) confidence += 0.2
  if (person) confidence += 0.2
  if (activityMatch) confidence += 0.2
  if (directionCertain) confidence += 0.1
  if (feelings.length > 0) confidence += 0.1
  if (timeTypeInferred) confidence += 0.1
  if (isOutsideRequest || isCommitment) confidence += 0.1
  confidence = Math.min(confidence, 1.0)

  return {
    direction, outcome, cleanedName, rawInput,
    date, time, endTime, duration,
    person, unrecognizedName,
    activityMatch, valueLinks, timeType, feelings,
    isOutsideRequest, isCommitment, confidence,
  }
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
