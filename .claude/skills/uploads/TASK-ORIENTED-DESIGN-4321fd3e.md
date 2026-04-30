
## Task-Oriented Design Specification SCRUB FROM PUNC TO WILD SUCCESS

**Version:** 2.0 (TOD Rewrite)  
**Date:** February 1, 2026  
**Design Philosophy:** Task-Oriented Design  
**Tech Stack:** Next.js, Supabase, Vercel

---

## Part I: Design Philosophy

### What is Task-Oriented Design?

Task-Oriented Design (TOD) is a methodology for building business applications where the **task** is the primary unit of design. Unlike data-model-first approaches that produce CRUD interfaces, or feature-first approaches that produce capability menus, TOD produces applications that mirror how humans actually work: doing one thing at a time, needing the right context to decide, acting, and knowing it mattered.

**Core principles:**

1. **Task primacy**: Users come to accomplish specific tasks, not to interact with data models
2. **Context sufficiency**: Present exactly the information needed to decide/act—no more, no less
3. **Action clarity**: Make the primary action obvious; secondary actions discoverable
4. **Confirmation completeness**: Users must know: it worked, what it means, what happens next
5. **Flow continuity**: Tasks trigger other tasks; completion begets continuation
6. **Exception visibility**: Handle the unhappy path as explicitly as the happy path

### The Emotional Architecture

TOD recognizes that users need to feel effective. Every task screen should produce:

- **Clarity**: "I know exactly what I'm being asked to do, and why I want to do it"
- **Efficacy**: "I have what I need to do it"
- **Completion**: "I did it, and I know it took"
- **Consequence**: "My action mattered—something happened because of it"

### How This Spec Is Organized

1. **Task Flows**: The primary design artifacts. Each flow maps trigger → context → action → confirmation → downstream effects
2. **Task Screens**: Derived from flows. Each screen serves one task.
3. **State Machines**: For entities that move through processes
4. **Data Model**: Derived from what flows need to function
5. **Implementation Patterns**: Reusable components and architectural guidance

**When building features, always start with the Task Flow.** The flow is the source of truth. Screens, APIs, and data structures serve the flow, not the other way around.

---

## Part II: Task Flows

Each task flow follows this structure:

```
FLOW: [Name]
Actors: [Who can trigger/perform this task]
Trigger: [What initiates this task]

[TASK: Task Name]
├─ Context Needed: [What information the actor needs to decide/act]
├─ Actor Sees: [The task prompt—what are they being asked?]
├─ Actor Does: [The available actions]
├─ System Response: [What happens immediately]
├─ Confirmation: [What the actor sees/knows after acting]
└─ Downstream: [What tasks this triggers, for whom]

[Exception handling as explicit branches]
```

---

### Flow 1: Meeting Cycle

The core loop of PUNC chapter life. Meetings happen every 2-3 weeks; this flow covers the full cycle from scheduling through post-meeting tasks.

