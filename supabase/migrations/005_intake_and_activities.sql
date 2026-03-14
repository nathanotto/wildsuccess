-- 005_intake_and_activities.sql
-- Adds intake system, hopper, schedule, and enriched activity templates

-- ─── Extend activities table ───────────────────────────────────────────────

ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS context text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS energy_level text DEFAULT 'B'
    CHECK (energy_level IN ('A', 'B', 'C')),
  ADD COLUMN IF NOT EXISTS emotional_weight text DEFAULT 'normal'
    CHECK (emotional_weight IN ('light', 'normal', 'heavy')),
  ADD COLUMN IF NOT EXISTS flexibility text DEFAULT 'anytime_this_week'
    CHECK (flexibility IN ('hard_scheduled', 'soft_scheduled', 'anytime_today', 'anytime_this_week')),
  ADD COLUMN IF NOT EXISTS clusterable boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS prep_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS prep_notes text,
  ADD COLUMN IF NOT EXISTS depends_on_others boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS dependency_notes text,
  ADD COLUMN IF NOT EXISTS duration_range_min integer,
  ADD COLUMN IF NOT EXISTS duration_range_max integer,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'user_created'
    CHECK (source IN ('template_derived', 'user_created', 'outside_request', 'planning_function')),
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- ─── intake_questions (system reference data) ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.intake_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text text NOT NULL,
  question_type text NOT NULL
    CHECK (question_type IN ('boolean', 'single_choice', 'multi_choice', 'number', 'freetext')),
  options jsonb,
  domain_tag text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  payoff_description text NOT NULL,
  is_seed_question boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.intake_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intake_questions_select_auth" ON public.intake_questions
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── intake_responses ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.intake_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.intake_questions(id) ON DELETE CASCADE,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, question_id)
);

ALTER TABLE public.intake_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intake_responses_select_own" ON public.intake_responses
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "intake_responses_insert_own" ON public.intake_responses
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "intake_responses_update_own" ON public.intake_responses
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "intake_responses_delete_own" ON public.intake_responses
  FOR DELETE USING (auth.uid() = user_id);

-- ─── hopper_items ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hopper_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_input text NOT NULL,
  source text NOT NULL
    CHECK (source IN ('quick_capture', 'template_proposal', 'outside_request', 'planning_function')),
  activity_id uuid REFERENCES public.activities(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'activated', 'dismissed', 'ignored', 'archived')),
  proposed_date date,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.hopper_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hopper_items_select_own" ON public.hopper_items
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "hopper_items_insert_own" ON public.hopper_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "hopper_items_update_own" ON public.hopper_items
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "hopper_items_delete_own" ON public.hopper_items
  FOR DELETE USING (auth.uid() = user_id);

-- ─── schedule_items ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.schedule_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES public.activities(id) ON DELETE SET NULL,
  hopper_item_id uuid REFERENCES public.hopper_items(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  scheduled_date date NOT NULL,
  scheduled_time time,
  scheduled_end_time time,
  flexibility text NOT NULL DEFAULT 'anytime_today'
    CHECK (flexibility IN ('hard_scheduled', 'soft_scheduled', 'anytime_today')),
  context text[] DEFAULT '{}',
  energy_level text DEFAULT 'B' CHECK (energy_level IN ('A', 'B', 'C')),
  emotional_weight text DEFAULT 'normal'
    CHECK (emotional_weight IN ('light', 'normal', 'heavy')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'skipped', 'rescheduled')),
  completion_note text,
  actual_duration_minutes integer,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedule_items_select_own" ON public.schedule_items
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "schedule_items_insert_own" ON public.schedule_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "schedule_items_update_own" ON public.schedule_items
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "schedule_items_delete_own" ON public.schedule_items
  FOR DELETE USING (auth.uid() = user_id);

-- ─── Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS intake_responses_user_id_idx ON public.intake_responses(user_id);
CREATE INDEX IF NOT EXISTS intake_responses_question_id_idx ON public.intake_responses(question_id);
CREATE INDEX IF NOT EXISTS hopper_items_user_id_idx ON public.hopper_items(user_id);
CREATE INDEX IF NOT EXISTS hopper_items_status_idx ON public.hopper_items(status);
CREATE INDEX IF NOT EXISTS hopper_items_proposed_date_idx ON public.hopper_items(proposed_date);
CREATE INDEX IF NOT EXISTS schedule_items_user_id_idx ON public.schedule_items(user_id);
CREATE INDEX IF NOT EXISTS schedule_items_scheduled_date_idx ON public.schedule_items(scheduled_date);
CREATE INDEX IF NOT EXISTS schedule_items_status_idx ON public.schedule_items(status);
CREATE INDEX IF NOT EXISTS schedule_items_activity_id_idx ON public.schedule_items(activity_id);
CREATE INDEX IF NOT EXISTS activities_source_idx ON public.activities(source);
CREATE INDEX IF NOT EXISTS activities_energy_level_idx ON public.activities(energy_level);
CREATE INDEX IF NOT EXISTS activities_archived_at_idx ON public.activities(archived_at);

-- ─── Updated_at triggers ───────────────────────────────────────────────────

CREATE TRIGGER set_intake_responses_updated_at
  BEFORE UPDATE ON public.intake_responses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_hopper_items_updated_at
  BEFORE UPDATE ON public.hopper_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_schedule_items_updated_at
  BEFORE UPDATE ON public.schedule_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Seed intake_questions ─────────────────────────────────────────────────

INSERT INTO public.intake_questions
  (question_text, question_type, options, domain_tag, sort_order, payoff_description, is_seed_question)
