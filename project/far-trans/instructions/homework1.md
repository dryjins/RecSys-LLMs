# Session 1 — Research Question and Minimal Study Plan (Individual)

**Course**: LLM4Rec, HSE University · **Instructor**: Seungmin Jin (sedzhin@hse.ru), GitHub <https://github.com/dryjins> · **Task**: individual homework; each student writes and submits their own report, not a team submission.
**Shared project**: one FAR-Trans ranking task — for the same evaluated users, a Top-10 list scored by nDCG@10 against future purchases. Item scope, time cut and evaluated users are **pending** and will be fixed before Session 2. This page gives only the minimum context needed here; the project guides, assessment weights and milestones stay in their own documents.
**Submission**: the two files required by the course homework guidelines, sent through the established homework channel — `<student-name>_session1_report.pdf` and `<student-name>_session1_session.json`. The export is the tool-native log; native JSONL is accepted as-is, with no forced conversion. A derived export is acceptable if it preserves code, tool calls and results and states what was derived. If you used no AI, say so honestly; do not invent an exemption.
**Format**: the existing report template and page limit apply unchanged — maximum 5 pages excluding references. A repository file, repository link or Markdown draft is not a submission.
**Header**: full student name, team name and date on the first page. **Deadline**: to be announced (TBA).

## 1. What you produce

Session 1 is the **Define** stage: one question, one data example and one planned comparison — not a system build and not a survey.

The target is a narrow workshop- or short-paper-level contribution, not a promise of publication. No full implementation is required now; a credible, feasible plan is.

## 2. The one research question

State one primary research question that explicitly identifies the intervention, outcome, comparator and population. The wording below is a suggested template, not a mandatory sentence format.

> We test whether **[intervention]** improves **[outcome]** over **[control]** for **[population]**.

Name all four elements. A direction hypothesis is optional. Positive, negative and null findings are all valid results and must not be hidden. State the track and whether the work is planned or partly run. The control and intervention must differ only in the named change, on the same users, candidate universe, time split and metric.

| Track | What the LLM changes |
|---|---|
| Encoder | LLM-derived user or item representations feeding retrieval, content-based or hybrid recommendation |
| Ranker | LLM scoring or reranking of the same eligible assets |
| Hybrid | Encoder and ranker combined, with an ablation separating the two contributions |

A shared-output study still emits the common Top-10 list.

## 3. Literature, importance and business value

Cite 3–5 genuinely related studies **you opened**, in a compact table:

| Study (authors, year, venue) | Method | Data and evaluation | Limitations and connection to your question |
|---|---|---|---|

Then identify the **nearest prior work**, what it answered, what it left open under your condition, and the gap your comparison addresses. Write "we did not find a study reporting X under condition Y", never a global "no research exists" claim.

**Research importance** and **business value** are two distinct paragraphs. Research importance is the new knowledge; business value is the named stakeholder decision that changes (advisor, product owner, compliance reviewer), rooted in the literature. A positive or negative finding is valuable either way. Do not promise profit, returns or user acceptance. Use IEEE numbered references.

## 4. One actual data example

Open the public FAR-Trans archive and read a raw file. Show **one actual record**, anonymized, with field names and verbatim values:

```
source: <public release and file>   record id: <verbatim, non-identifying>
fields: <field 1>, <field 2>, ...
values: <verbatim value 1>, <verbatim value 2>, ...
window: <period or split this record belongs to>
```

Placeholders are not a record. For each used field, state whether it is **observed**, **predicted/estimated** or **missing**, with its timestamp. A value knowable only after prediction time is future leakage. Do not attach a real identity.

The dataset covers stocks, funds and bonds; the item scope for the shared task is still pending, so do not present a stocks-only scope as official.

## 5. How Will You Test Your Question?

Describe the experiment you would run to answer your research question. You do not need to finish the implementation or report results at this stage.

| Element | What to state |
|---|---|
| Data and users | Which FAR-Trans fields, time window, evaluated users and subgroups; every field's timestamp |
| Method and baseline | Your method and at least one existing classical recommender as the baseline |
| Fair comparison | Same users, same information and same time split; the same eligible universe (you may fix one candidate set only to isolate reranking, but do not force every method to use identical intermediate candidates) |
| Measure | Common nDCG@10, plus runtime and cost |
| Contribution check | Remove or change only the LLM component (ablation) and explain what that isolates |
| Feasibility | Next steps, tools and budget across the remaining sessions |

