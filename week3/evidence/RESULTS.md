# A03 verification results

Every number below was produced by `week3/evidence/run-all.sh`, which evaluates the
real `week3/data.js` and `week3/script.js` rather than a copy. The machine-readable
output is in `week3/evidence/results/`.

Reproduce with:

```
cd week3/evidence
./run-all.sh
```

Runtime: JavaScriptCore (`/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc`),
because no Node runtime is installed. `run-all.sh` prefers `node` when it is available
and falls back to JavaScriptCore otherwise. The harness runs under either.

## Consolidated summary

| Section | File | Result |
| --- | --- | --- |
| A. Dataset integrity | `results/A-data-integrity.json` | PASS 18/18 |
| B. Unit and regression suite | `results/B-unit-and-regression.json` | PASS 27/27 |
| C. Professor worked example | `results/C-professor-worked-example.json` | PASS 8/8 |
| D. Holdout evaluation | `results/D-holdout-evaluation.json` | PASS 7/7 |
| E. Independent Python cross-check | `results/E-crosscheck.json` | PASS 13 fixed pairs |
| F. Efficiency | `results/F-efficiency.json` | PASS 26/26 |
| G. Cold start and sparsity | `results/G-cold-start-and-sparsity.json` | PASS 11/11 |
| H. Browser, 1280px | `results/H-browser-desktop.json` | PASS 43/43 |
| H. Browser, 375px | `results/H-browser-mobile.json` | PASS 43/43 |
| I. Static source and dataset hashes | `results/I-static-checks.json` | PASS 21/21 |

204 assertions plus 13 independently cross-checked prediction pairs. Whole suite: ~16 s.

## A. Dataset integrity

| Property | Value |
| --- | --- |
| Users | 943 |
| Movie rows | 1,682 |
| Distinct canonical titles | 1,664 |
| Ratings | 100,000 |
| Rating values | exactly {1, 2, 3, 4, 5} |
| Malformed `u.item` rows | 0 |
| Malformed `u.data` rows | 0 |
| Dense matrix | 944 x 1,683, `Float32Array` |
| Non-zero matrix entries | 100,000 |
| Density / sparsity | 6.29% / 93.71% |
| Titles with extended characters | 9, none containing U+FFFD |
| Duplicate canonical titles | 18 pairs |
| Unknown-only movies | 2 (`unknown`, `Good Morning (1971)`) |
| Toy Story genres | Animation, Children's, Comedy |

## C. Professor's worked example

Two independent routes to the slide's printed answer.

| Route | Sum of effects | Sum of similarities | Prediction |
| --- | --- | --- | --- |
| Slide's printed totals | -2.764 | 2.543 | 2.583095 |
| Recomputed from the printed rows | -2.7705 | 2.55 | 2.583529 |

The two differ by 0.000435. The slide prints row similarities and deviations rounded
to two decimals while its denominator is carried at three decimals, so neither route
is exact. Both round to **2.58**, which is the published answer. The production
similarity is a non-negative cosine and so never produces the signed values on the
slide; the fixture exercises the aggregation rule only.

## D. Holdout evaluation

Selection: each user hides the most recent rating they gave to a movie whose canonical
title is unique in the catalogue, ties broken by the larger item ID. All 943 users
qualified, so the full population was evaluated; the documented 200-user reduction was
not needed. 1,269 ratings were skipped by the unique-title filter and none by history
length.

| Metric | User-Based | Item-Based |
| --- | --- | --- |
| Evaluated | 943 | 943 |
| Non-fallback coverage | 922 (97.77%) | 940 (99.68%) |
| Fallbacks | 21 | 3 |
| MAE (covered) | 0.8560 | 0.8318 |
| RMSE (covered) | 1.1044 | 1.0553 |
| MAE (fallbacks counted as baseline error) | 0.8575 | 0.8330 |
| Evidence HIGH / MEDIUM / LOW / FALLBACK | 448 / 393 / 81 / 21 | 855 / 72 / 13 / 3 |
| Median / p95 prediction latency (ms) | 0.34 / 0.96 | 0.06 / 0.30 |

