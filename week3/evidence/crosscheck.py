#!/usr/bin/env python3
"""Section E -- independent re-implementation of the A03 prediction rule.

This script deliberately shares no code with data.js or script.js. It parses
u.data and u.item from scratch with the standard library only, re-implements
the significance-weighted co-rated cosine, the top-20 neighbour rule and the
baseline-plus-deviations aggregate, and compares its numbers against the values
the JavaScript harness produced.

Usage: crosscheck.py <holdout-results.json> [tolerance]
"""

import json
import math
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
WEEK3 = HERE.parent

LAMBDA = 25
NEIGHBOUR_LIMIT = 20
MIN_RATING = 1.0
MAX_RATING = 5.0

# Fixed, reproducible pairs. These user ids are pinned here rather than sampled
# so the cross-check is byte-for-byte repeatable.
FIXED_USERS = [1, 19, 50, 100, 200, 300, 405, 500, 600, 700, 800, 900, 943]


def canonical_title(title):
    return re.sub(r"\s+", " ", title.strip().lower())


def load_movies():
    """Return {item_id: canonical_title} plus the canonical->count map."""
    titles = {}
    counts = {}
    raw = (WEEK3 / "u.item").read_bytes().decode("latin-1")
    for line in raw.splitlines():
        if not line.strip():
            continue
        fields = line.split("|")
        item_id = int(fields[0])
        title = canonical_title(fields[1])
        titles[item_id] = title
        counts[title] = counts.get(title, 0) + 1
    return titles, counts


def load_ratings():
    """Return (user_ratings, item_ratings, user_sums, user_counts,
    item_sums, item_counts, latest_candidate)."""
    user_ratings = {}
    item_ratings = {}
    records = []

    raw = (WEEK3 / "u.data").read_bytes().decode("latin-1")
    for line in raw.splitlines():
        if not line.strip():
            continue
        fields = line.split("\t")
        user_id, item_id, rating, timestamp = (
            int(fields[0]), int(fields[1]), float(fields[2]), int(fields[3])
        )
        records.append((user_id, item_id, rating, timestamp))
        user_ratings.setdefault(user_id, {})[item_id] = rating
        item_ratings.setdefault(item_id, {})[user_id] = rating

    user_sums = {u: sum(m.values()) for u, m in user_ratings.items()}
    user_counts = {u: len(m) for u, m in user_ratings.items()}
    item_sums = {i: sum(m.values()) for i, m in item_ratings.items()}
    item_counts = {i: len(m) for i, m in item_ratings.items()}
    return (user_ratings, item_ratings, user_sums, user_counts,
            item_sums, item_counts, records)


def clamp_unit(value):
    return 0.0 if value < 0.0 else (1.0 if value > 1.0 else value)


def similarity(dot, sum_squares_a, sum_squares_b, overlap):
    if overlap <= 0:
        return 0.0, 0.0, 0
    denominator = math.sqrt(sum_squares_a * sum_squares_b)
    if not denominator > 0 or not math.isfinite(denominator):
        return 0.0, 0.0, 0
    raw_cosine = clamp_unit(dot / denominator)
    similarity_value = clamp_unit(raw_cosine * overlap / (overlap + LAMBDA))
    return similarity_value, raw_cosine, overlap


def user_similarity(user_a, user_b, user_ratings, hidden):
    row_b = user_ratings.get(user_b, {})
    dot = 0.0
    squares_a = 0.0
    squares_b = 0.0
    overlap = 0
    for item_id, left in sorted(user_ratings.get(user_a, {}).items()):
        if hidden is not None and hidden[0] == user_a and hidden[1] == item_id:
            continue
        right = row_b.get(item_id, 0.0)
        if right == 0.0:
            continue
        overlap += 1
        dot += left * right
        squares_a += left * left
        squares_b += right * right
    return similarity(dot, squares_a, squares_b, overlap)


