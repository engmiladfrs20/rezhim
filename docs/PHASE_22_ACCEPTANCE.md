# Phase 22 Acceptance — Fasting, Water & Habits

Phase 22 adds authenticated lifestyle tracking without making medical claims.

- Water intake is stored in millilitres with a positive upper bound and strict UTC timestamps.
- Fasting sessions are immutable in ownership, allow only one active session per user, and close with a server timestamp.
- Habit logs are idempotent per `(user, habit_key, occurred_on)` and expose only the owning user's records.
- `/api/v1/lifestyle/summary` returns a deterministic daily total and the matching fasting/habit records.
- Integration coverage exercises authentication, validation, ownership, duplicate prevention, lifecycle transitions, and date filtering.

The feature is a tracking aid, not medical advice. Users should consult a qualified professional for medical or eating-disorder concerns.