Common supported subset, the only place the two methods are directly comparable:
922 pairs (97.77% of the population), user-based MAE 0.8560 against item-based 0.8324,
RMSE 1.1044 against 1.0557. Item-based had the lower absolute error on 539 pairs,
user-based on 373, with 10 ties.

## E. Independent Python cross-check

`crosscheck.py` re-parses `u.data` and `u.item` with the standard library only and
re-implements the significance-weighted co-rated cosine, the top-20 neighbour rule and
the baseline-plus-deviations aggregate from scratch. It shares no code with the
application.

| Property | Value |
| --- | --- |
| Fixed pairs | 13 (users 1, 19, 50, 100, 200, 300, 405, 500, 600, 700, 800, 900, 943) |
| Tolerance | 1e-9 on the predicted rating |
| Worst user-based delta | 0.0 |
| Worst item-based delta | 0.0 |
| Holdout item re-derived independently | matches on all 13 |
| Fallback flags | agree on all 13 |

The tolerance is 1e-9 because both implementations accumulate the same integer
products in double precision; the observed agreement is exact.

## F. Efficiency

Fixed users chosen to span history sizes. Cold is the first invocation in the process,
warm is the median of three subsequent invocations. All figures in milliseconds in
JavaScriptCore, so they are not browser figures.

| User | Ratings | User-based prediction, cold | Item-based prediction, cold | User-based Top-5, warm median | Item-based Top-5, cold | Item-based Top-5, warm median | Item-based Top-5 warm range |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 19 | 20 | 0.64 | 0.34 | 1.36 | 16.44 | 17.64 | 16.08 - 18.42 |
| 100 | 59 | 0.60 | 0.30 | 0.92 | 31.20 | 29.16 | 28.18 - 33.52 |
| 200 | 216 | 1.20 | 1.20 | 1.26 | 176.70 | 169.72 | 168.92 - 179.56 |
| 1 | 272 | 3.44 | 1.04 | 2.80 | 237.82 | 223.12 | 208.68 - 230.42 |
| 405 | 737 | 2.80 | 2.48 | 2.00 | 425.96 | 444.26 | 411.08 - 474.70 |

Item-based Top-5 dominates the cost and grows close to linearly in the user's history
size, because every candidate item is compared against every rated item. User-based
Top-5 stays flat because it ranks the 942 other users once and reuses the result.

## G. Cold start and sparsity

| Case | Result |
| --- | --- |
| New user, no ratings | fallback to the global mean 3.52986, reason `cold-start-user` |
| New item, no ratings | fallback to the user's mean 3.61029, reason `cold-start-item` |
| No co-ratings | similarity 0, overlap 0 |
| Exactly one co-rating (items 1 and 361) | raw cosine 1, weighted 0.0385, evidence LOW |
| No valid contributors | fallback to the baseline, reason `no-contributors` |
| NaN, Infinity or unexplained zero | none across the sampled predictions |

Sparsity: 100,000 observed cells out of 1,588,752, so 6.29% dense. 333 movies have
fewer than five raters and 141 have exactly one. The median movie has 27 raters while
the most popular has 583, so the rating mass is concentrated in a minority of the
catalogue.

## H. Browser verification

Driven in the installed headless Chrome by loading the real `week3/index.html` in a
same-origin iframe and POSTing the results to a local server. No chromedriver or
selenium is used. The driver exercises the real controls, so these are DOM-level
assertions, not a claim about intent.

Verified at both 1280px and 375px viewports (43 checks each):

- the app reports `Loaded 943 users, 1682 movies, 100000 ratings.`
- the user dropdown holds 943 options plus a placeholder, the movie dropdown 1,682
  plus exactly one placeholder
- no U+FFFD, no empty genre parenthetical, and `unknown` never appears as a genre
- the nine Latin-1 titles render with their accented characters
- for users 1, 19, 100, 200 and 405, both columns render exactly five rows, each with
  a unique title, a two-decimal score and a valid evidence badge
- the target panel renders both prediction cards with baseline, contributors,
  denominator and median overlap, and states that the observed rating was held out
- clearing the target movie empties the panel but leaves both Top-5 lists intact
- the action button and both selects take keyboard focus and have a visible focus
  indicator; the status region is a `role="status"` `aria-live="polite"` region; every
  control has an associated label
- the result grid collapses to one column below 640px and is two columns above
- no uncaught window errors and no console errors during interaction

