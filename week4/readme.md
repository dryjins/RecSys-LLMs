# HW4 — Association Rules (Week 4)

**Course**: LLM4Rec, HSE University
**Instructor**: Seungmin Jin (sedzhin@hse.ru)
**Repository**: https://github.com/dryjins/RecSys-LLMs/tree/main/week4
**Task type**: Assignment (individual)

---

## 1. Learning goals

By the end of this assignment you should be able to:

- Turn a raw retail transaction log into **item counts** and **pairwise
  co-occurrence counts**, and explain why those counts are all that
  association-rule mining needs.
- Compute **support**, **confidence**, and **lift** for a rule, and explain what
  each metric does and does not measure.
- Implement **Apriori** (or an equivalent frequent-itemset miner) using the
  downward-closure property: every subset of a frequent itemset is frequent.
- Generate **candidate rules in both directions** (`A → B` and `B → A`) and show
  that confidence is *not* symmetric while lift *is*.
- Filter a rule list with **support / confidence thresholds**, keep only rules with
  **lift > 1**, and describe how each filter changes the list of rules you keep.
- Distinguish a **genuinely useful rule** from a **misleading one** that only looks
  good because one item is very frequent.
- Reason about **association versus causation**, and propose a **validation plan**
  for a rule when the exported dataset carries no usable time information.

---

## 2. Run instructions

Open `week4/index.html` in a modern browser. No build, no server, no install. Keep
`week4/transactions.js` next to `index.html` — it holds the dataset; if it is
missing, the page shows a "Failed to load `transactions.js`" message.

The page shows a dataset summary and a **Controls** sidebar with the minimum
support and confidence sliders. Press **Run tests** to check the metric helpers,
then **Run rules**. Click a rule to open it in the detail panel, where **Reverse
direction (B → A)** compares `A → B` with `B → A`.

---

## 3. Dataset provenance

- **Source**: UCI Machine Learning Repository, *Online Retail*, dataset id **352**.
  - Dataset page: `https://archive.ics.uci.edu/dataset/352/online+retail`
  - Raw download: `https://archive.ics.uci.edu/static/public/352/online+retail.zip`
  - Original workbook sha256:
    `43465a06f2ccf7c8b5bd2892bc7defb52f97487934fe93b16ae4c3936424676d`
- **Citation** (as required by the source): Daqing Chen, Sai Liang Sain, and Kun
  Guo, "Data mining for the online retail industry: A case study of RFM
  model-based customer segmentation using data mining", *Journal of Cases on
  Information Technology*, 2012.
- **Cleaning summary** (performed by `tools/build_week4_data.py`, a one-off
  generator that is **not** part of this assignment):
  - 541,909 raw rows → **384,911 kept rows**, **17,080 baskets**, **3,653 distinct items**.
  - Rows removed: cancellations (`InvoiceNo` starting with `C`) and adjustments
    (`A`), non-positive `Quantity`, non-positive `UnitPrice`, blank `Description`,
    guest checkouts (blank `CustomerID`), and non-product codes (postage,
    carriage, bank charges, manual entries, samples, discounts, gift vouchers,
    packing charges, internal adjustments).
  - `StockCode` is trimmed and upper-cased so case variants such as `84509c` and
    `84509C` collapse to one item; `Description` is upper-cased, whitespace is
    collapsed, trailing punctuation is dropped, and one canonical description is
    kept per stock code.
  - Baskets are grouped by `InvoiceNo`. Baskets with fewer than two distinct items
    are dropped because they cannot yield a rule. Baskets are **not** split by
    customer.
- The full provenance string is available as `window.HW4.dataset_provenance` (set
  by `week4/transactions.js`) and is displayed in the page's dataset summary.

---

## 4. Required student work

### 4.1 Implementation Task

Implement the seven `TODO(hw4)` stubs in `week4/script.js`:

1. **Basket construction.** Build an invoice–item basket matrix: implement
   `dedupeBasket(rawItems)` so a repeated item in a raw basket is counted once (a
   basket behaves as a *set* of items), keeping first-appearance order.
2. **Counting.** Implement `countItemset(basketsOrIndex, stocks)` — the number of
   baskets containing every stock in `stocks`. `countItem` and `countPair` are
   provided thin wrappers over it.
3. **Support, confidence, lift.** Implement `computeSupport`, `computeConfidence`,
   and `computeLift`, each returning `{ value, defined }` with `defined: false` on a
   zero denominator. Your numbers must match the definitions in §5 exactly.
