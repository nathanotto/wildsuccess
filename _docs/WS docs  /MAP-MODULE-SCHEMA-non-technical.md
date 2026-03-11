# Wild Success: Map Module Schema

*A non-technical description of the data structures underlying the Map Module.*

*March 2026*

---

## What the Map Module Is

The Map Module is the user's life overview — a living, glanceable picture of what they care about, what they're doing, and where the gaps are. It is the Wild Success equivalent of a whiteboard in a home office: something you glance at to orient, recalibrate, and notice what needs attention.

The Map is not a task list. It is upstream of tasks. It holds the *why* and the *what* — values and activities — so that the Commitment Cycle and dashboard can handle the *when* and *how*.

---

## The Five Data Objects

The Map Module has five data objects. They nest and connect as follows:

### 1. Values

A Value is something the user cares about protecting or pursuing. Values are the top of the hierarchy — everything else in the Map exists to serve them.

Each value is one of two types:

- **Preventive:** Protecting what you have. Safety, financial sufficiency, health, belonging. These always take priority. They answer: *what do I need to keep and protect?*

- **Promotional:** Pursuing what you want. Freedom, creative expression, purpose and meaning, adventure. These become possible when preventive values are handled. They answer: *what do I want to express and achieve?*

Each value has:

- A **name** (user-defined, starting from defaults)
- A **type** (preventive or promotional)
- A **sufficiency threshold** — the user's own definition of "enough" for this value. This is qualitative and personal. Examples: "6 months emergency fund," "see friends 2x per week," "one creative project active at all times."
- A **fulfillment status** — computed by the system from the activities serving this value. Sufficient, partial, or insufficient.

**Default preventive values:** Safety, Financial Sufficiency, Health, Belonging.

**Default promotional values:** Freedom, Creative Expression, Purpose & Meaning, Adventure.

The user can rename, add, or remove values. The defaults are a starting point, not a cage.

---

### 2. Life Domains

A Life Domain is a territory of responsibility and aspiration. It is an organizational container — activities live inside domains so the Map has visual and conceptual structure. Domains are not physical locations.

Each domain has:

- A **name** (user-defined, starting from defaults)
- An **active/inactive flag** — domains can be deactivated if they don't apply to a user's current life, without deleting them

**Default Life Domains:**

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

The user can rename, add, remove, or deactivate domains.

Life Domains do not connect directly to Values. The connection is computed through Activities — the system aggregates which values are being served within each domain by looking at the activities in that domain and the values those activities serve.

---

### 3. Activities

An Activity is the universal unit of the Map Module. Everything the user does or wants to do is an Activity. Preventive systems, regular life habits, one-time events, and aspirations are all Activities — distinguished by type and status, not by separate data structures.

Each activity has:

- A **name** and optional **description**
- A **primary Life Domain** — where it lives on the Map
- A **type:**
  - **Recurring** — happens on a cadence. Has a frequency (daily, weekly, biweekly, monthly, quarterly, annual), a last-completed date, and a next-due date. Examples: monthly budgeting, weekly family dinner, biweekly men's group, annual physical.
  - **One-time** — happens once. Has a target date. Examples: a ski trip, a medical procedure, writing a book, "create world peace."
- A **status:**
  - **Active** — currently happening or being maintained
  - **Aspirational** — not yet happening; a planning input. This is where bucket list items, dreams, and future plans live. When the user begins acting on an aspiration, it graduates to active.
  - **Paused** — temporarily suspended. Life interruption, seasonal, deprioritized. Preserved, not deleted.
  - **Completed** — done. Preserved in the visible record per the Wild Success completion cycle.
- A **preventive flag** — marks activities that are preventive systems: budgeting, insurance renewal, medical checkups, car maintenance. These are the vigilance-to-system conversions that Wild Success values. When a preventive activity is overdue, it signals attentional drag and surfaces prominently on the Map and dashboard.

**Key design point:** Activities absorb what would otherwise be three separate concepts — preventive systems, regular activities, and aspirations. The distinctions are captured by type, status, and the preventive flag, not by separate tables. This keeps the schema simple while preserving all the functional differences.

