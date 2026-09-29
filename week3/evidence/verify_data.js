// Section A -- dataset integrity, verified against the real data.js output.

function a03Section() {
    const checks = [];
    const facts = {};

    facts.users = numUsers;
    facts.movieRows = movies.length;
    facts.ratingRows = ratings.length;
    checks.push(a03Check('943 users', numUsers === 943, numUsers));
    checks.push(a03Check('1682 movie rows', movies.length === 1682, movies.length));
    checks.push(a03Check('100000 ratings', ratings.length === 100000, ratings.length));

    const distinctCanonical = new Set(movies.map(movie => movie.canonicalTitle));
    facts.distinctCanonicalTitles = distinctCanonical.size;
    checks.push(a03Check('1664 distinct canonical titles', distinctCanonical.size === 1664, distinctCanonical.size));

    const ratingValues = [...new Set(ratings.map(record => record.rating))].sort();
    facts.ratingValues = ratingValues;
    checks.push(a03Check('rating values are exactly 1..5',
        ratingValues.length === 5 && ratingValues.join(',') === '1,2,3,4,5', ratingValues.join(',')));

    facts.malformed = {
        itemRows: dataDiagnostics.malformedItemRows,
        ratingRows: dataDiagnostics.malformedRatingRows
    };
    checks.push(a03Check('0 malformed u.item rows', dataDiagnostics.malformedItemRows === 0, dataDiagnostics.malformedItemRows));
    checks.push(a03Check('0 malformed u.data rows', dataDiagnostics.malformedRatingRows === 0, dataDiagnostics.malformedRatingRows));

    let shapeOk = ratingMatrix.length === 944;
    let rowWidth = 0;
    for (let userId = 1; userId <= numUsers && shapeOk; userId++) {
        if (!(ratingMatrix[userId] instanceof Float32Array) || ratingMatrix[userId].length !== 1683) {
            shapeOk = false;
            rowWidth = ratingMatrix[userId] ? ratingMatrix[userId].length : 0;
        }
    }
    facts.matrixShape = { rows: ratingMatrix.length, columns: 1683, float32: shapeOk };
    checks.push(a03Check('matrix shape is 944 x 1683 of Float32Array', shapeOk, rowWidth || 'all rows ok'));

    let nonZero = 0;
    for (let userId = 1; userId <= numUsers; userId++) {
        const row = ratingMatrix[userId];
        for (let itemId = 1; itemId <= 1682; itemId++) {
            if (row[itemId] !== 0) {
                nonZero++;
            }
        }
    }
    const cells = 944 * 1683;
    facts.nonZeroEntries = nonZero;
    facts.totalCells = cells;
    facts.density = nonZero / cells;
    facts.sparsity = 1 - facts.density;
    checks.push(a03Check('100000 non-zero matrix entries', nonZero === 100000, nonZero));
    checks.push(a03Check('density and sparsity are complementary',
        Math.abs(facts.density + facts.sparsity - 1) < 1e-12,
        `density ${(facts.density * 100).toFixed(2)}% sparsity ${(facts.sparsity * 100).toFixed(2)}%`));

    const extended = movies.filter(movie => /[^\x00-\x7F]/.test(movie.title));
    const corrupted = extended.filter(movie => movie.title.indexOf('\uFFFD') >= 0);
    facts.extendedTitles = extended.map(movie => movie.title);
    facts.corruptedTitles = corrupted.length;
    checks.push(a03Check('9 extended-character titles', extended.length === 9, extended.length));
    checks.push(a03Check('no U+FFFD in any title', corrupted.length === 0, corrupted.length));

    const titleCounts = new Map();
    for (const movie of movies) {
        titleCounts.set(movie.canonicalTitle, (titleCounts.get(movie.canonicalTitle) || 0) + 1);
    }
    const duplicatePairs = [...titleCounts.entries()].filter(([, count]) => count > 1);
    facts.duplicateCanonicalPairs = duplicatePairs.length;
    facts.duplicateExamples = duplicatePairs.slice(0, 3).map(([title, count]) => `${title} x${count}`);
    checks.push(a03Check('18 duplicate canonical-title pairs', duplicatePairs.length === 18, duplicatePairs.length));

    const unknownOnly = movies.filter(movie => movie.unknownGenre === true && movie.genres.length === 0);
    const anyUnknownInGenres = movies.filter(movie => movie.genres.indexOf('unknown') >= 0);
    facts.unknownOnlyMovies = unknownOnly.map(movie => movie.title);
    checks.push(a03Check('exactly two unknown-only movies', unknownOnly.length === 2, JSON.stringify(unknownOnly.map(m => m.title))));
    checks.push(a03Check('"unknown" never appears as a genre', anyUnknownInGenres.length === 0, anyUnknownInGenres.length));

    const toyStory = movies.find(movie => movie.id === 1);
    facts.toyStoryGenres = toyStory ? toyStory.genres : null;
    checks.push(a03Check('Toy Story genres are corrected',
        toyStory !== undefined && toyStory.genres.join('|') === "Animation|Children's|Comedy",
        toyStory === undefined ? 'missing' : toyStory.genres.join('|')));

    const westerns = movies.filter(movie => movie.genres.indexOf('Western') >= 0);
    facts.westernCount = westerns.length;
    checks.push(a03Check('Western is reachable', westerns.length > 0, `${westerns.length} westerns`));

    let allFieldsKnown = true;
    for (const movie of movies) {
        for (const genre of movie.genres) {
            if (genreNames.indexOf(genre) < 0) {
                allFieldsKnown = false;
            }
        }
    }
    checks.push(a03Check('every genre label is one of the 18 named genres', allFieldsKnown, allFieldsKnown));

    return { section: 'A-data-integrity', facts, summary: a03Summarise(checks) };
}
