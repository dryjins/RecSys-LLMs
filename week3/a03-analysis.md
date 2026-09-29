# A03 Analysis: Collaborative Filtering Movie Recommender

## 1. What I built and why

The brief required a recommender over MovieLens 100K that predicts a single rating for a
chosen user and movie pair and produces two Top-5 lists, one from user-based collaborative
filtering and one from item-based, and it fixed the similarity rule and the prediction rule
rather than leaving them to my judgement. That constraint shaped most of the design
decisions below, so I have separated the mandated parts from the parts I chose.

I implemented the system in plain HTML, CSS and JavaScript with no external libraries, as
required. The whole verification suite is written in the same style, so there is no gap
between what is tested and what ships: `week3/evidence/run-all.sh` concatenates the real
`data.js` and `script.js` with the verification code into a single program and runs it.

## 2. Dataset audit

Before writing the algorithm I audited the two data files, because several of the
properties turned out to matter for correctness.

| Property | Finding |
| --- | --- |
| Users | 943 |
| Movie rows | 1,682 |
| Distinct canonical titles | 1,664 |
| Ratings | 100,000 |
| Rating values | exactly {1, 2, 3, 4, 5}, no zero ratings |
| Duplicate (user, item) pairs | none |
| Matrix cells | 1,588,752 (944 x 1,683) |
| Density | 6.29% |
| Movies with fewer than 5 raters | 333 |
| Movies with exactly 1 rater | 141 |
| Median raters per movie | 27 |
| Most popular movie | 583 raters |
| Titles with non-ASCII characters | 9 |
| Pairs of movies sharing a canonical title | 18 |
| Movies whose only genre flag is `unknown` | 2 |

Four findings changed the implementation.

**`u.item` is Latin-1, not UTF-8.** Nine titles contain accented characters. Decoding the
response body with `response.text()` would have replaced every one of them with U+FFFD.
The code requests an `ArrayBuffer` and decodes it as `windows-1252` explicitly, which is the
only part of the loading path that needed a non-obvious choice. A regression check asserts
no title contains U+FFFD.

**The genre columns were off by one.** `u.item` has 24 pipe-separated fields per row. The
common reading of the header treats field 5 as the first genre, but field 5 is the
`unknown` flag and the genre flags run from field 6 to field 23. Reading it the usual way
produces 19 apparent genres, pushes every genre label one column to the left, and reports
`unknown` as a genre. Toy Story, for instance, comes out as `unknown, Animation, Children's`
instead of `Animation, Children's, Comedy`. I verified this against the flag semantics and
the counts now line up, with Western correctly reachable by 27 movies.

**`unknown` is a flag, not a genre.** It is now a separate boolean field, `unknownGenre`,
and the 18 real genres are the only members of `genres`. The two movies with no genre flags
therefore show no parenthetical at all, rather than an empty or misleading label. The
browser check asserts that no dropdown option contains an empty parenthetical and that
`unknown` never appears after a comma.

**Titles are not unique identifiers.** Eighteen canonical titles appear on two different
movie rows, so a recommendation list keyed only on title can suggest a film the user has
already seen. I normalise titles by trimming, lowercasing and collapsing internal whitespace,
use the result as the canonical identity, and never offer a candidate whose canonical title
the user has already rated. This is why the distinct-title count is 1,664 against 1,682 rows.

## 3. The algorithm

### 3.1 Similarity

The mandated similarity is the cosine between the two rating vectors restricted to their
co-rated entries, damped by a significance weight:

```
sim(a, b) = cos(a, b) * n / (n + 25)
```

where `n` is the number of items or users the two vectors have in common. A zero entry
means "not rated" and is skipped; it is never treated as a rating of 0, which would silently
corrupt every cosine. When `n` is 0 the similarity is 0 by definition, and when either sum
of squares is 0 the code returns 0 rather than dividing by zero.

The constant 25 is worth a comment, because it is doing the real work. A single shared
rating gives a raw cosine of exactly 1, which would otherwise look like perfect evidence.
The damping turns `n = 1` into `1/26`, about 0.038. In the dataset, items 1 and 361 share
exactly one rater: raw cosine 1, damped similarity 0.038, labelled LOW. Two shared ratings
give 0.074 and twenty give 0.444, so a similarity has to rest on a substantial intersection
before it counts. This is the classic significance-weighting argument and it is the main
defence against confidently wrong recommendations on a 6.29% dense matrix.