**Lifecycle:** An aspiration (status=aspirational) becomes active when the user begins. An active activity becomes completed when it's done. A recurring activity is never "completed" in the same way — it cycles. A one-time activity that grows in complexity beyond a simple calendar entry can be promoted to a Mission (defined in the Wild Success constitution, outside the Map Module).

---

### 4. Activity-Value Links

An Activity-Value Link connects an activity to a value it serves. This is the connective tissue of the Map — the structure that produces the heat map of value fulfillment.

Each link has:

- An **activity**
- A **value**
- A **contribution strength:** strong, moderate, or weak
  - **Strong** — the primary purpose of the activity serves this value. Example: monthly budgeting → Financial Sufficiency.
  - **Moderate** — meaningful but secondary contribution. Example: men's group → Play.
  - **Weak** — incidental or minor contribution. Example: a ski trip → Health.

Activities can link to multiple values. Values can be linked from multiple activities. This many-to-many relationship is what makes the Map powerful:

- A single activity (men's group) serves Belonging (strong), Inner Life (strong), Play (moderate), and Social Connection (strong) — across multiple domains.
- A single value (Belonging) is served by family dinners (strong), men's group (strong), work team lunches (moderate), and community volunteering (moderate) — across multiple domains.

The system aggregates these links to compute value fulfillment. A value with many strong links from active activities is well-fed. A value with no links, or only links from aspirational activities, is starving. This aggregation is the heat map.

---

### 5. Computed Views (not stored, derived)

The Map Module computes three views from the data above:

**Value Heat Map:** For each value, how well is it being served? Aggregates all Activity-Value Links from active activities, weighted by contribution strength. Preventive values are listed first. Low scores indicate starving values that need attention.

**Overdue Preventive Systems:** Which recurring preventive activities are past due? These represent attentional drag — the thing Wild Success is designed to eliminate. Surfaced prominently.

**Domain-Value Summary:** For each Life Domain, which values are being served through its activities? This is the computed domain-value relationship. It answers questions like: "My Work domain serves Financial Sufficiency well, but does nothing for Belonging — and I work from home alone."

---

## How the Map Module Connects to the Rest of Wild Success

The Map Module is the upstream source for the rest of the system:

- **Aspirational activities** are planning inputs. They flow into the Planning mode, the Commitment Cycle, calendar scheduling, or Mission Planning depending on their scale and complexity.

- **Overdue preventive systems** surface on the dashboard in Right Now mode as priority items.

- **Value fulfillment gaps** inform the system's coaching suggestions (available, not pushed — per the anti-hungry-cat principle).

- **Cooperation Points** (Principle 7) are awarded and lost based on activity follow-through. When a recurring preventive activity is completed on time, points are retained. When it's missed, points are lost. The Map is where the user sees the upstream picture; the CP system is where they feel the downstream consequence.

- **The Map Module review itself** is a recurring preventive activity — the user visits the Map weekly (or at their chosen cadence) to review activities, assess value fulfillment, notice gaps, and generate planning inputs. The Map maintains itself.

---

## What the Map Module Does Not Contain

- **Task details and commitments.** Those live in the Commitment Cycle.
- **Calendar events and scheduling.** Those live in the calendar system.
- **Budget data, email, messages.** Those are inputs to the dashboard from external sources.
- **Mission plans.** Those live in the Mission data object. The Map references active missions but does not contain their planning detail.
- **Cooperation Points and Integrity Score.** Those are computed from commitment follow-through, not stored in the Map. The Map shows value fulfillment; the CP system shows behavioral consistency.

The Map is the *what and why*. Everything else is the *when and how*.

---

## Default Data for New Users

During onboarding, Wild Success seeds the Map with defaults. The AI intake conversation helps the user modify these to match their actual life. The defaults are:

**Values (preventive):** Safety, Financial Sufficiency, Health, Belonging

**Values (promotional):** Freedom, Creative Expression, Purpose & Meaning, Adventure

**Life Domains:** Home, Work & Career, Finances, Health, Family, Friends & Community, Recreation & Play, Inner Life, Downtime, Public Life

**Activities:** None seeded. The intake conversation populates these from the user's actual life — what they're already doing, what systems they already have, what they aspire to. The Map starts empty of activities and fills through conversation, not assumption.