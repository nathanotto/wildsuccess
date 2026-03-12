-- =============================================================================
-- Wild Success: Map Module
-- Migration 001: Schema, RLS, Indexes, Triggers, Seed Function
-- =============================================================================


-- =============================================================================
-- 1. TRIGGER FUNCTIONS
-- =============================================================================

-- Reusable updated_at trigger
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Seed default map data for a new user
create or replace function seed_default_map_data(p_user_id uuid)
returns void as $$
begin
  -- Default preventive values
  insert into user_values (user_id, name, value_type, sort_order) values
    (p_user_id, 'Safety',                'preventive',   0),
    (p_user_id, 'Financial Sufficiency', 'preventive',   1),
    (p_user_id, 'Health',                'preventive',   2),
    (p_user_id, 'Belonging',             'preventive',   3),
    (p_user_id, 'Freedom',               'promotional',  4),
    (p_user_id, 'Creative Expression',   'promotional',  5),
    (p_user_id, 'Purpose & Meaning',     'promotional',  6),
    (p_user_id, 'Adventure',             'promotional',  7);

  -- Default life domains
  insert into life_domains (user_id, name, sort_order) values
    (p_user_id, 'Home',                 0),
    (p_user_id, 'Work & Career',        1),
    (p_user_id, 'Finances',             2),
    (p_user_id, 'Health',               3),
    (p_user_id, 'Family',               4),
    (p_user_id, 'Friends & Community',  5),
    (p_user_id, 'Recreation & Play',    6),
    (p_user_id, 'Inner Life',           7),
    (p_user_id, 'Downtime',             8),
    (p_user_id, 'Public Life',          9);
end;
$$ language plpgsql security definer;

-- Auto-create profile and seed data on new user signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into user_profiles (id) values (new.id);
  perform seed_default_map_data(new.id);
  return new;
end;
$$ language plpgsql security definer;


-- =============================================================================
-- 2. TABLES
-- =============================================================================

-- user_profiles
create table user_profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  display_name     text,
  intake_status    text not null default 'not_started'
                     check (intake_status in ('not_started', 'in_progress', 'complete')),
  intake_progress  jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- user_values
create table user_values (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  name                  text not null,
  description           text,
  value_type            text not null check (value_type in ('preventive', 'promotional')),
  sufficiency_threshold text,
  sufficiency_status    text not null default 'unassessed'
                          check (sufficiency_status in ('unassessed', 'insufficient', 'partial', 'sufficient')),
  sort_order            integer not null default 0,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (user_id, name)
);

-- life_domains
create table life_domains (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  color       text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, name)
);

