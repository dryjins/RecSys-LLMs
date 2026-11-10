# Session 2 — Implementation and Baselines (Individual Homework 2)

**Course**: LLM4Rec, HSE University · **Instructor**: Seungmin Jin (sedzhin@hse.ru), GitHub dryjins
**Task**: individual homework; every student submits their own report and session export. **Deadline**: TBA.

## 1. Goal

Turn the Session 1 question into one executed, time-aware comparison. Use the provided
`project/far-trans/` package as-is: it already has the common CSV loader, four provided
baselines (Popularity, CBF, `latest_buy` and `latest_buy_or_sell`), the
cutoff/as-of/eligibility rules and the nDCG@10 evaluation. **Do not reimplement these
baselines.** Your work is one question linked to one change in the Encoder, Ranker or both, run
against the provided baselines and reported as the `custom` method. This week requires actual
implementation, experiments and your own verification; a performance improvement is **not**
required now, and the final 50-point ranking is a separate later component.

## 2. One change, one fair comparison

Implement one change that follows from your question, then run baseline and change under an
identical frozen protocol: same evaluated users, cutoff, horizon, eligible universe, input
information, scoring and tie-break. Both runs must report the same `protocol_hash` and source
SHA-256 values from `protocol.json`.

The provided `extensions.py` identity plugin is **not** an LLM and is not experimental evidence.
The simulated response files are protocol round-trip demos, not LLM outputs. A report must
describe the method you actually executed, including model name/version, prompt, inputs,
outputs, cache, call cost or runtime, and failures.

Use a publicly available open-weight model for the required experiment. Run it locally or
on an accessible notebook/cloud runtime; you do not need to own a GPU. Provide the model
repository and exact revision, tokenizer version, runtime dependencies, runnable inference
code, prompts and decoding settings. Record hardware, quantization and seeds where
applicable. A chat interface or closed API alone is not a reproducible required experiment.
Optional closed-API comparisons must be labelled separately. The starter's prompt-export and
response-import commands remain useful for debugging the protocol, but the required change
must include your own model-call code committed in the project; a hand-made response file or
a chat transcript is a manual trial, not the final required experiment.

## 3. Encoder, Ranker, Hybrid

- **Encoder**: the seam accepts finite nonnegative weights for assets already in history, then
  re-scores with the same content model. This is a bridge, not a semantic embedding. If you
  claim real text embeddings, define the exact connection from text representation to scorer and
  implement it; an auto-generated summary that never reaches the ranking is not encoder work.
- **Ranker**: rerank a frozen candidate list to isolate ranking. For an end-to-end system,
  internal candidate generation may differ, but the shared eligible universe and truth must be
  common to both arms.
- **Hybrid**: separate encoder and ranker contributions; a minimum baseline-vs-change comparison
  is enough for your scope. Do not force every team into four conditions.

Zero-shot prompting is allowed. Few-shot demonstrations are optional unless your question
requires them; the agreed minimum is one working connection, and demonstrations must come from
the past, precede the cutoff and exclude evaluated users. Prompting does not update model
weights, and weight training is not required.

## 4. Protocol and reporting

Use the starter defaults for the teaching run: warm cohort, 100 users, cutoff `2021-06-01`,
30-day horizon, repeats allowed, empty truth scored `0` in the all-user mean while the nonempty
mean is reported separately. This is a provisional teaching protocol, not the frozen final
benchmark. Keep the same users and hash; do not drop users based on future truth or build your
own filtered subset to obtain a higher comparable number.

Expect roughly 89 of 100 demo users to have empty truth (the reference run has 11 nonempty).
Report both means and counts; do not compare the all-user mean with the nonempty mean or with
published paper numbers. Predeclare subgroup analysis with counts and a fixed primary cohort.
If an output is invalid, report the fallback or error; never silently drop failed cases.

