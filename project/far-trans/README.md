# FAR-Trans student starter

A small, time-aware recommender over the public
[FAR-Trans](https://researchdata.gla.ac.uk/1658/) dataset. It reads the CSVs with
the Python standard library only and ranks assets for each customer. It ships a
working classical baseline plus the same evaluation for a student component, and
leaves two deliberate seams — the history-weights encoder and the ten-item
reranker — where that component plugs in.

This is a teaching illustration. The default CLI settings are **demo settings, not a
grading protocol**, and nothing here is investment advice.

## Data

The archive is about 9.8 MB. Download the official `FAR-Trans.zip` from
<https://researchdata.gla.ac.uk/1658/> in a browser, unzip it, and pass the folder
that contains the CSVs with `--data-dir`. Nothing in this package needs a specific
absolute path: any folder that holds `transactions.csv`, `asset_information.csv`,
`customer_information.csv` and `close_prices.csv` works, and all commands below
are written relative to the extracted package folder. The raw archive and the
extracted CSVs are excluded from the package and from version control, so a fresh
copy must download them again.

The dataset is CC BY 4.0. Cite: Javier Sanz-Cruzado, Nikolaos Droukas, Richard
McCreadie. *FAR-Trans: An Investment Dataset for Financial Asset Recommendation.*
IJCAI-2024 Workshop on Recommender Systems in Finance (Fin-RecSys), Jeju, 2024.

## Run

Python 3.10 or newer, no third-party packages, no virtual environment. From the
extracted package folder (the one containing `starter.py`), with the dataset
folder you created yourself:

```bash
python3 starter.py run \
  --data-dir /path/to/FAR-Trans \
  --output-dir outputs/baseline
```

`/path/to/FAR-Trans` is the folder holding the four CSVs; `outputs/baseline` is
created for you. The same command works unchanged when the dataset is a sibling
folder, e.g. `--data-dir data/FAR-Trans`, and `--output-dir` may be any writable
relative or absolute path.

The script writes five files:

- `protocol.json` — cutoff, label window, selected users, eligibility and the
  SHA-256 of every source CSV plus a `protocol_hash` over the whole protocol;
- `contexts.jsonl` — one redacted context per user (profile, history, candidates,
  eligible ids); it holds no truth label and no future row;
- `predictions.csv` — `method, user_id, rank, ISIN` for `cbf`, `popularity` and,
  when a plugin or response file is given, `custom`;
- `per_user.csv` — one row per `(user, method)` with `relevant_count` and
  `ndcg_at_10`;
- `metrics.json` — the aggregate block and the excluded-row counts.

### Actual result of the command above

Warm cohort, 100 users, cutoff `2021-06-01`, label window `2021-06-01 … 2021-06-30`,
`protocol_hash 50efd4aeb415ba6f0c66dd0793a7c2033cdc32a42b86b58eebbca3e81eaf3417`:

| method | users | nonempty truth | empty truth | nDCG@10 (all users) | nDCG@10 (nonempty) |
|---|---:|---:|---:|---:|---:|
| `cbf` | 100 | 11 | 89 | 0.020100011736078574 | 0.18272737941889614 |
| `popularity` | 100 | 11 | 89 | 0.028590012799467643 | 0.25990920726788763 |

89 of 100 users have no future purchase in the window, so the primary mean is
mostly the frozen `0.0` empty-truth convention (E3) and is **not** comparable with
the nonempty mean. Both labels are always reported. The identity plugin
(`extensions.py`) reproduces `cbf` for all 100 users, so its `custom` row equals the
`cbf` row. Elapsed time is not written to any output; measure it externally
(`/usr/bin/time`) if you need it — on the reference machine the command above takes
about 2.6 s and roughly 520 MB peak RSS.

These numbers depend on the cutoff and must not be compared with published
FAR-Trans results. Raw-data SHA-256 values and `protocol_hash` are recomputed on
every run, so two runs with the same inputs and CLI flags are byte-identical.

### Full-cohort run

Dropping the demo slice (`--max-users 0 --cohort all`) evaluates every as-of
customer, `protocol_hash 14bf32af7a8144041eb1816628be5bc23a909575c8fa62b8861795b3879f54e5`:

| method | users | nonempty truth | empty truth | nDCG@10 (all users) | nDCG@10 (nonempty) |
|---|---:|---:|---:|---:|---:|
| `cbf` | 23,571 | 1,208 | 22,363 | 0.012824042796071428 | 0.25022807346539705 |
| `popularity` | 23,571 | 1,208 | 22,363 | 0.011773410868238582 | 0.22972770494640035 |

The all-user mean is again dominated by the empty-truth convention (22,363 of
23,571 users); report both labels or neither. This is still a teaching split, not
the paper's protocol.

## Rules and flags

- Metadata is as-of the cutoff: the latest `asset_information` /
  `customer_information` row strictly before it. No later row is back-filled.
- History is `Buy` rows strictly before the cutoff; repeated buys increase the
  content weight. `Sell` rows are ignored.
- Rows with a negative `transactionID` (reconstructed initial positions) are
  excluded by default and counted in `excluded_rows.reconstructed_initial_position_rows`.
- Only exact duplicate rows are removed; a repeated `transactionID` for another
  customer is kept (`excluded_rows.exact_duplicate_rows`).
- An asset is eligible iff it has as-of metadata **and** at least one positive
  pre-cutoff close price. Truth is a future `Buy` in the 30-day window, intersected
  with the eligible set.
- `totalValue`, `units`, `limit_prices` and `profitability` are never read: no
  spending, revenue or return is computed or shown. Customer type, risk level and
  investment capacity are display-only context, copied verbatim (`Predicted_*` is
  not converted) and never a filter or a score. This example makes no
  suitability claim; it is not advice.

Flags: `--data-dir`, `--output-dir`, `--cutoff` (default `2021-06-01`),
`--horizon-days` (default 30), `--max-users` (default 100; `0` selects every
eligible user), `--cohort {warm,all}` (default `warm`; `all` keeps users without
history), `--users-file` (frozen explicit cohort, must be unique as-of-known ids),
`--candidate-count` (default 50, at least 10), `--exclude-seen`, `--plugin`,
`--responses`, `--stage {encoder,ranker}`, `--shots-file`, `--on-invalid {error,fallback}`.
`--max-users 0` with a large `--users-file` is how a full evaluation is run; the
default 100 is a demo slice.

## The two extension points

### 1. Encoder seam (history weights)

`extensions.py` exposes `encode(context) -> {asset_id: weight}`. It may return
weights **only for assets already in `context['history']`** — the starter validates
this and raises on an unknown, negative, `nan`, `inf` or `bool` weight. The weights are
re-fed to the same E1 content scorer, so an encoder can reweight history but cannot
introduce a new asset, a price forecast or a truth label. This is intentionally a
simple **bridge**, not a semantic embedding: the downstream scorer only consumes
nonnegative observed-asset weights, and formatting a structured context summary
(history, candidates, profile) does not by itself produce semantic embeddings. A
student who wants true embeddings must extend this score API in their own copy.

Run the bundled identity plugin (no model, no API key) to see the `custom` column:

```bash
python3 starter.py run --plugin extensions.py \
  --data-dir /path/to/FAR-Trans --output-dir outputs/plugin_identity
```

`custom` then equals `cbf` for every user; that equality is the expected result,
not a bug.

### 2. Ranker seam (ten candidate ids)

A ranker-only extension defines `rerank(context, candidate_ids) -> [10 unique ids]`.
The starter builds `candidate_ids` from the encoder's ranking (or from the CBF
candidate list when no encoder is present), so the ranker always re-runs the encoder
retrieval and sees the resulting candidate pool, never the full eligible set. The
returned list must be ten unique ids drawn from that pool; anything else raises
`ValueError` (or falls back to `cbf` under `--on-invalid fallback`).

