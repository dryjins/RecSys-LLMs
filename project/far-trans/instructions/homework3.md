# Homework 3: Test Your Project Idea

**Individual submission:** PDF report and AI-session export.

**Homework deadline:** To be announced.

## 1. What to do

Continue your existing project question. Run your main experiment, one focused ablation (change or remove one component), and a failure analysis. Write up the evidence as a paper-style draft for Session 4. A narrow, well-checked replication or teaching adaptation is sufficient for this homework.

State whether you use the LLM as an Encoder, a Ranker, or both, and explain what it changes. Run actual model inference and evaluate the resulting recommendations; train a model only if your method requires it. A performance gain is not required. If a run is incomplete, say so and do not invent results.

## 2. Development evaluation

Start with the HW2 teaching setup: the deterministic 100-user sample with purchase history, a 1 June 2021 cutoff, the following 30 days for evaluation, and repeat purchases allowed. If that sample is too small for your question, you may use a larger development sample or a separate development evaluation window. Define the user selection rule, cutoff, and window before comparing methods. Do not select users based on future purchases or observed scores. Label these results as development results, not official benchmark scores.

- Report all four required baselines: Popularity, CBF, Latest buy, and Latest buy or sell. Include the relevant provided LLM comparison and a matched control where applicable, such as original-text CBF for an Encoder or the initial candidate order for a Ranker.
- Use the same users, cutoff, eligible assets, labels, and evaluation rules for every method in a comparison. For reranking comparisons, keep the candidates and their initial order fixed. Save the evaluation settings and protocol hashes.
- Report mean nDCG@10 across all evaluated users as the primary metric, counting users with no future purchases as zero. Separately report mean nDCG@10 over users with future purchases and give their count. Display measured metrics to four decimal places.
- Explain what your ablation tests. If you combine an Encoder and a Ranker, separate their contributions. Show cases where the method fails or changes nothing, and record invalid outputs, repairs, fallbacks, and relevant coverage.
- Personally verify at least one important result, including a small hand-worked check. Record model version, runnable code, settings, hardware, and runtime scope; report training or preparation time separately from recommendation generation.

External-news RAG is an optional example, not a requirement and not a reason to change your project topic. If using it, verify that retrieved evidence is relevant and available before the cutoff, and disclose any source-quality problems.

## 3. Final project evaluation

The official evaluation protocol and the common final evaluation set will be released **at least 100 hours before the final project submission deadline**. The number of users with future purchases is not yet confirmed. Do not wait for the release to run HW3. Use development data to choose and tune your method; reserve the official set for final evaluation.

## 4. What to submit

Submit your individual PDF (maximum five pages excluding references) and AI-session export through the established homework channel. Native JSONL is accepted. A documented derivative is accepted only if it preserves generated code, tool calls, and tool results. A repository link does not replace either file.

Use Title, Abstract, Introduction, Related Work, Method, Experiments, Discussion, AI Usage Disclosure, and References. Include your name, team, repository, and experiment commit. Explain what your team decided, what remains unresolved, what you personally contributed and verified, and how you used AI.
