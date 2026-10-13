# Trust-Aware User-Based and Item-Based Collaborative Filtering on MovieLens 100K

**Student Name:** Tokkozhin Sanzhar  ·  **Year of Study:** 2  ·  **Submission Date:** 29
September 2026

## 1. Abstract

Presenting a predicted rating without evidence is worse than presenting none. I built a
trust-aware recommender over MovieLens 100K [3] in plain JavaScript, implementing
user-based and
item-based collaborative filtering [1][2][4] that predict one rating and produce two
Top-5 lists.
My missing-value strategy is the **significance-weighted co-rated cosine**: unrated
entries are ignored, cosine uses only co-rated entries, and each similarity is damped by
*n*/(*n*+25), discounting predictions resting on one shared rating. The deterministic
holdout
evaluated all 943 users; supported prediction coverage was 922/943 for User-Based and
940/943 for
Item-Based, and item-based reached MAE 0.8318 against 0.8560. These are results for this
dataset
and split, not general claims about the methods.

**Keywords:** collaborative filtering, MovieLens 100K, cosine similarity

## 2. Dataset and Method

**Assignment and data.** I extended the Week 2 MovieLens 100K project [1] from
content-based
recommendation to collaborative filtering, with an interface alongside it. The data
files are
byte-identical to the Week 2 copies, verified by SHA-256. There are 943 users and 1,682
movie rows across 1,588,752
possible pairs, with 100,000 ratings on a 1–5 scale and no zeros: 6.29% density, 93.71%
sparsity. Eighteen canonical titles are each represented twice, giving 36 catalogue rows
with
separate item IDs, so a title is not a unique movie identifier; both files parse with zero
malformed rows.

**Integrity corrections.** `u.item` is Latin-1, so text decoding would replace all nine accented
titles with the replacement character, and I fetch an `ArrayBuffer` to decode as Windows-1252. Each
row has 24 pipe-separated fields, but the conventional reading treats field 5 as the
first genre
when field 5 is the `unknown` flag and genres run from fields 6 to 23 — that misreading reports
19 genres and shifts every label one column left, so I corrected the offsets. Rows are
checked for field count, integer identifiers and a rating within 1–5, with invalid rows
excluded. Titles are normalised by trimming, lowercasing and collapsing whitespace.
A zero means *not rated*, which it can only mean because real ratings are 1–5, so zeros
are skipped
rather than used as ratings of zero.

**Similarity and prediction.** A missing rating is ignored rather than imputed. For
vectors *a*
and *b* over the co-rated set *C*, with *n* = |*C*|:

```
rawCosine(a,b) = ( Σ_{k∈C} a_k·b_k ) / sqrt( Σ_{k∈C} a_k² · Σ_{k∈C} b_k² )
sim(a,b)       = rawCosine(a,b) · n/(n+25)          n = |C|, the co-rating overlap

User-Based:  r̂(u,i) = userMean(u) + Σ_v sim(u,v)·(rating(v,i) − userMean(v)) / Σ_v
|sim(u,v)|
Item-Based:  r̂(u,i) = itemMean(i) + Σ_j sim(i,j)·(rating(u,j) − itemMean(j)) / Σ_j
|sim(i,j)|
```

Cosine uses only co-rated entries, and being non-negative over positive ratings yields
similarity
in [0, 1] by construction. Damping makes overlap count: one shared rating gives weight
1/26 ≈ 0.0385, two give 0.074, twenty give 0.444. Items 1 and 361 share exactly one
rater, giving
raw cosine 1 damped to 0.0385, labelled LOW; without the term one shared rating would
look like
perfect agreement. Damping reduces the *apparent* strength of evidence built on
thin overlap but cannot create evidence absent from the data, so a one-rater film
honestly yields a
fallback. I rejected mean imputation, which would fabricate ratings and then trust them.

Both formulas aggregate the 20 strongest positively similar neighbours, differing only in
baseline and neighbour; mean subtraction matters because raw ratings differ
systematically between
lenient and strict users. Predictions are **clamped to [1, 5]**; where none is supported
the system
returns an **explicit fallback** to a stated baseline with the reason. Watched
items are excluded, repeated canonical titles are suppressed within each list, the Top-5
is
**deterministic** under a fixed tie-break rule, and **holdout masking** keeps a known
target rating
out of the calculation. Four things appear on screen and are not interchangeable: the
**model
prediction**, the **observed rating** (never an input to the estimate above it), the
**baseline
fallback**, and the **evidence label**.

