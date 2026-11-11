# Homework 2 — Implement and Test Your Idea

**Individual submission:** PDF report + AI-session export.  
**Deadline:** To be announced.

## 1. Your task

Implement one change related to your Session 1 research question. Compare it with the provided FAR-Trans baselines and explain the result.

**Your method does not have to improve performance this week. You must implement it, run the comparison, and verify the results.**

## 2. What we provide

The starter includes data loading, time-based filtering, recommendation output checks, and nDCG@10 evaluation. It also runs four baselines:

| Baseline | What it recommends |
|---|---|
| Popularity | Assets bought by the most historical users |
| CBF | Assets similar to the user's past purchases |
| Latest buy | The user's most recently bought assets |
| Latest buy or sell | The user's most recently bought or sold assets |

**Use these implementations. You do not need to rebuild them.** The supplied `extensions.py` is an identity example, not an LLM model.

## 3. What you implement

Choose the approach that matches your research question:

| Approach | Your change |
|---|---|
| Encoder | Use an LLM to build a user or asset representation that affects recommendation scores. |
| Ranker | Use an LLM to reorder candidate assets. |
| Both | Combine the two and explain what each component contributes. |

Start with one working version. Zero-shot prompting is enough; add few-shot examples only if your question needs them. Use only earlier training material for demonstrations, not evaluation users' future purchases.

**Use a publicly available open-weight model and provide runnable inference code.** Record its repository and exact version, prompts, dependencies, generation settings, and hardware. You may run it locally or on a notebook/cloud runtime.

The starter supports a Python plugin or saved model responses. You must connect the actual model call; exporting a prompt alone does not run an LLM. Its simple Encoder interface reweights past assets. If your project uses text embeddings instead, implement how those vectors produce recommendation scores.

## 4. Run a fair comparison

Keep the same users, cutoff, eligible assets, and scoring rules for the baselines and your method. For a reranker-only experiment, also keep the candidate list fixed. Do not remove difficult users or failed outputs from the comparison.

Use the starter defaults for this homework:

- **Users:** the provided deterministic sample of 100 users with purchase history.
- **Cutoff:** 1 June 2021; **evaluation window:** the following 30 days.
- **Repeat purchases:** previously bought assets may be recommended again.
- **Primary metric:** average nDCG@10 over all selected users; empty truth counts as zero.
- **Also report:** average nDCG@10 for users with future purchases, and their number.

These are teaching settings, not the final project test protocol. In the reference sample, only 11 of 100 users have future purchases. Always distinguish the two averages. Check that the runs have matching settings in `protocol.json`; keep the full hashes in the output files, not in the report's main table.

Do not use future transactions or later metadata as model inputs. A high purchase-prediction score does not establish investment suitability or profit.

## 5. What to report

Explain your research question, what you changed, and how the change connects to the recommendation pipeline. Include a results table for the four provided baselines and your method:

| Method | Users | Users with future purchases | nDCG@10: all users | nDCG@10: nonempty truth | Runtime | Failed cases |
|---|---:|---:|---:|---:|---:|---:|
| Popularity | | | | | | |
| CBF | | | | | | |
| Latest buy | | | | | | |
| Latest buy or sell | | | | | | |
| Your method | | | | | | |

Show metrics to **four decimal places**. State the candidate policy and how invalid outputs were handled. If runtime is measured for the whole run rather than each method, label it that way instead of inventing separate timings.

Then discuss what improved, what failed, and your next experiment. A negative result is acceptable; an unexecuted method must be reported as incomplete.

**Personally verify at least one important result.** For example, check one user's recommendation IDs and nDCG calculation, confirm that model inputs contain no future data, or reproduce an output from the saved settings. Explain the check and its outcome; do not merely say “verified.”

### Team Discussion and Individual Contribution

Include the following in the Discussion section of your individual PDF:

- What your team discussed and decided, including unresolved questions.
- Your own contribution: what you proposed, implemented, tested or verified.
- Which work was shared and which work you performed yourself.

Shared team code is allowed, but your individual PDF must present your own work; no separate group report is required.

## 6. Run the starter

From the folder containing `starter.py`:

```bash
# Run all four provided baselines.
python starter.py run --data-dir /path/to/FAR-Trans --output-dir outputs/baseline

# Run your extension alongside the same baselines.
python starter.py run --data-dir /path/to/FAR-Trans --output-dir outputs/change --plugin extensions.py
```

Replace `/path/to/FAR-Trans` with your extracted dataset folder. The starter README explains the plugin and model-response formats.

## 7. Submit

- **Your individual PDF report**, following the existing homework structure and five-page limit excluding references.
- **Your AI-session export.** Native JSONL is accepted. A documented derivative must preserve the generated code, tool calls, and results.

Include your name, team, GitHub repository, and experiment commit in the PDF. Use the usual sections: Title, Abstract, Introduction, Related Work, Method, Experiments, Discussion, AI Usage Disclosure, and References. Follow the existing citation requirements and distinguish your own verification from AI-performed checks.

Submit through the established homework channel. The team repository does not replace either required file. Final project ranking points are separate from this week's implementation homework.

## References

- Sanz-Cruzado, Droukas, and McCreadie. *FAR-Trans: An Investment Dataset for Financial Asset Recommendation*, 2024. https://arxiv.org/abs/2407.08692
- Official dataset: https://researchdata.gla.ac.uk/1658/
