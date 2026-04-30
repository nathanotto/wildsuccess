import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { COLORS } from '@/lib/theme'

interface SetupPayload {
  preventive_values: string[]
  promotional_values: string[]
  life_domains: string[]
}

// Preventive values that always belong together semantically
const PREVENTIVE_COLORS: Record<string, string> = {
  Safety: '#D4564E',
  'Financial Sufficiency': COLORS.primary,
  Belonging: '#9E6A46',
  'Household Order': '#A0826D',
  'Administrative Compliance': '#8B6E5A',
  'Professional Standing': '#7A5C4A',
  'Digital / Data Security': '#6B4E3D',
  'Caregiving Obligations': '#BE7A5E',
}

const DOMAIN_COLORS: Record<string, string> = {
  'Work / Livelihood': '#4B82AF',
  'Health / Body': '#5A9E6F',
  Finances: COLORS.primary,
  'Home / Household': '#9E6A46',
  Family: '#D4A056',
  'Partnership / Romance': '#C4564E',
  'Friendships / Social': '#7A9EC4',
  'Personal Growth / Learning': '#6B9E7A',
  'Creative Life': '#A07AC4',
  'Spiritual Life': '#7AC4A0',
  'Community / Civic': '#C4A07A',
  'Recreation / Fun': '#7AC4C4',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: SetupPayload = await req.json()
  const { preventive_values, promotional_values, life_domains } = body

  if (!preventive_values?.length || !promotional_values?.length || !life_domains?.length) {
    return NextResponse.json({ error: 'All three steps are required' }, { status: 400 })
  }
  if (promotional_values.length < 2) {
    return NextResponse.json({ error: 'Select at least two promotional values' }, { status: 400 })
  }
  if (life_domains.length < 4) {
    return NextResponse.json({ error: 'Select at least four life domains' }, { status: 400 })
  }

  // Delete existing defaults
  await supabase.from('user_values').delete().eq('user_id', user.id)
  await supabase.from('life_domains').delete().eq('user_id', user.id)

  // Insert preventive values
  const preventiveRows = preventive_values.map((name, i) => ({
    user_id: user.id,
    name,
    value_type: 'preventive' as const,
    sort_order: i,
    score: 5,
    sufficiency_mark: 4,
    sufficiency_status: 'unassessed',
    is_active: true,
  }))

  // Insert promotional values
  const promotionalRows = promotional_values.map((name, i) => ({
    user_id: user.id,
    name,
    value_type: 'promotional' as const,
    sort_order: i,
    score: 5,
    sufficiency_mark: 4,
    sufficiency_status: 'unassessed',
    is_active: true,
  }))

  const { error: vErr } = await supabase
    .from('user_values')
    .insert([...preventiveRows, ...promotionalRows])

  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 })

  // Insert life domains
  const domainRows = life_domains.map((name, i) => ({
    user_id: user.id,
    name,
    color: DOMAIN_COLORS[name] ?? '#8A8578',
    sort_order: i,
    is_active: true,
  }))

  const { error: dErr } = await supabase.from('life_domains').insert(domainRows)
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 })

  // Update profile
  const { error: pErr } = await supabase
    .from('user_profiles')
    .update({
      intake_status: 'in_progress',
      intake_progress: {
        preventive_values: true,
        promotional_values: true,
        life_domains: true,
        welcome_shown: false,
      },
    })
    .eq('id', user.id)

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