4. **Frequent itemsets.** Implement `findFrequentItemsets(transactions, minSupport)`
   — Apriori, FP-Growth, or an equivalent frequent-itemset miner — and return
   itemsets with their counts and supports.
5. **Candidate rules.** Implement `generateRules(frequentItemsets, minConfidence)`.
   Split each frequent itemset into antecedent and consequent **both ways**, compute
   confidence for each direction, and keep the rules that pass the threshold.
6. **Threshold filtering.** The two sliders feed `minSupport` and `minConfidence`.
   The Rules table must contain exactly the rules that satisfy both; downstream
   analysis retains only rules with **lift > 1**.
7. **Selected-rule display.** Clicking a rule must show it in the detail panel, and
   the **Reverse direction** button must show `B → A` with its own recomputed
   confidence and lift. Demonstrate that confidence changes with direction while
   lift does not.
8. **Zero-denominator handling.** If `count(A) === 0` or `count(B) === 0`, the
   metric is undefined; the detail panel must show an explicit inline note instead
   of printing `Infinity` or `NaN`. (With well-formed generated rules this cannot
   happen — implement it defensively anyway.)

Do not change `transactions.js`, `index.html`, or `style.css` beyond what is
needed to make your implementation work. Keep all code and comments in English.

### 4.2 Business & Algorithmic Analysis

Answer in the course report (see §7), using numbers produced by your own code:

1. **One useful rule.** Report a rule with lift comfortably above 1 and an
   antecedent count large enough to be actionable. State the business action you
   would take (cross-sell, bundle, recommendation slot) and why the lift — not the
   confidence alone — supports it.
2. **One misleading or weak rule.** Report a rule that looks strong on confidence
   but is weak or vacuous: for example, a very high-confidence rule whose **lift is
   close to 1**, or a rule whose antecedent is so frequent that the rule is trivially
   satisfied. Explain what makes it misleading and what a naive reading would get wrong.
   *(Anchor fact for this discussion: the most frequent item,
   `85123A` — WHITE HANGING HEART T-LIGHT HOLDER — appears in 1,959 of 17,080
   baskets, i.e. 11.47%. It is frequent, but it is not in every basket, so
   "high confidence" alone does not imply an informative rule.)*
3. **Threshold trade-off.** State and justify the minimum support and confidence
   thresholds you actually chose for your final rule table. Then run the miner with
   at least two settings (for example 1% vs 3% support; 30% vs 60% confidence) and
   report how the number of frequent itemsets and rules changes. Explain the
   direction of the effect in terms of downward closure.
4. **Cross-sell / bundle / placement use case with a limitation.** Describe one
   concrete bundle, product-placement, or "customers who bought A also bought B"
   feature you would ship, and
   state its most important limitation (sparsity of long baskets, seasonality,
   wholesale-vs-retail mix in this dataset, or the fact that a rule is a frequency
   statement about the observed period only).
5. **Association is not causation.** Explain why `A → B` does not mean that
   promoting `A` causes sales of `B`, and give a plausible confounding explanation
   for the rule you chose in item 1.
6. **Validation plan (no usable timestamps in the exported data).** The source log
   has an `InvoiceDate` column, but the exported dataset contains baskets only
   (grouped by `InvoiceNo`), so the starter has **no usable per-basket timestamp**.
   **Do not simulate temporal data.** Propose a stability check on a **later time
   period** — for example, a held-out period split, an A/B test in which the bundle
   is shown to a treatment group and the incremental attach rate is compared with a
   control group, and the decision rule you would use to accept or reject the rule.
   Describe how you would use such data to test whether the rule still holds before
   deploying. If you had access to later-period data, describe how you would test
   the rule's stability. If not, describe the smallest experiment that would let
   you measure it. State clearly that the plan requires data the starter does not
   contain.

---

## 5. Definitions

For an itemset `X`, let `count(X)` be the number of baskets containing every item
in `X`, and let `N` be the total number of baskets (`window.HW4.N_BASKETS` in
`transactions.js`).

```
support(A → B)    = count(A ∪ B) / N
confidence(A → B) = count(A ∪ B) / count(A)
lift(A → B)       = confidence(A → B) / [ count(B) / N ]
```

Notes:

- `support` is the share of all baskets that contain A and B together. It measures
  how often the pattern occurs, not how strong the link is.
- `confidence` is the conditional probability of B given A. It is **not symmetric**:
  `confidence(A → B)` and `confidence(B → A)` generally differ.
