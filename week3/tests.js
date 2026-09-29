// A03 unit and regression suite for the HW3 collaborative filtering module.
//
// This file is NOT loaded by index.html. It runs only through the verification
// harness in week3/evidence/, which concatenates it after the real data.js and
// script.js so it exercises the shipped code paths rather than a copy.
//
// Every symbol is a03-prefixed so the file cannot collide with application
// globals if it is ever loaded alongside the app.

const A03_ITEM_PAIRS = [
    [599, 50],
    [18, 208],
    [158, 50],
    [18, 158],
    [599, 208],
    [208, 50]
];

const A03_USERS = [1, 19, 100, 200, 405];

const A03_TOLERANCE = 1e-12;

function a03Assert(results, name, condition, detail) {
    results.push({
        name,
        passed: Boolean(condition),
        detail: detail === undefined ? '' : String(detail)
    });
}

function a03Approx(actual, expected, tolerance) {
    return Math.abs(actual - expected) <= tolerance;
}

// A true dense item column: ratingMatrix[userId][itemId] for users 0..numUsers.
// Row 0 is never allocated by buildRatingMatrix and means "not a user", so it
// contributes a zero, which is exactly the unobserved value.
function a03DenseItemColumn(itemId) {
    const column = new Array(numUsers + 1);
    for (let userId = 0; userId <= numUsers; userId++) {
        const row = ratingMatrix[userId];
        column[userId] = row === undefined ? 0 : row[itemId];
    }
    return column;
}

function a03DenseUserRow(userId) {
    return ratingMatrix[userId];
}

function a03AllFiniteAndUnit(value) {
    return Number.isFinite(value) && value >= 0 && value <= 1;
}

function a03RecommendationSanity(list, ratedItemIds, ratedCanonical) {
    const seen = new Set();
    for (const entry of list) {
        if (ratedItemIds.has(entry.id)) {
            return `already-rated ${entry.title}`;
        }
        const canonical = moviesById.get(entry.id).canonicalTitle;
        if (ratedCanonical.has(canonical)) {
            return `duplicate-title-of-rated ${entry.title}`;
        }
        if (seen.has(canonical)) {
            return `repeated canonical ${canonical}`;
        }
        seen.add(canonical);
        if (entry.evidenceLabel === 'FALLBACK') {
            return `fallback listed ${entry.title}`;
        }
        if (!Number.isFinite(entry.score) || entry.score < MIN_RATING || entry.score > MAX_RATING) {
            return `score out of range ${entry.score}`;
        }
    }
    return null;
}

// Regression guard for the defect where collectItemNeighbours pooled every
// anchor into a single accumulator per candidate. The sink must stay keyed by
// anchor, and each accumulator must reproduce the pairwise similarity exactly.
function a03PerAnchorRegression(results) {
    const userId = 1;
    const anchors = userRatings[userId].map(entry => entry.itemId);
    const sink = new Map();
    for (const anchor of anchors) {
        collectItemNeighbours(anchor, null, sink);
    }

    let multiAnchor = 0;
    let anchorKeyed = true;
    let reproducesPairwise = true;
    let onlyRatedAnchors = true;
    let detail = 'no candidate with two anchors';

    for (const [candidateId, byAnchor] of sink) {
        if (!(byAnchor instanceof Map)) {
            anchorKeyed = false;
            detail = `sink value is not a Map for candidate ${candidateId}`;
            break;
        }
        for (const anchorId of byAnchor.keys()) {
            if (!anchors.includes(anchorId)) {
                onlyRatedAnchors = false;
            }
        }
        if (byAnchor.size < 2) {
            continue;
        }
        multiAnchor++;
        for (const [anchorId, accumulator] of byAnchor) {
            const expected = itemSimilarityWithEvidence(candidateId, anchorId, null);
            if (accumulator.overlap !== expected.overlap ||
                !a03Approx(accumulator.dot / Math.sqrt(accumulator.sumSquaresSelf * accumulator.sumSquaresOther),
                    expected.rawCosine, A03_TOLERANCE)) {
                reproducesPairwise = false;
            }
        }
        if (multiAnchor >= 40) {
            break;
        }
    }

    a03Assert(results, 'collectItemNeighbours keeps a per-anchor accumulator', anchorKeyed, detail);
    a03Assert(results, 'collectItemNeighbours anchors are the user rated items', onlyRatedAnchors, 'anchors');
    a03Assert(results, 'per-anchor accumulators reproduce the pairwise similarity', reproducesPairwise, `${multiAnchor} candidates`);
    a03Assert(results, 'multi-anchor candidates exist for the regression test', multiAnchor > 0, multiAnchor);
}

