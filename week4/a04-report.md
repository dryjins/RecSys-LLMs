# Association Rule Mining on UCI Online Retail Baskets

**Student:** Tokkozhin Sanzhar  **Year of study:** 2  **Submitted:** 6 October 2026

## 1. Abstract

For the Week 4 assignment [1] I implemented the seven required functions — basket deduplication, itemset counting, support, confidence, lift, an Apriori miner, and rule generation — following the level-wise, downward-closure method of Agrawal and Srikant [4], and applied them to the cleaned UCI Online Retail export [2] of 17,080 baskets and 3,653 items. Results were validated by the provided browser suite (11 of 11 checks), a brute-force enumeration on a five-basket fixture, and a separate raw-basket recount. Threshold sweeps show strong sensitivity: raising support from 1% to 3% collapses the rule count from 950 to 12. I report one useful rule joining two jumbo-bag designs and one misleading rule whose strength is explained by the consequent's popularity. Both are co-purchase associations, not causal effects, so I propose a randomised A/B test rather than immediate deployment.

## 2. Dataset and Method

**Data.** The source is the UCI *Online Retail* dataset [2]: 541,909 rows, 1 December 2010 to 9 December 2011, for a UK non-store online retailer — the log whose customer base was modelled by RFM segmentation in [3]. The starter supplies a cleaned, dictionary-encoded export: 384,911 retained rows grouped into 17,080 baskets with 3,653 distinct `StockCode` values [1]. Column roles: `InvoiceNo` defines the basket, `StockCode` is item identity, and `Description` is a display label, never a key. Quantities are not multiplicative; a line repeated with a larger `Quantity` does not create a second basket membership. Cleaning removed cancellations and adjustments, non-positive quantities and prices, blank descriptions, guest checkouts, non-product codes, and baskets of fewer than two distinct items [1]. One property constrains the analysis that follows: the export carries no `InvoiceDate` field.

**Basket semantics and metrics.** Each basket is a set: `dedupeBasket` collapses repeated stock codes to a single entry in first-appearance order. For an itemset $X$, let $\mathit{count}(X)$ be the number of baskets containing every item in $X$, and let $N = 17{,}080$.

$$\mathit{support}(A \to B) = \frac{\mathit{count}(A \cup B)}{N} \qquad \mathit{confidence}(A \to B) = \frac{\mathit{count}(A \cup B)}{\mathit{count}(A)} \qquad \mathit{lift}(A \to B) = \frac{\mathit{confidence}(A \to B)}{\mathit{count}(B)/N}$$

Support measures how often a pattern occurs, not link strength. Confidence is the conditional probability of $B$ given $A$ and is directional. Lift compares the observed co-occurrence with independence: 1 means independent, above 1 more than chance, below 1 less than chance, and it is symmetric. Each helper returns `{ value, defined }` and reports `defined: false` on a zero denominator, so an absent antecedent yields an explicit note instead of a printed `Infinity` or `NaN`.

**Miner.** `findFrequentItemsets` implements Apriori [4]. Itemsets are built level by level: candidates of size $k$ are the join of large $(k{-}1)$-itemsets, then pruned by deleting every candidate with a $(k{-}1)$-subset that is not large. This is the downward-closure property — every subset of a frequent itemset is frequent — so whole levels are discarded before counting [4]. Counting uses a private inverted posting index per stock code, intersecting the smallest posting lists first. The support floor is $\max(1, \lceil \mathit{minSupport}\cdot N - |N|\cdot\varepsilon \rceil)$, so an itemset at exactly the threshold is not lost to floating-point error. Items are traversed in a fixed order, so output is deterministic. `generateRules` splits each frequent itemset into every non-empty proper subset in both directions, deduplicates the complementary pair, and retains those meeting the confidence threshold.

## 3. Verification and Results

**Automated verification.** The provided harness reports 11 passed, 0 failed, 0 pending, from a baseline of 2 passed, 0 failed, 9 pending with the stubs untouched. It covers the metric helpers, degenerate denominators, the miner, and a five-basket fixture.

**Independent brute force.** I enumerated that fixture exhaustively, every itemset and ordered rule pair, without my miner. At support 0.4 it returns 9 itemsets; at 0.2, 19 itemsets; at 0.2 with confidence 0.5, 38 rules, matching brute-force identities, counts, support, confidence and lift. The fixture's lift-equals-1, lift-above-1 and lift-below-1 rows reproduce the hand-computed page values.

**Real-data checks.** Repeated runs at a fixed threshold produce identical row ordering and values; mining 1,219 itemsets at 1% support took roughly 2.2 s in Chrome. No rule in any configuration produced `NaN` or `Infinity`. For the rule analysed in Section 4 I recounted the raw baskets with a throwaway script that parsed the dataset file and tested membership directly, without the miner, index builder, or any metric helper; it returned identical counts. That script was a cross-check only, not part of the implementation and not submitted: the the deliverable is JavaScript with no Python component [1].

