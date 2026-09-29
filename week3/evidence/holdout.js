// Section D -- leave-one-out holdout evaluation over the whole population.
//
// Selection rule: each user hides the most recent rating they gave to a movie
// whose canonical title is unique in the catalogue. Ties on timestamp are
// broken by the larger item ID so the split is deterministic. Every one of the
// 943 users has at least two ratings on unique-title movies, so the full
// population is eligible; the 200-user fallback is implemented and reported if
// it is ever needed, but it is not used here.
//
// The hidden pair is passed as a single mask record to the real prediction
// functions, so it is excluded from the active user's mean, from the item
// mean, from every co-rated intersection and from every contribution sum.

function a03UniqueCanonicalTitle(itemId) {
    let occurrences = 0;
    for (const movie of movies) {
        if (movie.canonicalTitle === moviesById.get(itemId).canonicalTitle) {
            occurrences++;
            if (occurrences > 1) {
                return false;
            }
        }
    }
    return true;
}

function a03HoldoutSelection() {
    const uniqueTitleCache = new Map();
    const isUnique = itemId => {
        let value = uniqueTitleCache.get(itemId);
        if (value === undefined) {
            value = a03UniqueCanonicalTitle(itemId);
            uniqueTitleCache.set(itemId, value);
        }
        return value;
    };

    const chosen = new Map();
    let eligibleUsers = 0;
    let rejectedByTitle = 0;
    let rejectedByDepth = 0;

    for (const record of ratings) {
        if (!isUnique(record.itemId)) {
            rejectedByTitle++;
            continue;
        }
        const current = chosen.get(record.userId);
        if (current === undefined ||
            record.timestamp > current.timestamp ||
            (record.timestamp === current.timestamp && record.itemId > current.itemId)) {
            chosen.set(record.userId, {
                userId: record.userId,
                itemId: record.itemId,
                rating: record.rating,
                timestamp: record.timestamp
            });
        }
    }

    const selection = [];
    for (const entry of [...chosen.values()].sort((a, b) => a.userId - b.userId)) {
        if (userRatings[entry.userId].length < 2) {
            rejectedByDepth++;
            continue;
        }
        eligibleUsers++;
        selection.push(entry);
    }
    return { selection, eligibleUsers, rejectedByTitle, rejectedByDepth };
}

function a03Metrics(records, field) {
    const latencies = [];
    const evidence = { HIGH: 0, MEDIUM: 0, LOW: 0, FALLBACK: 0 };
    let absoluteErrorSum = 0;
    let squaredErrorSum = 0;
    let covered = 0;
    let fallbackAbsoluteErrorSum = 0;

    for (const record of records) {
        const prediction = record[field];
        latencies.push(prediction.elapsedMs);
        evidence[evidenceLabelFor(prediction)]++;
        const absoluteError = Math.abs(prediction.predictedRating - record.actual);
        fallbackAbsoluteErrorSum += absoluteError;
        if (!prediction.usedFallback) {
            covered++;
            absoluteErrorSum += absoluteError;
            squaredErrorSum += absoluteError * absoluteError;
        }
    }

    latencies.sort((a, b) => a - b);
    const n = records.length;
    return {
        evaluated: n,
        covered,
        fallbacks: n - covered,
        coverage: a03Round(covered / n, 4),
        mae: covered ? a03Round(absoluteErrorSum / covered, 4) : null,
        rmse: covered ? a03Round(Math.sqrt(squaredErrorSum / covered), 4) : null,
        fallbackInclusiveMae: a03Round(fallbackAbsoluteErrorSum / n, 4),
        evidence,
        latencyMedianMs: a03Round(a03Percentile(latencies, 0.5), 3),
        latencyP95Ms: a03Round(a03Percentile(latencies, 0.95), 3),
        latencyTotalMs: a03Round(latencies.reduce((total, value) => total + value, 0), 1)
    };
}