function runA03UnitTests() {
    const results = [];

    const zeroOverlap = similarityWithEvidence([1, 2, 0, 0], [0, 0, 3, 4]);
    a03Assert(results, 'zero overlap returns similarity 0',
        zeroOverlap.similarity === 0 && zeroOverlap.rawCosine === 0 && zeroOverlap.overlap === 0,
        JSON.stringify(zeroOverlap));

    const zeroDenominator = aggregatePrediction(3.0, []);
    a03Assert(results, 'zero denominator returns an explicit fallback',
        zeroDenominator.usedFallback === true &&
        zeroDenominator.fallbackReason === 'no-contributors' &&
        zeroDenominator.predictedRating === 3.0,
        JSON.stringify(zeroDenominator));

    const a = [5, 4, 0, 1];
    const b = [4, 3, 5, 2];
    const densePair = similarityWithEvidence(a, b);
    const expectedRaw = 34 / Math.sqrt(42 * 29);
    a03Assert(results, 'raw cosine uses only co-rated entries', densePair.overlap === 3, `overlap ${densePair.overlap}`);
    a03Assert(results, 'raw cosine matches the hand calculation',
        a03Approx(densePair.rawCosine, expectedRaw, A03_TOLERANCE), densePair.rawCosine);
    a03Assert(results, 'significance weight is exactly n/(n+25)',
        a03Approx(densePair.similarity, expectedRaw * 3 / (3 + SIMILARITY_LAMBDA), A03_TOLERANCE),
        densePair.similarity);
    a03Assert(results, 'cosineSimilarity is the numeric wrapper',
        cosineSimilarity(a, b) === densePair.similarity, cosineSimilarity(a, b));

    const thin = similarityWithEvidence([5, 0, 0, 0], [4, 0, 0, 0]);
    a03Assert(results, 'a one-rating overlap is strongly shrunk',
        thin.overlap === 1 && thin.rawCosine > 0.9 && thin.similarity < 0.05 && thin.similarity > 0,
        `raw ${thin.rawCosine} weighted ${thin.similarity}`);

    const userDense = cosineSimilarity(a03DenseUserRow(1), a03DenseUserRow(2));
    const userSparse = userSimilarityWithEvidence(1, 2, null);
    a03Assert(results, 'user sparse similarity equals dense similarity',
        a03Approx(userDense, userSparse.similarity, A03_TOLERANCE) &&
        a03Approx(similarityWithEvidence(a03DenseUserRow(1), a03DenseUserRow(2)).rawCosine, userSparse.rawCosine, A03_TOLERANCE) &&
        similarityWithEvidence(a03DenseUserRow(1), a03DenseUserRow(2)).overlap === userSparse.overlap,
        `dense ${userDense} sparse ${userSparse.similarity}`);

    let itemPairsMatched = 0;
    let itemMismatch = '';
    for (const [itemA, itemB] of A03_ITEM_PAIRS) {
        const dense = similarityWithEvidence(a03DenseItemColumn(itemA), a03DenseItemColumn(itemB));
        const sparse = itemSimilarityWithEvidence(itemA, itemB, null);
        const ok = a03Approx(dense.rawCosine, sparse.rawCosine, A03_TOLERANCE) &&
            a03Approx(dense.similarity, sparse.similarity, A03_TOLERANCE) &&
            dense.overlap === sparse.overlap;
        if (ok) {
            itemPairsMatched++;
        } else if (!itemMismatch) {
            itemMismatch = `(${itemA},${itemB}) dense ${JSON.stringify(dense)} sparse ${JSON.stringify(sparse)}`;
        }
    }
    a03Assert(results, 'five real item sparse similarities equal dense columns',
        itemPairsMatched === A03_ITEM_PAIRS.length,
        itemMismatch || `${itemPairsMatched}/${A03_ITEM_PAIRS.length} within ${A03_TOLERANCE}`);

    let sampled = 0;
    let unitViolation = '';
    for (let itemA = 1; itemA <= 120; itemA++) {
        for (let offset = 1; offset <= 3; offset++) {
            const itemB = itemA + offset * 137;
            if (itemB > numMovies) {
                continue;
            }
            const evidence = itemSimilarityWithEvidence(itemA, itemB, null);
            if (!a03AllFiniteAndUnit(evidence.similarity) || !a03AllFiniteAndUnit(evidence.rawCosine)) {
                unitViolation = `item (${itemA},${itemB}) ${JSON.stringify(evidence)}`;
            }
            sampled++;
        }
    }
    for (let userA = 1; userA <= 120; userA++) {
        const evidence = userSimilarityWithEvidence(userA, userA + 137 <= numUsers ? userA + 137 : 1, null);
        if (!a03AllFiniteAndUnit(evidence.similarity) || !a03AllFiniteAndUnit(evidence.rawCosine)) {
            unitViolation = `user (${userA}) ${JSON.stringify(evidence)}`;
        }
        sampled++;
    }
    a03Assert(results, 'all sampled similarities are finite and in [0,1]', unitViolation === '', unitViolation || `${sampled} pairs`);

    let clamped = 0;
    let clampViolation = '';
    for (const userId of A03_USERS) {
        const rated = userRatings[userId].map(entry => entry.itemId);
        const hidden = { userId, itemId: rated[rated.length - 1], rating: ratingMatrix[userId][rated[rated.length - 1]] };
        const predictions = [predictUserBased(userId, rated[0], hidden), predictItemBased(userId, rated[0], hidden)];
        for (const prediction of predictions) {
            if (!Number.isFinite(prediction.predictedRating) ||
                prediction.predictedRating < MIN_RATING || prediction.predictedRating > MAX_RATING ||
                !Number.isFinite(prediction.denominator) || prediction.denominator < 0) {
                clampViolation = `user ${userId} ${JSON.stringify(prediction)}`;
            }
            clamped++;
        }
    }
    a03Assert(results, 'predictions are finite and clamped to [1,5]', clampViolation === '', clampViolation || `${clamped} predictions`);

    // Regression: buildPredictionCard renders result.baseline.toFixed(2) on
    // every card, so a non-fallback result that omits `baseline` throws in the
    // real UI. This must fail if that field ever disappears again.
    let baselineViolations = 0;
    let baselineViolationDetail = '';
    for (const userId of A03_USERS) {
        for (const entry of userRatings[userId].slice(0, 3)) {
            const hidden = { userId, itemId: entry.itemId, rating: entry.rating };
            for (const prediction of [
                predictUserBased(userId, entry.itemId, hidden),
                predictItemBased(userId, entry.itemId, hidden),
                predictUserBased(userId, 0, null),
                predictItemBased(userId, 0, null)
            ]) {
                if (typeof prediction.baseline !== 'number' || !Number.isFinite(prediction.baseline)) {
                    baselineViolations++;
                    baselineViolationDetail = baselineViolationDetail ||
                        `user ${userId} ${JSON.stringify(prediction).slice(0, 120)}`;
                }
            }
        }
    }
    a03Assert(results, 'every prediction result carries a finite baseline for the UI',
        baselineViolations === 0, baselineViolationDetail || 'baseline present on every result');

    let topFiveOk = 0;
    let topFiveViolation = '';
    for (const userId of A03_USERS) {
        const ratedItemIds = new Set(userRatings[userId].map(entry => entry.itemId));
        const ratedCanonical = canonicalTitlesFor(userRatings[userId]);
        const userTop = getUserBasedRecommendations(userId);
        const itemTop = getItemBasedRecommendations(userId);

        if (userTop.length !== 5) {
            topFiveViolation = `user ${userId} user-based returned ${userTop.length}`;
        } else {
            const problem = a03RecommendationSanity(userTop, ratedItemIds, ratedCanonical);
            if (problem) {
                topFiveViolation = `user ${userId} user-based: ${problem}`;
            }
        }
        if (itemTop.length !== 5) {
            topFiveViolation = topFiveViolation || `user ${userId} item-based returned ${itemTop.length}`;
        } else {
            const problem = a03RecommendationSanity(itemTop, ratedItemIds, ratedCanonical);
            if (problem) {
                topFiveViolation = topFiveViolation || `user ${userId} item-based: ${problem}`;
            }
        }
        if (topFiveViolation === '') {
            topFiveOk++;
        }
    }
    a03Assert(results, 'both methods return five supported recommendations per fixed user',
        topFiveOk === A03_USERS.length, topFiveViolation || `${topFiveOk}/${A03_USERS.length} users`);

    let deterministic = true;
    let deterministicDetail = '';
    for (const userId of A03_USERS) {
        const firstUser = JSON.stringify(getUserBasedRecommendations(userId));
        const secondUser = JSON.stringify(getUserBasedRecommendations(userId));
        const firstItem = JSON.stringify(getItemBasedRecommendations(userId));
        const secondItem = JSON.stringify(getItemBasedRecommendations(userId));
        if (firstUser !== secondUser || firstItem !== secondItem) {
            deterministic = false;
            deterministicDetail = `user ${userId} differs on repeat`;
            break;
        }
    }
    a03Assert(results, 'rankings are deterministic on repeated execution', deterministic, deterministicDetail || 'stable');

    const hiddenItem = 1;
    const hiddenRating = ratingMatrix[1][hiddenItem];
    const hidden = { userId: 1, itemId: hiddenItem, rating: hiddenRating };
    const userOverlapFull = userSimilarityWithEvidence(1, 2, null).overlap;
    const userOverlapHidden = userSimilarityWithEvidence(1, 2, hidden).overlap;
    const itemOverlapFull = itemSimilarityWithEvidence(1, 2, null).overlap;
    const itemOverlapHidden = itemSimilarityWithEvidence(1, 2, hidden).overlap;
    a03Assert(results, 'hidden rating is excluded from the user mean',
        a03Approx(userMean(1, hidden), (userRatingSums[1] - hiddenRating) / (userRatingCounts[1] - 1), A03_TOLERANCE),
        userMean(1, hidden));
    a03Assert(results, 'hidden rating is excluded from the item mean',
        a03Approx(itemMean(hiddenItem, hidden),
            (itemRatingSums[hiddenItem] - hiddenRating) / (itemRatingCounts[hiddenItem] - 1), A03_TOLERANCE),
        itemMean(hiddenItem, hidden));
    a03Assert(results, 'hidden rating leaves the user similarity intersection',
        userOverlapHidden === userOverlapFull - 1, `${userOverlapFull} -> ${userOverlapHidden}`);
    a03Assert(results, 'hidden rating leaves the item similarity intersection',
        itemOverlapHidden === itemOverlapFull - 1, `${itemOverlapFull} -> ${itemOverlapHidden}`);
    a03Assert(results, 'hidden rating leaves the item neighbour totals',
        collectItemNeighboursSizesAgree(1, hidden), 'anchor totals');

    a03Assert(results, 'a fallback is labelled FALLBACK',
        evidenceLabelFor({ usedFallback: true, contributorCount: 0, denominator: 0, overlaps: [] }) === 'FALLBACK',
        'FALLBACK');
    a03Assert(results, 'a thin but valid prediction is never labelled FALLBACK',
        evidenceLabelFor({ usedFallback: false, contributorCount: 1, denominator: 0.03, overlaps: [1] }) === 'LOW',
        'LOW');
    a03Assert(results, 'HIGH band requires strong support',
        evidenceLabelFor({ usedFallback: false, contributorCount: 10, denominator: 2, overlaps: new Array(10).fill(10) }) === 'HIGH',
        'HIGH');
    a03Assert(results, 'MEDIUM band requires moderate support',
        evidenceLabelFor({ usedFallback: false, contributorCount: 3, denominator: 0.5, overlaps: [3, 3, 3] }) === 'MEDIUM',
        'MEDIUM');

    a03PerAnchorRegression(results);

    const passed = results.filter(result => result.passed).length;
    return { passed, failed: results.length - passed, total: results.length, results };
}

// Confirms that hiding a pair removes exactly one co-occurrence from every
// anchor scan that touches the hidden item, with no collateral change.
function collectItemNeighboursSizesAgree(itemId, hidden) {
    const withHidden = new Map();
    const withoutHidden = new Map();
    collectItemNeighbours(itemId, hidden, withHidden);
    collectItemNeighbours(itemId, null, withoutHidden);

    for (const [candidateId, byAnchor] of withHidden) {
        if (candidateId === hidden.itemId) {
            return false;
        }
        if (!byAnchor.has(itemId)) {
            return false;
        }
    }
    for (const [candidateId, byAnchor] of withoutHidden) {
        const counterpart = withHidden.get(candidateId);
        if (counterpart === undefined || !counterpart.has(itemId)) {
            return false;
        }
    }
    return withHidden.size === withoutHidden.size;
}
