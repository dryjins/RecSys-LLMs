# FAR-Trans Team Project — Shared Scope and Tracks

**Course**: LLM4Rec, HSE University
**Instructor**: Seungmin Jin (sedzhin@hse.ru), GitHub <https://github.com/dryjins>
**Cohort**: FKN **Duration**: 4 sessions
Individual homework follows the existing homework guidelines: PDF report and AI-session export.
**Version**: v2.0 — 2026-11-06

This document describes the common project. It does not change the homework
guidelines, the report template, the page limit or the assessment.

## 1. Common data

Every team uses **FAR-Trans**, the public financial asset recommendation dataset
released by the University of Glasgow. Both links below were checked on 2026-11-06:

- Dataset archive: <https://researchdata.gla.ac.uk/1658/>
- Paper: <https://arxiv.org/abs/2407.08692> — Sanz-Cruzado, Droukas, McCreadie,
  "FAR-Trans: An Investment Dataset for Financial Asset Recommendation" (2024).

FAR-Trans is a shared data source, not a prescribed model. Teams use the same
eligible universe, evaluated users, time cut and exclusion rules so that their
results are comparable.

## 2. Shared task and output

For each evaluated user, produce a **Top-10 ranked list of assets**. Inputs may
include past transactions, user profile fields and asset information available
at prediction time. The primary metric is **nDCG@10 against the assets the user
actually purchases in the future evaluation window**. Same users, same candidate
universe, same time split, same metric.

The exact item scope, split, evaluated users and transaction-label rules are
**pending** and will be fixed by the instructor before Session 2. State your
assumptions as assumptions; do not present them as official.

The shared output is one ranking task, not three separate projects. Tracks differ
in method and question, never in deliverable format or evaluation protocol.

## 3. Three methodological tracks

| Track | What the LLM changes | Shared output |
|---|---|---|
| **Encoder** | LLM-derived user and/or item representations, fed to retrieval or content-based/hybrid recommendation | Same Top-10 list |
| **Ranker** | LLM-enhanced scoring or reranking of the same eligible assets | Same Top-10 list |
| **Hybrid** | Encoder and ranker combined | Same Top-10 list |

- Encoder work may feed a retrieval stage, a content-based recommender or a hybrid pipeline.
- Ranker work scores or reranks the same eligible asset set; it may not quietly change the candidate universe.
- Hybrid is allowed. It must separate the encoder contribution from the ranker contribution with an ablation.
- A feasible comparison includes a baseline, encoder-only, ranker-only and both. A project may study one side when that is its question; this is not a rule that every project must implement both.
- Methods are not limited to a specific LLM size, model family or fine-tuning requirement. Prompted, frozen, fine-tuned, distilled and classical components are all acceptable if the comparison is fair and reproducible.

Questions may differ within a track. Two teams may share a question or study
different interventions on the same side; what must not happen is an independent
silo with its own task, data cut, metric or output.

## 4. Research question and baseline

A project question is a narrow workshop- or short-paper-level question, not a
promise of publication. Negative and null results are valid and must be reported.

Name the intervention, comparator, outcome and population. At least one
**existing classical recommender** is the baseline: popularity, content-based,
collaborative filtering, matrix factorization or a learned ranker, receiving the
**same information** as the proposed method. Add a same-information control: if
the LLM sees profile text and the baseline does not, the difference is
information, not method.

Risk, profit and ranking accuracy are different targets. nDCG@10 measures
ranking accuracy against observed purchases, not profitability or suitability.
A short-horizon return is a secondary diagnostic only; it is not a primary
metric, and no fixed multi-day trading horizon is required. Do not claim causal
effects on profit.

## 5. Four-session milestones

| Session | Milestone | Exit evidence |
|---|---|---|
| Session 1 | **Define** | Shared scope, one question per student, data fields and baseline plan; literature and research-question discussion in the team |
| Session 2 | **Encoder & Ranker Models: Implementation and Baselines** | Frozen common protocol; working classical baseline and evaluation code; minimal implementation of the chosen LLM approach. |
| Session 3 | **Test** | Main comparison, ablation and controls, error analysis; draft results |
| Session 4 | **Present** | Reproducible results, threats, defense, short paper and code |

Session 2 lecture covers LLM encoder, ranker and combined architectures,
implementation choices and controlled comparisons. Its milestone is a working
baseline and evaluation pipeline plus a minimal implementation of the selected
approach—not a final performance claim.

These four milestones are the same for every team and follow the agreed course
schedule. This document does not add a separate calendar or new deadlines.

## 6. Team registration (project administration)

Register once per team in the **Projects** tab of the course grade sheet, using
exactly these five fields:

| Field | What to write |
|---|---|
| Group Name | Short team name, unique within the cohort |
| Group Leader Telegram ID | One leader; used for course communication |
| Members (Full Names in Russian) | One full name per member, as listed |
| Project Name | Working project title |
| GitHub Link | Team repository holding code and documents |