def item_similarity(item_a, item_b, item_ratings, hidden):
    column_a = item_ratings.get(item_a, {})
    column_b = item_ratings.get(item_b, {})
    dot = 0.0
    squares_a = 0.0
    squares_b = 0.0
    overlap = 0
    for user_id, self_value in sorted(column_a.items()):
        if hidden is not None and hidden[0] == user_id and hidden[1] == item_a:
            continue
        other_value = column_b.get(user_id, 0.0)
        if other_value == 0.0:
            continue
        overlap += 1
        dot += self_value * other_value
        squares_a += self_value * self_value
        squares_b += other_value * other_value
    return similarity(dot, squares_a, squares_b, overlap)


def make_means(sums, counts, hidden_position):
    """Build a mean lookup for either users (position 0) or items (position 1).

    The hidden record is a (user_id, item_id, rating) tuple, so masking the mean
    of entity `key` means removing hidden[2] exactly when
    hidden[hidden_position] == key.
    """
    def mean(key, hidden):
        count = counts.get(key, 0)
        if count == 0:
            return None
        total = sums.get(key, 0.0)
        if hidden is not None and hidden[hidden_position] == key:
            total -= hidden[2]
            count -= 1
        return total / count

    return mean


def clamp_rating(value):
    if not math.isfinite(value):
        return MIN_RATING
    return max(MIN_RATING, min(MAX_RATING, value))


def aggregate(baseline, sum_of_effects, sum_of_absolute):
    if not math.isfinite(sum_of_absolute) or sum_of_absolute <= 0:
        return clamp_rating(baseline), True
    return clamp_rating(baseline + sum_of_effects / sum_of_absolute), False


def top_user_neighbours(user_id, user_ratings, hidden, num_users):
    scored = []
    for other in range(1, num_users + 1):
        if other == user_id:
            continue
        value, _, _ = user_similarity(user_id, other, user_ratings, hidden)
        if value > 0:
            scored.append((value, other))
    scored.sort(key=lambda pair: (-pair[0], pair[1]))
    return [other for _, other in scored[:NEIGHBOUR_LIMIT]]


def predict_user_based(user_id, item_id, hidden, ctx):
    baseline = ctx["user_mean"](user_id, hidden)
    if baseline is None:
        return None, True

    effects = 0.0
    absolute = 0.0
    contributors = 0
    for neighbour in top_user_neighbours(user_id, ctx["user_ratings"], hidden,
                                         ctx["num_users"]):
        rating = ctx["user_ratings"].get(neighbour, {}).get(item_id, 0.0)
        if rating == 0.0:
            continue
        neighbour_mean = ctx["user_mean"](neighbour, hidden)
        if neighbour_mean is None:
            continue
        value, _, _ = user_similarity(user_id, neighbour, ctx["user_ratings"], hidden)
        effects += value * (rating - neighbour_mean)
        absolute += abs(value)
        contributors += 1
    if contributors == 0:
        return clamp_rating(baseline), True
    return aggregate(baseline, effects, absolute)


def predict_item_based(user_id, item_id, hidden, ctx):
    baseline = ctx["item_mean"](item_id, hidden)
    if baseline is None:
        baseline = ctx["user_mean"](user_id, hidden)
        if baseline is None:
            return None, True
        return clamp_rating(baseline), True

    rated = {i: r for i, r in ctx["user_ratings"].get(user_id, {}).items()
             if not (hidden is not None and hidden[0] == user_id and hidden[1] == i)}
    if not rated:
        return clamp_rating(baseline), True

    scored = []
    for other_item in sorted(rated):
        value, _, _ = item_similarity(item_id, other_item, ctx["item_ratings"], hidden)
        if value > 0:
            scored.append((value, other_item))
    scored.sort(key=lambda pair: (-pair[0], pair[1]))

    effects = 0.0
    absolute = 0.0
    contributors = 0
    for value, other_item in scored[:NEIGHBOUR_LIMIT]:
        neighbour_mean = ctx["item_mean"](other_item, hidden)
        if neighbour_mean is None:
            continue
        effects += value * (rated[other_item] - neighbour_mean)
        absolute += abs(value)
        contributors += 1
    if contributors == 0:
        return clamp_rating(baseline), True
    return aggregate(baseline, effects, absolute)


