# Evaluation plan

There are no real users in this evaluation. Nobody was recruited, messaged or contacted for it, and our own traffic counts as testing, never as usage.

## Question
Does the matcher ever return an "exact" Jan Aushadhi match that differs from the caller's medicine in strength, form or release type?

## Metric and threshold
- Metric: on every priced tablet and capsule on PMBI's official Product & MRP List whose name parses into ingredients with strengths, (a) the share that finds itself as an exact match from its own composition, and (b) the number of exact matches returned when every strength is doubled.
- Threshold: (b) is 0. (a) above 99%.
- Plus 15 hand-written traps (wrong strength, wrong form, wrong release type, unknown drug, unit conversion, combination order), each with an expected result: all must behave.
- Interval: 95%, from `python3 evidence/interval.py` (Wilson for k of n).

## Data
- Dataset: PMBI Product & MRP List, janaushadhi.gov.in > Product Portfolio > Product & MRP List, read on 20 Nov 2026 (2,453 rows, 2,100 with an MRP), saved as data/source/pmbi-product-mrp-list.tsv.
- Split: none (the whole list is the test set; nothing is trained).

## Baseline
- Whose: none published for this task.

## Success rule
(b) = 0 and all 15 traps behave. Decided before the plan was written down (see Changes).

## Models and seeds
- Models: none (the matcher is plain code; no AI model in this evaluation).
- Seeds: none.

## How results are reported
| Kind | Label at first mention | Travels with the number | Never used for this kind |
|---|---|---|---|
| Break test | Our own break test (we tried to make it fail) | what we tried, how many attempts, what broke and what we fixed | `users`, `testers`, `validated` |

## Changes after the first run
- 21 Nov 2026 ~01:30 IST: this plan was written after the first run. The product was built before the hackathon kit was set up, and the break test was written and run first (commit 02236c5). The first run found one wrong trap (hydrochlorothiazide 12.5 mg is on the list on its own, code 912; the trap expected otherwise) and one real bug (valproic acid was treated as sodium valproate, so the two-ingredient valproate tablets, codes 1806 and 1807, couldn't match themselves); both were fixed (commit 56b7702) before the result below.
