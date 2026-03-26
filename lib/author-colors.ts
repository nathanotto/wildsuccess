// Distinct colors for plan collaborators — avoiding the brand brick red (#C4725A)
const AUTHOR_COLORS = [
  '#1A5FB4', // strong blue
  '#9A2E6F', // deep magenta
  '#C45000', // burnt orange
  '#1B6B3A', // forest green (distinct from YOU_COLOR)
  '#7B2DBF', // vivid purple
  '#0B7A75', // dark teal
  '#B8360E', // vermilion
  '#5C4D9A', // indigo
  '#A85D00', // amber
  '#2A4858', // slate
]

const YOU_COLOR = '#2D6A4F' // dark green

const colorCache = new Map<string, string>()
let nextColorIndex = 0

export function getAuthorColor(userId: string, isOwn: boolean): string {
  if (isOwn) return YOU_COLOR
  if (colorCache.has(userId)) return colorCache.get(userId)!
  const color = AUTHOR_COLORS[nextColorIndex % AUTHOR_COLORS.length]
  nextColorIndex++
  colorCache.set(userId, color)
  return color
}

export function formatAuthorTag(authorName: string | undefined, isOwn: boolean | undefined): string {
  if (isOwn) return 'You'
  const name = authorName ?? '???'
  return name.slice(0, 3)
}