A plugin must define `encode`, `rerank`, or both. With both, the ranking is
encoded first, `candidate_ids` for `rerank` are the encoder's top
`--candidate-count` ids, and `rerank` reorders that pool. A module with neither
raises. The bundled `extensions.py` **is not an LLM** — it is an identity
baseline, and its `custom` output is identical to `cbf`.

A plugin is imported and executed as ordinary Python in the starter process.
There is **no security sandbox**; treat plugins as training-only code and run only
code you trust.

### Prompt / response API (bring your own call)

The starter never calls a model. It exports prompts and reads responses; your own
script makes the API call in between. All paths below are relative to the extracted
package folder:

```bash
# 1. Export prompts for both stages (no model is called).
python3 starter.py export-prompts --stage encoder \
  --max-users 3 --data-dir /path/to/FAR-Trans --output-dir outputs/prompts_encoder
python3 starter.py export-prompts --stage ranker \
  --max-users 3 --data-dir /path/to/FAR-Trans --output-dir outputs/prompts_ranker

# 2. Create your JSONL response file (one object per user), then:
python3 starter.py run --stage ranker \
  --responses my_responses.jsonl --max-users 3 \
  --data-dir /path/to/FAR-Trans --output-dir outputs/from_ranker
```

`prompts.jsonl` has one object per selected user:
`user_id`, `stage`, `protocol_hash`, and `prompt` (the instruction text plus a
JSON payload with `demonstrations` and `current_input`). Send `prompt` to your
model unchanged; `current_input` holds `user_id`, `cutoff`, `profile`, at most 20
`history` rows, `candidate_assets` and `cold_start`, but never
`eligible_asset_ids`, a truth field or a future timestamp.

Your response file must be JSONL with one object per user and these fields:

| stage | required fields |
|---|---|
| `ranker` | `user_id`, `stage` (`"ranker"`), `protocol_hash`, `ranked_ids` (ten unique strings from `candidate_assets`) |
| `encoder` | `user_id`, `stage` (`"encoder"`), `protocol_hash`, `history_weights` (object mapping observed history ISINs to finite nonnegative weights) |

`user_id` must be one of the run's users, `protocol_hash` must equal the run's
hash, and `stage` must match `--stage`; any mismatch or a malformed list/weight
raises by default. `--on-invalid fallback` replaces only that user's `custom`
ranking with the `cbf` baseline and records the message under `custom_failures` —
it never fabricates a response. `--shots-file` supplies zero-shot (omit the flag)
or few-shot demonstrations as a JSON list of objects each carrying at least
`user_id` and `available_before`; every `available_before` must precede the cutoff
and every `user_id` must be outside the evaluation cohort (a demonstration is
training-only context, never a graded user).

The response format is service-agnostic — implement your own HTTP/SDK call between
steps 1 and 2. The prompt contains only historical context: no truth field, no
future timestamp, no label, no metric.

### Inference vs. grading

The recommender forecasts the ranking; it does **not** grade. The profile block is
static metadata as-of the cutoff, shown for context only. No profitability, return
or suitability is inferred, and the report never claims one.

## Tests

```bash
# From the extracted package folder:
python3 -m unittest discover -s . -p 'test_*.py' -v
```

The suite pins the frozen vectors TV1–TV16 (E1–E5) and runs the CLI on a temporary
CSV fixture for the cutoff, as-of, exclusion, cold-start, plugin, prompt, response,
determinism and portability rules. It never reads the real archive and never calls
a model.

## Screenshots

None are required. The outputs are plain CSV/JSONL; inspect them directly.
