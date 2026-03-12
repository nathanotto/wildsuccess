# SESSION 1: Map Module — Schema, Migrations, Auth, and Seed Data

## Context

You are building Wild Success, a personal productivity and attention-management app. The stack is Next.js + Supabase + Vercel. The repo has Next.js scaffolding only — no app code yet.

**Read these project files before doing anything:**
- `Map_Module_Schema.md` — the non-technical schema description. This is your source of truth for data objects and their relationships.
- `Map_Module_Task_Flows.md` — the functional specification. Read the overview and visual design constraints. You are NOT building the UI in this session, but understanding it will inform schema decisions.
- `wild-success-constitutional-reference.docx` — the philosophical foundation. Skim sections 1-3 for context on values, the preventive/promotional distinction, and sufficiency.

This session builds the database layer only. No API routes, no UI. Sessions 2 and 3 will build on this.

---

## What to Build

### 1. Supabase Auth Setup

Use Supabase Auth. Do NOT create a custom users table. Every table uses `user_id uuid references auth.users(id) on delete cascade`.

Create a minimal `user_profiles` table for app-specific user state:

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, references auth.users(id) on delete cascade |
| display_name | text | nullable |
| intake_status | text | not null, default 'not_started', check in ('not_started', 'in_progress', 'complete') |
| intake_progress | jsonb | nullable, tracks which intake steps are done (e.g. {"preventive_values": true, "promotional_values": false, ...}) |
| created_at | timestamptz | not null, default now() |
| updated_at | timestamptz | not null, default now() |

### 2. Map Module Tables

**IMPORTANT:** The table name `values` is a SQL reserved word. Name the table `user_values` instead.

All tables get `id uuid primary key default gen_random_uuid()` unless noted.

#### `user_values`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users, not null |
| name | text | not null |
| description | text | nullable, user's own words |
| value_type | text | not null, check in ('preventive', 'promotional') |
| sufficiency_threshold | text | nullable, qualitative — e.g. "6 months emergency fund". Preventive values only. |
| sufficiency_status | text | not null, default 'unassessed', check in ('unassessed', 'insufficient', 'partial', 'sufficient') |
| sort_order | integer | not null, default 0 |
| is_active | boolean | not null, default true |
| created_at | timestamptz | not null, default now() |
| updated_at | timestamptz | not null, default now() |

Unique constraint on (user_id, name).

#### `life_domains`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users, not null |
| name | text | not null |
| description | text | nullable |
| color | text | nullable, hex color |
| sort_order | integer | not null, default 0 |
| is_active | boolean | not null, default true |
| created_at | timestamptz | not null, default now() |
| updated_at | timestamptz | not null, default now() |

Unique constraint on (user_id, name).

#### `big_outcomes`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users, not null |
| name | text | not null |
| description | text | nullable |
| status | text | not null, default 'aspirational', check in ('aspirational', 'in_progress', 'achieved', 'abandoned') |
| target_date | date | nullable |
| completed_at | timestamptz | nullable |
| completion_note | text | nullable, preserved in the visible record |
| abandonment_reason | text | nullable, preserved |
| life_domain_id | uuid | FK → life_domains, nullable, on delete set null |
| sort_order | integer | not null, default 0 |
| created_at | timestamptz | not null, default now() |
| updated_at | timestamptz | not null, default now() |

#### `big_outcome_value_links`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users, not null (denormalized for RLS) |
| big_outcome_id | uuid | FK → big_outcomes, not null, on delete cascade |
| value_id | uuid | FK → user_values, not null, on delete cascade |
| contribution_strength | text | not null, default 'moderate', check in ('weak', 'moderate', 'strong') |
| created_at | timestamptz | not null, default now() |

Unique constraint on (big_outcome_id, value_id).

#### `activities`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users, not null |
| name | text | not null |
| description | text | nullable |
| activity_type | text | not null, check in ('recurring', 'one_time') |
| frequency | text | nullable, check in ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annual'). Required if recurring. |
| target_date | date | nullable. Used for one-time activities. |
| status | text | not null, default 'active', check in ('active', 'aspirational', 'paused', 'completed') |
| is_preventive | boolean | not null, default false |
| life_domain_id | uuid | FK → life_domains, nullable, on delete set null |
| big_outcome_id | uuid | FK → big_outcomes, nullable, on delete set null |
| default_duration_minutes | integer | nullable |
| preferred_days | text[] | nullable, array of day names |
| preferred_time | text | nullable, e.g. 'morning', 'afternoon', 'evening' |
| default_location | text | nullable |
| participants | text | nullable, freeform |
| sort_order | integer | not null, default 0 |
| created_at | timestamptz | not null, default now() |
| updated_at | timestamptz | not null, default now() |

#### `activity_value_links`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users, not null (denormalized for RLS) |
| activity_id | uuid | FK → activities, not null, on delete cascade |
| value_id | uuid | FK → user_values, not null, on delete cascade |
| contribution_strength | text | not null, default 'moderate', check in ('weak', 'moderate', 'strong') |
| created_at | timestamptz | not null, default now() |

