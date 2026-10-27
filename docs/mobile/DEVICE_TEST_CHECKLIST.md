# Manual device test checklist (nothing below has been run on a real device)

Use a real iPhone and a real Android phone, a development/internal build (not the Hermes export), a fixture employer and fixture candidates, and a push-enabled build with `NUA_PUSH_PROVIDER=expo` against a test server. Never send real invitations to real people.

**Session and storage**
- [ ] Sign in, force-quit, reopen: session restores. Sign out: reopening shows sign-in; Keychain/Keystore entry is gone.
- [ ] Sign in as A, sign out, sign in as B: nothing of A is visible (inbox, applications, availability) even for a moment.
- [ ] Turn on app lock; relaunch and background for >30 s: the lock covers the app before any content shows.
- [ ] Aeroplane mode mid-refresh, then reconnect: no sign-out, no crash.

**Invitations and messages**
- [ ] Employer (web) invites candidate: Inbox tab badge appears; generic push ("You have a new invitation", no business name); tapping it opens that invitation after authentication.
- [ ] Push tapped while signed in as a different account: shows "isn't available", never the other account's data.
- [ ] Employer changes pay after sending: invitation shows the change banner; Accept uses the new terms.
- [ ] Accept twice quickly; decline; let one expire; withdraw from the employer side while the invitation is open.
- [ ] Open a conversation: keyboard never hides the Message field on small iPhone and small Android; large system text (200%) stays usable; Send is disabled when empty; failed send keeps the text.
- [ ] Block from the invitation and from a conversation: confirmation sheet appears, employer loses the thread, no further notifications.
- [ ] Report a message and end a conversation.

**Accessibility (VoiceOver and TalkBack)**
- [ ] Every control has a role and label; message bubbles read "You:" / "<Business>:"; errors are announced; focus moves into sheets.
- [ ] Availability and work-preference forms: validation errors are announced and typed text is kept.

**Platform**
- [ ] Share sheet on a job, location prompt (coarse only), biometric prompt, notification permission flow.