```
FLOW: Meeting Cycle
Actors: Chapter Leader, Scribe, Members
Trigger: Time-based (recurring schedule) or Leader initiates

────────────────────────────────────────────────────────────────────────────────

[TASK: Schedule Next Meeting]
Actor: Chapter Leader
Trigger: Recurring schedule or manual initiation

├─ Context Needed:
│   • Chapter's default schedule (day, time, frequency)
│   • Last meeting date
│   • Default location
│   • Any scheduling conflicts flagged by members
│
├─ Actor Sees:
│   "Schedule your next chapter meeting"
│   [Proposed date/time based on recurring pattern]
│   [Location pre-filled from default]
│
├─ Actor Does:
│   • Confirm proposed date/time OR adjust
│   • Confirm/change location
│   • Add optional meeting notes/theme
│   → [Schedule Meeting]
│
├─ System Response:
│   Creates Meeting record (status: scheduled)
│   Queues RSVP notification tasks for all members
│
├─ Confirmation:
│   "Meeting scheduled for [Date] at [Time]"
│   "RSVPs will go out to [N] members"
│   [Preview: who will be notified]
│
└─ Downstream:
    → Triggers [TASK: Respond to Meeting RSVP] for each member

────────────────────────────────────────────────────────────────────────────────

[TASK: Respond to Meeting RSVP]
Actor: Chapter Member
Trigger: Meeting scheduled, notification sent

├─ Context Needed:
│   • Meeting date, time, location
│   • Meeting theme/topic (if set)
│   • Your RSVP deadline
│   • Your pending commitments for review at this meeting
│
├─ Actor Sees:
│   "You're invited to [Chapter Name] meeting"
│   [Date, Time, Location]
│   "Please respond by [RSVP deadline]"
│
├─ Actor Does:
│   • Select: Yes / No / Maybe
│   • If No: provide reason (required)
│   → [Submit RSVP]
│
├─ System Response:
│   Records RSVP
│   Updates Leader's RSVP summary
│
├─ Confirmation:
│   "Got it! [Leader name] will see your response."
│   If Yes: "See you on [Date]. Come prepared to share your stretch goal progress."
│   If No: "We'll miss you. [Leader] may reach out about [reason]."
│
└─ Downstream:
    → Updates [Leader: RSVP Summary] (aggregated view)
    → If No with concerning reason, may trigger [Leader: Member Outreach]

EXCEPTION: No Response by Deadline
├─ Trigger: 48 hours before meeting, member hasn't responded
├─ System Action: Sends reminder notification
├─ If still no response 24 hours before:
│   → Triggers [TASK: Contact Unresponsive Member] for Leader
└─ Member status shows "No Response" in meeting context

────────────────────────────────────────────────────────────────────────────────

[TASK: Review RSVP Status]
Actor: Chapter Leader
Trigger: Ongoing (dashboard view) or explicit check

├─ Context Needed:
│   • List of all members
│   • Each member's RSVP status (Yes/No/Maybe/No Response)
│   • For No: the reason given
│   • RSVP deadline
│   • Historical attendance for each member
│
├─ Actor Sees:
│   "[Meeting Date]: [X] confirmed, [Y] declined, [Z] pending"
│   [Member list with status indicators]
│   [Members with "No Response" highlighted]
│
├─ Actor Does:
│   • View details on any member
│   • Send nudge to pending members → [Nudge for RSVP]
│   • Contact member who declined → [Member Outreach]
│
└─ Downstream:
    → Nudge actions trigger notifications to members

────────────────────────────────────────────────────────────────────────────────

[TASK: Start Meeting]
Actor: Chapter Leader (designates Scribe)
Trigger: Meeting time arrives, Leader ready to begin

├─ Context Needed:
│   • Meeting details (date, time, location, topic)
│   • Expected attendees (from RSVPs)
│   • Chapter members not present
│   • Any flagged items from PUNC admin
│
├─ Actor Sees:
│   "Start [Chapter Name] Meeting"
│   [Date, time, location]
│   [Expected: X members based on RSVPs]
│
├─ Actor Does:
│   • Designate Scribe for this meeting (can be self)
│   → [Start Meeting]
│
├─ System Response:
│   Creates meeting session
│   Meeting status: in_progress
│   Enables self-check-in for members
│
├─ Confirmation:
│   "Meeting started. [Scribe name] is recording."
│   "Members can now check in."
│
└─ Downstream:
    → Enables [TASK: Check In to Meeting] for all members
    → Meeting Runner flow begins

────────────────────────────────────────────────────────────────────────────────

[TASK: Check In to Meeting]
Actor: Chapter Member (including Leader)
Trigger: Meeting started, member arrives

├─ Context Needed:
│   • Meeting is in progress
│   • Your RSVP status
│   • Attendance type options
│
├─ Actor Sees:
│   "Check in to [Chapter Name] meeting"
│   [In Person] [Video] buttons
│
├─ Actor Does:
│   • Tap attendance type
│   → [Check In]
│
├─ System Response:
│   Records attendance with timestamp
│   Updates Scribe's attendance view
│
├─ Confirmation:
│   "You're checked in. Welcome, brother."
│   [Current attendee count]
│
└─ Downstream:
    → Updates meeting attendance summary for Scribe

────────────────────────────────────────────────────────────────────────────────

[TASK: Run Lightning Round]
Actor: Scribe (with Leader facilitation)
Trigger: Meeting started, attendance complete

├─ Context Needed:
│   • List of attendees
│   • For each attendee:
│     - Name/display name
│     - Pending stretch goal from last meeting
│     - Stretch goal status (if pre-updated)
│   • Time allocated per person (default: 3 min)
│
├─ Actor Sees:
│   "Lightning Round"
│   [Current member: Name]
│   [Timer: 3:00]
│   [Their stretch goal: "Description"]
│   [Next up: Name, Name, Name...]
│
├─ Actor Does (Scribe):
│   • Start timer for current member
│   • When member shares stretch goal outcome:
│     - Mark: Done / Not Done / Abandoned
│   • Assign priority: 1 (needs long check-in) or 2 (okay for now)
│   • Advance to next member (auto or manual)
│
├─ System Response:
│   Records time used per member
│   Records stretch goal status
│   Records priority assignment
│
├─ Confirmation (per member):
│   "[Name] complete. [Time used]. Priority [1/2]."
│   [Running totals: X of Y complete, Z minutes elapsed]
│
└─ Downstream:
    → When all members complete → [TASK: Run Long Check-ins]

────────────────────────────────────────────────────────────────────────────────

[TASK: Run Long Check-ins]
Actor: Scribe (with Leader facilitation)
Trigger: Lightning round complete

├─ Context Needed:
│   • Attendees sorted by priority (1s first, then 2s)
│   • Time remaining (total meeting time - elapsed - 30 min for curriculum)
│   • Time per person: (remaining time / attendee count)
│   • Each member's stated "what support I want"
│
├─ Actor Sees:
│   "Long Check-ins"
│   [Time budget: X minutes per person]
│   [Current: Name (Priority 1)]
│   [Timer: X:XX]
│   [They wanted: support type from lightning round]
│
├─ Actor Does (Scribe):
│   • Start timer
│   • When complete, advance to next
│   • Can adjust time as needed (borrows from 30-min buffer)
│
├─ System Response:
│   Records time used per member
│
├─ Confirmation (per member):
│   "[Name] complete. [Remaining members]."
│
└─ Downstream:
    → When all complete → [TASK: Run Curriculum Module]

────────────────────────────────────────────────────────────────────────────────

[TASK: Run Curriculum Module]
Actor: Scribe/Facilitator (often not the Leader)
Trigger: Long check-ins complete

├─ Context Needed:
│   • Selected curriculum module for this meeting
│   • Module content:
│     - Principle (from PUNC Ethos)
│     - Reflective question
│     - Exercise instructions
│   • Who is facilitating (designated non-Leader)
│
├─ Actor Sees:
│   "Curriculum: [Module Title]"
│   [Principle text]
│   [Reflective Question]
│   [Exercise: instructions for facilitator]
│   [Time target: 20-30 min]
│
├─ Actor Does:
│   • Read principle aloud
│   • Pose reflective question → members share (captured in app)
│   • Lead exercise
│   • Mark complete
│
├─ System Response:
│   Records module completion for this meeting
│   Records member reflections (brief text entries)
│
├─ Confirmation:
│   "Curriculum complete."
│
└─ Downstream:
    → [TASK: Create Stretch Goals]

────────────────────────────────────────────────────────────────────────────────

[TASK: Create Stretch Goal]
Actor: Each Member
Trigger: Curriculum complete, Scribe prompts commitment creation

├─ Context Needed:
│   • Your completed/abandoned stretch goals from this meeting
│   • Suggested commitment types
│   • Other members (for commitments to specific people)
│
├─ Actor Sees:
│   "What will you stretch into before we meet again?"
│   [Commitment types: Stretch Goal / To Another Member / Volunteer / Help-Favor]
│   [Description field]
│   [Optional: deadline, recipient]
│
├─ Actor Does:
│   • Enter stretch goal description
│   • Select type
│   • If "To Another Member": select recipient
│   • Optional: set deadline
│   → [Commit]
│
├─ System Response:
│   Creates Commitment record
│   If recipient specified: notifies them
│
├─ Confirmation:
│   "Your stretch goal is set."
│   "You'll be asked about this at the next meeting."
│   If to another member: "[Name] has been notified."
│
└─ Downstream:
    → Commitment appears in member's profile
    → Appears in next meeting's Lightning Round for this member
    → If recipient: appears in their "commitments to me" view

────────────────────────────────────────────────────────────────────────────────

[TASK: Close Meeting]
Actor: Chapter Leader
Trigger: Stretch goals complete, meeting ready to end

├─ Context Needed:
│   • Meeting duration
│   • Attendance summary
│   • Commitments created this meeting
│   • Audio recording status
│
├─ Actor Sees:
│   "Close Meeting"
│   [Duration: X hours Y minutes]
│   [Attended: X in-person, Y video]
│   [Commitments made: Z]
│   [Audio: Not recorded / Recorded]
│
├─ Actor Does:
│   • Record validation audio (required for funding)
│   • Or skip audio (meeting still valid, but not for donor reporting)
│   → [End Meeting]
│
├─ System Response:
│   Meeting status: completed
│   Calculates stats
│   Queues post-meeting tasks
│
├─ Confirmation:
│   "Meeting complete. Great work."
│   [Summary: duration, attendance, commitments]
│   "You'll need to validate this meeting for donor reporting."
│
└─ Downstream:
    → [TASK: Rate Meeting Value] for each attendee
    → [TASK: Validate Meeting] for Leader (can be done later)

────────────────────────────────────────────────────────────────────────────────

[TASK: Rate Meeting Value]
Actor: Each Attendee
Trigger: Meeting ends

├─ Context Needed:
│   • Meeting just ended
│   • Simple scale context
│
├─ Actor Sees:
│   "How valuable was today's meeting?"
│   [1-10 scale]
│   "Who gave you the most value today?"
│   [Member selector]
│
├─ Actor Does:
│   • Select value rating (1-10)
│   • Select most valuable member
│   → [Submit]
│
├─ System Response:
│   Records feedback
│
├─ Confirmation:
│   "Thanks for the feedback."
│   "See you at the next meeting."
│
└─ Downstream:
    → Aggregated into meeting stats
    → Contributes to "value given" recognition for selected member

────────────────────────────────────────────────────────────────────────────────

[TASK: Validate Meeting]
Actor: Chapter Leader
Trigger: Meeting completed, Leader ready to validate

├─ Context Needed:
│   • Meeting details (date, time, duration)
│   • Attendance list with types
│   • Topic/curriculum covered
│   • Audio recording (if present)
│   • Validation representations (what Leader is attesting to)
│
├─ Actor Sees:
│   "Validate Meeting for Donor Reporting"
│   [Meeting: Date, Duration]
│   [Attendance: X in-person, Y video]
│   [Topic: Curriculum module or freeform]
│   [Audio: Play button or "Not recorded"]
│   
│   Representations:
│   [ ] This meeting took place as described
│   [ ] Attendance is accurate
│   [ ] The topic was covered as stated
│   [ ] The audio (if present) reflects genuine member feedback
│
├─ Actor Does:
│   • Review details
│   • Check all representation boxes
│   • Listen to audio (if applicable)
│   → [Validate Meeting]
│
├─ System Response:
│   Meeting status: validated
│   Adds to PUNC validation queue
│
├─ Confirmation:
│   "Meeting validated."
│   "This meeting is now eligible for donor funding reporting."
│
└─ Downstream:
    → Appears in PUNC Admin validation queue
    → After PUNC review → transferred to Direct Outcomes
```

