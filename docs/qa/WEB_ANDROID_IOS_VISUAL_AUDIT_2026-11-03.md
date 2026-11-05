# Web, Android and iOS visual audit — 4 November 2026

All screenshots are from the running apps on the local stack built from `main` (`f10a55e`), seeded with fictional data. They are **browser captures**: the mobile app is the Expo web export, so none of this is native Android or iOS device evidence.

| # | File (`docs/qa/screenshots/`) | App and viewport |
| --- | --- | --- |
| 1 | `01-employer-dashboard-desktop.png` | Employer web, 1280×900 |
| 2 | `02-employer-job-posting-desktop.png` | Employer web, job form |
| 3 | `03-employer-shifts-desktop.png` | Employer web, shifts and hours |
| 4 | `04-employer-messages-desktop.png` | Employer web, messages |
| 5 | `05-candidate-jobs-phone.png` | Candidate web, 390×844 |
| 6 | `06-candidate-documents-phone.png` | Candidate web, document wallet |
| 7 | `07-candidate-shifts-phone.png` | Candidate web, shifts |
| 8 | `08-app-discover-phone.png` | Mobile app (web export), discover |
| 9 | `09-app-applications-phone.png` | Mobile app, applications |
| 10 | `10-app-inbox-phone.png` | Mobile app, inbox |
| 11 | `11-app-documents-phone.png` | Mobile app, documents |
| 12 | `12-app-my-shifts-phone.png` | Mobile app, my shifts |
| 13 | `13-candidate-documents-after-phone.png` | Candidate web, document wallet **after** the fix below |

## Findings (P0 blocks release, P3 polish)
| Priority | Finding | Where |
| --- | --- | --- |
| P2 — **fixed** | The document wallet showed the full upload form (type, name, file picker, button) while uploads are disabled. The notice "Document uploads are not connected yet" is accurate, but the form invites an action that cannot work. The form is now hidden until storage is connected; only the notice shows (web and mobile). Before: #06, #11. After: #13 |
| P2 | The footer prints a business identifier ("NUA POS / NUA AUS. ABN …") that came in with #11. The handoff requires the confirmed entity and ABN to be verified against owner records before use; Claude has not verified it | #06 and every candidate page |
| P3 | The employer dashboard is clear and shows live jobs, drafts, timesheets, updates and a "Post a job" action; nothing blocks a first job post | #01 |
| — | No horizontal overflow was measured on the Expo web export at 360, 390 and 820 px in the earlier country work; this audit did not re-measure overflow on every screen | — |

## Not done
Screenshots at small Android, large iPhone and tablet sizes for every screen, dark mode captures, and any real-device check. These need devices or emulators that were not available.