The implementation keeps the dense 944 x 1,683 `Float32Array` the brief requires, but every
similarity is computed from the sparse side structures, iterating the active user's rated
items or the shorter of the two item columns. Cost is proportional to the data actually
present rather than to the matrix width, and the unit suite asserts that the sparse
similarities equal the equivalent dense-column computation to within 1e-12 for six real
item pairs, so the optimisation is verified rather than assumed.

### 3.2 Prediction

Both methods share the same aggregation rule, differing only in what plays the role of the
baseline and of the neighbour:

```
user-based:  r̂(u, i) = mean(u) + Σ_v sim(u, v) * (r(v, i) - mean(v)) / Σ_v |sim(u, v)|
item-based:  r̂(u, i) = mean(i) + Σ_j sim(i, j) * (r(u, j) - mean(j)) / Σ_j |sim(i, j)|
```

The sum runs over the 20 strongest positively similar neighbours. Subtracting each
neighbour's own mean is the baseline-deviation step, and it matters more than it looks: raw
ratings differ systematically between lenient and strict users, so a similarity computed on
raw ratings mostly measures how generous a rater is rather than what they liked. Predictions
are clamped to the 1-5 scale and the clamped value is what the interface displays.

### 3.3 The professor's example, and where production diverges

The worked example on the slide is reproduced in the verification suite, using the real
aggregation helper. There are two routes to the printed answer and they do not agree
exactly:

| Route | Sum of effects | Sum of similarities | Prediction |
| --- | --- | --- | --- |
| Slide's printed totals | -2.764 | 2.543 | 2.583095 |
| Recomputed from the printed rows | -2.7705 | 2.55 | 2.583529 |

The gap is 0.000435. The slide prints the row similarities and deviations rounded to two
decimals but carries the denominator to three, so neither route is exact; both round to
2.58, the published answer. I report the discrepancy rather than hiding it, because the
honest statement is that the printed figures are internally inconsistent at the third
decimal.

The example also uses negative similarities, and production never produces them. The
production cosine over co-rated positive ratings lies in [0, 1] and the denominator sums
absolute values, so negatively related neighbours cannot contribute. The fixture therefore
validates the aggregation rule, not the production similarity function, and I have labelled
it as such rather than letting the agreement imply more than it does.

### 3.4 Fallbacks

A prediction that cannot be supported degrades to a stated baseline rather than a number:

| Situation | Fallback | Reason string |
| --- | --- | --- |
| User has no ratings | global mean 3.52986 | `cold-start-user` |
| Item has no ratings | the user's mean | `cold-start-item` |
| No neighbour with positive similarity | the baseline | `no-contributors` |
| No co-rated entries at all | similarity 0 | — |

Every fallback is labelled FALLBACK, never LOW. LOW means a real prediction from thin
evidence; FALLBACK means no prediction was possible. Collapsing the two would let an
unhelpful baseline masquerade as an estimate.

### 3.5 Leakage control

When predicting a pair the user has already rated, the observed rating must not inform the
prediction. This is easy to get subtly wrong, because the rating reaches the calculation
through four separate paths: the user's mean, the item's mean, the co-rated intersection,
and the contribution sum. I use a single mask record and consult it in all four places, so
there is one switch rather than four conditions to keep consistent. The unit suite verifies
that hiding a pair removes exactly one co-occurrence from the user similarity (18 to 17) and
the item similarity (104 to 103) and shifts both means by exactly the masked rating.

## 4. Evaluation

Each user hides the most recent rating they gave to a movie whose canonical title is unique
in the catalogue, with ties broken by the larger item id for determinism. The unique-title
condition matters: for a duplicated title the "same film" appears twice, so a prediction
against one copy leaks through the other. 1,269 ratings were excluded by that filter, and no
user was excluded for having too short a history. All 943 users qualified, so the full
population was evaluated; the documented fallback to the first 200 users was not needed
because the whole thing runs in well under a second per prediction.