Interaction timings observed in the browser, wall clock including rendering:
258 ms for user 1, 103 ms for user 19, 101 ms for user 100, 193 ms for user 200 and
422 ms for user 405.

### Student Manual Browser Verification

**This subsection is manual evidence and is not produced by `run-all.sh`.** The observations
below were recorded by hand in Chrome while using the real `week3/index.html`. They are
transcribed exactly as observed, they are not assertions, and they are not combined with the
automated checks above. `run-all.sh` does not generate, regenerate or verify this
subsection, and nothing here contributes to the pass counts in the consolidated summary. The
automated results in `results/H-browser-desktop.json` and `results/H-browser-mobile.json` are
unchanged and remain the automated evidence.

The manual run did not exercise the dropdown contents beyond what these scenarios required.
No manual count of the 943 user entries or the 1,682 movie entries is claimed here; the
dropdown counts in the automated list above come from the driver.

#### Scenario A: user 1 and Star Wars (1977)

Page and target state:

- The page loaded successfully.
- User 1 was selected.
- Star Wars (1977) was selected as the target movie.
- The application displayed observed rating 5.
- The UI explicitly stated: "Observed rating 5 — held out of the calculation below."
- Total displayed computation time: 262.3 ms.
- User-Based displayed time: 9.9 ms.
- Item-Based displayed time: 241.3 ms.

User-Based target prediction:

- Predicted rating: 4.99
- Evidence label: HIGH
- Baseline: 3.61
- Contributors: 20
- Denominator: 16.479
- Median overlap: 159.5
- Prediction-card elapsed time: 2.8 ms

Item-Based target prediction:

- Predicted rating: 5.00
- Evidence label: HIGH
- Baseline: 4.36
- Contributors: 20
- Denominator: 17.945
- Median overlap: 319
- Prediction-card elapsed time: 1.3 ms

Recommendation panels:

- User-Based CF displayed exactly five recommendations.
- Item-Based CF displayed exactly five recommendations.
- Star Wars was absent from both displayed Top-5 lists.
- No duplicate title was visible within either list.

Displayed User-Based Top-5:

1. Sweet Hereafter, The (1997) — 5.00 — LOW —
   2 contributors — overlap 175.5
2. Angel Baby (1995) — 5.00 — LOW —
   1 contributor — overlap 177
3. Great Day in Harlem, A (1994) — 5.00 — LOW —
   1 contributor — overlap 174
4. Hearts and Minds (1996) — 5.00 — LOW —
   1 contributor — overlap 174
5. Mina Tannenbaum (1994) — 5.00 — LOW —
   1 contributor — overlap 177

Displayed Item-Based Top-5:

1. Aiqing wansui (1994) — 5.00 — LOW —
   20 contributors — overlap 1
2. Casablanca (1942) — 5.00 — HIGH —
   20 contributors — overlap 164
3. Close Shave, A (1995) — 5.00 — HIGH —
   20 contributors — overlap 69.5
4. Faust (1994) — 5.00 — MEDIUM —
   20 contributors — overlap 3
5. Marlene Dietrich: Shadow and Light (1996) — 5.00 — LOW —
   20 contributors — overlap 1

#### Scenario B: user 1 and Aladdin and the King of Thieves (1996)

Page and target state:

- The application explicitly displayed: "Not yet rated by this user."
- No observed rating was incorrectly assigned.
- Total displayed computation time: 237.5 ms.
- User-Based displayed time: 6 ms.
- Item-Based displayed time: 226.4 ms.

User-Based target prediction:

- Predicted rating: 2.77
- Evidence label: LOW
- Baseline: 3.61
- Contributors: 2
- Denominator: 1.646
- Median overlap: 158.5
- Prediction-card elapsed time: 1.3 ms

Item-Based target prediction:

- Predicted rating: 3.42
- Evidence label: HIGH
- Baseline: 2.85
- Contributors: 20
- Denominator: 8.553
- Median overlap: 21
- Prediction-card elapsed time: 0.4 ms

- Both methods produced finite predictions.
- No NaN, Infinity, or unexplained zero appeared.
- The two methods differed by 0.65 rating points.
- Both Top-5 panels continued to display five recommendations.