**Manual verification.** These are my own browser observations, recorded separately from the 11 automated checks and deliberately **not** added to that count. The page opened from `week4/index.html`; the dataset summary showed 17,080 baskets and 3,653 distinct items. *Run tests* showed 11 passed, 0 failed, 0 pending. At 1% support and 30% confidence, 950 rules rendered; at 3% and 30%, 12 rules; at 1% and 60%, 238 rules. Selecting the jumbo-bag rule displayed $\mathit{count}(A) = 1{,}584$, $\mathit{count}(B) = 869$, $\mathit{count}(A \cup B) = 546$, support 3.20%, confidence 34.47%, and lift 6.7749. *Reverse direction* showed confidence 62.83% with support and lift unchanged. Tab navigation, Enter and Space rule activation, visible focus, the Reverse button, and the narrow mobile layout all worked; the DevTools Console showed no errors.

**Threshold sensitivity.** I chose 1% support and 30% confidence as the primary thresholds. At 1% support a pattern must appear in at least 171 baskets, discarding very small patterns while retaining enough candidates for comparison; at 30% confidence they avoid very low attach rates while still leaving 950 to analyse. These are analytical choices for this dataset, not universally optimal values; the 3%/30%, 1%/60% and 0.5%/10% rows below are sensitivity checks, not competing recommendations.

| Support | Confidence | Minimum count | Frequent itemsets | Sizes (1/2/3/4/5/6) | Rules |
|---|---|---|---|---|---|
| 1.0% | 30% | 171 | 1,219 | 691 / 413 / 109 / 6 / 0 / 0 | 950 |
| 3.0% | 30% | 513 | 115 | 109 / 6 / 0 / 0 / 0 / 0 | 12 |
| 1.0% | 60% | 171 | 1,219 | 691 / 413 / 109 / 6 / 0 / 0 | 238 |
| 0.5% | 10% | 86 | 5,255 | 1,320 / 2,206 / 1,161 / 474 / 88 / 6 | 19,058 |

Raising support to 3% removes 90.6% of itemsets and 98.7% of rules and eliminates levels 3–6, because downward closure means a $k$-itemset cannot survive unless all its $(k{-}1)$-subsets do. Raising confidence to 60% leaves the 1,219 itemsets untouched, pruning only the rule set: the two sliders act at different stages. Lowering the pair to 0.5% and 10% recovers levels 5 and 6 and yields 19,058 rules, the first configuration producing lift below 1: broader coverage, but it admits additional weak and threshold-sensitive patterns.

## 4. Business Analysis and Validation

**A useful rule.** Let $A$ = `85099B` — JUMBO BAG RED RETROSPOT and $B$ = `22386` — JUMBO BAG PINK POLKADOT, with $N = 17{,}080$, $\mathit{count}(A) = 1{,}584$, $\mathit{count}(B) = 869$, and $\mathit{count}(A \cup B) = 546$.

| Metric | Value |
|---|---|
| $\mathit{support} = 546 / 17{,}080$ | 3.196721% |
| $\mathit{confidence}(A \to B) = 546 / 1{,}584$ | 34.469697% |
| $\mathit{confidence}(B \to A) = 546 / 869$ | 62.830840% |
| $\mathit{lift} = (546 \times 17{,}080) / (1{,}584 \times 869)$ | 6.774942 |

Three paths agree — raw-basket recount, miner, rendered table — on 546, 1,584, and 869. The antecedent is the most frequent in the 1%/30% table, exposing a large actionable audience, and 546 baskets carry the pair — absolute volume, not a large ratio on a tiny base. Consequent $B$ appears in 5.0878% of all baskets, yet 34.47% of $A$-baskets carry it, about 6.77 times its base rate. Same product family, different design: a plausible alternative-colour bundle, not an arbitrary catalogue pairing. Its counts and metrics do not depend on the selected threshold: support 3.196721% clears both the 1% and the 3% floor, and the rule would drop out only once minimum support exceeded 3.196721%. Changing the threshold alters the surrounding rule set, not this rule's numbers. I do not propose shipping it on this evidence; it is a candidate for the validation below.

**A misleading rule.** Let $A$ = `22727` — ALARM CLOCK BAKELIKE RED and $B$ = `85123A` — WHITE HANGING HEART T-LIGHT HOLDER. This pair appears at minimum support 0.5% and minimum confidence 10%, not in the primary 1%/30% table, with $\mathit{count}(A) = 877$, $\mathit{count}(B) = 1{,}959$, $\mathit{count}(A \cup B) = 98$, and $N = 17{,}080$.

