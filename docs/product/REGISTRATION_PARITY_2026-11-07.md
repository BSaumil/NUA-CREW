# Registration parity: website and app

**7 November 2026.** Compared from the code of `apps/web`, `apps/employer` and `apps/mobile`, not by running both side by side on a device.

| Step | Candidate web | Candidate app | Employer web | Employer app |
| --- | --- | --- | --- | --- |
| Name, email, password (at least 12 characters) | yes | yes | yes | yes |
| Business name | n/a | n/a | yes | yes |
| Country choice (AU live, NZ preview-only, blocked) | n/a | n/a | yes | yes |
| First work location (venue, suburb, state, postcode) | n/a | n/a | yes | **yes (added; optional)** |
| ABN | n/a | n/a | optional field | not asked |
| Terms and privacy consent | tick box with links to the site pages | switch, no links | tick box with links | switch, no links |
| Pricing wording | none | none | "does not buy an advertisement" | planned prices, "payments are not active yet" |
| Email verification prompt (only if email can be sent) | yes | yes | yes | yes |
| Forgot password | yes | yes | yes | yes |

## Changed in this pass
- The app's employer sign-up now takes the first venue, optional, with the same rule as the website: if any of suburb, state or postcode is given, all are required and the postcode is four digits. A blank venue name becomes "Main location", as on the web. Nothing is sent if the venue is left empty, and the employer can still add it after setup.

## Open decisions (not changed, because they are legal or product wording)
1. **Terms links in the app.** The website's sign-up links the terms, employer terms and privacy policy pages on the site. The app's sign-up shows consent text without links, and its settings screen says links will appear once reviewed. Linking the same pages from the app is a small change, but it is your call whether the legal text is ready to be shown there.
2. **ABN.** The website has an optional ABN field (checksum only, never treated as verification). The app does not ask. Add it to the app, or drop it from the website, once you decide whether to collect it at sign-up.
3. **Pricing wording at sign-up.** The app states the planned advertising prices; the website does not. Both are truthful; pick one wording.