-- big_outcomes
create table big_outcomes (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  name                text not null,
  description         text,
  status              text not null default 'aspirational'
                        check (status in ('aspirational', 'in_progress', 'achieved', 'abandoned')),
  target_date         date,
  completed_at        timestamptz,
  completion_note     text,
  abandonment_reason  text,
  life_domain_id      uuid references life_domains(id) on delete set null,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- big_outcome_value_links
create table big_outcome_value_links (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  big_outcome_id        uuid not null references big_outcomes(id) on delete cascade,
  value_id              uuid not null references user_values(id) on delete cascade,
  contribution_strength text not null default 'moderate'
                          check (contribution_strength in ('weak', 'moderate', 'strong')),
  created_at            timestamptz not null default now(),
  unique (big_outcome_id, value_id)
);

-- activities
create table activities (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  name                     text not null,
  description              text,
  activity_type            text not null check (activity_type in ('recurring', 'one_time')),
  frequency                text check (frequency in ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annual')),
  target_date              date,
  status                   text not null default 'active'
                             check (status in ('active', 'aspirational', 'paused', 'completed')),
  is_preventive            boolean not null default false,
  life_domain_id           uuid references life_domains(id) on delete set null,
  big_outcome_id           uuid references big_outcomes(id) on delete set null,
  default_duration_minutes integer,
  preferred_days           text[],
  preferred_time           text,
  default_location         text,
  participants             text,
  sort_order               integer not null default 0,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- activity_value_links
create table activity_value_links (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  activity_id           uuid not null references activities(id) on delete cascade,
  value_id              uuid not null references user_values(id) on delete cascade,
  contribution_strength text not null default 'moderate'
                          check (contribution_strength in ('weak', 'moderate', 'strong')),
  created_at            timestamptz not null default now(),
  unique (activity_id, value_id)
);

-- activity_log
create table activity_log (
  id               uuid primary key default gen_random_uuid(),
  activity_id      uuid not null references activities(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  performed_at     timestamptz not null default now(),
  note             text,
  duration_minutes integer,
  created_at       timestamptz not null default now()
);

-- day_log
create table day_log (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  log_date       date not null,
  journal_note   text,
  gratitude_note text,
  mood_energy    integer check (mood_energy between 1 and 5),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, log_date)
);


-- =============================================================================
-- 3. ROW LEVEL SECURITY
-- =============================================================================

-- user_profiles (uses id, not user_id)
alter table user_profiles enable row level security;

create policy "user_profiles_select_own" on user_profiles
  for select using (auth.uid() = id);
create policy "user_profiles_insert_own" on user_profiles
  for insert with check (auth.uid() = id);
create policy "user_profiles_update_own" on user_profiles
  for update using (auth.uid() = id);
create policy "user_profiles_delete_own" on user_profiles
  for delete using (auth.uid() = id);

-- user_values
alter table user_values enable row level security;

create policy "user_values_select_own" on user_values
  for select using (auth.uid() = user_id);
create policy "user_values_insert_own" on user_values
  for insert with check (auth.uid() = user_id);
create policy "user_values_update_own" on user_values
  for update using (auth.uid() = user_id);
create policy "user_values_delete_own" on user_values
  for delete using (auth.uid() = user_id);

-- life_domains
alter table life_domains enable row level security;

create policy "life_domains_select_own" on life_domains
  for select using (auth.uid() = user_id);
create policy "life_domains_insert_own" on life_domains
  for insert with check (auth.uid() = user_id);
create policy "life_domains_update_own" on life_domains
  for update using (auth.uid() = user_id);
create policy "life_domains_delete_own" on life_domains
  for delete using (auth.uid() = user_id);

-- big_outcomes
alter table big_outcomes enable row level security;

create policy "big_outcomes_select_own" on big_outcomes
  for select using (auth.uid() = user_id);
create policy "big_outcomes_insert_own" on big_outcomes
  for insert with check (auth.uid() = user_id);
create policy "big_outcomes_update_own" on big_outcomes
  for update using (auth.uid() = user_id);
create policy "big_outcomes_delete_own" on big_outcomes
  for delete using (auth.uid() = user_id);

-- big_outcome_value_links
alter table big_outcome_value_links enable row level security;

create policy "big_outcome_value_links_select_own" on big_outcome_value_links
  for select using (auth.uid() = user_id);
create policy "big_outcome_value_links_insert_own" on big_outcome_value_links
  for insert with check (auth.uid() = user_id);
create policy "big_outcome_value_links_update_own" on big_outcome_value_links
  for update using (auth.uid() = user_id);
create policy "big_outcome_value_links_delete_own" on big_outcome_value_links
  for delete using (auth.uid() = user_id);

-- activities
alter table activities enable row level security;

create policy "activities_select_own" on activities
  for select using (auth.uid() = user_id);
create policy "activities_insert_own" on activities
  for insert with check (auth.uid() = user_id);
create policy "activities_update_own" on activities
  for update using (auth.uid() = user_id);
create policy "activities_delete_own" on activities
  for delete using (auth.uid() = user_id);

-- activity_value_links
alter table activity_value_links enable row level security;

create policy "activity_value_links_select_own" on activity_value_links
  for select using (auth.uid() = user_id);
create policy "activity_value_links_insert_own" on activity_value_links
  for insert with check (auth.uid() = user_id);
create policy "activity_value_links_update_own" on activity_value_links
  for update using (auth.uid() = user_id);
create policy "activity_value_links_delete_own" on activity_value_links
  for delete using (auth.uid() = user_id);

-- activity_log
alter table activity_log enable row level security;

create policy "activity_log_select_own" on activity_log
  for select using (auth.uid() = user_id);
create policy "activity_log_insert_own" on activity_log
  for insert with check (auth.uid() = user_id);
create policy "activity_log_update_own" on activity_log
  for update using (auth.uid() = user_id);
create policy "activity_log_delete_own" on activity_log
  for delete using (auth.uid() = user_id);

-- day_log
alter table day_log enable row level security;

create policy "day_log_select_own" on day_log
  for select using (auth.uid() = user_id);
create policy "day_log_insert_own" on day_log
  for insert with check (auth.uid() = user_id);
create policy "day_log_update_own" on day_log
  for update using (auth.uid() = user_id);
create policy "day_log_delete_own" on day_log
  for delete using (auth.uid() = user_id);


-- =============================================================================
-- 4. INDEXES
-- =============================================================================

-- user_id indexes (all tables)
create index on user_profiles (id);
create index on user_values (user_id);
create index on life_domains (user_id);
create index on big_outcomes (user_id);
create index on big_outcome_value_links (user_id);
create index on activities (user_id);
create index on activity_value_links (user_id);
create index on activity_log (user_id);
create index on day_log (user_id);

-- additional targeted indexes
create index on activities (life_domain_id);
create index on activities (big_outcome_id);
create index on activities (status);
create index on activity_log (performed_at);
create index on activity_log (activity_id);
create index on day_log (log_date);
create index on big_outcomes (status);
create index on big_outcomes (life_domain_id);


-- =============================================================================
-- 5. UPDATED_AT TRIGGERS
-- =============================================================================

create trigger set_updated_at_user_profiles
  before update on user_profiles
  for each row execute function set_updated_at();

create trigger set_updated_at_user_values
  before update on user_values
  for each row execute function set_updated_at();

create trigger set_updated_at_life_domains
  before update on life_domains
  for each row execute function set_updated_at();

create trigger set_updated_at_big_outcomes
  before update on big_outcomes
  for each row execute function set_updated_at();

create trigger set_updated_at_activities
  before update on activities
  for each row execute function set_updated_at();

create trigger set_updated_at_day_log
  before update on day_log
  for each row execute function set_updated_at();


-- =============================================================================
-- 6. AUTH TRIGGER
-- =============================================================================

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