**Professor's 2.58 example.** Run through the production aggregation helper, the slide's
example computes `r̂ = 3.67 + (−2.764 / 2.543) ≈ 2.58`. Recomputing from the slide's own rounded
row values gives 2.583529 against its displayed 2.583095, and I report that 0.000435
discrepancy
rather than hiding it: the slide rounds rows to two decimals but its denominator to
three. The
example validates the **aggregation rule** production shares; its similarities are
**signed**,
whereas my cosine is non-negative, so production cannot generate such values.

## 3. Verification and Evaluation

**Holdout protocol.** For each user I hide their most recent rating to a film whose
canonical title
is unique, breaking timestamp ties by the larger item ID. Uniqueness is necessary, or a
prediction
against one row would leak through the other. That filter excluded 1,269 ratings and no
user for a
short history, so all 943 qualified and I evaluated the whole population. The held-out
pair is excluded from the active user's mean, the item's mean, every co-rated
intersection and
every contribution sum, via one mask record consulted at all four points. **Other users'
future
ratings were not removed**, so this is leave-one-out, not complete temporal, evaluation.

| Metric | User-Based | Item-Based |
| --- | --- | --- |
| Coverage | 922/943 (97.77%) | 940/943 (99.68%) |
| Fallbacks | 21 | 3 |
| MAE / RMSE | 0.8560 / 1.1044 | 0.8318 / 1.0553 |
| Fallback-inclusive MAE | 0.8575 | 0.8330 |
| Median / p95 latency | 0.34 / 0.978 ms | 0.06 / 0.318 ms |

The methods support different subsets, so the fair comparison is the 922 pairs where
both do
(97.77%): item-based reaches MAE 0.8324 and RMSE 1.0557 against 0.8560 and
1.1044, with lower absolute error on 539 cases versus 373 and 10 ties — roughly 0.024
apart. I read this narrowly, per the standard warning that offline accuracy is easy to
over-interpret [5]. The robust observation is structural: a user almost always has some
rated film
sharing a rater with the target, whereas user-based needs a similar user who rated that
film.

**Manual browser cases.** I verified the built interface in Chrome by hand, recording
what it
displayed. These are stored separately from the automated evidence below, never combined
into one
pass count.

| Case (both for User 1) | Observed rating | User-Based | Item-Based |
| --- | --- | --- | --- |
| Star Wars (1977), already rated 5 | 5, shown as held out | 4.99 HIGH, 20 contributors, median overlap 159.5 | 5.00 HIGH, 20 contributors, median overlap 319 |
| Aladdin and the King of Thieves (1996), unrated | "Not yet rated by this user" | 2.77 LOW, 2 contributors | 3.42 HIGH, 20 contributors |

Star Wars was correctly absent from both Top-5 lists, and the 0.65-point gap on Aladdin
shows the
two do not merely reorder one opinion. I also confirmed that selecting no user fabricated
nothing, that target-free Top-5 rendered both lists, that the layout stacked at a narrow
viewport, that Tab moved focus visibly with no keyboard trap, and that the Console was
clean.

**Automated verification.** My suite evaluates the real implementation files, not a copy:
**204 of 204 automated assertions passed, 0 failed**, plus **13 independently
cross-checked
prediction pairs**. An independent Python re-implementation sharing no code reproduced
both
methods with a **worst delta of 0** at tolerance 1e-9, and re-derived the same holdout
items. Automated browser checks passed **43/43 at both viewports** (1280px, 375px).
Dataset
SHA-256 hashes are unchanged and `git diff --check` is clean. It caught four real defects that
would otherwise have shipped. **Item-neighbour accumulators were pooled
across anchors**, so item-based scoring summed similarities instead of using each
separately;
**prediction results omitted the baseline** the interface needs, throwing at runtime;
**the movie
dropdown retained stale "No target movie" entries**; and **the Python mean calculation
missed the
hidden rating**, causing discrepancies up to 0.43 points, caught because a second
implementation
disagreed. Each now has a regression check.

## 4. Business and Trust Analysis

**Efficiency and scaling.** User-based work is dominated by the number of *users*, so it
does not
grow with the active user's history. Item-based Top-5 cost grows with candidate items
*and*
history: as history rises from 20 to 737 ratings, item-based Top-5 rises from 15.82 ms to
432.00 ms (range 404.20–455.66 ms) while user-based stays between 0.86 and 2.90 ms. Here
users
greatly outnumber films, making item-based Top-5 the more expensive interactive
operation, yet
per-target latency was *lower* (0.06 ms against 0.34 ms median). These are not in
conflict:
ranking a candidate set is not producing one prediction. **Neither method is universally
faster:** the winner depends on the user-to-item ratio, history depth, and the workload.