---

### Flow 2: Member Onboarding

How a new man finds and joins a chapter.

```
FLOW: Member Onboarding
Actors: New User, Chapter Leader, PUNC Admin
Trigger: Person visits PUNChapters.org

────────────────────────────────────────────────────────────────────────────────

[TASK: Sign Up]
Actor: New User
Trigger: Visits site, wants to join

├─ Context Needed:
│   • What PUNC is (brief)
│   • What they're signing up for
│   • What info is needed
│
├─ Actor Sees:
│   "Find Your Brotherhood"
│   [Brief: PUNC is men supporting men through regular meetings]
│   [Sign up form]
│
├─ Actor Does:
│   • Enter: Name, Email, Phone, Address
│   • Choose username (for privacy)
│   • Set display preference (real name or username)
│   → [Create Account]
│
├─ System Response:
│   Creates User (status: unassigned)
│   Sends email verification
│
├─ Confirmation:
│   "Welcome. Check your email to verify your account."
│   "Then we'll help you find a chapter."
│
└─ Downstream:
    → After email verification → [TASK: Find a Chapter]

────────────────────────────────────────────────────────────────────────────────

[TASK: Find a Chapter]
Actor: New User (verified)
Trigger: Email verified, user returns

├─ Context Needed:
│   • User's address (for proximity)
│   • Chapters near them (open chapters accepting members)
│   • Forming chapters near them
│
├─ Actor Sees:
│   "Find a Chapter Near You"
│   [Map with chapter markers]
│   [List: Open chapters within X miles]
│   [List: Forming chapters (if any)]
│   [Option: "No chapters near me? Request one."]
│
├─ Actor Does:
│   • Browse chapters by proximity
│   • View chapter details (meeting schedule, member count, topics)
│   • Either:
│     → [Apply to Join] existing chapter
│     → [Join Forming Chapter] waitlist
│     → [Request New Chapter]
│
└─ Downstream:
    → Chosen path determines next task

────────────────────────────────────────────────────────────────────────────────

[TASK: Apply to Join Chapter]
Actor: New User
Trigger: User selects an open chapter

├─ Context Needed:
│   • Chapter details (name, location, schedule)
│   • Current member count / max
│   • Meeting frequency and topics
│
├─ Actor Sees:
│   "Apply to Join [Chapter Name]"
│   [Chapter details]
│   [Application field: "Tell us about yourself"]
│
├─ Actor Does:
│   • Write brief introduction
│   → [Submit Application]
│
├─ System Response:
│   Creates application record
│   Notifies Chapter Leader and Outreach Leader
│
├─ Confirmation:
│   "Application submitted to [Chapter Name]."
│   "[Leader name] will review and respond within [X days]."
│   "We'll email you when there's an update."
│
└─ Downstream:
    → [TASK: Review Membership Application] for Chapter Leader

────────────────────────────────────────────────────────────────────────────────

[TASK: Review Membership Application]
Actor: Chapter Leader or Outreach Leader
Trigger: Application received

├─ Context Needed:
│   • Applicant profile (name, location, introduction)
│   • Distance from chapter meeting location
│   • Current chapter member count
│   • Application message
│
├─ Actor Sees:
│   "New Application: [Applicant Name]"
│   [Location: X miles from chapter]
│   [Introduction text]
│   [Approve] [Reject] [Request More Info]
│
├─ Actor Does:
│   • Review application
│   • Approve, Reject, or Request More Info
│
├─ System Response (Approve):
│   Creates ChapterMembership
│   User status: assigned
│   Sends welcome email with next meeting details
│
├─ Confirmation:
│   "Approved. [Name] is now a member."
│   "They've been sent welcome info for the next meeting."
│
└─ Downstream:
    → New member receives [TASK: Welcome to Chapter]
    → Next meeting RSVP automatically sent

────────────────────────────────────────────────────────────────────────────────

[TASK: Request New Chapter]
Actor: New User (no chapters nearby)
Trigger: User can't find suitable chapter

├─ Context Needed:
│   • Confirmation that this adds them to formation waitlist
│   • What happens next
│   • Typical timeline
│
├─ Actor Sees:
│   "Request a Chapter Near You"
│   [Your location will be used to match you with others]
│   "When we have 5+ men near you and a certified leader, we'll form a chapter."
│
├─ Actor Does:
│   • Confirm location
│   • Optional: express interest in becoming a leader
│   → [Submit Request]
│
├─ System Response:
│   Creates ChapterFormationRequest (status: waitlist)
│
├─ Confirmation:
│   "You're on the waitlist."
│   "We'll email you when we're forming a chapter near you."
│   "Current waitlist near you: [X] others"
│
└─ Downstream:
    → User receives periodic updates
    → When threshold met → PUNC Admin forms chapter
```

