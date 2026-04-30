# SESSION 16: Plan Module — Multi-User Collaboration, Commitments, Action Items, and Email

## Context

You are building Wild Success, a personal productivity and attention-management app. Stack: Next.js + Supabase + Vercel.

**Sessions 14–15 are complete.** The Plan module has missions, factors (five types with lifecycle), COAs (split into action/outcome), factor-COA linking with relationship types, the Arrange step (dependencies, resource needs, time horizons), mission log, factor review on COA completion, and a living summary view.

**Read these files before doing anything:**
- `SESSION-14-PROMPT.md` — Plan module foundation (schema, factor entry, COA linking, Plan-to-Map bridge)
- `SESSION-15-PROMPT.md` — Arrange step, split COA, factor lifecycle, mission log, resource needs
- `Wild_Success_Principles.md` — Principle 5 (agency), Principle 7 (tit-for-tat, commitment), Principle 2 (every human wants to contribute and be acknowledged)
- `wild-success-constitutional-reference.docx` — sections 6.2 (User, integrity), 6.3 (Mission), 6.8 (Commitments)

**What this session adds:**

Wild Success becomes multi-user. Users can invite collaborators to missions. Collaborators can see and edit shared missions, make commitments to COAs, and create action items. Commitments flow into full users' personal systems (hopper, /today, Map). Mission collaborators (limited-access users) interact with WS only through shared missions and receive commitment digests via email.

**Design philosophy:**

This is not project management with task assignment. This is a collaboration tool where people *choose* what to commit to (Principle 5 — agency). The mission is shared. The commitment is personal. A small trusted team works a COA together fluidly — adding action items, claiming tasks, completing work — and the plan reflects their progress. Every person who contributes is acknowledged (Principle 2).

---

## What to Build

### 1. Schema Changes

#### Account tiers and admin

**Modify `user_profiles` table:**

```sql
ALTER TABLE user_profiles ADD COLUMN app_role text NOT NULL DEFAULT 'mission_collaborator'
  CHECK (app_role IN ('admin', 'full', 'mission_collaborator'));

ALTER TABLE user_profiles ADD COLUMN communication_preferences jsonb NOT NULL DEFAULT '{
  "digest_enabled": true,
  "digest_frequency": "weekly",
  "invitation_emails": true,
  "commitment_reminders": true
}'::jsonb;
```

- `admin` — full app access plus admin panel. Can approve access requests, see all users. Initially only Nathan.
- `full` — full app access: Map, /today, /organize, /plan, values, hopper.
- `mission_collaborator` — limited access: /plan only. Can see and edit missions they participate in, create their own missions, invite their own collaborators. Cannot access Map, /today, /organize, values, hopper.

**Default role for all new signups is `mission_collaborator`.** This is safe by default — nobody gets full access without admin approval. Nathan's existing account is set to `app_role = 'admin'` in the migration.

**Communication preferences** control what emails the user receives:
- `digest_enabled` — whether the user receives the weekly commitment digest (default true)
- `digest_frequency` — "weekly" or "daily" (default "weekly", only applies when digest_enabled is true)
- `invitation_emails` — whether the user receives mission invitation emails (default true)
- `commitment_reminders` — whether the user receives commitment reminder emails (default true)

All email-sending functions must check these preferences before sending. If a preference is false, skip that email for that user. The invitation token link still works even if invitation_emails is off — the user just won't get the email notification about it.

Update the existing Supabase Auth trigger that creates `user_profiles` on signup to set `app_role = 'mission_collaborator'` as the default. This applies to all new signups — both direct and invitation-driven.

#### Access requests

**New table: `access_requests`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users, not null, on delete cascade. The requester. |
| status | text | not null, default 'pending', check in ('pending', 'approved', 'denied') |
| note | text | nullable. Optional message from the requester. |
| resolved_by | uuid | nullable FK → auth.users. The admin who resolved it. |
| requested_at | timestamptz | not null, default now() |
| resolved_at | timestamptz | nullable |

RLS: users can insert where user_id = auth.uid(). Users can select their own requests. Admins can select all, update all.

#### Commitments