def expected_holdout(user_id, records, title_counts):
    """Recompute the holdout item independently: latest timestamp, unique title."""
    best = None
    for record_user, item_id, rating, timestamp in records:
        if record_user != user_id:
            continue
        if title_counts[CANONICAL_TITLES[item_id]] != 1:
            continue
        if (best is None or timestamp > best[2] or
                (timestamp == best[2] and item_id > best[1])):
            best = (record_user, item_id, timestamp, rating)
    return best


CANONICAL_TITLES = {}


def main():
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2
    tolerance = float(sys.argv[2]) if len(sys.argv) > 2 else 1e-9

    holdout = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
    records = {record["userId"]: record for record in holdout["facts"]["records"]}

    global CANONICAL_TITLES
    titles, title_counts = load_movies()
    CANONICAL_TITLES = titles
    (user_ratings, item_ratings, user_sums, user_counts,
     item_sums, item_counts, raw_records) = load_ratings()

    ctx = {
        "user_ratings": user_ratings, "item_ratings": item_ratings,
        "user_sums": user_sums, "user_counts": user_counts,
        "item_sums": item_sums, "item_counts": item_counts,
        "num_users": len(user_counts),
        "user_mean": make_means(user_sums, user_counts, 0),
        "item_mean": make_means(item_sums, item_counts, 1)
    }

    report = {
        "tolerance": tolerance,
        "pairs": [],
        "worstUserBasedDelta": 0.0,
        "worstItemBasedDelta": 0.0,
        "checkedPairs": 0,
        "failures": []
    }

    for user_id in FIXED_USERS:
        reference = records.get(user_id)
        if reference is None:
            report["failures"].append(f"user {user_id} missing from holdout results")
            continue

        item_id = reference["itemId"]
        actual = reference["actual"]
        hidden = (user_id, item_id, float(actual))

        chosen = expected_holdout(user_id, raw_records, title_counts)
        selection_ok = chosen is not None and chosen[1] == item_id

        python_user, user_fallback = predict_user_based(user_id, item_id, hidden, ctx)
        python_item, item_fallback = predict_item_based(user_id, item_id, hidden, ctx)

        js_user = reference["userBased"]
        js_item = reference["itemBased"]
        user_delta = abs(python_user - js_user["predictedRating"])
        item_delta = abs(python_item - js_item["predictedRating"])
        report["worstUserBasedDelta"] = max(report["worstUserBasedDelta"], user_delta)
        report["worstItemBasedDelta"] = max(report["worstItemBasedDelta"], item_delta)

        entry = {
            "userId": user_id,
            "itemId": item_id,
            "actual": actual,
            "selectionMatches": selection_ok,
            "userBased": {
                "javascript": round(js_user["predictedRating"], 9),
                "python": round(python_user, 9),
                "delta": user_delta,
                "agrees": user_delta <= tolerance,
                "fallbackAgrees": user_fallback == js_user["usedFallback"]
            },
            "itemBased": {
                "javascript": round(js_item["predictedRating"], 9),
                "python": round(python_item, 9),
                "delta": item_delta,
                "agrees": item_delta <= tolerance,
                "fallbackAgrees": item_fallback == js_item["usedFallback"]
            }
        }
        report["pairs"].append(entry)
        report["checkedPairs"] += 1

        if not selection_ok:
            report["failures"].append(f"user {user_id} holdout item disagrees: js {item_id}")
        if not entry["userBased"]["agrees"]:
            report["failures"].append(f"user {user_id} user-based delta {user_delta}")
        if not entry["itemBased"]["agrees"]:
            report["failures"].append(f"user {user_id} item-based delta {item_delta}")
        if not entry["userBased"]["fallbackAgrees"] or not entry["itemBased"]["fallbackAgrees"]:
            report["failures"].append(f"user {user_id} fallback flag disagrees")

    report["passed"] = report["checkedPairs"] >= 10 and not report["failures"]
    report["minimumRequiredPairs"] = 10
    json.dump(report, sys.stdout, indent=1)
    print()
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