Create one shared repository and invite GitHub user **dryjins**
(<https://github.com/dryjins>) as a collaborator. Registration is project
administration, not an individual homework submission: every student still
submits their own report and AI session export under the homework guidelines.

## 7. Assessment

| Component | Weight | What it covers |
|---|---|---|
| Correctness, evidence, reproducibility and defense | 30 | Whether the work is correct, supported by evidence, repeatable and defensible |
| Stanford AI review | 20 | The external review component of the course assessment |
| Shared benchmark ranking | 50 | Performance on the common FAR-Trans benchmark |

These weights are the announced overall assessment. An explicit conversion from
these weights to individual assignment points is not published, and none is
invented here. Session 1 remains an individual homework under the existing
guidelines; this document assigns no Session-1 points.

### Shared benchmark ranking (50 points)

The 50-point benchmark component is a **rank-based** score within a comparison
cohort, not a transformation of the metric magnitude. Let `N` be the number of
eligible teams with a valid official submission in that cohort, and let `r` be
the team's **average rank** among the **official, unrounded** nDCG@10 values
(not the four-decimal display values). With average ranking of exact ties, a
team's points are

```
points = 50 - 40 * (r - 1) / (N - 1)    for N > 1
```

rounded for display to one decimal place. A unique best rank gives 50 points and
a unique lowest rank gives 10 points. If `N = 1`, the single valid team receives
50 points. For example, with three eligible teams whose official nDCG@10 values
are strictly ordered, the points from best to worst are 50, 30 and 10. Teams
with identical official nDCG@10 share the same average rank and therefore the
same points; the formula does not reserve 50 points for every tied team, and no
all-tie case is added beyond this average-rank rule (for `N > 1`, an all-tie
cohort therefore gives 30 points to each team).

A team with no valid submission or an invalid submission does **not** receive
the 10-point benchmark minimum: it records **0** on the 50-point benchmark
component. This zero applies to the benchmark component only and is not, by
itself, a project-wide Gate 0; any project-wide failure follows the applicable
integrity policy.

Rank is computed **within a comparison cohort**. FKN, GSB and AVITO are separate
cohorts, and the instructor has not fixed whether any cohorts are pooled; do not
assume or invent a pooled grouping. The comparison groups and valid-submission
criteria will be announced before the final deadline; do not pool cohorts with
different project durations without an announced rule.

nDCG@10 measures ranking accuracy, not profit; no bootstrap significance test,
team-level bias correction or other unannounced statistic is used.

### Participation, defense and individual contribution

All team members do not need to attend the presentation. The presenting members
must be prepared to defend the whole team's data, model, protocol, experiments
and limitations, and if they cannot cover a part, the member(s) responsible for
that part must attend the Q&A; there is no new requirement that every member
present or hold a role.

Individual contribution is evidenced separately in each student's PDF report and
in commits/code, experiments, source analysis and verification, not only through
code commits. Evidence must name concrete contributions, not a general "we did"
statement. Individual explanations and questions in the Q&A may be used to
confirm the claimed contribution.

As verbally announced in Session 1, non-participation fails the project
regardless of the team score. A student may fail the project if their individual
contribution is absent or judged insufficient, even when the team receives a
passing or high score. "Insufficient" means no substantive, identifiable and
verifiable contribution, or an inability to substantiate the claimed work; it
does not mean low model performance, fewer commits than teammates, or normal
absence.

A missing individual homework is missing required progress/contribution evidence
and triggers this check; it is not by itself automatic proof of
non-participation. Documented other contributions may be considered subject to
instructor judgment, with no automatic exemption; the individual homework
requirement itself is unchanged.

This rule applies to the final project only and creates no course-wide automatic
fail. It changes no historical reports or grades.

### Stanford AI review rubric (course-defined)

The 20-point Stanford AI review component is scored with the following
**course-defined** rubric. The category names and point values are the course
scale; they are **not** claimed to be official Stanford labels or an official
Stanford scoring scheme.

| Category | Points | Definition |
|---|---|---|
| Accept | 20 | Sound question, contribution, experiments and conclusions; no substantive change is needed. |
| Accept with Minor Revisions | 15 | Core is valid; limited presentation or analysis needs clarification; no new core experiment is required. |
| Borderline Accept | 10 | Plausible contribution, but novelty or evidence is weak; the review leans accept. |
| Borderline Reject | 5 | Promising work with an important missing comparison, verification or piece of core evidence; the review leans reject. |
| Reject | 0 | Unclear question or contribution, or an unreliable core experiment or conclusion. |

"Accept" is a course score category, not a claim that the work is literally
flawless in wording. The rubric applies identically to every team: the review
instructions, the submitted material scope and the tool configuration are the
same for all teams, and each team receives **one official review pass** — there
is no score-shopping. The instructor checks the review and corrects a factual
AI misreading, with the reason recorded. This section documents scoring policy
only; it does not describe or run an actual review agent.