**New table: `commitments`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| coa_id | uuid | FK → coas, not null, on delete cascade |
| mission_id | uuid | FK → missions, not null, on delete cascade. Denormalized for query convenience. |
| user_id | uuid | FK → auth.users, not null, on delete cascade. The person committing. |
| description | text | nullable. What specifically they're taking on, if not the whole COA. |
| deadline | timestamptz | nullable |
| status | text | not null, default 'active', check in ('active', 'completed', 'abandoned') |
| completed_at | timestamptz | nullable |
| completion_note | text | nullable |
| created_at | timestamptz | not null, default now() |
| updated_at | timestamptz | not null, default now() |

Multiple users can commit to the same COA. A user can commit to the same COA only once (unique on coa_id, user_id).

RLS: users can select commitments on missions they participate in (join through mission_participants). Users can insert/update/delete their own commitments.

#### Action items on COAs — extend existing action items table

**Do not create a separate table.** An action item is an action item, whether it comes from personal capture or a shared COA. Extend the existing action items / tasks table with COA-awareness:

```sql
ALTER TABLE [existing action items table] ADD COLUMN coa_id uuid REFERENCES coas(id) ON DELETE SET NULL;
ALTER TABLE [existing action items table] ADD COLUMN mission_id uuid REFERENCES missions(id) ON DELETE SET NULL;
ALTER TABLE [existing action items table] ADD COLUMN assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;
```

Replace `[existing action items table]` with the actual table name used in the codebase (likely `tasks`, `action_items`, or `hopper_items` — check the existing schema).