- `lift` compares the observed co-occurrence with what independence would predict.
  `lift = 1` means A and B are independent, `lift > 1` means they co-occur more than
  chance, `lift < 1` means less than chance. Lift **is symmetric**:
  `lift(A → B) = lift(B → A)`.
- The two denominators that can be zero are `N` (never zero here) and `count(A)`
  (zero when the antecedent never occurs). Both must be guarded.

---

## 6. Implementation & analysis tasks

1. Read `week4/script.js` and identify the seven `TODO(hw4)` stubs:
   `dedupeBasket`, `countItemset`, `computeSupport`, `computeConfidence`,
   `computeLift`, `findFrequentItemsets`, and `generateRules`. The rest of the
   file (dataset loading/decoding, `buildIndex` / `asIndex`, the `countItem` /
   `countPair` wrappers, `validateThresholds`, formatting, rendering, and the test
   harness) is scaffolding and should be left as-is.
2. Run the page, press **Run tests**, and record the baseline pass / fail /
   pending counts. With the stubs untouched the harness reports **2 passed /
   0 failed / 9 pending**; after a correct implementation all **11** checks
   should pass.
3. Implement the metric and counting stubs: `dedupeBasket` (unique stock codes in
   first-appearance order), `countItemset` (baskets containing every requested
   stock, returning `0` when any stock is absent), and `computeSupport`,
   `computeConfidence`, `computeLift` (each returns `{ value, defined }` and
   guards its zero denominator).
4. Implement `findFrequentItemsets(transactions, minSupport)` with Apriori
   (level-wise candidate generation plus downward-closure pruning) or an
   equivalent miner, returning `{ items, count, support }` for each frequent
   itemset.
5. Implement `generateRules(frequentItemsets, minConfidence)`, generating both
   rule directions (`A → B` and `B → A`) and keeping the rules that pass the
   threshold. Confirm that the two miner checks now report `PASS` and that the
   fixture's `lift = 1`, `lift > 1`, and `lift < 1` cases match the hand-computed
   values in `tinyWorkedExample`.
6. Run the miner on the real dataset at two threshold settings and save the rule
   tables you will cite.
7. Hand-compute support, confidence, and lift for **one** rule from the real data
   directly from the raw counts, and confirm it against the number the page shows.
8. Answer the six analysis questions in §4.2, citing your own computed numbers.
9. Verify every citation you use: check that the paper, URL, authors, and year are
   real before submitting (see §8).

---

## 7. Submission instructions

Submit the **modified `week4/` directory** containing:

| File | Role |
|---|---|
| `week4/transactions.js` | dictionary-encoded dataset embedded as a plain script (provided, do not modify) |
| `week4/script.js` | your implementation of the `TODO(hw4)` stubs |
| `week4/index.html` | page structure (provided) |
| `week4/style.css` | styling (provided) |
| `week4/readme.md` | this file |

Plus the course report (IEEE-aligned, per the homework guidelines) that answers
§4.2.

- **No Jupyter notebook** (`.ipynb`) is part of this deliverable.
- **No separate memo** is required; the analysis belongs in the report.
- **No Python** is part of this deliverable. `tools/build_week4_data.py` is the
  one-off dataset generator used by the instructor; it is not a student deliverable
  and must not be submitted.
- Do not commit generated artefacts, virtual environments, or log files.

---

## 8. Grading criteria

Grading follows the course homework guidelines, **§8 — Rubric Criteria in Detail**
(course repository path: `docs/homework-guidelines/guidelines.md`). The two
criteria are **binary** (0 or 1) and combine into a per-assignment score of
**0, 1, or 2**:

- **c1 — Understanding.** Clear problem statement; all references valid;
  attribution accurate. A hallucinated citation, a broken reference URL, or a
  fabricated author/year is a **Gate 0** failure of c1.
- **c2 — AI Management.** The solution works (the page runs and the table matches
  the code output); the reasoning is accurate; and verification is cited (a
  hand-computed metric, a re-run, a source read beyond the abstract, or a
  cross-check of a number against the code).

Read §10 of the same guidelines for the **Gate 0** failure modes. The ones that
apply most directly here:

- a **hallucinated citation** (a paper that does not exist) — including the UCI
  source reference;
- **fabricated verification** — claiming you hand-computed or re-ran something you
  did not;
- a **broken solution** — the page does not run, or the numbers shown do not match
  the code's own output.

If you cannot verify a critical output, say so honestly in the report's AI-usage
section rather than claiming verification you did not perform.

---

*Generated 2026-09-29 from HW4 work order.*
