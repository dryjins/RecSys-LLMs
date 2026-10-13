// Section G -- cold start, zero-denominator handling and sparsity.

function a03Section() {
    const checks = [];
    const facts = {};

    // 1. New user with no ratings.
    const coldUser = predictUserBased(0, 1, null);
    facts.newUser = {
        predictedRating: coldUser.predictedRating,
        baseline: coldUser.baseline,
        globalRatingMean: globalRatingMean,
        fallbackReason: coldUser.fallbackReason
    };
    checks.push(a03Check('new user falls back to the global mean',
        coldUser.usedFallback === true &&
        coldUser.fallbackReason === 'cold-start-user' &&
        Math.abs(coldUser.predictedRating - globalRatingMean) < 1e-12,
        coldUser.fallbackReason));

    // 2. New item with no ratings.
    const coldItem = predictItemBased(1, 0, null);
    facts.newItem = {
        predictedRating: coldItem.predictedRating,
        baseline: coldItem.baseline,
        userMean: userMean(1, null),
        fallbackReason: coldItem.fallbackReason
    };
    checks.push(a03Check('new item falls back to the user mean',
        coldItem.usedFallback === true &&
        coldItem.fallbackReason === 'cold-start-item' &&
        Math.abs(coldItem.predictedRating - userMean(1, null)) < 1e-12,
        coldItem.fallbackReason));

    const coldBoth = predictItemBased(0, 0, null);
    checks.push(a03Check('user and item both cold falls back to the global mean',
        coldBoth.usedFallback === true && coldBoth.fallbackReason === 'cold-start-item' &&
        Math.abs(coldBoth.predictedRating - globalRatingMean) < 1e-12,
        coldBoth.fallbackReason));

    // 3. No co-ratings.
    const noOverlap = similarityWithEvidence([1, 2, 0, 0], [0, 0, 3, 4]);
    checks.push(a03Check('no co-ratings gives similarity 0 and zero overlap',
        noOverlap.similarity === 0 && noOverlap.rawCosine === 0 && noOverlap.overlap === 0,
        JSON.stringify(noOverlap)));

    let disjointPairs = 0;
    for (let itemA = 1; itemA <= 200; itemA++) {
        for (let offset = 1; offset <= 4; offset++) {
            const itemB = itemA + offset * 211;
            if (itemB > numMovies) {
                continue;
            }
            if (itemSimilarityWithEvidence(itemA, itemB, null).overlap === 0) {
                disjointPairs++;
            }
        }
    }
    facts.disjointItemPairsFound = disjointPairs;
    checks.push(a03Check('zero-overlap item pairs exist and score 0', disjointPairs > 0, `${disjointPairs} pairs`));

    // 4. Exactly one co-rating.
    let oneOverlapEvidence = null;
    for (let itemA = 1; itemA <= numMovies && oneOverlapEvidence === null; itemA++) {
        for (let itemB = itemA + 1; itemB <= numMovies; itemB++) {
            const evidence = itemSimilarityWithEvidence(itemA, itemB, null);
            if (evidence.overlap === 1) {
                oneOverlapEvidence = { itemA, itemB, rawCosine: evidence.rawCosine, similarity: evidence.similarity };
                break;
            }
        }
    }
    facts.oneOverlap = oneOverlapEvidence;
    const single = oneOverlapEvidence !== null &&
        oneOverlapEvidence.rawCosine > 0.9 &&
        oneOverlapEvidence.similarity < 0.05;
    checks.push(a03Check('a one-rating overlap is strongly shrunk', single,
        oneOverlapEvidence === null ? 'no pair found' : `raw ${oneOverlapEvidence.rawCosine} -> ${oneOverlapEvidence.similarity}`));

    if (oneOverlapEvidence !== null) {
        const label = evidenceLabelFor({
            usedFallback: false,
            contributorCount: 1,
            denominator: oneOverlapEvidence.similarity,
            overlaps: [1]
        });
        facts.oneOverlap.evidenceLabel = label;
        checks.push(a03Check('a one-rating overlap is labelled LOW', label === 'LOW', label));
    }

    // 5. No valid contributors.
    const noContributors = aggregatePrediction(3.2, []);
    checks.push(a03Check('no valid contributors gives an explicit baseline fallback',
        noContributors.usedFallback === true &&
        noContributors.fallbackReason === 'no-contributors' &&
        noContributors.predictedRating === 3.2,
        JSON.stringify(noContributors)));

    // 6. No NaN, Infinity or unexplained zero anywhere.
    let numericViolations = 0;
    let violationSample = '';
    for (const userId of [1, 19, 100, 200, 405]) {
        for (const entry of userRatings[userId].slice(0, 5)) {
            const hidden = { userId, itemId: entry.itemId, rating: entry.rating };
            const results = [
                predictUserBased(userId, entry.itemId, hidden),
                predictItemBased(userId, entry.itemId, hidden)
            ];
            for (const result of results) {
                const bad = !Number.isFinite(result.predictedRating) ||
                    !Number.isFinite(result.baseline) ||
                    !Number.isFinite(result.denominator) ||
                    result.predictedRating < 1 || result.predictedRating > 5 ||
                    (result.predictedRating === 0);
                if (bad) {
                    numericViolations++;
                    violationSample = violationSample || JSON.stringify(result);
                }
            }
        }
    }
    facts.numericViolations = numericViolations;
    checks.push(a03Check('no NaN, Infinity or unexplained zero in any prediction',
        numericViolations === 0, violationSample || 'clean'));

    // Sparsity quantification.
    const cells = 944 * 1683;
    let lowSupportItems = 0;
    let singletonItems = 0;
    let itemCounts = [];
    for (let itemId = 1; itemId <= numMovies; itemId++) {
        const count = itemRatingCounts[itemId];
        itemCounts.push(count);
        if (count < 5) {
            lowSupportItems++;
        }
        if (count === 1) {
            singletonItems++;
        }
    }
    itemCounts.sort((a, b) => a - b);
    facts.sparsity = {
        cells,
        observed: ratings.length,
        density: a03Round(ratings.length / cells, 6),
        sparsity: a03Round(1 - ratings.length / cells, 6),
        lowSupportItemsUnder5: lowSupportItems,
        singletonItems,
        medianRatersPerItem: a03Percentile(itemCounts, 0.5),
        p95RatersPerItem: a03Percentile(itemCounts, 0.95),
        maxRatersPerItem: itemCounts[itemCounts.length - 1]
    };
    checks.push(a03Check('sparsity is quantified', facts.sparsity.density > 0.05 && facts.sparsity.sparsity > 0.9,
        `density ${facts.sparsity.density} sparsity ${facts.sparsity.sparsity}`));
    checks.push(a03Check('low-support items exist and are counted', lowSupportItems > 0, `${lowSupportItems} items with fewer than 5 raters`));

    return { section: 'G-cold-start-and-sparsity', facts, summary: a03Summarise(checks) };
}