VALUES
-- Seed questions (is_seed_question = true, asked before first Map use)
(
  'Do you live alone, with a partner, with family, or with roommates?',
  'single_choice',
  '["alone", "with a partner", "with family", "with roommates"]',
  'household', 1,
  'Generates shared meal, household coordination, and personal space templates',
  true
),
(
  'Do you have kids? If so, what ages?',
  'freetext', null,
  'household', 2,
  'Generates childcare, school, and family activity templates',
  true
),
(
  'What''s your work situation?',
  'single_choice',
  '["employed", "self-employed", "freelance", "between jobs", "retired", "student"]',
  'work', 3,
  'Generates work rhythm and professional maintenance templates',
  true
),
(
  'Do you work from home, commute, or hybrid?',
  'single_choice',
  '["work from home", "commute", "hybrid", "varies"]',
  'work', 4,
  'Generates commute, workspace, and transition templates',
  true
),
(
  'Is your workday mostly structured (meetings, shifts) or mostly self-directed?',
  'single_choice',
  '["mostly structured", "mostly self-directed", "mix"]',
  'work', 5,
  'Determines how Organize proposes your time blocks',
  true
),
(
  'Do you exercise? What kind, and how often ideally?',
  'freetext', null,
  'health', 6,
  'Generates exercise and movement templates at your preferred frequency',
  true
),
(
  'Are you a morning person or a night person?',
  'single_choice',
  '["morning", "night", "neither/varies"]',
  'rhythm', 7,
  'Helps match high-energy tasks to your best hours',
  true
),
(
  'List five things you do every week at roughly the same time.',
  'freetext', null,
  'rhythm', 8,
  'Seeds your recurring activity templates directly from your real routine',
  true
),

-- Progressive questions (is_seed_question = false)

-- Household & Care
(
  'Do you have pets?',
  'boolean', null,
  'household', 9,
  'Generates pet care and vet appointment templates',
  false
),
(
  'Do you care for aging parents or other dependents?',
  'boolean', null,
  'household', 10,
  'Generates caregiving coordination templates',
  false
),
(
  'Do you cook most meals, share cooking, or mostly eat out?',
  'single_choice',
  '["cook most meals", "share cooking", "mostly eat out"]',
  'household', 11,
  'Generates meal planning and grocery templates',
  false
),
(
  'Do you eat meals with others on a regular schedule?',
  'boolean', null,
  'household', 12,
  'Blocks shared mealtimes in your schedule',
  false
),

-- Work
(
  'Roughly how many hours per week do you work?',
  'number', null,
  'work', 13,
  'Calibrates how much non-work time to propose activities for',
  false
),
(
  'Do you manage other people?',
  'boolean', null,
  'work', 14,
  'Generates 1:1, delegation, and team check-in templates',
  false
),
(
  'Do you have regular recurring meetings?',
  'boolean', null,
  'work', 15,
  'Helps Organize avoid proposing over your meeting blocks',
  false
),

-- Health
(
  'Do you have medical, therapy, or dental appointments to maintain?',
  'boolean', null,
  'health', 16,
  'Generates recurring health maintenance templates',
  false
),
(
  'Do you take medications that structure your day?',
  'boolean', null,
  'health', 17,
  'Adds medication reminders to your daily rhythm',
  false
),
(
  'Do you have a sleep schedule you''re trying to protect?',
  'boolean', null,
  'health', 18,
  'Protects wind-down time and morning routines',
  false
),

-- Finance & Admin
(
  'Do you handle your own finances and bills, or share that?',
  'single_choice',
  '["handle my own", "share that", "partner handles it"]',
  'finance', 19,
  'Generates bill-pay, budget review, and financial admin templates',
  false
),
(
  'Do you own or rent your home?',
  'single_choice',
  '["own", "rent"]',
  'finance', 20,
  'Generates property maintenance or lease renewal templates',
  false
),
(
  'Do you have a car to maintain?',
  'boolean', null,
  'finance', 21,
  'Generates car maintenance and registration templates',
  false
),

-- Social & Relationships
(
  'Do you have regular social commitments (weekly dinner, group, church, club)?',
  'freetext', null,
  'social', 22,
  'Seeds recurring social activity templates',
  false
),
(
  'Are there relationships you want to invest in more deliberately?',
  'boolean', null,
  'social', 23,
  'Generates intentional connection templates (calls, visits, letters)',
  false
),
(
  'Do you have a partner whose schedule interacts with yours?',
  'boolean', null,
  'social', 24,
  'Generates couple coordination and date templates',
  false
),

-- Personal Growth & Meaning
(
  'Are you learning anything right now, or want to be?',
  'freetext', null,
  'growth', 25,
  'Generates study, practice, and learning session templates',
  false
),
(
  'Do you have a creative practice or hobby?',
  'freetext', null,
  'growth', 26,
  'Generates dedicated creative time templates',
  false
),
(
  'Do you have a spiritual or reflective practice?',
  'freetext', null,
  'growth', 27,
  'Generates meditation, prayer, or journaling templates',
  false
),
(
  'Is there a big personal project or goal on your mind?',
  'freetext', null,
  'growth', 28,
  'Creates a Big Outcome and generates supporting activity templates',
  false
),

-- Rhythm & Preference
(
  'When''s your best focus time?',
  'single_choice',
  '["early morning", "mid-morning", "early afternoon", "late afternoon", "evening", "late night"]',
  'rhythm', 29,
  'Reserves your peak hours for A-level tasks',
  false
),
(
  'What''s the thing you most wish you made more time for?',
  'freetext', null,
  'rhythm', 30,
  'Creates a protected activity template for what matters most to you',
  false
),
(
  'What''s the thing that always falls through the cracks?',
  'freetext', null,
  'rhythm', 31,
  'Creates a recurring template with nudges so this stops slipping',
  false
);
