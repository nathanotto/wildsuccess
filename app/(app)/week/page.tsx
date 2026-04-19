import { redirect } from 'next/navigation'

function getMondayOf(d: Date): string {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(monday.getDate() + diff)
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
}

export default function WeekRedirect() {
  // Default: this week's Monday (user completes this week or creates it)
  const monday = getMondayOf(new Date())
  redirect(`/week/${monday}`)
}
