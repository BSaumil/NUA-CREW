# Incident response — DRAFT outline (not an operational plan)

Needs an owner, an on-call path and counsel review before launch. Outline: detect → contain (revoke sessions/sources, disable accounts via `users.is_active`) → assess whether personal information is affected and whether the Notifiable Data Breaches scheme applies (decision for counsel) → notify → remediate → review. Audit trail: `audit_events` (append-only). Evidence not yet collected: backups, restore test, log retention.