| Metric | Value |
|---|---|
| $\mathit{support} = 98 / 17{,}080$ | 0.573770% |
| $\mathit{confidence}(A \to B) = 98 / 877$ | 11.174458% |
| base rate of $B$ = 1,959 / 17,080 | 11.469555% |
| $\mathit{lift}$ | 0.9743 |

Read out of context, 11.17% looks like a usable attach rate. The anchor item already occurs in 11.47% of all baskets on its own [1], so the conditional rate is slightly *below* its unconditional rate: within this dataset the rule does not outperform showing the holder to a random basket, and lift below 1 gives no evidence that targeting alarm-clock baskets improves selection of $B$. This is popularity making confidence misleading — a statement about observed frequencies, establishing no causal financial outcome.

A second limitation runs the other way: `22916` — HERB MARKER THYME to `22917` — HERB MARKER ROSEMARY has confidence 94.62% and lift 85.0617, the highest in the 1%/30% table, on an antecedent count of 186 and joint count 176. Its arithmetic is exact; its volume is tiny, and it vanishes at 3% support. Neither metric alone ranks usefulness — that needs exposed volume plus lift above 1.

**Rule direction.** Support and lift are symmetric; confidence is not, because it divides by $\mathit{count}(A)$. For the useful rule, confidence moves from 34.47% to 62.83% on reversal while support and lift are unchanged, so a recommendation must state its direction.

**Business action and causality.** The Rules table applies support and confidence first; for the positive business candidate above I then retained $\mathit{lift} > 1$, which is why the alarm-clock rule is the deliberately rejected counterexample at $\mathit{lift} = 0.9743$. I would test showing $B$ as a same-family alternative when $A$ is viewed or added to cart, rather than deploying on this evidence. $A \to B$ is an observed co-purchase pattern; it does not show that promoting $A$ causes purchases of $B$. Plausible confounders include the shared product family and similar design, gift or bulk-order baskets, the wholesale/retail mix, and shared promotion or merchandising placement.

**Validation plan.** *Later-period stability check (requires data this export does not contain).* Given a new timestamped export, I would split baskets by date, recompute the three counts, both confidences and lift on the later window alone, predefine a minimum joint count below which the pair is too thin to interpret, and require lift above 1 with volume retained before experimenting. The current file has no `InvoiceDate`, so this is hypothetical and I did not run it. *Prospective randomised A/B test.* Treatment shows $B$ when $A$ is viewed or added to cart; control keeps the current interface. The primary metric is the incremental attach rate of $B$ among eligible $A$ sessions; secondary metrics are revenue or contribution margin, with cancellation and return guardrails. I accept the rule only if the treatment yields a statistically credible positive increment without harming the guardrails; otherwise I reject or revise it. No such experiment has been run and no outcome is claimed.

## 5. Limitations, AI Assistance, and References

**Limitations.** Every figure is a frequency statement over the observed period only; the export pools roughly twelve months, so seasonality is invisible. Wholesale and gift baskets are not separated from retail, and the catalogue includes novelty codes appearing in one or two baskets, so rules involving them are catalogue artefacts. Counts are unordered memberships without quantities, prices, margins, or customer identity, so nothing here supports a revenue estimate. All rules are associations; none of this analysis identifies a causal effect.

**AI assistance.** I used OpenCode to inspect the starter code, implement the seven `TODO` functions, build the verification procedures, analyse the outputs, and draft this report. I ran the browser checks myself and recorded them in Section 3 as manual observations, and I reviewed the results, threshold table, and hand calculation. I take responsibility for this submission. Automated and manual evidence are reported separately; every number here was produced by code I ran and inspected. I opened all four references: [3]'s authors and journal details match the UCI page for [2] and its DOI record, and the algorithm, decomposition and pruning claims attributed to [4] were read from the paper text.

**References**

[1] S. Jin, "HW4 — Association Rules (Week 4)," instructor starter, `dryjins/RecSys-LLMs`, HSE University. [Online]. Available: https://github.com/dryjins/RecSys-LLMs/tree/main/week4

[2] D. Chen, "Online Retail [Dataset]," UCI Machine Learning Repository, 2015. doi: 10.24432/C5BW33. [Online]. Available: https://archive.ics.uci.edu/dataset/352/online+retail

[3] D. Chen, S. Laing Sain, and K. Guo, "Data mining for the online retail industry: A case study of RFM model-based customer segmentation using data mining," *Journal of Database Marketing & Customer Strategy Management*, vol. 19, no. 3, pp. 197–208, 2012. doi: 10.1057/dbm.2012.17. [Online]. Available: https://doi.org/10.1057/dbm.2012.17

[4] R. Agrawal and R. Srikant, "Fast algorithms for mining association rules in large databases," in *Proc. 20th VLDB Conf.*, Santiago, Chile, 1994, pp. 487–499. [Online]. Available: https://www.vldb.org/conf/1994/P487.PDF