---

### Flow 3: Commitment Lifecycle

How commitments are made, tracked, and resolved.

```
FLOW: Commitment Lifecycle
Actors: Member, Recipient (if applicable), Chapter Leader
Trigger: Member makes commitment at meeting

────────────────────────────────────────────────────────────────────────────────

[TASK: Create Commitment]
(See Meeting Cycle flow for full details)

Downstream creates Commitment record with:
- Maker
- Type (stretch goal, to member, volunteer, help-favor)
- Description
- Recipient (if applicable)
- Deadline (optional)
- Status: pending

────────────────────────────────────────────────────────────────────────────────

[TASK: Update Commitment Status]
Actor: Commitment Maker
Trigger: Between meetings, or at next meeting Lightning Round

├─ Context Needed:
│   • Commitment description
│   • Deadline (if set)
│   • Time since commitment made
│   • Recipient (if applicable)
│
├─ Actor Sees:
│   "Your Commitment"
│   [Description]
│   [Made: date] [Due: date or "Next meeting"]
│   [Current status: Pending]
│
├─ Actor Does:
│   • Mark: Completed / Abandoned
│   • Add note (optional)
│   → [Update]
│
├─ System Response:
│   Updates self_reported_status
│   If recipient exists: notifies for confirmation
│
├─ Confirmation:
│   "Updated."
│   If to another member: "[Recipient] will be asked to confirm."
│
└─ Downstream:
    → If recipient exists → [TASK: Confirm Commitment Completion]

────────────────────────────────────────────────────────────────────────────────

[TASK: Confirm Commitment Completion]
Actor: Commitment Recipient
Trigger: Maker reports commitment complete

├─ Context Needed:
│   • Who made the commitment
│   • What they committed to
│   • When they said they completed it
│
├─ Actor Sees:
│   "[Maker] says they completed their commitment to you:"
│   "[Description]"
│   "Do you agree it's complete?"
│
├─ Actor Does:
│   • Confirm: Yes, complete / No, not complete
│   → [Submit]
│
├─ System Response:
│   If confirmed: status = completed
│   If disputed: flags discrepancy, notifies Leader
│
├─ Confirmation:
│   If confirmed: "Great. Commitment closed."
│   If disputed: "[Leader] will help resolve this at your next meeting."
│
└─ Downstream:
    → If discrepancy → [TASK: Resolve Commitment Discrepancy] for Leader

────────────────────────────────────────────────────────────────────────────────

[TASK: Resolve Commitment Discrepancy]
Actor: Chapter Leader
Trigger: Recipient disputes completion

├─ Context Needed:
│   • Commitment details
│   • Maker's claim
│   • Recipient's dispute
│   • Both members' perspectives
│
├─ Actor Sees:
│   "Commitment Discrepancy"
│   [Maker] says: Complete
│   [Recipient] says: Not complete
│   [Commitment description]
│   [Suggested action: Discuss at next meeting]
│
├─ Actor Does:
│   • Review details
│   • Mark for meeting discussion, OR
│   • Reach out to members directly, OR
│   • Resolve manually with notes
│
├─ Confirmation:
│   "Flagged for discussion at next meeting."
│   OR "Resolved: [notes]"
│
└─ Downstream:
    → If meeting discussion: appears in next meeting's process flags
```

---

### Flow 4: Chapter Formation

How PUNC creates new chapters from waitlisted users.