**Cold start and sparsity.** Rating mass concentrates in a minority of the catalogue —
333 films
have fewer than five raters, 141 exactly one, the median film 27, the most popular 583.
A user
with no ratings falls back to the global mean of 3.52986; an item with no ratings to the
active
user's mean. Both are defensible defaults, not recommendations. With no valid
contributors the system falls back, naming `no-contributors`. No NaN, Infinity or unexplained zero
appeared in the sampled predictions.

**Evidence labels.** Every number carries a label: HIGH needs ≥10 contributors, median
overlap
≥10 and denominator ≥2; MEDIUM needs 3, 3 and 0.5; other supported values are LOW; every
fallback
is FALLBACK, never LOW. LOW is a real estimate from thin evidence, FALLBACK means no
estimate was
possible, and conflating them would let a baseline masquerade as a prediction. These are
**documented heuristics, not calibrated probabilities**: nothing was fitted to
correctness, so HIGH
means "well supported by co-ratings", not "probably correct".

**Score saturation.** In my manual run all ten displayed Top-5 scores were 5.00 while the
evidence varied substantially: user-based recommendations had one or two contributors and
were all LOW, while item-based had 20 contributors with median overlaps from 1 to 164
and labels
from LOW to HIGH, some resting on a median overlap of one. **Equal displayed scores
therefore did
not imply equal support.** I record this as a **ranking-confidence limitation, not a
proven
arithmetic bug**: the unit suite and independent cross-check agree exactly, and no
regression test
demonstrates incorrect arithmetic. When many candidates push against the top of the
scale the
clamped scores converge and stop discriminating, so ordering carries information the
number no
longer does. Ten items reading 5.00 faithfully displays ten correct estimates, but not
ten equally
trustworthy recommendations.

**Trust and discovery.** Displaying every figure with its contributors, overlap and
label makes a
prediction interpretable without the source, and the Aladdin case shows the two methods
recommending materially different films, which aids discovery. I make no claim about
retention or
revenue.

## 5. Limitations, AI Disclosure, and References

**Limitations.**

- **One dataset and one evaluation rule**; the 0.024 MAE difference is specific to this
setup, and
  only the active user's held-out rating is removed, so this is not complete temporal
evaluation.
- **Evidence labels are heuristics**, ranking support rather than correctness, and **score
  saturation** limits ranking confidence.
- **Production similarity is non-negative** and cannot represent the professor's negative
  similarities.
- **Runtime measurements depend on the environment**; cold start is handled by
baselines, not
  solved.
- **The 18 canonical titles represented twice remain 36 separate matrix columns**,
fragmenting the
  evidence for those films; recommendation generation suppresses repeated canonical
titles and
  excludes canonical titles the user has already rated, but never merges the rows.
Manual evidence
  is not reproducible by the automated suite.
- **Matrix factorisation was not implemented**, leaving the clearest weakness of the
similarity
  approach unaddressed. I judged it out of scope: the assignment fixed the similarity and
  prediction rules, and a latent-factor model built without numerical libraries would
have replaced
  an interpretable method with an opaque one where the brief asked for explanation.

**AI assistance disclosure.** I used OpenCode as an AI-assisted development tool to
inspect the
starter code, implement draft changes, and construct verification scripts. I reviewed the
implementation and evidence, performed the manual browser checks, and take
responsibility for the
submitted results.

**References.**

[1] Instructor Week 3 repository, `RecSys-LLMs`. https://github.com/dryjins/RecSys-LLMs/tree/main/week3
[2] Google Developers. *Collaborative Filtering basics for recommender systems.*
https://developers.google.com/machine-learning/recommendation/collaborative/basics
[3] GroupLens Research. *MovieLens 100K Dataset.*
https://grouplens.org/datasets/movielens/100k/
[4] Sarwar, B. M., Karypis, G., Konstan, J., & Riedl, J. *Item-based collaborative
filtering recommendation algorithms.* https://doi.org/10.1145/371920.372071
[5] Herlocker, J. L., Konstan, J. A., Terveen, L.-G., & Riedl, J. *Evaluating
collaborative filtering recommender systems.* ACM Transactions on Information Systems,
22(1), 2004. https://doi.org/10.1145/963770.963772
