# Award data: loading, verifying and what to do each 1 July

NUA CREW never invents a wage figure. Every rate and multiplier is data with a source, stored
as `supplied_unverified` until a person checks it against the official Fair Work pay guide.

## Who can do this
Only users with the `admin` role, through `/v1/admin/awards/*`. Every change is audited.

## Load a new rate (for example after the 1 July annual review)
`POST /v1/admin/awards/rate-versions`

```json
{
  "instrument": "MA000119",
  "classification": "L2",
  "effective_from": "2027-07-01",
  "weekly_minor": 120000,
  "hourly_minor": 3158,
  "source_url": "https://awards.fairwork.gov.au/MA000119.html",
  "source_note": "Fair Work pay guide, effective 1 July 2027 (say where you read it)"
}
```

Money is whole cents. The earlier open-ended rate is closed on the day the new one starts, so two
versions never overlap. Load in date order; a start date that already exists is refused. The
figures above are an example of the shape only, not a Fair Work rate.

## Load a weekend, holiday or other multiplier
`POST /v1/admin/awards/penalty-rules` with `instrument`, `employment` (`permanent` or `casual`),
`classification_codes`, `day_kind`, `multiplier_bp` (basis points of the permanent ordinary hourly
rate; casual rows include the 25% loading), `effective_from`, `source_url` and `source_note`.
An identical-scope rule is closed on the new start date; a partly overlapping rule is refused so a
lookup is never ambiguous. Load differing scopes as separate rules.

Still not loaded because no source was supplied: Registered Clubs weekend and public-holiday
multipliers, evening and night loadings, overtime, allowances, junior/apprentice/trainee rates,
enterprise agreements. Until they are, the pay check says "not assessed".

## Load public holidays
`POST /v1/admin/awards/public-holidays` (state, date, name, source URL). Dates are not guessed:
with none loaded, a public-holiday shift is reported as not assessed.

## Verify
`POST /v1/admin/awards/rate-versions/{id}/verify` or `/penalty-rules/{id}/verify` with a
`source_note` saying what you checked. Do this only after comparing with the official guide. A pay
check reports `verified` only when the rate and every multiplier it used are verified.

## Every 1 July
The pay check already warns that a loaded rate older than the next 1 July may be out of date. Load
and verify the new rates; the warning stops by itself.