All features must be legitimately available at prediction time: use the actual raw FAR-Trans
files, mark fields observed, predicted/estimated or missing, and never read future prices,
profitability or purchases. The risk profile is display-only, never a filter or score. Questionnaire,
full metadata and stocks-only scopes remain pending; nDCG@10 measures purchase ranking, not profit.

## 5. Required results table

Include one table with one row per method and these labeled fields: method, evaluated users,
candidate policy, protocol (cutoff/horizon/hash), nDCG@10 over all users, nDCG@10 over
nonempty-truth users, runtime, and failure count. Report **every provided baseline that applies**
— `popularity`, `cbf`, `latest_buy` and `latest_buy_or_sell` — plus your `custom` change, so all
four baselines appear in the same result table and the comparison is fair. Exact formatting is
free; the labels are not optional.

### Provided-baseline update

The starter published for this course now emits the two recency baselines in every run, on
exactly the same evaluated users, cutoff, horizon, candidate pool and truth as `popularity` and
`cbf`; the protocol hash and the input contexts are unchanged by them. Re-run the **provided code**
to obtain their numbers; do not reimplement them and do not copy values from these instructions.
The primary metric remains the all-user nDCG@10 (empty truth scored `0`); the nonempty-truth mean
is secondary and must be labelled with its user count. This update adds no deadline, no points,
no profit or return claim, and no requirement that your change outperform any baseline; it only
makes the comparison complete and repeatable.

## 6. Verification

Do at least one concrete correctness check beyond trusting the code: confirm context and prompt
IDs are past-only with no truth or missing-ID leak; mutate one user's future label and confirm
the scalar nDCG@10 changes as expected; or rerun one case and compare scalar and protocol hash.
Hand computation alone is not sufficient.

## 7. Team work and deliverables

Shared team code is allowed, but your PDF must make your personal role clear and include the
team discussion inside it: what was agreed, your contribution and what you verified yourself.
A team-only PDF is not a submission, and a repository or link cannot replace either file. Keep
3–7 references under the existing Related Work rule (for example the official FAR-Trans dataset
paper and Python documentation); do not invent URLs or impose a new mandatory literature review.

Submit per the existing guidelines: an individual PDF and the AI-session export (tool-native
JSONL accepted; a documented derivative is fine only if it preserves code, tool calls and
results). The first page carries your name, team and date. Maximum 5 pages excluding references;
no arbitrary 2–3-page target. Use the existing sections: Title, Abstract, Introduction, Related
Work, Method, Experiments, Discussion, AI Usage, References. Include the team GitHub repository and your commit link in the PDF; the shared
repository with the instructor as collaborator exists but does not replace the files above.

The existing §5 failure discussion applies only if you actually found a defect in the provided
code; do not invent a failure case, and finding a code bug is not mandatory. If you cannot run
the LLM part, state honestly that the implementation is incomplete and do not claim the
milestone. Honest incompleteness is distinguished from full completion; no automatic false pass.
No numeric rubric points are published here.

## 8. Run commands (verified flags)

```bash
# Baseline, provided code unchanged
python starter.py run --data-dir /path/to/FAR-Trans --output-dir outputs/baseline
# Your change through the plugin seam; the same four baselines are re-emitted
python starter.py run --data-dir /path/to/FAR-Trans --output-dir outputs/change --plugin extensions.py
# Export prompts only; no model is called
python starter.py export-prompts --stage ranker --data-dir /path/to/FAR-Trans --output-dir outputs/prompts
```

Run these from the folder containing `starter.py` and `extensions.py`. `/path/to/FAR-Trans` is a
placeholder for the extracted-CSV folder, not a machine path. Plain code paths are fine in the
report; no local Markdown hyperlinks and no absolute machine paths.

## References

[1] J. Sanz-Cruzado, N. Droukas, R. McCreadie, "FAR-Trans: An Investment Dataset for Financial
Asset Recommendation," IJCAI-2024 Workshop on Recommender Systems in Finance (Fin-RecSys), 2024.
[2] Python Software Foundation, "Python 3 documentation" (optional tool reference).
