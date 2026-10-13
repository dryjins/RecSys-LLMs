// Section F -- efficiency on fixed users with deliberately different history
// sizes. Cold = first invocation in the process (no JIT warm-up), warm =
// repeated invocations of the same operation on the same user.

const A03_WARM_REPEATS = 3;

function a03Time(operation) {
    const started = now();
    operation();
    return now() - started;
}

function a03Measure(operation) {
    const cold = a03Time(operation);
    const warm = [];
    for (let repeat = 0; repeat < A03_WARM_REPEATS; repeat++) {
        warm.push(a03Time(operation));
    }
    return {
        coldMs: a03Round(cold, 3),
        warmMedianMs: a03Round(a03Median(warm), 3),
        warmMinMs: a03Round(Math.min(...warm), 3),
        warmMaxMs: a03Round(Math.max(...warm), 3)
    };
}

function a03Section() {
    const checks = [];
    const rows = [];

    for (const userId of A03_USERS) {
        const historySize = userRatings[userId].length;
        const ratedItemId = userRatings[userId][0].itemId;

        const userPrediction = a03Measure(() => predictTargetPair(userId, ratedItemId).userBased);
        const itemPrediction = a03Measure(() => predictTargetPair(userId, ratedItemId).itemBased);
        const userTop = a03Measure(() => getUserBasedRecommendations(userId));
        const itemTop = a03Measure(() => getItemBasedRecommendations(userId));

        rows.push({
            userId,
            historySize,
            maskedItemId: ratedItemId,
            userPrediction,
            itemPrediction,
            userTop5: userTop,
            itemTop5: itemTop,
            top5ItemCost: a03Round(itemTop.warmMedianMs + userTop.warmMedianMs, 3)
        });
    }

    for (const row of rows) {
        for (const key of ['userPrediction', 'itemPrediction', 'userTop5', 'itemTop5']) {
            const timing = row[key];
            const values = [timing.coldMs, timing.warmMedianMs, timing.warmMinMs, timing.warmMaxMs];
            const sane = values.every(value => Number.isFinite(value) && value >= 0) &&
                timing.warmMinMs <= timing.warmMaxMs;
            checks.push(a03Check(`user ${row.userId} ${key} timing is measurable and ordered`, sane, JSON.stringify(timing)));
        }
    }

    const distinctSizes = new Set(rows.map(row => row.historySize));
    checks.push(a03Check('at least five fixed users with distinct history sizes',
        rows.length >= 5 && distinctSizes.size >= 5,
        `sizes ${rows.map(row => row.historySize).join(', ')}`));

    for (const row of rows) {
        checks.push(a03Check(`user ${row.userId} returns five recommendations from both methods`,
            getUserBasedRecommendations(row.userId).length === 5 &&
            getItemBasedRecommendations(row.userId).length === 5,
            'five each'));
    }

    const sorted = [...rows].sort((a, b) => a.historySize - b.historySize);
    const facts = {
        note: 'Timings are wall-clock in the verification runtime (JavaScriptCore), not a browser. ' +
            'They describe this dataset and these history sizes only.',
        warmRepeats: A03_WARM_REPEATS,
        slowestUserTop5: Math.max(...rows.map(row => row.userTop5.warmMedianMs)),
        slowestItemTop5: Math.max(...rows.map(row => row.itemTop5.warmMedianMs)),
        byHistorySize: sorted
    };

    return { section: 'F-efficiency', facts, summary: a03Summarise(checks) };
}