#### Scenario C: Top-5 without a target movie

- User 1 was selected.
- "No target movie (Top-5 only)" was selected.
- Both Top-5 lists rendered successfully.
- The target panel displayed: "Select a target movie to compare a single predicted rating."
- No target prediction was fabricated.
- User-Based and Item-Based timings were displayed.
- The interface remained responsive.

#### Scenario D: no user selected

- "Select a user" was selected in the user dropdown.
- A target movie could remain selected without causing an incorrect prediction.
- The status displayed: "Select a user to begin."
- User-Based CF displayed: "Please select a user first."
- Item-Based CF displayed: "Please select a user first."
- No recommendation or target prediction was fabricated.
- The validation state was clear and readable.

#### Responsive and accessibility checks

- At a wide viewport, User-Based and Item-Based panels appeared in two columns.
- At a narrow viewport, the panels stacked vertically.
- The content remained readable at both widths.
- Tab navigation worked and moved focus between the interactive controls.
- The focused button displayed a visible blue focus outline.
- The dropdowns and button were keyboard reachable.
- No keyboard trap was observed during this check.

#### Console check

- DevTools Console was opened manually.
- No JavaScript errors appeared.
- No uncaught exceptions appeared during the tested interactions.

#### Trust-related manual finding: score saturation

All ten displayed Top-5 scores were clamped to 5.00, while evidence quality varied
substantially:

- User-Based recommendations had only one or two contributors and were all labelled LOW.
- Item-Based recommendations had 20 contributors, but median overlaps ranged from 1 to
  164 and evidence labels ranged from LOW to HIGH.
- Equal displayed scores therefore did not imply equal evidence strength.
- Contributor count, overlap, and evidence label materially changed how the score should
  be interpreted.

Recorded as a score-saturation and ranking-confidence limitation. It is not an arithmetic
failure: the calculations are covered by the unit suite (section B) and the independent
cross-check (section E), and no regression test demonstrates incorrect calculation. The five
kinds of information the page displays are distinct and are not interchangeable — prediction
score, supporting evidence, confidence heuristic, fallback, observed rating.

## I. Static checks

Both data files are byte-identical to the originals:

```
u.data  06416e597f82b7342361e41163890c81036900f418ad91315590814211dca490
u.item  553841ebc7de3a0fd0d6b62a204ea30c1e651aacfb2814c7a6584ac52f2c5701
```

Also asserted: `index.html` loads only `data.js` and `script.js` and does not reference
`tests.js`; no remote script, stylesheet or library is referenced anywhere; `script.js`
contains no `innerHTML` assignment and inserts all text through `textContent`;
`u.item` is decoded as windows-1252; `SIMILARITY_LAMBDA` is 25 and `NEIGHBOUR_LIMIT`
is 20; the significance weight is `overlap / (overlap + SIMILARITY_LAMBDA)`; the genre
list holds exactly 18 named genres and `unknown` is a separate flag; focus styles exist
for all three controls; and a small-viewport media query is present.

## Defects the suite caught during development

These were found by the verification code, not by reading the source, and each now has
a regression check.

| Defect | How it surfaced | Fix |
| --- | --- | --- |
| `collectItemNeighbours` pooled every anchor into one accumulator per candidate, so item-based prediction scored a candidate against the sum of its similarities to the user's rated items rather than each similarity separately | per-anchor accumulator regression test | the sink is now a `Map` of candidate to `Map` of anchor to totals, keyed per pair |
| `aggregatePrediction` never set `baseline`, but `buildPredictionCard` calls `result.baseline.toFixed(2)` on every card, so the real UI would have thrown on the first successful prediction | the cold-start numeric check reads `.baseline` | both return paths of `aggregatePredictionTotals` now set `baseline`; a regression check asserts every prediction result carries a finite baseline |
| `populateMovieDropdown` kept the placeholder already in `index.html` and appended a second one, leaving two "No target movie" entries | the browser dropdown count check | the list is now cleared to zero entries before rebuilding |
| A cross-check of the holdout disagreed with the application by up to 0.43 ratings | the Python cross-check | the Python `mean_of` helper compared the hidden-entity kind against the entity id, so no mean excluded the masked rating; replaced with explicit `user_mean` and `item_mean` lookups |
