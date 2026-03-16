// Server-only: generates ActivitySpec[] from intake responses
// Freetext → Claude API; boolean/choice → deterministic rules

import Anthropic from '@anthropic-ai/sdk'
import type { ActivitySpec, IntakeQuestion, UserValue, LifeDomain } from './types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Freetext: Claude API ──────────────────────────────────────────────────

export async function generateForFreetext(
  question: IntakeQuestion,
  responseText: string,
  userValues: UserValue[],
  userDomains: LifeDomain[],
): Promise<ActivitySpec[]> {
  const domainNames = userDomains.map(d => d.name)
  const valueNames = userValues.map(v => v.name)

  const systemPrompt = `You are generating Activity templates for Wild Success, a personal productivity app.
Given a user's response to an intake question, return a JSON array of activity template objects.

Available life domains: ${domainNames.join(', ')}
Available values: ${valueNames.join(', ')}

Each activity object must have these exact fields:
{
  "name": string (concise, action-oriented, max 50 chars),
  "description": string (optional, 1-2 sentences, or omit),
  "activity_type": "recurring" | "one_time",
  "frequency": "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "annual" | null (null if one_time),
  "context": string[] (use these exact tags: "computer-home", "phone-anywhere", "errand-out", "focused-quiet", "comms-any", "hands-free", "home"),
  "time_type": "A" | "B" | "C",
  "emotional_weight": "light" | "normal" | "heavy",
  "flexibility": "hard_scheduled" | "soft_scheduled" | "anytime_today" | "anytime_this_week",
  "clusterable": boolean,
  "duration_range_min": number (minutes) | null,
  "duration_range_max": number (minutes) | null,
  "is_preventive": boolean,
  "suggested_life_domain": string (exactly match one from the available domains list) | null,
  "suggested_value_links": string[] (exactly match names from the available values list)
}

Energy levels: A = high-consequence, external-facing, needs best attention. B = important but routine. C = downtime, recovery, low-stakes.
Emotional weight: heavy = looms large beyond clock time (e.g. difficult conversation). light = routine.
Flexibility: hard_scheduled = must happen at specific time. soft_scheduled = rough time. anytime_today = flexible today. anytime_this_week = this week.

Return ONLY a valid JSON array, no preamble, no markdown, no explanation.
Generate 1-5 specific, realistic activities based on what the user described.
If the user says "no" or "none" or describes nothing actionable, return an empty array [].`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Question: "${question.question_text}"\nUser's response: "${responseText}"`,
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : '[]'
    const parsed = JSON.parse(text.trim())
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// ─── Deterministic rules for boolean/single_choice/number ─────────────────

export function generateForBoolean(
  question: IntakeQuestion,
  value: boolean,
): ActivitySpec[] {
  if (!value) return []

  const q = question.question_text.toLowerCase()

  if (q.includes('pet')) {
    return [
      {
        name: 'Pet care',
        description: 'Daily feeding, grooming, and care for your pet',
        activity_type: 'recurring',
        frequency: 'daily',
        context: ['home'],
        time_type: 'B',
        emotional_weight: 'light',
        flexibility: 'anytime_today',
        clusterable: false,
        duration_range_min: 15,
        duration_range_max: 30,
        is_preventive: true,
        suggested_life_domain: 'Home / Household',
        suggested_value_links: ['Safety'],
      },
    ]
  }

  if (q.includes('aging parent') || q.includes('dependent')) {
    return [
      {
        name: 'Caregiving coordination',
        description: 'Regular check-in and care coordination for dependents',
        activity_type: 'recurring',
        frequency: 'daily',
        context: ['phone-anywhere'],
        time_type: 'B',
        emotional_weight: 'heavy',
        flexibility: 'anytime_today',
        clusterable: false,
        is_preventive: true,
        suggested_life_domain: 'Family',
        suggested_value_links: ['Belonging'],
      },
    ]
  }

  if (q.includes('eat meals with others')) {
    return [
      {
        name: 'Shared mealtimes',
        description: 'Regular meals with household members',
        activity_type: 'recurring',
        frequency: 'daily',
        context: ['home'],
        time_type: 'B',
        emotional_weight: 'light',
        flexibility: 'soft_scheduled',
        clusterable: false,
        duration_range_min: 20,
        duration_range_max: 45,
        is_preventive: false,
        suggested_life_domain: 'Home / Household',
        suggested_value_links: ['Belonging'],
      },
    ]
  }

  if (q.includes('manage other people')) {
    return [
      {
        name: 'Team 1:1s',
        description: 'One-on-one meetings with direct reports',
        activity_type: 'recurring',
        frequency: 'weekly',
        context: ['comms-any'],
        time_type: 'A',
        emotional_weight: 'normal',
        flexibility: 'hard_scheduled',
        clusterable: false,
        duration_range_min: 30,
        duration_range_max: 60,
        is_preventive: false,
        suggested_life_domain: 'Work / Livelihood',
        suggested_value_links: [],
      },
      {
        name: 'Team check-in',
        description: 'Regular team meeting or standup',
        activity_type: 'recurring',
        frequency: 'weekly',
        context: ['comms-any'],
        time_type: 'B',
        emotional_weight: 'normal',
        flexibility: 'hard_scheduled',
        clusterable: false,
        duration_range_min: 15,
        duration_range_max: 30,
        is_preventive: false,
        suggested_life_domain: 'Work / Livelihood',
        suggested_value_links: [],
      },
    ]
  }

  if (q.includes('recurring meeting')) {
    return [
      {
        name: 'Meeting block',
        description: 'Recurring scheduled meetings',
        activity_type: 'recurring',
        frequency: 'weekly',
        context: ['comms-any', 'computer-home'],
        time_type: 'B',
        emotional_weight: 'normal',
        flexibility: 'hard_scheduled',
        clusterable: false,
        is_preventive: false,
        suggested_life_domain: 'Work / Livelihood',
        suggested_value_links: [],
      },
    ]
  }

  if (q.includes('medical') || q.includes('therapy') || q.includes('dental')) {
    return [
      {
        name: 'Annual physical',
        description: 'Yearly wellness checkup',
        activity_type: 'recurring',
        frequency: 'annual',
        context: ['errand-out'],
        time_type: 'B',
        emotional_weight: 'normal',
        flexibility: 'hard_scheduled',
        clusterable: false,
        duration_range_min: 60,
        duration_range_max: 120,
        is_preventive: true,
        suggested_life_domain: 'Health / Body',
        suggested_value_links: ['Safety'],
      },
      {
        name: 'Dental checkup',
        description: 'Biannual dental cleaning and exam',
        activity_type: 'recurring',
        frequency: 'biweekly', // closest to 6-month; system treats biweekly loosely
        context: ['errand-out'],
        time_type: 'B',
        emotional_weight: 'light',
        flexibility: 'hard_scheduled',
        clusterable: false,
        duration_range_min: 45,
        duration_range_max: 90,
        is_preventive: true,
        suggested_life_domain: 'Health / Body',
        suggested_value_links: ['Safety'],
      },
    ]
  }

  if (q.includes('medication')) {
    return [
      {
        name: 'Medications',
        description: 'Take daily medications',
        activity_type: 'recurring',
        frequency: 'daily',
        context: ['home'],
        time_type: 'B',
        emotional_weight: 'light',
        flexibility: 'hard_scheduled',
        clusterable: false,
        duration_range_min: 2,
        duration_range_max: 10,
        is_preventive: true,
        suggested_life_domain: 'Health / Body',
        suggested_value_links: ['Safety'],
      },
    ]
  }

  if (q.includes('sleep schedule')) {
    return [
      {
        name: 'Wind-down routine',
        description: 'Evening routine to protect sleep',
        activity_type: 'recurring',
        frequency: 'daily',
        context: ['home'],
        time_type: 'C',
        emotional_weight: 'light',
        flexibility: 'soft_scheduled',
        clusterable: false,
        duration_range_min: 30,
        duration_range_max: 60,
        is_preventive: true,
        suggested_life_domain: 'Health / Body',
        suggested_value_links: ['Safety'],
      },
      {
        name: 'Morning routine',
        description: 'Morning ritual to start the day well',
        activity_type: 'recurring',
        frequency: 'daily',
        context: ['home'],
        time_type: 'B',
        emotional_weight: 'light',
        flexibility: 'soft_scheduled',
        clusterable: false,
        duration_range_min: 20,
        duration_range_max: 45,
        is_preventive: false,
        suggested_life_domain: 'Health / Body',
        suggested_value_links: [],
      },
    ]
  }

  if (q.includes('car')) {
    return [
      {
        name: 'Car maintenance',
        description: 'Oil changes, tires, registration, and upkeep',
        activity_type: 'recurring',
        frequency: 'quarterly',
        context: ['errand-out'],
        time_type: 'B',
        emotional_weight: 'light',
        flexibility: 'soft_scheduled',
        clusterable: false,
        duration_range_min: 60,
        duration_range_max: 180,
        is_preventive: true,
        suggested_life_domain: 'Finances',
        suggested_value_links: ['Financial Sufficiency'],
      },
    ]
  }

  if (q.includes('relationships') && q.includes('invest')) {
    return [
      {
        name: 'Intentional connection',
        description: 'Reach out to important people in your life',
        activity_type: 'recurring',
        frequency: 'weekly',
        context: ['phone-anywhere'],
        time_type: 'B',
        emotional_weight: 'normal',
        flexibility: 'anytime_this_week',
        clusterable: false,
        duration_range_min: 15,
        duration_range_max: 60,
        is_preventive: false,
        suggested_life_domain: 'Friendships / Social',
        suggested_value_links: ['Belonging'],
      },
    ]
  }

  if (q.includes('partner') && q.includes('schedule')) {
    return [
      {
        name: 'Date night',
        description: 'Dedicated quality time with partner',
        activity_type: 'recurring',
        frequency: 'weekly',
        context: ['errand-out'],
        time_type: 'B',
        emotional_weight: 'light',
        flexibility: 'soft_scheduled',
        clusterable: false,
        duration_range_min: 90,
        duration_range_max: 180,
        is_preventive: false,
        suggested_life_domain: 'Partnership / Romance',
        suggested_value_links: ['Belonging'],
      },
      {
        name: 'Partner coordination',
        description: 'Sync schedules, plans, and logistics',
        activity_type: 'recurring',
        frequency: 'daily',
        context: ['comms-any'],
        time_type: 'B',
        emotional_weight: 'light',
        flexibility: 'anytime_today',
        clusterable: false,
        duration_range_min: 5,
        duration_range_max: 15,
        is_preventive: false,
        suggested_life_domain: 'Partnership / Romance',
        suggested_value_links: ['Belonging'],
      },
    ]
  }

  return []
}

export function generateForSingleChoice(
  question: IntakeQuestion,
  value: string,
): ActivitySpec[] {
  const q = question.question_text.toLowerCase()
  const v = value.toLowerCase()

  // Q1: Living situation
  if (q.includes('live alone') || q.includes('partner') || q.includes('roommate')) {
    if (v === 'with a partner') {
      return [
        {
          name: 'Partner check-in',
          description: 'Daily sync on plans, needs, and how you are doing',
          activity_type: 'recurring',
          frequency: 'daily',
          context: ['comms-any'],
          time_type: 'B',
          emotional_weight: 'light',
          flexibility: 'anytime_today',
          clusterable: false,
          duration_range_min: 5,
          duration_range_max: 15,
          is_preventive: false,
          suggested_life_domain: 'Partnership / Romance',
          suggested_value_links: ['Belonging'],
        },
      ]
    }
    if (v === 'with family') {
      return [
        {
          name: 'Family coordination',
          description: 'Daily family logistics and communication',
          activity_type: 'recurring',
          frequency: 'daily',
          context: ['comms-any'],
          time_type: 'B',
          emotional_weight: 'light',
          flexibility: 'anytime_today',
          clusterable: false,
          is_preventive: false,
          suggested_life_domain: 'Family',
          suggested_value_links: ['Belonging'],
        },
        {
          name: 'Household management',
          description: 'Weekly household tasks and upkeep',
          activity_type: 'recurring',
          frequency: 'weekly',
          context: ['home'],
          time_type: 'B',
          emotional_weight: 'light',
          flexibility: 'anytime_this_week',
          clusterable: true,
          is_preventive: true,
          suggested_life_domain: 'Home / Household',
          suggested_value_links: [],
        },
      ]
    }
    if (v === 'with roommates') {
      return [
        {
          name: 'Household coordination',
          description: 'Shared chores, bills, and household communication',
          activity_type: 'recurring',
          frequency: 'weekly',
          context: ['comms-any'],
          time_type: 'B',
          emotional_weight: 'light',
          flexibility: 'anytime_this_week',
          clusterable: false,
          is_preventive: false,
          suggested_life_domain: 'Home / Household',
          suggested_value_links: [],
        },
      ]
    }
    return []
  }

  // Q3: Work situation
  if (q.includes('work situation')) {
    if (v === 'employed') {
      return [
        {
          name: 'Professional development',
          description: 'Learning, training, and staying current in your field',
          activity_type: 'recurring',
          frequency: 'monthly',
          context: ['computer-home', 'focused-quiet'],
          time_type: 'B',
          emotional_weight: 'normal',
          flexibility: 'anytime_this_week',
          clusterable: false,
          duration_range_min: 60,
          duration_range_max: 120,
          is_preventive: false,
          suggested_life_domain: 'Work / Livelihood',
          suggested_value_links: [],
        },
      ]
    }
    if (v === 'self-employed' || v === 'freelance') {
      return [
        {
          name: 'Admin & invoicing',
          description: 'Invoices, contracts, business admin tasks',
          activity_type: 'recurring',
          frequency: 'weekly',
          context: ['computer-home'],
          time_type: 'B',
          emotional_weight: 'normal',
          flexibility: 'anytime_this_week',
          clusterable: true,
          duration_range_min: 30,
          duration_range_max: 60,
          is_preventive: true,
          suggested_life_domain: 'Work / Livelihood',
          suggested_value_links: ['Financial Sufficiency'],
        },
      ]
    }
    if (v === 'student') {
      return [
        {
          name: 'Study sessions',
          description: 'Focused study and coursework',
          activity_type: 'recurring',
          frequency: 'daily',
          context: ['computer-home', 'focused-quiet'],
          time_type: 'A',
          emotional_weight: 'normal',
          flexibility: 'soft_scheduled',
          clusterable: false,
          duration_range_min: 60,
          duration_range_max: 180,
          is_preventive: false,
          suggested_life_domain: 'Personal Growth / Learning',
          suggested_value_links: [],
        },
      ]
    }
    return []
  }

  // Q4: Work location
  if (q.includes('work from home') || q.includes('commute') || q.includes('hybrid')) {
    if (v === 'commute') {
      return [
        {
          name: 'Commute',
          description: 'Daily travel to and from work',
          activity_type: 'recurring',
          frequency: 'daily',
          context: ['errand-out'],
          time_type: 'B',
          emotional_weight: 'light',
          flexibility: 'hard_scheduled',
          clusterable: false,
          duration_range_min: 20,
          duration_range_max: 60,
          is_preventive: false,
          suggested_life_domain: 'Work / Livelihood',
          suggested_value_links: [],
        },
      ]
    }
    if (v === 'hybrid') {
      return [
        {
          name: 'Office commute days',
          description: 'Travel on days you go into the office',
          activity_type: 'recurring',
          frequency: 'weekly',
          context: ['errand-out'],
          time_type: 'B',
          emotional_weight: 'light',
          flexibility: 'hard_scheduled',
          clusterable: false,
          duration_range_min: 20,
          duration_range_max: 60,
          is_preventive: false,
          suggested_life_domain: 'Work / Livelihood',
          suggested_value_links: [],
        },
      ]
    }
    return []
  }

  // Q5: Work structure
  if (q.includes('structured') && q.includes('self-directed')) {
    if (v === 'mostly self-directed' || v === 'mix') {
      return [
        {
          name: 'Deep work block',
          description: 'Protected focus time for high-priority projects',
          activity_type: 'recurring',
          frequency: 'daily',
          context: ['computer-home', 'focused-quiet'],
          time_type: 'A',
          emotional_weight: 'normal',
          flexibility: 'soft_scheduled',
          clusterable: false,
          duration_range_min: 90,
          duration_range_max: 180,
          is_preventive: false,
          suggested_life_domain: 'Work / Livelihood',
          suggested_value_links: [],
        },
      ]
    }
    return []
  }

  // Q7: Morning/night
  if (q.includes('morning person') || q.includes('night person')) {
    if (v === 'morning') {
      return [
        {
          name: 'Morning routine',
          description: 'Start-of-day ritual to set the tone',
          activity_type: 'recurring',
          frequency: 'daily',
          context: ['home'],
          time_type: 'B',
          emotional_weight: 'light',
          flexibility: 'soft_scheduled',
          clusterable: false,
          duration_range_min: 20,
          duration_range_max: 45,
          is_preventive: false,
          suggested_life_domain: 'Health / Body',
          suggested_value_links: [],
        },
      ]
    }
    if (v === 'night') {
      return [
        {
          name: 'Evening wind-down',
          description: 'End-of-day ritual and reflection',
          activity_type: 'recurring',
          frequency: 'daily',
          context: ['home'],
          time_type: 'C',
          emotional_weight: 'light',
          flexibility: 'soft_scheduled',
          clusterable: false,
          duration_range_min: 30,
          duration_range_max: 60,
          is_preventive: false,
          suggested_life_domain: 'Health / Body',
          suggested_value_links: [],
        },
      ]
    }
    return []
  }

  // Q11: Cooking
  if (q.includes('cook most meals') || q.includes('mostly eat out')) {
    if (v === 'cook most meals') {
      return [
        {
          name: 'Meal planning',
          description: 'Plan meals and grocery list for the week',
          activity_type: 'recurring',
          frequency: 'weekly',
          context: ['computer-home'],
          time_type: 'B',
          emotional_weight: 'light',
          flexibility: 'anytime_this_week',
          clusterable: false,
          duration_range_min: 20,
          duration_range_max: 40,
          is_preventive: false,
          suggested_life_domain: 'Home / Household',
          suggested_value_links: [],
        },
        {
          name: 'Grocery shopping',
          activity_type: 'recurring',
          frequency: 'weekly',
          context: ['errand-out'],
          time_type: 'B',
          emotional_weight: 'light',
          flexibility: 'soft_scheduled',
          clusterable: true,
          duration_range_min: 30,
          duration_range_max: 60,
          is_preventive: false,
          suggested_life_domain: 'Home / Household',
          suggested_value_links: [],
        },
      ]
    }
    if (v === 'share cooking') {
      return [
        {
          name: 'Meal planning',
          description: 'Coordinate weekly meals with household',
          activity_type: 'recurring',
          frequency: 'weekly',
          context: ['comms-any'],
          time_type: 'B',
          emotional_weight: 'light',
          flexibility: 'anytime_this_week',
          clusterable: false,
          duration_range_min: 15,
          duration_range_max: 30,
          is_preventive: false,
          suggested_life_domain: 'Home / Household',
          suggested_value_links: [],
        },
        {
          name: 'Grocery shopping',
          activity_type: 'recurring',
          frequency: 'weekly',
          context: ['errand-out'],
          time_type: 'B',
          emotional_weight: 'light',
          flexibility: 'soft_scheduled',
          clusterable: true,
          duration_range_min: 30,
          duration_range_max: 60,
          is_preventive: false,
          suggested_life_domain: 'Home / Household',
          suggested_value_links: [],
        },
      ]
    }
    return []
  }

  // Q19: Finances
  if (q.includes('finances and bills')) {
    if (v === 'handle my own' || v === 'share that') {
      const activities: ActivitySpec[] = [
        {
          name: 'Bill pay',
          description: 'Pay monthly bills and review statements',
          activity_type: 'recurring',
          frequency: 'monthly',
          context: ['computer-home'],
          time_type: 'B',
          emotional_weight: 'light',
          flexibility: 'anytime_this_week',
          clusterable: true,
          duration_range_min: 20,
          duration_range_max: 40,
          is_preventive: true,
          suggested_life_domain: 'Finances',
          suggested_value_links: ['Financial Sufficiency'],
        },
      ]
      if (v === 'handle my own') {
        activities.push({
          name: 'Budget review',
          description: 'Monthly check on spending, savings, and financial goals',
          activity_type: 'recurring',
          frequency: 'monthly',
          context: ['computer-home'],
          time_type: 'A',
          emotional_weight: 'normal',
          flexibility: 'anytime_this_week',
          clusterable: false,
          duration_range_min: 30,
          duration_range_max: 60,
          is_preventive: false,
          suggested_life_domain: 'Finances',
          suggested_value_links: ['Financial Sufficiency'],
        })
      }
      return activities
    }
    return []
  }

  // Q20: Own/rent
  if (q.includes('own or rent')) {
    if (v === 'own') {
      return [
        {
          name: 'Home maintenance',
          description: 'Seasonal upkeep, repairs, and home care',
          activity_type: 'recurring',
          frequency: 'quarterly',
          context: ['hands-free'],
          time_type: 'B',
          emotional_weight: 'normal',
          flexibility: 'anytime_this_week',
          clusterable: false,
          duration_range_min: 60,
          duration_range_max: 240,
          is_preventive: true,
          suggested_life_domain: 'Home / Household',
          suggested_value_links: ['Financial Sufficiency'],
        },
      ]
    }
    if (v === 'rent') {
      return [
        {
          name: 'Lease renewal',
          description: 'Annual lease review, renewal, or apartment search',
          activity_type: 'recurring',
          frequency: 'annual',
          context: ['computer-home'],
          time_type: 'B',
          emotional_weight: 'normal',
          flexibility: 'anytime_this_week',
          clusterable: false,
          duration_range_min: 30,
          duration_range_max: 60,
          is_preventive: true,
          suggested_life_domain: 'Finances',
          suggested_value_links: ['Financial Sufficiency'],
        },
      ]
    }
    return []
  }

  // Q29: Best focus time — no activities, just a preference signal
  if (q.includes('best focus time')) {
    return []
  }

  return []
}

export function generateForNumber(
  question: IntakeQuestion,
  _value: number,
): ActivitySpec[] {
  // Q13: Hours per week — informational, no direct activities
  return []
}

// ─── Main dispatcher ───────────────────────────────────────────────────────

export async function generateActivitySpecs(
  question: IntakeQuestion,
  responseValue: unknown,
  userValues: UserValue[],
  userDomains: LifeDomain[],
): Promise<ActivitySpec[]> {
  const { question_type } = question

  if (question_type === 'freetext') {
    const text = typeof responseValue === 'string' ? responseValue : String(responseValue)
    if (!text.trim() || text.toLowerCase() === 'no' || text.toLowerCase() === 'none') {
      return []
    }
    return generateForFreetext(question, text, userValues, userDomains)
  }

  if (question_type === 'boolean') {
    const boolValue =
      responseValue === true ||
      responseValue === 'true' ||
      responseValue === 'yes' ||
      responseValue === 'Yes'
    return generateForBoolean(question, boolValue)
  }

  if (question_type === 'single_choice') {
    const strValue = typeof responseValue === 'string' ? responseValue : String(responseValue)
    return generateForSingleChoice(question, strValue)
  }

  if (question_type === 'number') {
    const numValue = typeof responseValue === 'number' ? responseValue : parseFloat(String(responseValue))
    return generateForNumber(question, isNaN(numValue) ? 0 : numValue)
  }

  return []
}
