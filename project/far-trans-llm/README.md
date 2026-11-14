# FAR-Trans: Encoder and Ranker baselines

This package provides two runnable open-weight LLM methods, **adaptations rather
than full paper reproductions**, with the [starter](../far-trans/README.md)'s four
baselines and evaluation unchanged. These are optional starting points: use the
approach relevant to your research question, not necessarily both. Identify your
own change and contribution; improvement over the baselines is not required.

- **Encoder:** paraphrase each asset's supplied attributes, combine original and
  generated text as separate TF-IDF views, then match assets to a user's past Buy
  history. Compare `llmrec_encoder` with `original_text_cbf`. Inspired by LLM-Rec's
  basic `p_para` prompt; this uses TF-IDF instead of its text encoder/trained MLP.
- **Ranker:** show the LLM past Buy counts, dated recent purchases, the explicit
  most recent Buy, and fixed CBF candidates; ask it to return ten original ISINs.
  Compare `llmrank` with `candidate_order_first10` on identical candidates.
  This adapts LLMRank's sequential/recency prompting, without ICL, bootstrapping,
  or multi-permutation aggregation.

This README is the primary GitHub guide. Continue with [From HW1 to HW2](HW1_TO_HW2.md)
for questions, exact prompts, input/output formats, and paper references, and
[HW2 results](HW2_RESULTS.md) for the seven-method aggregate comparison.
The optional [HTML handout](BASELINE_GUIDE.html) must be downloaded and opened
locally; GitHub displays its source, not a rendered page. No GitHub Pages hosting
is assumed. Its Markdown companion links are plain text files when opened locally;
read them on GitHub or with a Markdown viewer.

## Dependencies and offline behavior

Use Python 3.12 or a compatible Python 3 environment. Pure-function tests, imports,
CLI help and `--prepare-only` use the standard library; inference additionally needs
**torch and transformers** installed in your own environment. The optional
[requirements.txt](requirements.txt) preserves the measured pins. For example, in
a user-managed uv project use `uv add 'torch==2.11.0' 'transformers==4.57.6'`;
choose the appropriate torch build for your hardware. The measured CUDA wheel
reports `2.11.0+cu128`. Public package/index and CPU/platform wheel availability
must be checked in your own environment; no installation or availability test was
performed during packaging.

The measured local pilot used torch **2.11.0+cu128**, transformers **4.57.6**, and an
NVIDIA GeForce RTX 5070 Ti **Laptop GPU**, CUDA bfloat16. CUDA is not required by the
API; CPU uses float32 and may be much slower. The pilot required at least 5 GiB free
CUDA memory before starting; that is a local safety gate, **not a promise that every
model/workload fits in 5 GiB**. Do not use a CPU fallback for a time-bounded GPU pilot.

A cached model ID or local snapshot path is accepted. Loading defaults to
`local_files_only=True`, `trust_remote_code=False`; no teacher API or API credentials
are used. **The commands below assume the pinned model is already cached. On first
load in a fresh environment, explicitly add `--allow-download` to authorize the
model download**, or provide a previously downloaded snapshot with `--model`.
Keep `--revision 70d244cc86ccca08cf5af4e1e306ecf908b1ad5e` when using the
`Qwen/Qwen3-1.7B` model ID. Subsequent cached runs omit `--allow-download` and stay
offline. Greedy generation disables thinking through the tokenizer chat template;
context budget is fixed at 8192 tokens; encoder/ranker generation budgets are
160/512 tokens. No context/decoding tuning is performed here.

## Quickstart

From the repository root, change into `project/far-trans-llm`. Replace the data path
with the directory **containing** `transactions.csv`, `asset_information.csv`,
`customer_information.csv`, and `close_prices.csv`.

```bash
cd project/far-trans-llm
python ranker.py --help
python encoder.py --help
python -m unittest discover -s . -p 'test_*.py' -v

# Cached-model inference; add --allow-download explicitly for a first download.
python ranker.py \
  --data-dir /path/to/FAR-Trans \
  --output-dir outputs/my_ranker \
  --max-users 100 --candidate-count 50 \
  --model Qwen/Qwen3-1.7B \
  --revision 70d244cc86ccca08cf5af4e1e306ecf908b1ad5e \
  --device auto --on-invalid fallback

python encoder.py \
  --data-dir /path/to/FAR-Trans \
  --output-dir outputs/my_encoder \
  --max-users 100 --candidate-count 50 \
  --model Qwen/Qwen3-1.7B \
  --revision 70d244cc86ccca08cf5af4e1e306ecf908b1ad5e \
  --device auto --on-invalid fallback
```