Reporting only MAE over non-fallback predictions would flatter both methods, so I report
coverage, the error over covered cases, the error counting a fallback as its baseline value,
and the evidence distribution. A fallback is a design decision rather than a scoring error,
but hiding it would be dishonest, which is why both numbers are present.

## 5. Results

| Metric | User-Based | Item-Based |
| --- | --- | --- |
| Evaluated | 943 | 943 |
| Non-fallback coverage | 922 (97.77%) | 940 (99.68%) |
| Fallbacks | 21 | 3 |
| MAE (covered) | 0.8560 | 0.8318 |
| RMSE (covered) | 1.1044 | 1.0553 |
| MAE (fallback counted at baseline) | 0.8575 | 0.8330 |
| Evidence HIGH / MEDIUM / LOW / FALLBACK | 448 / 393 / 81 / 21 | 855 / 72 / 13 / 3 |
| Median / p95 prediction latency | 0.34 / 0.96 ms | 0.06 / 0.30 ms |

Only the 922 pairs where both methods produced a supported prediction are directly
comparable, and there item-based has the lower absolute error (MAE 0.8324 against 0.8560,
RMSE 1.0557 against 1.1044), winning 539 pairs to 373 with 10 ties.

I do not read this as a general claim that item-based beats user-based. It is one dataset
with a specific structure, one holdout rule, and a difference of 0.024 in MAE. The
substantively useful observations are narrower. Item-based has far higher coverage, 99.68%
against 97.77%, because a user almost always has at least one rated item that shares a
rater with the target, whereas a user-based prediction needs a similar user who rated that
specific item. Item-based also concentrates its evidence: 855 HIGH against 448, so where
it does answer, it tends to answer from more co-ratings. User-based is not useless, but
its support is thinner and more often LOW. Neither result is a justification for dropping
either method, which is why both remain in the interface.

### Efficiency

Item-based Top-5 dominates cost and grows close to linearly in history size: 16 ms at 20
ratings, 223 ms at 272, and 444 ms at 737. Every candidate item is compared against every
rated item. User-based Top-5 stays flat, 0.9 to 2.8 ms across the same users, because it
ranks the other 942 users once and reuses the result. The asymmetry is a direct consequence
of the two neighbourhood definitions and it is the practical argument for the item-based
path on this dataset.

### Evidence labels

Every displayed number carries a support label, computed from the contribution count, the
median overlap and the denominator:

| Label | Condition |
| --- | --- |
| HIGH | contributors >= 10, median overlap >= 10, denominator >= 2 |
| MEDIUM | contributors >= 3, median overlap >= 3, denominator >= 0.5 |
| LOW | anything else that is not a fallback |
| FALLBACK | no supported prediction was possible |

This is a transparent heuristic, not a calibrated probability. Nothing here has been fitted
to a notion of correctness, and HIGH means "well supported by co-ratings", not "probably
correct". I would rather show a coarse honest label than a decimal that implies a precision
the evidence does not support.

### Cross-check

`week3/evidence/crosscheck.py` re-parses both data files and re-implements the similarity,
the neighbour rule and the aggregation from scratch in Python's standard library, sharing no
code with the application. Across 13 fixed user/item pairs, at a tolerance of 1e-9, the
largest disagreement is exactly 0.0 for both methods, the independently re-derived holdout
items match on all 13, and the fallback flags agree on all 13. This is the check I trust
most, because it is the only one that could have caught a shared misreading of the spec on
both sides.

## 6. Student Manual Browser Verification

I also drove the real `week3/index.html` by hand in Chrome and recorded what the page
actually showed. These are manual observations and are kept separate from the automated
browser checks in section 10 of `week3/evidence/RESULTS.md`, which run through a
same-origin iframe driver. Nothing below was produced by a script, and the automated
results are not restated here.

### 6.1 The five things a displayed number is not

The manual run made one distinction worth writing down, because it is easy to collapse.
The interface shows five different kinds of information and they must not be read as one:

| Kind | What it is | How it is displayed |
| --- | --- | --- |
| Prediction score | the estimate, on the 1-5 scale, clamped into range | the large number on a card or row |
| Supporting evidence | the raw counts behind the estimate | contributors, denominator, median overlap |
| Confidence heuristic | a coarse band derived from that evidence | the HIGH / MEDIUM / LOW / FALLBACK badge |
| Fallback | a stated baseline used because no supported estimate existed | a badge plus an explicit reason |
| Observed rating | what the user actually rated, excluded from the estimate | a separate sentence above the cards |

A score without its evidence columns is not interpretable, and a badge is not a
calibrated probability. An observed rating is never an input to the estimate it sits
above.

### 6.2 Scenario A: user 1 and Star Wars (1977)

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

### 6.3 Scenario B: user 1 and Aladdin and the King of Thieves (1996)

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

### 6.4 Scenario C: Top-5 without a target movie

- User 1 was selected.
- "No target movie (Top-5 only)" was selected.
- Both Top-5 lists rendered successfully.
- The target panel displayed: "Select a target movie to compare a single predicted rating."
- No target prediction was fabricated.
- User-Based and Item-Based timings were displayed.
- The interface remained responsive.

### 6.5 Scenario D: no user selected

- "Select a user" was selected in the user dropdown.
- A target movie could remain selected without causing an incorrect prediction.
- The status displayed: "Select a user to begin."
- User-Based CF displayed: "Please select a user first."
- Item-Based CF displayed: "Please select a user first."
- No recommendation or target prediction was fabricated.
- The validation state was clear and readable.

### 6.6 Responsive and accessibility checks

- At a wide viewport, User-Based and Item-Based panels appeared in two columns.
- At a narrow viewport, the panels stacked vertically.
- The content remained readable at both widths.
- Tab navigation worked and moved focus between the interactive controls.
- The focused button displayed a visible blue focus outline.
- The dropdowns and button were keyboard reachable.
- No keyboard trap was observed during this check.

### 6.7 Console check

- DevTools Console was opened manually.
- No JavaScript errors appeared.
- No uncaught exceptions appeared during the tested interactions.

### 6.8 Trust-related manual finding: score saturation

All ten displayed Top-5 scores were clamped to 5.00, while evidence quality varied
substantially:

- User-Based recommendations had only one or two contributors and were all labelled LOW.
- Item-Based recommendations had 20 contributors, but median overlaps ranged from 1 to
  164 and evidence labels ranged from LOW to HIGH.
- Equal displayed scores therefore did not imply equal evidence strength.
- Contributor count, overlap, and evidence label materially changed how the score should
  be interpreted.

I record this as a score-saturation and ranking-confidence limitation. It is not an
arithmetic failure: the calculations are covered by the unit suite and the independent
cross-check in section 5, and no regression test demonstrates incorrect calculation. The
issue is presentational and interpretive. When many candidates push against the top of the
scale, the clamped scores converge on 5.00 and stop discriminating, so the ordering
carries the information that the score no longer does. Ten items all reading 5.00 is a
correct display of ten correct estimates, but it is not ten equally trustworthy
recommendations, and reading the number alone would suggest that it was.

The manual run did not exercise the dropdown contents beyond what the scenarios required.
I am not claiming any manual count of the 943 user entries or the 1,682 movie entries; the
dropdown counts reported in `week3/evidence/RESULTS.md` come from the automated driver.

## 7. Why not Matrix Factorization

Matrix factorization is the standard next step and it is worth being explicit about why it
is not here. The brief fixed the similarity and prediction rules, so a latent-factor model
would not have been an implementation of the assignment as specified. Independently of
that, it would have been a poor use of the remaining effort: 100,000 ratings is small
enough to factor with plain JavaScript, but it means writing and tuning gradient descent
by hand with no numerical libraries, plus choosing a regularisation strength and a
dimension, none of which the evidence labels in the interface are built to describe. A
factor model would likely narrow the gap on 141 single-rater movies, which is the clearest
weakness of the similarity approach, but it would have replaced an interpretable,
verifiable method with an opaque one at the point where the brief asked for explanation.
I would treat it as the next assignment rather than as an improvement smuggled into this
one.

## 8. Limitations