Unique constraint on (activity_id, value_id).

#### `activity_log`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| activity_id | uuid | FK → activities, not null, on delete cascade |
| user_id | uuid | FK → auth.users, not null |
| performed_at | timestamptz | not null, default now() |
| note | text | nullable |
| duration_minutes | integer | nullable |
| created_at | timestamptz | not null, default now() |

#### `day_log`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users, not null |
| log_date | date | not null |
| journal_note | text | nullable |
| gratitude_note | text | nullable |
| mood_energy | integer | nullable, check between 1 and 5 |
| created_at | timestamptz | not null, default now() |
| updated_at | timestamptz | not null, default now() |

Unique constraint on (user_id, log_date).

### 3. Row Level Security (RLS)

Enable RLS on ALL tables. Every table has a `user_id` column (including the denormalized join tables). Use this pattern on every table:

```sql
alter table [table] enable row level security;

create policy "[table]_select_own" on [table]
  for select using (auth.uid() = user_id);

create policy "[table]_insert_own" on [table]
  for insert with check (auth.uid() = user_id);

create policy "[table]_update_own" on [table]
  for update using (auth.uid() = user_id);

create policy "[table]_delete_own" on [table]
  for delete using (auth.uid() = user_id);
```

For `user_profiles`, the column is `id` not `user_id` — adjust the policy to use `auth.uid() = id`.

### 4. Triggers

Create a reusable `set_updated_at()` trigger function. Apply it to every table with an `updated_at` column.

Create a trigger on `auth.users` that auto-creates a profile row and seeds default Map data when a new user signs up:

```sql
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into user_profiles (id) values (new.id);
  perform seed_default_map_data(new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

### 5. Seed Function

Create a database function `seed_default_map_data(p_user_id uuid)` that populates the default values and life domains for a new user.

**Default values (preventive), in order:**
1. Safety
2. Financial Sufficiency
3. Health
4. Belonging

**Default values (promotional), in order:**
5. Freedom
6. Creative Expression
7. Purpose & Meaning
8. Adventure

**Default life domains, in order:**
1. Home
2. Work & Career
3. Finances
4. Health
5. Family
6. Friends & Community
7. Recreation & Play
8. Inner Life
9. Downtime
10. Public Life

Set `sort_order` to preserve list order (0, 1, 2, ...). No default activities or big outcomes — those come from the intake conversation.

### 6. Indexes

Add indexes on:
- Every `user_id` column (all tables)
- `activities.life_domain_id`
- `activities.big_outcome_id`
- `activities.status`
- `activity_log.performed_at`
- `activity_log.activity_id`
- `day_log.log_date`
- `big_outcomes.status`
- `big_outcomes.life_domain_id`

### 7. Migration File Structure

Put everything in a single migration file: `supabase/migrations/001_map_module.sql`

Order:
1. Trigger functions (set_updated_at, seed_default_map_data, handle_new_user)
2. Tables (respecting FK dependencies: user_profiles → user_values → life_domains → big_outcomes → big_outcome_value_links → activities → activity_value_links → activity_log → day_log)
3. RLS policies on all tables
4. Indexes
5. Apply updated_at triggers to relevant tables
6. Apply auth trigger (on_auth_user_created)

---

## What NOT to Build

- No API routes (Session 2)
- No UI components (Session 2)
- No Anthropic API integration (Session 3)
- No computed views as database views — those will be application-layer queries

## Verification

After creating the migration, verify the SQL is syntactically correct. If there's a local Supabase instance, run `supabase db reset` to test. Check that:
- All tables create without errors
- RLS is enabled on all tables
- The seed function runs and produces 8 values and 10 life domains
- The auth trigger fires on user creation and calls the seed function
- Foreign key cascades work (delete a life domain → activities.life_domain_id set null)
- Unique constraints reject duplicates (try inserting two values with the same name for the same user)

---

## Session 2 Preview (for context only — do not build)

Session 2 builds the Map canvas UI and API routes. The user will see a spatial, zoomable, desktop-first canvas showing their values, life domains, activities, big outcomes, and connections. All CRUD operations for Map data objects. In-place editing — clicked elements expand but the user stays on the Map. Light background, colorful organic shapes for domains, warm/cool heat indicators on values. Six action mode buttons stubbed as "coming soon" (Right Now, Organizing, Planning, Communicating, Spending, Activity Review). No AI yet.

## Session 3 Preview (for context only — do not build)

Session 3 adds the AI-powered intake conversation. A Claude-powered sidebar (using the Anthropic API) walks the user through their values — safety, sufficiency, freedom, opportunity — unpacked into concrete life dimensions. It surfaces activities and big outcomes through natural conversation. The Map populates in real time as the user talks. Intake is implicitly resumable — autosave throughout, the user can leave and come back. Also adds the AI help button for post-intake Map questions.