If the plan is stochastic, say how repeats and variance will be handled; fixed seeds are not mandatory. Name the model and version if you use an LLM, and note that an LLM judge is never sole ground truth. Add ethical, privacy and contamination risks. nDCG@10 measures ranking accuracy against observed purchases; it is a ranking metric, not a measure of investment quality or profitability. Keep future information out of the inputs.

**Illustrative example (Ranker track, not a required design).** Generate one fixed candidate list per user with a classical recommender. Compare its original order with an LLM-reranked order using the same user and asset information. Evaluate both against the same future purchases with nDCG@10; record runtime and cost.

## 6. Team Discussion (required inside your PDF)

Include this inside §5 Discussion, not as a separate file. Report only what actually happened in your team discussion:

- **Options considered** — questions, methods, baselines and data slices weighed, including dropped ones.
- **Agreement and unresolved differences** — what converged and what still differs. Unresolved disagreement is acceptable; no forced consensus and no rule that every student must hold a unique question.
- **Your contribution** — what you proposed, checked or argued yourself, separated from joint work.
- **Your position and reasons** — the option you adopt and why; "the team chose it" is not a reason.

Mark joint ideas as joint. Shared inputs may be reused when attributed. A shared or copied report is not a submission.

## 7. Mapping into the existing report

The existing Title block and Abstract requirements are unchanged; this table maps content, it does not replace the template.

| Existing section | Session 1 content |
|---|---|
| §1 Introduction | Problem, one focused RQ, research importance and business value |
| §2 Related Work | 3–5-study table, nearest prior work, gap, IEEE references |
| §3 Method | Data example and fields, baseline, control, change, ablation, metric, feasibility, risks |
| §4 Experiments | Only what was run; otherwise an explicit **planned** evaluation, with no fabricated numbers |
| §5 Discussion | Team Discussion, your position, threats, meaning of positive/negative results |
| §6 AI Usage Disclosure | Tools and versions, personal verification, what you trusted, session-export reference; honest if no AI was used |
| References | IEEE numbered; only sources you opened |

## 8. Checklist

- [ ] Both required files, named as above, sent through the established channel; header has name, team and date; ≤5 pages excluding references.
- [ ] Exactly one RQ naming intervention, control, outcome and population; track and planned/actual state stated.
- [ ] 3–5 real studies; nearest prior work and gap stated; no global novelty claim.
- [ ] Research importance and business value argued separately, with a named stakeholder decision.
- [ ] One real, anonymized record with source, fields, values, timestamps and a leakage check.
- [ ] Same-information baseline, non-LLM control and ablation; common Top-10 and nDCG@10 acknowledged.
- [ ] Team Discussion in §5, joint and own work separated; §6 disclosure matches the submitted export.

## 9. Three example questions

These illustrate the shape only; they are **not** verified as novel, and you must check the literature yourself. They are alternative examples, not three required questions; your team may refine one of them into its own question based on the literature.

| Track | Example question |
|---|---|
| Encoder | We test whether an LLM-derived history representation improves nDCG@10 over a structured-history representation for FAR-Trans users with sparse transaction histories. |
| Ranker | We test whether LLM reranking improves nDCG@10 over a classical learned ranker for the common FAR-Trans evaluation users. |
| Hybrid | We test whether combining an LLM encoder and reranker improves nDCG@10 over encoder-only and reranker-only variants for the common FAR-Trans evaluation users. |

## References

Public external sources; no local files, and the list below is not a substitute for the studies you find yourself.

[1] J. Sanz-Cruzado, D. Droukas, C. McCreadie, "FAR-Trans: An Investment Dataset for Financial Asset Recommendation," 2024. [Online]. Available: <https://arxiv.org/abs/2407.08692>.

[2] University of Glasgow, "FAR-Trans dataset," research data repository. [Online]. Available: <https://researchdata.gla.ac.uk/1658/>.

[3] J. Sanz-Cruzado, "FAR-Trans baseline code" (optional implementation reference). [Online]. Available: <https://github.com/javiersanzcruza/far-trans>.