```
FLOW: Chapter Formation
Actors: PUNC Admin, Waitlisted Users, Assigned Leader
Trigger: Sufficient users in geographic cluster + available certified leader

────────────────────────────────────────────────────────────────────────────────

[TASK: Review Formation Opportunities]
Actor: PUNC Admin
Trigger: Periodic review or system alert

├─ Context Needed:
│   • Geographic clusters of waitlisted users
│   • Cluster sizes (threshold: 5+)
│   • Certified leaders in each area (or available to travel)
│   • How long users have been waiting
│
├─ Actor Sees:
│   "Formation Opportunities"
│   [Map with clusters]
│   [List: Clusters ready to form (5+ users)]
│   [For each: user count, location, wait time, leader availability]
│
├─ Actor Does:
│   • Select cluster to form
│   → [Begin Chapter Formation]
│
└─ Downstream:
    → [TASK: Configure New Chapter]

────────────────────────────────────────────────────────────────────────────────

[TASK: Configure New Chapter]
Actor: PUNC Admin
Trigger: Cluster selected for formation

├─ Context Needed:
│   • Users in cluster (names, locations, wait times)
│   • Available certified leaders
│   • Suggested meeting location (central to users)
│
├─ Actor Sees:
│   "Form New Chapter"
│   [Users to invite: checkboxes, all selected by default]
│   [Assign Leader: dropdown of certified leaders]
│   [Chapter name: auto-generated or custom]
│   [Initial meeting location suggestion]
│
├─ Actor Does:
│   • Select users to include
│   • Assign certified leader
│   • Set or accept chapter name
│   • Set initial meeting schedule (date/time for first 3 meetings)
│   → [Send Formation Invitations]
│
├─ System Response:
│   Creates Chapter (status: forming)
│   Sends invitation emails to all selected users
│   Creates ChapterMembership records (pending confirmation)
│
├─ Confirmation:
│   "[Chapter Name] forming."
│   "[X] invitations sent."
│   "You'll be notified as responses come in."
│
└─ Downstream:
    → [TASK: Respond to Chapter Formation Invitation] for each user

────────────────────────────────────────────────────────────────────────────────

[TASK: Respond to Chapter Formation Invitation]
Actor: Invited User
Trigger: Formation invitation email

├─ Context Needed:
│   • Chapter being formed
│   • Meeting schedule (first 3 meetings)
│   • Location
│   • Who the leader is
│   • Other invited members (count, not names)
│
├─ Actor Sees:
│   "You're Invited to Join [Chapter Name]"
│   [Location: Address]
│   [First meeting: Date/Time]
│   [Leader: Name]
│   "[X] others are also invited"
│
├─ Actor Does:
│   • Accept: Yes, I'll join
│   • Decline: No, keep me on waitlist
│   → [Submit]
│
├─ System Response:
│   If accept: confirms membership
│   If decline: keeps user on waitlist
│   Updates PUNC Admin on response count
│
├─ Confirmation:
│   If accepted: "Welcome to [Chapter Name]. Your first meeting is [Date]."
│   If declined: "Got it. We'll keep you on the waitlist for other opportunities."
│
└─ Downstream:
    → When 5+ accept → Chapter status changes to "open"
    → First meeting scheduled and RSVP cycle begins

EXCEPTION: Not Enough Acceptances
├─ Trigger: Response deadline passes with < 5 acceptances
├─ Admin Sees: "[Chapter] formation stalled: [X] of 5 minimum"
├─ Admin Can:
│   • Extend deadline
│   • Add more users from nearby waitlist
│   • Cancel formation (users return to waitlist)
└─ Users notified of outcome
```

---

### Flow 5: Chapter Funding

How chapters are funded through member contributions.

```
FLOW: Chapter Funding
Actors: Contributing Member, Chapter Leader, PUNC Admin
Trigger: Various (viewing dashboard, monthly debit, etc.)

────────────────────────────────────────────────────────────────────────────────

[TASK: View Chapter Funding Status]
Actor: Chapter Leader or Contributing Member
Trigger: Visits chapter dashboard

├─ Context Needed:
│   • Monthly cost ($55)
│   • Current month contributions
│   • Current balance (surplus or deficit)
│   • Funding breakdown (member vs external)
│
├─ Actor Sees:
│   "Chapter Funding"
│   [Status badge: Fully Funded / 80% Funded / Deficit]
│   [This month: $X of $55]
│   [Balance: $Y surplus/deficit]
│   [Breakdown: pie chart or bars]
│
├─ Actor Does (if Contributing Member):
│   • View status (no action required)
│   • Optionally → [Support Our Chapter]
│
└─ This is an informational view, not a task requiring action

────────────────────────────────────────────────────────────────────────────────

[TASK: Become Contributing Member]
Actor: Regular Member
Trigger: Invited by Leader or opts in

├─ Context Needed:
│   • What contributing membership means
│   • No obligation to donate
│   • Access to funding visibility
│
├─ Actor Sees:
│   "Become a Contributing Member"
│   "Contributing members can see chapter funding status and support the chapter financially."
│   "There's no obligation to donate."
│   [Accept] [Decline]
│
├─ Actor Does:
│   • Accept or Decline
│
├─ System Response:
│   If accept: updates membership type to contributing
│   Funding dashboard becomes visible
│
├─ Confirmation:
│   "Welcome as a contributing member."
│   "You can now see funding status and support the chapter when you choose."
│
└─ Downstream:
    → Funding panel appears on their dashboard

────────────────────────────────────────────────────────────────────────────────

[TASK: Donate to Chapter]
Actor: Contributing Member
Trigger: Chooses to support chapter

├─ Context Needed:
│   • Chapter's current funding status
│   • Suggested amounts
│   • Attribution options
│
├─ Actor Sees:
│   "Support [Chapter Name]"
│   [Current need: $X to reach full funding]
│   [Amount: $5 / $10 / $20 / Custom]
│   [Frequency: One-time / Monthly]
│   [Attribution: Anonymous / Show to Leader / Show to Chapter]
│
├─ Actor Does:
│   • Select amount
│   • Select frequency
│   • Select attribution preference
│   • Enter payment info
│   → [Donate]
│
├─ System Response:
│   Processes payment
│   Creates ChapterLedger entry
│   If attributed: notifies Leader
│
├─ Confirmation:
│   "Thank you. Your chapter is now [X]% funded."
│   If recurring: "Your next contribution will be [Date]."
│
└─ Downstream:
    → Chapter balance updated
    → If attributed: Leader sees in donor list

────────────────────────────────────────────────────────────────────────────────

[TASK: Support Other Chapters]
Actor: Contributing Member
Trigger: Chooses to support chapters in need

├─ Context Needed:
│   • Chapters in deficit (anonymized)
│   • Chapter locations (relative to user)
│   • What each chapter needs
│
├─ Actor Sees:
│   "Support a Chapter in Need"
│   [Filters: In deficit / Forming / Near me]
│   [Chapter cards with: Location, Deficit amount, Recent topics]
│
├─ Actor Does:
│   • Browse chapters
│   • Select one to support
│   • Same donation flow as own chapter
│   • Optional: send encouragement message to Leader
│
├─ Confirmation:
│   "Thank you for supporting [Chapter Location]."
│   "The chapter leader has been notified."
│
└─ Downstream:
    → Cross-chapter donation recorded
    → Recipient chapter Leader notified
```

---

### Flow 6: Special Consideration Meeting

Special Consideration Meetings abandon the standard meeting flow in favor of open discussion to address important chapter issues. These are distinct from regular meetings.