- **One dataset, one split, one rule.** Every figure here comes from MovieLens 100K under a
  single leave-one-out rule. The user-based versus item-based difference is small enough
  that I would not expect it to survive a change of dataset.
- **Sparsity is mitigated, not removed.** At 6.29% density, 333 movies have fewer than five
  raters and 141 have one. The significance weight suppresses overconfident estimates from
  thin intersections; it does not create evidence that is not in the data. For the
  single-rater movies the honest answer is usually a fallback.
- **The evidence labels are heuristics.** They rank support, not correctness, and the
  thresholds are chosen rather than fitted.
- **Scores saturate at the top of the scale, so ranking carries the information the score
  loses.** In the manual run in section 6.8 all ten displayed Top-5 scores read 5.00 while
  their evidence ranged from one contributor to twenty and from an overlap of 1 to an
  overlap of 164. This is a score-saturation and ranking-confidence limitation, not an
  arithmetic failure: the calculations are covered by the unit suite and the independent
  cross-check, and no regression test demonstrates incorrect calculation. The display is
  faithful, but ten identical numbers are not ten equally trustworthy recommendations, and
  a reader who looks only at the score will over-trust the list.
- **The professor's example is a rule check, not a similarity check.** Production similarity
  is non-negative and cannot reproduce the slide's signed values.
- **Nothing here is temporally aware.** Ratings are treated as a static snapshot even though
  the data carries timestamps and tastes drift. The timestamps are used only to choose the
  holdout item.
- **Timings are runtime-specific.** Section F is measured in JavaScriptCore, not in the
  browser. The browser figures in section H are interaction timings including rendering, and
  the two are not interchangeable. The manual timings in section 6 were read off the page and
  are single observations, not averages.
- **Cold start is handled, not solved.** A user with no ratings receives the global mean.
  That is a defensible default and it is not a recommendation.

## 9. Defects found by the verification

The suite was written before the final version of the code and earned its keep. Four real
defects surfaced, each of which would have shipped:

| Defect | Symptom | Fix |
| --- | --- | --- |
| `collectItemNeighbours` pooled all anchors into one accumulator per candidate | item-based prediction scored a candidate against the sum of its similarities to all of the user's rated items instead of each similarity separately, so the prediction was simply the wrong formula | the sink is now keyed candidate to anchor, and a regression test asserts each per-anchor accumulator reproduces the pairwise similarity |
| `aggregatePrediction` never set `baseline` | `buildPredictionCard` calls `result.baseline.toFixed(2)` on every card, so the real interface would have thrown a TypeError on the first successful prediction | both return paths of `aggregatePredictionTotals` now set `baseline`; a regression check asserts every prediction result carries a finite baseline |
| `populateMovieDropdown` kept the placeholder from `index.html` and appended a second | the target movie dropdown offered two "No target movie" entries | the list is cleared to zero entries before rebuilding; the browser check asserts exactly 1,682 options plus one placeholder |
| the Python cross-check disagreed with the application by up to 0.43 ratings | the cross-check's mean helper compared the hidden-entity kind against the entity id, so no mean excluded the masked rating | replaced with explicit user and item mean lookups; agreement is now exact |

None of the four would have been found by reading the code carefully, which is the argument
for having the checks at all.

## 10. Reproducing this

```
cd week3/evidence
./run-all.sh
```

This runs 204 assertions and 13 cross-checked pairs in about 16 seconds and writes
machine-readable output to `week3/evidence/results/`. The exact figures for this submission
are recorded in `week3/evidence/RESULTS.md`. `week3/tests.js` holds the unit suite and is
deliberately not loaded by `index.html`; a static check asserts that, so the shipped page
never pays for the tests and the tests still exercise the shipped code.

Both data files are verified byte-identical to the originals by SHA-256 at the end of every
run, so a result here cannot be attributed to modified input data.

Section 6 is the exception to all of the above. Those observations were made by hand in the
browser, they are not reproducible by `./run-all.sh`, and they are not regenerated by it.
They are recorded in section 6 above and, kept separate from the automated browser results,
in `week3/evidence/RESULTS.md` under "Student Manual Browser Verification". The automated
browser checks in `week3/evidence/results/H-browser-*.json` remain the automated evidence and
are unaffected by them.