- `coa_id` — nullable. If set, this action item came from a COA on a shared mission. If null, it's a personal action item.
- `mission_id` — nullable, denormalized from the COA's mission for query convenience. Set when coa_id is set.
- `assigned_to` — nullable. For COA-sourced items: who claimed this item. Null = unassigned (available for any committed user to grab). For personal items: always the user_id (or null, depending on existing behavior — don't break existing personal item behavior).

**How this works:**

COA-sourced action items and personal action items live in the same table, flow through the same hopper, appear on the same /today view. One source of truth. No sync problem. No union query.

The /today and hopper views render COA-sourced items with a small mission name badge so the user sees where the task comes from. Completing the item in /today marks it done in the same row — the mission's COA page and commitments page see the completion automatically.

Any committed user on a COA can create action items on it (insert with coa_id set). They can be self-assigned (assigned_to = creator) or unassigned (assigned_to = null) for anyone to grab.

**RLS update for existing action items table:**

Current policy: users see their own items (`user_id = auth.uid()`).

New policy: users see their own items OR items where `coa_id IS NOT NULL AND mission_id IN (SELECT mission_id FROM mission_participants WHERE user_id = auth.uid())`. This lets mission participants see COA-sourced action items on shared missions.

Insert: user can create personal items (coa_id null, user_id = auth.uid()) OR COA-sourced items (coa_id set, user must have a commitment on that COA).

Update: user can update their own items. For COA-sourced unassigned items, any committed user can set assigned_to to their own user_id (claiming).

Delete: user can delete their own items.

#### Mission invitations

**New table: `mission_invitations`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| mission_id | uuid | FK → missions, not null, on delete cascade |
| invited_by | uuid | FK → auth.users, not null, on delete cascade |
| email | text | not null. Invitee's email address. |
| role | text | not null, default 'collaborator', check in ('collaborator', 'observer') |
| status | text | not null, default 'pending', check in ('pending', 'accepted', 'declined', 'expired') |
| token | uuid | not null, default gen_random_uuid(). Unique token for the invitation link. |
| created_at | timestamptz | not null, default now() |
| accepted_at | timestamptz | nullable |

Unique constraint on (mission_id, email). The token is used in the invitation URL so the invitee can accept without being logged in (the accept flow handles signup/login + adding to mission_participants).

RLS: users can select/insert invitations on missions they participate in. Public select by token (for the accept flow — unauthenticated access to look up an invitation by token).

#### App settings

**New table: `app_settings`**

| Column | Type | Notes |
|--------|------|-------|
| key | text | PK |
| value | text | not null |
| updated_at | timestamptz | not null, default now() |

Seed with: `{ key: 'email_override', value: '' }`. When non-empty, all outgoing emails are redirected to this address. The email body prepends "Originally to: [actual recipient]".

RLS: only admin can select/update. Alternatively, read this from environment variable `EMAIL_OVERRIDE` instead of database — simpler, no RLS needed. **Prefer the environment variable approach.** Set `EMAIL_OVERRIDE=nathan@nathanotto.com` (or your preferred address) in `.env` and on Vercel. When empty or absent, emails go to real recipients.

#### Updated `updated_at` triggers

Apply to: `commitments`.

#### Updated RLS on existing Plan tables

All existing Plan tables (missions, factors, coas, coa_factor_links, coa_dependencies, coa_resource_needs, mission_log) need RLS policy updates to support multi-user:

**Current policy pattern:** `user_id = auth.uid()`

**New policy pattern:** user is a participant in the mission. For each table:

- SELECT: `user_id = auth.uid() OR mission_id IN (SELECT mission_id FROM mission_participants WHERE user_id = auth.uid())`
- INSERT: user must be a participant in the mission with role 'creator' or 'collaborator'
- UPDATE: same as insert (any collaborator can edit — per Nathan's direction that any collaborator can edit anything)
- DELETE: same as insert

For `mission_log`: INSERT allowed for participants. No UPDATE or DELETE (append-only).

For `missions` table: UPDATE and DELETE restricted to creator only (role = 'creator' in mission_participants). SELECT for participants.

**Note:** These policy changes may require dropping and recreating existing policies. Test thoroughly — RLS errors will lock users out of their own data.

---

### 2. Email Setup

#### Resend integration

Install Resend SDK: `npm install resend`

Create a utility at `lib/email.ts`:

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams) {
  const override = process.env.EMAIL_OVERRIDE;
  const actualTo = override || to;
  const actualHtml = override
    ? `<p style="background:#fff3cd;padding:8px;border:1px solid #ffc107;margin-bottom:16px;"><strong>DEBUG: Originally to:</strong> ${to}</p>${html}`
    : html;

  const { data, error } = await resend.emails.send({
    from: 'Wild Success <noreply@wildsuccess.co>',
    to: actualTo,
    subject: override ? `[DEBUG] ${subject}` : subject,
    html: actualHtml,
  });

  if (error) {
    console.error('Email send error:', error);
    throw error;
  }

  return data;
}
```

#### DNS setup for wildsuccess.co

Resend requires domain verification. After creating a Resend account and adding the wildsuccess.co domain, add the DNS records Resend provides (MX, TXT for SPF, CNAME for DKIM) in Namecheap. Resend's dashboard will show the exact records needed. **Do not remove existing DNS records** — add alongside the A record and CNAME already configured for Vercel.

#### Environment variables

Add to `.env` and Vercel:
- `RESEND_API_KEY` — from Resend dashboard
- `EMAIL_OVERRIDE=nathan@nathanotto.com` — redirect all emails during development. Remove or empty when ready for real delivery.
- `NEXT_PUBLIC_APP_URL=https://wildsuccess.co` — for generating links in emails

---

### 3. API Routes

#### Mission invitations — `/api/missions/[missionId]/invitations`

- `POST` — create invitation. Params: `email`, `role` (default 'collaborator'). Validate: user must be a participant in this mission. Check if email is already invited (prevent duplicates). Check if email belongs to an existing WS user:
  - If existing user: create invitation, auto-create `mission_participants` row (status pending), send email notification with link to the mission.
  - If new user: create invitation with token, send email with signup/accept link: `${APP_URL}/invitations/accept?token=[token]`.
  Write mission_log entry: 'collaborator_invited'.

- `GET` — all invitations for this mission. Includes status, email, role, invited_by.

- `DELETE /api/missions/[missionId]/invitations/[id]` — cancel a pending invitation.

#### Invitation acceptance — `/api/invitations/accept`

- `GET ?token=TOKEN` — public, no auth required. Look up invitation by token. Return mission name, description, inviter display_name, invitation status. If not found or expired, return error. This powers the acceptance page's display.

- `POST` — params: `token`. Requires authentication.
  - Verify the authenticated user's email matches the invitation email. If not, return error: "This invitation was sent to a different email address."
  - Add user to `mission_participants` (role from invitation), mark invitation as accepted (status = 'accepted', accepted_at = now()).
  - Write mission_log entry.
  - Return the mission ID so the UI can redirect to `/plan/[mission-id]`.

**How invitation-driven signup works end to end:**

1. Inviter sends invitation → email goes to invitee (respecting EMAIL_OVERRIDE) with link: `APP_URL/invitations/accept?token=TOKEN`
2. Invitee clicks link → lands on `/invitations/accept?token=TOKEN` (public page, no auth required to view)
3. Page calls GET with token → shows mission name, description, who invited them
4. **If invitee is already logged in:** show "Join this mission" button. On click, call POST with token. Redirect to `/plan/[mission-id]`.
5. **If invitee has a WS account but is not logged in:** show login form. After login, auto-call POST with token. Redirect to `/plan/[mission-id]`.
6. **If invitee has no account:** show signup form (email pre-filled from invitation, password field). After signup:
   - Supabase Auth creates the account
   - The `user_profiles` trigger creates their profile with `app_role = 'mission_collaborator'` (the default for all new signups)
   - The page auto-calls POST with token, which adds them to the mission
   - Redirect to `/plan/[mission-id]`

The token in the URL persists through the signup/login flow. The acceptance page stores it (in React state or URL params) and uses it after authentication completes.

**Edge case:** if someone signs up directly at `/signup` without an invitation, they get `app_role = 'mission_collaborator'` and land on `/plan` with no missions. The /plan page should show: "You don't have any missions yet. Create one, or ask someone to invite you to theirs." Plus the "Request full access" link.

#### Commitments — `/api/missions/[missionId]/coas/[coaId]/commitments`

- `GET` — all commitments on this COA. Include user display_name.
- `POST` — create commitment. Params: `description` (optional), `deadline` (optional). user_id = auth.uid(). Validate: user must be a participant in this mission. Write mission_log entry: 'commitment_made'.
- `PATCH /api/missions/[missionId]/coas/[coaId]/commitments/[id]` — update description, deadline, status. When status → 'completed': set completed_at, accept completion_note, write mission_log entry 'coa_committed' (completion). Trigger factor review if COA has `aims_to_resolve` links and all commitments on the COA are now complete.
- `DELETE` — remove commitment. Write mission_log entry.

#### COA action items — `/api/missions/[missionId]/coas/[coaId]/action-items`

These routes create and manage action items on the existing action items table with `coa_id` and `mission_id` set.

- `GET` — all action items on this COA (WHERE coa_id = coaId). Include created_by (user_id) and assigned_to display names.
- `POST` — create action item on the existing action items table with `coa_id` = coaId, `mission_id` = missionId. Params: `title`, `description` (optional), `assigned_to` (optional, defaults to creator's user_id for self-assignment, null for unassigned). Validate: user must have a commitment on this COA. Write mission_log entry.
- `PATCH /api/missions/[missionId]/coas/[coaId]/action-items/[id]` — update title, description, status, assigned_to. Claiming: any committed user can set assigned_to to their own user_id on an unassigned item. Completing: when status → 'completed', set completed_at, write mission_log entry.
- `DELETE` — creator can delete their own action items.

#### Hopper integration — no query changes needed

Since COA-sourced action items live in the same table as personal items, the existing hopper query already includes them (assuming it queries by user_id or assigned_to). If the existing query filters by `user_id = auth.uid()`, update it to also include items where `assigned_to = auth.uid()` and `coa_id IS NOT NULL`.

The /today view should render COA-sourced items (where `coa_id IS NOT NULL`) with a small mission name badge so the user sees context. Completion uses the same existing completion route — one table, one row, one update.

#### Commitment digest — `/api/cron/commitment-digest`

A cron-triggered API route (use Vercel Cron or a scheduled Supabase function) that runs daily (checks per-user frequency):

1. Query all users who have active commitments AND whose `communication_preferences->>'digest_enabled'` is true.
2. Filter by frequency: if `digest_frequency` is 'weekly', only include users on the configured digest day (env var `DIGEST_DAY`, default 0 = Sunday). If 'daily', include every run.
3. For each qualifying user, gather: all active commitments across all missions, with mission name, COA action/outcome, deadline, and action items assigned to them.
4. Send a digest email using `sendEmail` (which respects EMAIL_OVERRIDE).
5. Skip users with no active commitments even if digest is enabled.

Add env vars: `DIGEST_DAY=0` (Sunday), `DIGEST_HOUR=18` for cron scheduling. The cron itself runs daily; the per-user frequency check happens in the route logic.

#### Access requests — `/api/access-requests`

- `POST` — create request. user_id = auth.uid(). Optional `note`. Validate: user must be `mission_collaborator`.
- `GET` — admin only. All pending requests with user display_name and email.
- `PATCH /api/access-requests/[id]` — admin only. Params: `status` ('approved' or 'denied'). If approved: update user's `app_role` to 'full'. Set resolved_by, resolved_at.

#### Mission commitments page — `/api/missions/[missionId]/commitments`

- `GET` — all commitments across all COAs for this mission. Include: COA action/outcome, user display_name, deadline, status, action item counts (total, completed, unassigned). This powers the mission-level commitment view.

---

### 4. UI Pages

#### Navigation gating

Modify the main app navigation component:

- If `app_role = 'admin'` or `app_role = 'full'`: show all nav items (Map, Today, Organize, Plan) plus Admin link for admins.
- If `app_role = 'mission_collaborator'`: show only Plan. All other routes (/map, /today, /organize) redirect to /plan with a toast: "Request full access to unlock all features."

#### `/plan` — Updated for multi-user

The mission list now includes missions where the user is a participant (not just creator). Show the user's role on each mission: "Creator" or "Collaborator". Filter/group options: "My missions" / "Shared with me" / "All".

#### `/plan/[id]/commitments` — Mission Commitments Page

**New page.** Shows all commitments across all COAs for this mission.

**Header:**
- "Commitments for: **[mission name]**"
- Links to mission overview, COA page, arrange, summary

**Commitment list, grouped by COA:**

For each COA that has at least one commitment:
- COA text: "[action] IOT [outcome]"
- COA status and time horizon badge
- List of commitments on this COA:
  - User name (colored by user, like the orange "Nat" from the 2010 app)
  - Description (what they're specifically doing, if provided)
  - Deadline (if set)
  - Status badge: active / completed / abandoned
  - Action items under this commitment's user: count total, count completed, count in progress

**Unassigned action items section:**
- "Help needed" — list of action items across all COAs that have no assignee
- Each shows: COA name, action item title, "Claim" button
- Claiming sets assigned_to to the current user (must have a commitment on the COA)

**Summary stats at top:**
- Total commitments: X active, Y completed, Z abandoned
- Total action items: A open, B in progress, C completed, D unassigned
- People involved: [list of participant names]

#### `/plan/[id]/invite` — Invite Collaborators

**Page structure:**
- "Invite collaborators to: **[mission name]**"
- Current collaborators: list with names and roles
- "Done inviting, continue" link → back to mission overview

**Invite by email:**
- Email input + "Invite" button
- On submit: calls invitation API. Shows success message with invitee email.

**Invite existing users:**
- "Search by name" input + Search button
- Results: list of WS users matching search (query user_profiles by display_name)
- Checkbox next to each + "Invite selected" button
- Already-invited users shown as disabled with "Already invited" label
- Note: "When you invite people already using Wild Success, they get instant access."

**Pending invitations:**
- List of pending invitations with email, date invited, "Cancel" action

#### `/invitations/accept` — Invitation Acceptance

Public page (no auth required to view). Reads `token` from query params.

- Call GET `/api/invitations/accept?token=TOKEN`. If not found or expired: show error message.
- If found: show mission name, description (first 200 chars), who invited them.
- **If user is authenticated and email matches invitation:** show "Join this mission" button. On click, calls POST accept API, redirects to `/plan/[mission-id]`.
- **If user is authenticated but email doesn't match:** show message: "This invitation was sent to [invitation email]. Log in with that account or ask for a new invitation."
- **If user is not authenticated:** show two options:
  - "I have an account" → login form (email + password). After login, page re-checks auth and proceeds with acceptance.
  - "I'm new" → signup form (email pre-filled from invitation email, password field). After signup, page proceeds with acceptance.
- The token is preserved in the URL throughout the auth flow. After successful signup/login, the page auto-calls POST accept with the token.
- New accounts created via this flow get `app_role = 'mission_collaborator'` (the default for all signups).
- After successful acceptance: redirect to `/plan/[mission-id]`.

#### COA detail — updated

On the COA page (`/plan/[id]/coas`) and Arrange page, each COA now shows:

**Commitment controls:**
- "Commit to this" button (if user hasn't committed yet). Opens inline form: optional description, optional deadline. On submit, creates commitment.
- If already committed: show "You're committed" badge with option to edit description/deadline or abandon.
- Show other users' commitments: "[Name] committed [date]" for each.

**Action items section (expandable on each COA):**
- List of action items with: title, assigned_to (name or "Unassigned"), status
- "Add action item" inline form: title (required), description (optional), assign to self (checkbox, default true) or leave unassigned
- Each item has: status toggle (open → in_progress → completed), "Claim" button if unassigned, edit/delete for creator
- Compact display — this shouldn't dominate the COA card

#### `/admin` — Admin Panel

Simple admin page, only accessible to users with `app_role = 'admin'`.

**Sections:**

**Pending access requests:**
- List of requests with: user display_name, email, note (if any), requested_at
- "Approve" and "Deny" buttons on each
- On approve: user's app_role changes to 'full', confirmation shown

**User management:**
- List of all users with: display_name, email, app_role, created_at
- Ability to change a user's app_role (dropdown: admin/full/mission_collaborator)
- No delete — just role changes

**App settings:**
- Display current EMAIL_OVERRIDE value (read from env, display-only — changing it requires Vercel/env update)
- Any future app-wide settings

#### Mission collaborator experience

When a `mission_collaborator` user logs in:

- They land on `/plan`
- They see missions they own and missions they're invited to
- They can create new missions and invite their own collaborators
- They can do everything a full user can do within /plan
- Nav shows only "Plan" (and a "Request full access" link)
- On any page, a subtle banner: "You have mission access. [Request full access] to unlock your personal Map, daily view, and more."

#### "Request full access" flow

- Mission collaborator clicks "Request full access" (in nav or banner)
- Modal: optional text field for a note ("Why do you want full access?"), Submit button
- On submit: creates access_request, shows confirmation: "Request sent. You'll get an email when it's reviewed."
- Admin gets an email notification about the new request (send via `sendEmail`, respecting admin's communication_preferences)

#### `/settings` or `/account/preferences` — Communication Preferences

Accessible to all users from their account menu.

**Email preferences:**
- Commitment digest: checkbox (on/off) + frequency dropdown (weekly/daily) when enabled
- Mission invitation emails: checkbox (on/off)
- Commitment reminders: checkbox (on/off)

On save: PATCH `user_profiles` with updated `communication_preferences` jsonb.

Simple form, no page reload — save with toast confirmation. Consistent with WS text-first aesthetic.

---

### 5. Email Templates

All emails use plain, clean HTML. No heavy styling. Consistent with WS's text-first aesthetic.

#### Mission invitation email

Subject: "[Inviter name] invited you to plan: [Mission name]"

Body:
```
[Inviter name] wants to collaborate with you on a mission in Wild Success.

Mission: [Mission name]
[Mission description, first 200 chars]

[Accept Invitation button/link → APP_URL/invitations/accept?token=TOKEN]

Wild Success is a planning and commitment tool for people who want to 
accomplish big things together.
```

#### Commitment digest email

Subject: "Your Wild Success Commitments"

Body:
```
Here's what you've committed to:

[Mission name]
  • [COA action] IOT [COA outcome]
    Your commitment: [description or "Committed"]
    Deadline: [date or "None set"]
    Action items: [X open, Y completed]
    [Link to COA page]

  • [Next COA...]

[Next mission...]

[Link to /plan]
```

#### Access request notification (to admin)

Subject: "Wild Success: Access request from [User name]"

Body:
```
[User name] ([email]) is requesting full access to Wild Success.

Note: [their note, or "No note provided"]

[Link to /admin]
```

#### Access request approved (to requester)

Subject: "Welcome to Wild Success"

Body:
```
Your request for full access has been approved.

You now have access to your personal Map, daily view, weekly planning, 
and everything else Wild Success offers.

[Link to /map]
```

---

### 6. Verification Checklist

When complete, verify these scenarios work:

**Account tiers:**
- [ ] Nathan's account has app_role 'admin'
- [ ] New signups via invitation get app_role 'mission_collaborator'
- [ ] Mission collaborators see only /plan in navigation
- [ ] Mission collaborators are redirected from /map, /today, /organize to /plan
- [ ] "Request full access" creates an access_request
- [ ] Admin can approve request — user's app_role changes to 'full'
- [ ] Full users see all navigation items
- [ ] Admin page accessible only to admins

**Invitations:**
- [ ] Invite existing WS user by email — they see the mission on their /plan page
- [ ] Invite new user by email — they receive an invitation email with link
- [ ] Invitation link shows mission info and signup/login form
- [ ] New user signs up via invitation — account created as mission_collaborator, auto-added to mission
- [ ] Existing user logs in via invitation link — auto-added to mission
- [ ] Email mismatch between logged-in user and invitation shows clear error
- [ ] Duplicate invitation to same email is rejected
- [ ] Cancel pending invitation works
- [ ] Invitation email goes to EMAIL_OVERRIDE address when set
- [ ] Direct signup without invitation lands on /plan with empty state message
- [ ] Invitation email respects user's communication_preferences (invitation_emails = false skips email, but token link still works if shared manually)

**Communication preferences:**
- [ ] New users get default communication_preferences (all enabled, weekly digest)
- [ ] User can toggle digest on/off in settings
- [ ] User can change digest frequency between weekly and daily
- [ ] User can toggle invitation emails on/off
- [ ] User can toggle commitment reminders on/off
- [ ] Digest cron respects digest_enabled and digest_frequency per user
- [ ] Invitation email sending respects invitation_emails preference
- [ ] Settings save with toast confirmation

**Commitments:**
- [ ] User can commit to a COA — commitment created, mission_log entry written
- [ ] Multiple users can commit to the same COA
- [ ] Commitment shows on COA card with user name
- [ ] Commitment page shows all commitments grouped by COA
- [ ] Edit commitment description and deadline
- [ ] Complete a commitment — status updates, completion_note captured
- [ ] Abandon a commitment — status updates

**Action items:**
- [ ] Committed user can create action items on a COA
- [ ] Action items can be self-assigned or unassigned
- [ ] Unassigned items show "Claim" button for committed users
- [ ] Claiming sets assigned_to
- [ ] Full user's hopper includes their assigned COA action items with mission attribution
- [ ] Completing a COA-sourced action item in /today marks it done (same row, same table)
- [ ] Action item status visible on COA card and commitments page
- [ ] "Help needed" section shows unassigned items

**Multi-user plan editing:**
- [ ] Collaborator can add factors to a shared mission
- [ ] Collaborator can create COAs on a shared mission
- [ ] Collaborator can link factors to COAs
- [ ] Collaborator can add dependencies and resource needs on Arrange page
- [ ] Factor author attribution shows correct user name
- [ ] COA author attribution shows correct user name
- [ ] Mission log records which user performed each action

**Email:**
- [ ] EMAIL_OVERRIDE redirects all emails to override address with debug header
- [ ] Invitation email sends correctly
- [ ] Commitment digest email sends with correct content
- [ ] Access request notification sends to admin
- [ ] Access approved email sends to requester
- [ ] With EMAIL_OVERRIDE removed, emails go to real recipients

**RLS:**
- [ ] Mission collaborator can only see missions they participate in
- [ ] Mission collaborator cannot see other users' personal data (values, hopper items, etc.)
- [ ] Factors, COAs, action items on shared missions visible to all participants
- [ ] Mission creator can delete the mission; collaborators cannot
- [ ] Mission log is append-only — no update or delete by any user
- [ ] Non-participants cannot see private missions