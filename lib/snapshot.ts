/**
 * Infer what display status an action item had on a given date,
 * using only current DB fields (no event-sourcing needed).
 */
export function computeDisplayStatus(
  item: {
    status: string
    completed_date: string | null
    parked_until: string | null
  },
  viewDate: string,
): string {
  // Item was completed on or before this day
  if (item.completed_date && item.completed_date <= viewDate) return 'completed'

  // Item was completed AFTER this day — it was open on viewDate
  if (item.completed_date && item.completed_date > viewDate) {
    // Was it parked on viewDate?
    if (item.status === 'parked' && item.parked_until && item.parked_until > viewDate) return 'parked'
    return 'committed'
  }

  // No completed_date — item is still active
  // Handle expired park
  if (item.status === 'parked' && item.parked_until && item.parked_until <= viewDate) return 'committed'

  // Preserve current status (in_progress, committed, parked, skipped, etc.)
  return item.status
}
