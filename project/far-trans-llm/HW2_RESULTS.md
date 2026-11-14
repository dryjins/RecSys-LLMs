# HW2 results: two FAR-Trans LLM adaptations

These completed teaching experiments compare an Encoder and a Ranker with
simple baselines. They are paper adaptations, not full reproductions.
Improvement is not required for a useful HW2 submission.

## Results on the same 100 users

Binary nDCG@10 is higher when purchased assets appear nearer the top.
The primary mean includes all 100 users; empty truth contributes zero.
Only 11 users have future Buy labels; the other 89 have empty truth.
The second column of scores uses those same 11 nonempty-truth users.

| Method | All 100 users | Nonempty 11 users |
|---|---:|---:|
| **Popularity** | **0.0286** | **0.2599** |
| CBF | 0.0201 | 0.1827 |
| Latest buy | 0.0277 | 0.2520 |
| Latest buy or sell | 0.0271 | 0.2464 |
| Original-text TF-IDF CBF | 0.0235 | 0.2140 |
| LLM-Rec-inspired encoder | 0.0254 | 0.2306 |
| LLMRank with fallback | 0.0201 | 0.1827 |

## What the comparison says

- **Popularity is best in this sample; Latest buy is second (0.0277).**
  This is not a general ranking of methods across datasets or populations.
- The Encoder exceeds its own original-text TF-IDF control (0.0254 vs 0.0235),
  but remains below Popularity and both recency baselines.
- The Ranker equals the initial candidate-order control (0.0201).
  **22 of 100 responses were invalid** and used the original CBF order;
  the reported score includes these fallbacks, not just valid LLM outputs.
- All methods retain the matched 100-user cohort; no empty-truth or fallback
  user is dropped. With only 11 labelled users, this is a small, uncertain
  comparison, not a universal conclusion about whether LLMs help recommendation.

## Shared protocol and limitations

The cutoff is 2021-06-01 exclusive; future Buy labels end on 2021-07-01 exclusive.
Warm users are chosen from past information, not future purchases; repeats are
allowed. The Encoder ranks all 767 eligible assets. The Ranker reorders 50 fixed
CBF candidates using past purchases and an as-of profile.

Both use **Qwen/Qwen3-1.7B**, greedy decoding with thinking off, an 8192-token
context, and encoder/ranker output limits of 160/512 tokens. Generated text is
not automatically factually validated. No significance, causal paraphrase benefit,
profitability, or validated suitability is established. This is not investment advice.

## Hardware and timing

The runs used an RTX 5070 Ti Laptop GPU, CUDA bfloat16, torch 2.11.0+cu128,
and transformers 4.57.6. Both reused cached generations, so their recorded times
are **not comparable cold-run, end-to-end timings**. Monetary and energy costs
were not measured. See the README for pinned commands and optional dependencies.

## Paper adaptations and next step

The Encoder adapts LLM-Rec paraphrasing with TF-IDF, not its trained model.
The Ranker adapts LLMRank recency prompting without ICL or permutation aggregation.
[From HW1 to HW2](HW1_TO_HW2.md) explains both prompts and how outputs are used.
Use the [README](README.md) to continue on GitHub. The optional
[HTML handout](BASELINE_GUIDE.html) is for download and local viewing; GitHub
shows its source rather than rendering a page.