```
FLOW: Special Consideration Meeting
Actors: Chapter Leader, Backup Leader, Members
Trigger: Leader/Backup calls meeting OR Member requests and Leader approves

Common Special Consideration topics:
- Chapter Split
- New Meeting Location
- Member Conflict
- Special Assistance for a Member (birth, death, moving, hardship)
- Special Event planning
- Community Service project
- Special Celebration

────────────────────────────────────────────────────────────────────────────────

[TASK: Request Special Consideration Meeting]
Actor: Chapter Member
Trigger: Member has an issue requiring chapter discussion

├─ Context Needed:
│   • What Special Consideration meetings are for
│   • Examples of appropriate topics
│   • That Leader must approve
│
├─ Actor Sees:
│   "Request a Special Consideration Meeting"
│   "Special Considerations are open discussions to resolve important chapter issues."
│   [Topic field]
│   [Description: why this needs chapter discussion]
│
├─ Actor Does:
│   • Select or enter topic
│   • Describe the situation and why it needs discussion
│   → [Submit Request]
│
├─ System Response:
│   Creates pending Special Consideration request
│   Notifies Leader and Backup Leader
│
├─ Confirmation:
│   "Request submitted."
│   "[Leader] will review and decide whether to call a Special Consideration meeting."
│
└─ Downstream:
    → [TASK: Review Special Consideration Request] for Leader/Backup

────────────────────────────────────────────────────────────────────────────────

[TASK: Call Special Consideration Meeting]
Actor: Chapter Leader or Backup Leader
Trigger: Leader decides to call one, OR approves member request

├─ Context Needed:
│   • Topic for consideration
│   • Member availability (if known)
│   • Urgency of the matter
│   • Any pending member requests for this topic
│
├─ Actor Sees:
│   "Call a Special Consideration Meeting"
│   [Topic: selected or entered]
│   [Description: context for members]
│   [Date/Time selector]
│   [Location: default or alternate]
│   [Notify members: checkbox, default on]
│
├─ Actor Does:
│   • Set topic and description
│   • Choose date, time, location
│   → [Schedule Special Consideration]
│
├─ System Response:
│   Creates Meeting (type: special_consideration)
│   Notifies all chapter members with topic
│
├─ Confirmation:
│   "Special Consideration scheduled for [Date]."
│   "Topic: [Topic]"
│   "All members have been notified."
│
└─ Downstream:
    → Members receive notification with topic
    → RSVPs requested (standard flow)

────────────────────────────────────────────────────────────────────────────────

[TASK: Run Special Consideration Meeting]
Actor: Leader or Backup Leader (facilitator), Scribe (note-taker)
Trigger: Meeting time arrives

├─ Context Needed:
│   • Topic and description
│   • Who requested it (if member-initiated)
│   • Attendees present
│   • Any relevant background (e.g., for Member Conflict: who's involved)
│
├─ Actor Sees:
│   "Special Consideration: [Topic]"
│   [Description/context]
│   [Attendees: list with check-in status]
│   [Notes field for Scribe]
│   [No Lightning Round, no Curriculum—just open discussion]
│
├─ Actor Does (Leader):
│   • Start meeting (attendance check-in)
│   • Facilitate open discussion
│   • Guide toward resolution if possible
│   • Call for decision if appropriate
│
├─ Actor Does (Scribe):
│   • Take notes on discussion
│   • Record any decisions made
│   • Record any follow-up actions
│
├─ System Response:
│   Tracks meeting duration
│   Saves notes continuously
│
├─ Confirmation:
│   (None during—meeting is ongoing)
│
└─ Downstream:
    → When complete → [TASK: Close Special Consideration Meeting]

────────────────────────────────────────────────────────────────────────────────

[TASK: Close Special Consideration Meeting]
Actor: Leader or Backup Leader
Trigger: Discussion complete or time to end

├─ Context Needed:
│   • Notes from discussion
│   • Duration
│   • Attendees
│
├─ Actor Sees:
│   "Close Special Consideration Meeting"
│   [Topic: reminder]
│   [Notes so far: displayed]
│   [Outcome field: What was decided?]
│   [Follow-up actions field: What happens next?]
│
├─ Actor Does:
│   • Review/edit notes
│   • Enter outcome summary (required)
│   • Enter follow-up actions (if any)
│   → [Close Meeting]
│
├─ System Response:
│   Meeting status: completed
│   Stores outcome and follow-up actions
│   Notifies all members of outcome (including those not present)
│
├─ Confirmation:
│   "Special Consideration complete."
│   "Outcome recorded: [summary]"
│   "All chapter members will be notified."
│
└─ Downstream:
    → All members notified of outcome
    → If follow-up actions assigned → creates tasks for responsible parties
    → If topic was "Chapter Split" and decision was Yes → [TASK: Split Chapter]
```

---

### Flow 7: Chapter Split

When a chapter grows to its maximum size (12), it can choose to split into two chapters. The split requires a Special Consideration Meeting to discuss and decide, then the Leader executes the split.

