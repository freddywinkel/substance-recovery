---
name: Anchor cloud sync per-user scoping & erase ordering
description: Non-obvious rules that keep optional cloud sync from leaking/losing data across accounts on a shared browser
---

# Per-user scoping of all sync state

Anchor sync is opt-in. One browser can be used by multiple Clerk accounts in
sequence, so any persisted sync bookkeeping MUST be keyed by `userId`, never
device-global:

- Pull cursor → `cursor:<userId>`; first-push-done flag → `firstPushDone:<userId>`.
- Track `lastSyncedUserId`. At the start of a sync, if it differs from the
  current user, clear the previous account's local syncable rows + dirty queue +
  sobriety (keep device-local: theme/language/activeRegistration/drafts/crisis/
  contacts), then set `lastSyncedUserId`.

**Why:** a device-global cursor/first-push flag makes account B reuse account A's
cursor → B skips records it never pulled, and A's local rows get pushed up into
B's account (cross-account leakage). Found in review as a HIGH bug.

**How to apply:** any new persisted sync metadata is per-user-keyed by default.
runSync is serialized by user (same-user calls coalesce; a different-user call
runs after the current one). Pulled remote records are never marked dirty.

# Signed-in "erase all data" must reconcile the account BEFORE tombstoning

Signed-in erase wipes the cloud too: tombstone every live syncable record +
empty sobriety → push tombstones → hard-clear local. But the ORDER matters:

- If `lastSyncedUserId !== currentUser`, run a reconcile sync FIRST (it performs
  the account-switch clear + pulls this user's data), THEN tombstone, THEN push.
- Do NOT tombstone before that reconcile: the account-switch clear inside the
  next runSync would delete the freshly-created tombstones and the current
  account's cloud would never be wiped (HIGH privacy bug found in review).
- Offline fallbacks: if the initial reconcile can't reach the cloud, clear only
  device-local and return (don't fabricate tombstones against an unmaterialized
  account). If the post-tombstone push fails, keep tombstones queued (clear only
  device-local) so the cloud wipe runs on reconnect.

**Why:** erasing recovery data must actually remove it from the account, not
leave it to re-sync back to this or other devices.

# Stale-result guards in SyncContext

After `await runSync(uid)`, recheck the current signed-in/user refs in BOTH the
success and the catch branch before calling setStatus — otherwise a sync that
finished after sign-out or an account switch surfaces a stale synced/error/offline
status. Signed-out: SyncProvider is fully inert (no network, no timers).