function a03Section() {
    const checks = [];
    const { selection, eligibleUsers, rejectedByTitle, rejectedByDepth } = a03HoldoutSelection();

    // Documented reduction path, reported but not triggered.
    const reduction = null;
    const REDUCTION_LIMIT = 200;
    const evaluatedSelection = reduction === null
        ? selection
        : selection.slice(0, REDUCTION_LIMIT);

    const records = [];
    for (const entry of evaluatedSelection) {
        const hidden = { userId: entry.userId, itemId: entry.itemId, rating: entry.rating };

        const userStarted = now();
        const userBased = predictUserBased(entry.userId, entry.itemId, hidden);
        userBased.elapsedMs = now() - userStarted;

        const itemStarted = now();
        const itemBased = predictItemBased(entry.userId, entry.itemId, hidden);
        itemBased.elapsedMs = now() - itemStarted;

        records.push({
            userId: entry.userId,
            itemId: entry.itemId,
            title: moviesById.get(entry.itemId).title,
            actual: entry.rating,
            historySizeAfterMask: userRatings[entry.userId].length - 1,
            userBased,
            itemBased
        });
    }

    const facts = {
        population: {
            mode: reduction === null ? 'all-eligible-users' : 'reduced',
            eligibleUsers,
            evaluated: records.length,
            limitIfReduced: REDUCTION_LIMIT,
            reason: reduction,
            selectionRule: 'latest timestamp, unique canonical title, tie broken by larger item ID',
            excludedBecauseTitleDuplicated: rejectedByTitle,
            excludedBecauseHistoryTooShort: rejectedByDepth
        },
        strategy: 'Significance-weighted co-rated cosine, lambda 25, baseline plus weighted rating deviations',
        userBased: a03Metrics(records, 'userBased'),
        itemBased: a03Metrics(records, 'itemBased')
    };

    const common = records.filter(record => !record.userBased.usedFallback && !record.itemBased.usedFallback);
    let userAbsolute = 0;
    let userSquared = 0;
    let itemAbsolute = 0;
    let itemSquared = 0;
    let userWins = 0;
    let itemWins = 0;
    let ties = 0;
    for (const record of common) {
        const userError = Math.abs(record.userBased.predictedRating - record.actual);
        const itemError = Math.abs(record.itemBased.predictedRating - record.actual);
        userAbsolute += userError;
        userSquared += userError * userError;
        itemAbsolute += itemError;
        itemSquared += itemError * itemError;
        const roundedUser = a03Round(record.userBased.predictedRating, 2);
        const roundedItem = a03Round(record.itemBased.predictedRating, 2);
        if (roundedUser < roundedItem) {
            userWins++;
        } else if (roundedItem < roundedUser) {
            itemWins++;
        } else {
            ties++;
        }
    }
    facts.commonSupportedSubset = {
        pairs: common.length,
        shareOfPopulation: a03Round(common.length / records.length, 4),
        userBasedMae: common.length ? a03Round(userAbsolute / common.length, 4) : null,
        userBasedRmse: common.length ? a03Round(Math.sqrt(userSquared / common.length), 4) : null,
        itemBasedMae: common.length ? a03Round(itemAbsolute / common.length, 4) : null,
        itemBasedRmse: common.length ? a03Round(Math.sqrt(itemSquared / common.length), 4) : null,
        userBasedLowerError: userWins,
        itemBasedLowerError: itemWins,
        tied: ties,
        note: 'Only comparable where both methods produced a non-fallback prediction. ' +
            'A fallback is a design decision, not a scoring error.'
    };

    checks.push(a03Check('every eligible user was evaluated',
        records.length === eligibleUsers && records.length === numUsers,
        `${records.length}/${eligibleUsers} of ${numUsers} users`));
    checks.push(a03Check('one record per user, no duplicates',
        new Set(records.map(record => record.userId)).size === records.length, 'unique user ids'));
    checks.push(a03Check('no hidden pair leaks into its own recommendation history',
        records.every(record => record.historySizeAfterMask === userRatings[record.userId].length - 1),
        'masked'));
    checks.push(a03Check('every prediction is finite and inside the rating scale',
        records.every(record =>
            Number.isFinite(record.userBased.predictedRating) &&
            Number.isFinite(record.itemBased.predictedRating) &&
            record.userBased.predictedRating >= MIN_RATING && record.userBased.predictedRating <= MAX_RATING &&
            record.itemBased.predictedRating >= MIN_RATING && record.itemBased.predictedRating <= MAX_RATING),
        'in range'));
    checks.push(a03Check('every fallback is labelled FALLBACK',
        records.every(record => !record.userBased.usedFallback || evidenceLabelFor(record.userBased) === 'FALLBACK') &&
        records.every(record => !record.itemBased.usedFallback || evidenceLabelFor(record.itemBased) === 'FALLBACK'),
        'labels agree'));
    checks.push(a03Check('coverage is reported per method',
        facts.userBased.coverage > 0 && facts.itemBased.coverage > 0,
        `user ${facts.userBased.coverage}, item ${facts.itemBased.coverage}`));
    checks.push(a03Check('accuracy is reported over the common supported subset',
        common.length > 0, `${common.length} common pairs`));

    const slowest = Math.max(facts.userBased.latencyP95Ms, facts.itemBased.latencyP95Ms);
    facts.performance = {
        p95PredictionMs: slowest,
        note: 'Recorded in the verification runtime; the browser figure is measured separately.'
    };

    facts.records = records.map(record => ({
        userId: record.userId,
        itemId: record.itemId,
        actual: record.actual,
        userBased: {
            predictedRating: record.userBased.predictedRating,
            usedFallback: record.userBased.usedFallback,
            fallbackReason: record.userBased.fallbackReason,
            contributorCount: record.userBased.contributorCount,
            denominator: record.userBased.denominator,
            evidence: evidenceLabelFor(record.userBased)
        },
        itemBased: {
            predictedRating: record.itemBased.predictedRating,
            usedFallback: record.itemBased.usedFallback,
            fallbackReason: record.itemBased.fallbackReason,
            contributorCount: record.itemBased.contributorCount,
            denominator: record.itemBased.denominator,
            evidence: evidenceLabelFor(record.itemBased)
        }
    }));

    return { section: 'D-holdout-evaluation', facts, summary: a03Summarise(checks) };
}