```
FLOW: Chapter Split
Actors: Chapter Leader, Members
Trigger: Special Consideration Meeting decides to split

Prerequisites:
- Chapter member count >= 9 (ideal size is 5-8)
- Special Consideration Meeting held with "Chapter Split" topic
- Members have discussed and agreed to split

────────────────────────────────────────────────────────────────────────────────

[TASK: Initiate Chapter Split]
Actor: Chapter Leader
Trigger: Special Consideration Meeting approved split

├─ Context Needed:
│   • Current chapter details
│   • Member list (all members)
│   • Special Consideration outcome confirming split decision
│   • Constraint: member_count >= 9
│
├─ Actor Sees:
│   "Split [Chapter Name]"
│   "Current members: [count]"
│   "After split, each chapter should have 5-8 members."
│   [Member list with assignment toggles: Original Chapter / New Chapter]
│   [New chapter name field]
│
├─ Actor Does:
│   • Assign each member to Original or New chapter
│   • Ensure each chapter has at least 5 members
│   • Name the new chapter
│   • Confirm: "I will temporarily lead both chapters until a new Leader is chosen"
│   → [Split Chapter]
│
├─ System Response:
│   Chapter status → "splitting"
│   Creates new Chapter (status: open)
│   Assigns Leader to both chapters (temporary)
│   Moves designated members to new chapter
│   Original chapter status → "open" (split complete)
│
├─ Confirmation:
│   "[Original Chapter] and [New Chapter] are now separate chapters."
│   "You are temporarily leading both chapters."
│   "Each chapter should choose permanent leadership at their next meeting."
│
└─ Downstream:
    → All members notified of their chapter assignment
    → Members in new chapter receive welcome to new chapter
    → Both chapters prompted to schedule next meeting
    → Reminder created: "Choose new Leader for [New Chapter]"

────────────────────────────────────────────────────────────────────────────────

EXCEPTION: Member Wants Both Chapters
├─ Context: Some members may want to remain in both chapters
├─ This requires Special Consideration by the chapter(s)
├─ If approved:
│   • Member maintains membership in both chapters
│   • Counts toward member limit in both
│   • Receives notifications from both
│   • Constraint: max 2 chapter memberships still applies
└─ Tracked as: dual membership approved via Special Consideration

────────────────────────────────────────────────────────────────────────────────

[TASK: Choose New Chapter Leader]
Actor: Chapter Members (new chapter)
Trigger: Split complete, leadership transition needed

├─ Context Needed:
│   • Current temporary Leader
│   • Certified Leaders in the chapter (if any)
│   • Members willing to become certified
│
├─ Actor Sees:
│   "[New Chapter] needs a permanent Leader"
│   "Current temporary Leader: [Name]"
│   [List of certified members who could lead]
│   [Option: Volunteer to become Leader (requires certification)]
│
├─ Actor Does:
│   • Nominate self or another certified member
│   • Or: request Leader certification process
│
├─ System Response:
│   If certified member accepts: assigns as Leader
│   Removes temporary Leader role (if they were only temporary)
│
├─ Confirmation:
│   "[Name] is now the Leader of [New Chapter]."
│   "The chapter is ready to continue independently."
│
└─ Downstream:
    → Former temporary Leader notified
    → New Leader receives Leader onboarding (if first time)
```

---

## Part III: State Machines

For entities that move through processes, define their states explicitly.

### Meeting State Machine

```
States: scheduled → in_progress → completed → validated
                 ↘ cancelled

Meeting Types:
- standard: Regular chapter meeting with Lightning Round, Long Check-ins, Curriculum
- special_consideration: Open discussion meeting to address chapter issues

Transitions:
- scheduled → in_progress: Leader clicks "Start Meeting"
- scheduled → cancelled: Leader cancels meeting
- in_progress → completed: Leader clicks "End Meeting"
- completed → validated: Leader validates meeting

Constraints:
- Only Leader or Backup Leader can trigger transitions
- Cannot transition backward
- Validation requires: attendance recorded, duration > 0
- Validation for donor funding additionally requires: audio present
- Special Consideration meetings require: outcome notes recorded
```

### Commitment State Machine

```
States: pending → completed
               → abandoned

Sub-states for "completed":
- self_reported_complete (awaiting recipient confirmation, if applicable)
- confirmed_complete (recipient confirmed OR no recipient)
- disputed (recipient says not complete)

Transitions:
- pending → completed: Maker marks complete
- pending → abandoned: Maker abandons
- completed → disputed: Recipient disputes
- disputed → confirmed_complete: Leader resolves

Constraints:
- Only Maker can mark complete/abandoned
- Only Recipient can dispute
- Only Leader can resolve disputes
```

### User Status State Machine

```
States: unassigned → assigned → inactive

Transitions:
- unassigned → assigned: Approved for chapter membership
- assigned → unassigned: Left all chapters voluntarily
- assigned → inactive: Removed by Leader or Admin
- inactive → unassigned: Reactivated by Admin

Constraints:
- User can be in max 2 chapters simultaneously
- User can be Leader in max 2 chapters
```

### Chapter Status State Machine

```
States: forming → open → closed
                   ↓
               splitting → open (original) + open (new chapter)

Transitions:
- forming → open: 5+ members confirmed AND first meeting held
- open → closed: Leader closes OR Admin closes
- open → splitting: Leader initiates split (requires member_count >= 9)
- splitting → open: Split completes, original chapter continues
- splitting → [new chapter created as open]: New chapter created with subset of members
- closed → open: Admin reopens

Constraints:
- Forming chapters have limited functionality (no funding, no curriculum progression)
- Closed chapters are read-only (history preserved)
- Splitting requires member_count >= 9 (ideal chapter size is 5-8, max is 12)
- During split: Leader temporarily leads both chapters until new Leader chosen for one
- Split creates new chapter directly as "open" (no forming period, since members are experienced)
```

---

## Part IV: Task Screen Patterns

Every task screen follows this structure. Use these patterns in implementation.

### TaskScreen Component Structure

```tsx
interface TaskScreenProps {
  // The prompt: why am I here, what am I being asked?
  prompt: {
    title: string;
    subtitle?: string;
  };
  
  // The context: what do I need to know to decide?
  context: React.ReactNode;
  
  // The action: what can I do?
  actions: {
    primary: ActionButton;
    secondary?: ActionButton[];
  };
  
  // The feedback: what happened?
  feedback?: {
    type: 'success' | 'error' | 'warning';
    message: string;
    nextStep?: string;
    downstream?: string; // what this triggered
  };
}
```

### Information Hierarchy on Task Screens

1. **Prompt** (top): What you're being asked to do. Large, clear, imperative.
2. **Context** (middle): Information needed to decide. Scannable, relevant, no extras.
3. **Action** (bottom): Primary action prominent. Secondary actions available but not competing.
4. **Feedback** (replaces/overlays): Confirmation with consequence and next step.

### Loading States

Every task screen needs:
- **Loading state**: While fetching context
- **Error state**: If context can't be loaded
- **Empty state**: If no data (e.g., no pending tasks)

### Confirmation Patterns

**Inline confirmation** (for quick actions):
```
Action taken. [Consequence]. [Next step or "Nothing more needed."]
```

**Modal confirmation** (for significant actions):
```
[Summary of what happened]
[Consequence: what changed]
[Downstream: what this triggered]
[Dismiss] or [Next Task]
```

**Toast notification** (for background completions):
```
[Brief: Action complete]
```

---

## Part V: Data Model (Derived from Flows)

The data model serves the flows. Here's what's needed:

### Core Entities

