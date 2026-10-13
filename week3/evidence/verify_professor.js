// Section C -- the professor's signed-similarity worked example.
//
// This fixture validates the baseline-plus-deviation aggregation rule only.
// Production similarity is a non-negative cosine on positive co-rated ratings,
// so it never produces the negative similarities shown on the slide.

function a03Section() {
    const checks = [];
    const outcome = professorWorkedExample();

    // Calculation 1: the slide's own aggregate values.
    const slidePrediction = 3.67 + (-2.764 / 2.543);

    // Calculation 2: the printed rows, each of which is already rounded.
    const rows = [
        { label: 'Star Wars', similarity: -0.99, deviation: 5 - 3.33 },
        { label: 'Dune', similarity: 0.72, deviation: 3 - 3.00 },
        { label: 'Interstellar', similarity: -0.84, deviation: 5 - 3.67 }
    ];
    let sumOfEffects = 0;
    let sumOfAbsoluteSimilarities = 0;
    const rowDetail = [];
    for (const row of rows) {
        const effect = row.similarity * row.deviation;
        sumOfEffects += effect;
        sumOfAbsoluteSimilarities += Math.abs(row.similarity);
        rowDetail.push({
            label: row.label,
            similarity: row.similarity,
            deviation: Math.round(row.deviation * 100) / 100,
            effect: Math.round(effect * 1000) / 1000
        });
    }
    const rowPrediction = 3.67 + (sumOfEffects / sumOfAbsoluteSimilarities);

    const details = {
        slideAggregate: {
            expression: '3.67 + (-2.764 / 2.543)',
            sumOfEffects: -2.764,
            sumOfAbsoluteSimilarities: 2.543,
            prediction: Math.round(slidePrediction * 1e6) / 1e6
        },
        roundedRows: {
            rows: rowDetail,
            recomputedSumOfEffects: Math.round(sumOfEffects * 1e6) / 1e6,
            recomputedSumOfAbsoluteSimilarities: sumOfAbsoluteSimilarities,
            prediction: Math.round(rowPrediction * 1e6) / 1e6
        },
        agreement: {
            absoluteDifference: Math.round(Math.abs(slidePrediction - rowPrediction) * 1e6) / 1e6,
            bothRoundTo: Math.round(slidePrediction * 100) / 100 === 2.58 &&
                Math.round(rowPrediction * 100) / 100 === 2.58,
            cause: 'The slide prints row values rounded to two decimals while its ' +
                'denominator 2.543 is carried at three decimals, so the two routes ' +
                'differ in the third decimal. Neither is exact; both round to 2.58.'
        },
        productionContract: {
            strategy: 'Significance-weighted co-rated cosine',
            range: 'similarity in [0, 1]; only positively related neighbours contribute',
            note: 'Production similarity is non-negative by construction. The signed ' +
                'values on the slide demonstrate that the aggregation rule is general, ' +
                'not that the production similarity can produce them.'
        }
    };

    checks.push(a03Check('slide aggregate rounds to 2.58', Math.round(slidePrediction * 100) / 100 === 2.58, slidePrediction));
    checks.push(a03Check('rounded rows round to 2.58', Math.round(rowPrediction * 100) / 100 === 2.58, rowPrediction));
    checks.push(a03Check('the two routes agree within 0.005',
        Math.abs(slidePrediction - rowPrediction) < 0.005,
        Math.abs(slidePrediction - rowPrediction)));
    checks.push(a03Check('the real aggregator reproduces the slide aggregate',
        Math.abs(outcome.fromSlideTotals.predictedRating - slidePrediction) < 1e-9,
        outcome.fromSlideTotals.predictedRating));
    checks.push(a03Check('the real aggregator reproduces the rounded rows',
        Math.abs(outcome.fromRoundedRows.predictedRating - rowPrediction) < 1e-9,
        outcome.fromRoundedRows.predictedRating));
    checks.push(a03Check('the aggregator is not a fallback in either route',
        outcome.fromSlideTotals.usedFallback === false && outcome.fromRoundedRows.usedFallback === false, 'ok'));
    checks.push(a03Check('a zero denominator still falls back on the shared helper',
        aggregatePredictionTotals(3.67, 0, 0).usedFallback === true, 'ok'));
    checks.push(a03Check('production cosine stays non-negative on the fixture data',
        similarityWithEvidence([5, 4, 1], [4, 3, 5]).similarity >= 0, 'non-negative'));

    return { section: 'C-professor-worked-example', details, summary: a03Summarise(checks) };
}