The default starter is the sibling `../far-trans`, resolved relative to the script,
not the shell's working directory; no `--starter-dir` is needed. An explicit
`--starter-dir ../far-trans` also works when running from this directory.

For prompt-only inspection, add `--prepare-only` to either command; no model is
loaded or downloaded, and no measured result is produced. For a three-user check,
use `--max-users 3` and a fresh output directory. For a bounded CUDA pilot use
`--device cuda` and GNU `timeout --signal=TERM --kill-after=2s 120s` (ranker) or
`300s` (encoder) before `python`. Timeout exit 124 is an incomplete experiment,
not a successful result; these pilot time limits do not guarantee a complete
100-user run.

## Data and evaluation protocol

Defaults: cutoff **2021-06-01 exclusive**, 30-day future Buy horizon, deterministic
warm-user selection using the starter's SHA256 seed 42 ordering, repeat purchases
allowed, and 50 CBF candidates. Selection never filters by future truth. Eligible
assets need pre-cutoff metadata and a positive historical close price. The starter
excludes exact duplicate transaction rows and reconstructed initial-position rows.
Same-day event ties use ISIN ordering, not invented intraday chronology. Encoder
candidate count does **not** reduce its full eligible corpus.

Retain and report **Popularity, CBF, Latest buy, and Latest buy or sell** for every
completed run. The starter computes binary nDCG@10, including empty-truth users as
zero in the all-user macro mean; its nonempty-truth mean is reported separately.
Do not change users per method, remove assets to finish generation, or evaluate
partially generated text as a completed encoder benchmark.

Only as-of source metadata/history/profile information enters prompts; truth is
kept separate. Missing values stay unknown. No future news or external lookup is
supplied, but real public asset names may activate a model's pretrained knowledge.
Generated text is **not automatically factually validated**, and these experiments
are not investment advice.

## Outputs, failures and resumption

Completed runs write `predictions.csv`, `metrics.json`, `per_user.json`, and
`run_manifest.json`, preserving all cohort users. `generations.jsonl` records each
request's complete prompt/settings, raw text, tokens and generation time.
`generation_cache/*.json` persists each completed unique request immediately;
identical asset descriptions can share a cache entry, so cache-file count need not
equal completed-asset count. Cache keys bind prompt, model/revision and settings.
Ranker responses also record parse repairs, invalid outputs and fallback decisions.
`ranker_responses.jsonl` is append-only event history: repeated users on resume
are expected, not corruption. On completion, `final_responses.jsonl` contains one
record per current cohort user in manifest order. Runtime `response_log` points
to this canonical file and `history_log` points to the untouched event history.

The distribution contains source/tests/documentation only, not models, data,
caches, logs, raw customer IDs, or user-level results. Keep generated files in the
ignored `outputs/` directory; do not commit prompts or user-level outputs.

Default invalid policy is `error`; explicit `--on-invalid fallback` keeps the
original candidate order for an invalid ranker response and original source text
for an invalid encoder paraphrase. These are fallback-inclusive results, **not bare
LLM performance**. Report invalid/fallback and valid-only coverage separately.

A timed-out encoder retains prompts and cache but has no completed metrics.
A later explicitly authorized run with the **same directory, model and settings**
can reuse compatible cache entries; no automatic retry occurs. Completed encoder
result directories are rejected: choose a fresh directory for a new benchmark.
Preserve failure evidence rather than overwriting previous logs.

## Completed 100-user HW2 implementation

[HW2 results](HW2_RESULTS.md) records the existing completed teaching runs, their
seven-method four-decimal aggregate table, cache-aware timing caveat, and
limitations. The cohort retains 11 nonempty-truth and 89 empty-truth users.
Ranker results include 22/100 invalid-response fallbacks. This is a ready HW2
implementation, **not evidence of strong LLM superiority**; honest negative results
are valid. No new inference was performed to package this distribution.