```typescript
// User: a man in the system
User {
  id: uuid
  name: string
  email: string
  phone: string
  address: Address
  username: string // display name for privacy
  display_preference: 'real_name' | 'username'
  status: 'unassigned' | 'assigned' | 'inactive'
  leader_certified: boolean
  leader_certification_date: datetime | null
  leader_certification_expiry: datetime | null
}

// Chapter: a group of men meeting regularly
Chapter {
  id: uuid
  name: string
  status: 'forming' | 'open' | 'closed'
  max_members: integer // default 12
  meeting_schedule: RecurringSchedule
  default_location: Address
  monthly_cost: decimal // default $55
  current_balance: decimal
  funding_status: 'fully_funded' | 'partially_funded' | 'deficit' | 'surplus'
}

// ChapterMembership: user's membership in a chapter
ChapterMembership {
  id: uuid
  chapter_id: uuid -> Chapter
  user_id: uuid -> User
  member_type: 'regular' | 'contributing'
  joined_at: datetime
  left_at: datetime | null
  is_active: boolean
}

// Meeting: a chapter gathering
Meeting {
  id: uuid
  chapter_id: uuid -> Chapter
  scheduled_datetime: datetime
  status: 'scheduled' | 'in_progress' | 'completed' | 'validated' | 'cancelled'
  scribe_id: uuid | null -> User
  actual_start: datetime | null
  actual_end: datetime | null
  curriculum_module_id: uuid | null -> CurriculumModule
  audio_recording_url: string | null
  validated_at: datetime | null
  validated_by: uuid | null -> User
}

// Attendance: who was at a meeting
Attendance {
  id: uuid
  meeting_id: uuid -> Meeting
  user_id: uuid -> User
  rsvp_status: 'yes' | 'no' | 'maybe' | 'no_response'
  rsvp_reason: string | null // required if rsvp_status = 'no'
  attendance_type: 'in_person' | 'video' | 'absent' | null
  checked_in_at: datetime | null
  lightning_round_time_used: integer | null // seconds
  priority: 1 | 2 | null // for long check-in ordering
}

// Commitment: something a member commits to
Commitment {
  id: uuid
  chapter_id: uuid -> Chapter
  made_by: uuid -> User
  made_at_meeting: uuid | null -> Meeting
  commitment_type: 'stretch_goal' | 'to_member' | 'volunteer' | 'help_favor'
  description: text
  recipient_id: uuid | null -> User
  deadline: datetime | null
  status: 'pending' | 'completed' | 'abandoned' | 'disputed'
  self_reported_status: 'pending' | 'completed' | 'abandoned'
  recipient_reported_status: 'pending' | 'completed' | null
  resolved_by: uuid | null -> User
  resolved_at: datetime | null
}
```

### Task Queue (for triggering downstream tasks)

```typescript
// PendingTask: a task waiting to be done
PendingTask {
  id: uuid
  task_type: string // e.g., 'respond_to_rsvp', 'confirm_commitment', etc.
  assigned_to: uuid -> User
  related_entity_type: string // 'meeting', 'commitment', etc.
  related_entity_id: uuid
  created_at: datetime
  due_at: datetime | null
  completed_at: datetime | null
  dismissed_at: datetime | null
}
```

This enables the system to show users "you have tasks waiting" and to trigger notifications.

---

## Part VI: Implementation Guidance for Claude Code

### Starting a New Feature

1. **Find the relevant Task Flow** in this document
2. **Identify the Task Screen(s)** needed
3. **Check the State Machine** for any entity state transitions
4. **Build the screen** following the TaskScreen pattern
5. **Implement the downstream triggers** (create PendingTask records, send notifications)
6. **Test the full flow** end-to-end, including confirmations

### File Organization

```
/app
  /tasks                    # Task screens organized by flow
    /meeting-cycle
      /schedule-meeting
      /respond-to-rsvp
      /start-meeting
      /run-lightning-round
      /close-meeting
      /validate-meeting
    /onboarding
      /sign-up
      /find-chapter
      /apply-to-chapter
    /commitments
      /create-commitment
      /update-commitment
      /confirm-commitment
  /components
    /task                   # Reusable task UI components
      TaskScreen.tsx
      TaskPrompt.tsx
      TaskContext.tsx
      TaskActions.tsx
      TaskConfirmation.tsx
    /meeting-runner         # Meeting-specific components
      LightningRoundTimer.tsx
      AttendanceChecklist.tsx
      CurriculumDisplay.tsx
```

### API Design

APIs should be task-oriented, not CRUD-oriented:

```
// Instead of:
POST /api/meetings/:id/attendance  // generic CRUD

// Use:
POST /api/tasks/check-in-to-meeting  // task-oriented
POST /api/tasks/submit-rsvp
POST /api/tasks/mark-commitment-complete
POST /api/tasks/validate-meeting
```

The API endpoint should:
1. Validate the actor has permission for this task
2. Validate the preconditions (entity is in correct state)
3. Execute the state transition
4. Create downstream PendingTask records
5. Return confirmation with consequence and next step

### Notification Strategy

Notifications are how users know they have tasks. Each PendingTask should trigger:

1. **In-app**: Badge/count on nav, task list in dashboard
2. **Email**: For tasks with deadlines or time sensitivity
3. **Push** (future): Same as email, user preference

Notification content should follow the task prompt pattern:
- What you're being asked to do
- Enough context to act (or link to full context)
- Clear CTA

---

## Part VII: Reference

### Glossary

- **Task**: A discrete unit of work a user performs, with context, action, and confirmation
- **Flow**: A sequence of tasks that accomplish a larger goal
- **Task Screen**: The UI for performing a single task
- **Downstream**: Tasks triggered by completing another task
- **State Machine**: The allowed states and transitions for an entity
- **Confirmation**: Feedback showing action succeeded, consequence, and next step
- **Context**: Information needed to make a decision or take an action

### Design Philosophy Reminders

When in doubt, ask:
- Is the task clear? Does the user know what they're being asked?
- Is the context sufficient? Do they have what they need to decide?
- Is the action obvious? Is there one clear thing to do?
- Is the confirmation complete? Do they know it worked, what it means, and what's next?

### Original Specification Reference

For detailed data model fields, API endpoints, and screen layouts, refer to `SPECIFICATION.md`. This TOD specification takes precedence for design decisions and flow structure; the original spec provides implementation details.

---

*End of Task-Oriented Design Specification*
