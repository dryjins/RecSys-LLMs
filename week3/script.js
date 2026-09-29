// ---------------------------------------------------------------------------
// HW3 — Collaborative Filtering core
//
// Missing-value strategy (see week3/readme.md section 6):
//
// "Significance-weighted co-rated cosine: missing values are ignored; cosine is
// computed on co-rated positive ratings and multiplied by n/(n+25), where n is
// the number of co-rated entries."
//
// This is the single strategy used by both User-Based and Item-Based CF.
// Mean imputation and matrix factorization are not used anywhere in this file.
// Because cosine runs on positive co-rated ratings, similarity stays in [0, 1]
// and every production neighbour is positively related, as the specification
// requires. No hard minimum-overlap cutoff exists: zero overlap scores 0, and
// thin overlap is shrunk by n/(n+25) and reported as low evidence instead.
// ---------------------------------------------------------------------------

const SIMILARITY_LAMBDA = 25;
const NEIGHBOUR_LIMIT = 20;
const MIN_RATING = 1;
const MAX_RATING = 5;

let moviesById = new Map();

function now() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
}

function yieldToBrowser() {
    return new Promise(resolve => {
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => setTimeout(resolve, 0));
        } else {
            setTimeout(resolve, 0);
        }
    });
}

function refreshMovieIndex() {
    moviesById = new Map();
    for (const movie of movies) {
        if (!moviesById.has(movie.id)) {
            moviesById.set(movie.id, movie);
        }
    }
}

function clampUnit(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    if (value > 1) {
        return 1;
    }
    if (value < 0) {
        return 0;
    }
    return value;
}

function clampRating(value) {
    if (!Number.isFinite(value)) {
        return null;
    }
    if (value < MIN_RATING) {
        return MIN_RATING;
    }
    if (value > MAX_RATING) {
        return MAX_RATING;
    }
    return value;
}

function formatNumber(value) {
    if (!Number.isFinite(value)) {
        return '0';
    }
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function medianOf(values) {
    if (!values || values.length === 0) {
        return 0;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2;
}

// Applies the single documented strategy to already-accumulated dot products
// and sums of squares. Shared by the dense wrapper, the sparse scanners and
// the professor's worked example so no call site can drift.
function similarityFromTotals(dot, sumSquaresLeft, sumSquaresRight, overlap) {
    if (overlap <= 0) {
        return { similarity: 0, rawCosine: 0, overlap: 0 };
    }
    const denominator = Math.sqrt(sumSquaresLeft * sumSquaresRight);
    if (!(denominator > 0) || !Number.isFinite(denominator)) {
        return { similarity: 0, rawCosine: 0, overlap: 0 };
    }
    const rawCosine = clampUnit(dot / denominator);
    const similarity = rawCosine * overlap / (overlap + SIMILARITY_LAMBDA);
    return {
        similarity: clampUnit(similarity),
        rawCosine,
        overlap
    };
}

// Required numeric wrapper over two equal-length rating vectors. A zero entry
// means "not rated" and is skipped, never treated as a rating of 0.
function similarityWithEvidence(a, b) {
    const length = Math.min(a.length, b.length);
    let dot = 0;
    let sumSquaresA = 0;
    let sumSquaresB = 0;
    let overlap = 0;

    for (let index = 0; index < length; index++) {
        const left = a[index];
        const right = b[index];
        if (left === 0 || right === 0) {
            continue;
        }
        overlap++;
        dot += left * right;
        sumSquaresA += left * left;
        sumSquaresB += right * right;
    }

    return similarityFromTotals(dot, sumSquaresA, sumSquaresB, overlap);
}

function cosineSimilarity(a, b) {
    return similarityWithEvidence(a, b).similarity;
}

// Sparse equivalent of similarityWithEvidence for two user rows. Iterates the
// active user's rated items and looks the partner up in the dense matrix, so
// cost is O(ratings of the active user) rather than O(numMovies).
function userSimilarityWithEvidence(userA, userB, hidden) {
    const rowB = ratingMatrix[userB];
    let dot = 0;
    let sumSquaresA = 0;
    let sumSquaresB = 0;
    let overlap = 0;

    for (const entry of userRatings[userA]) {
        const itemId = entry.itemId;
        if (hidden !== null && hidden.userId === userA && hidden.itemId === itemId) {
            continue;
        }
        const right = rowB[itemId];
        if (right === 0) {
            continue;
        }
        if (hidden !== null && hidden.userId === userB && hidden.itemId === itemId) {
            continue;
        }
        const left = entry.rating;
        overlap++;
        dot += left * right;
        sumSquaresA += left * left;
        sumSquaresB += right * right;
    }

    return similarityFromTotals(dot, sumSquaresA, sumSquaresB, overlap);
}

// Sparse equivalent for two item columns.
function itemSimilarityWithEvidence(itemA, itemB, hidden) {
    const listA = itemRatings[itemA] || [];
    const listB = itemRatings[itemB] || [];
    const scanA = listA.length <= listB.length;
    const scan = scanA ? listA : listB;
    const otherItemId = scanA ? itemB : itemA;

    let dot = 0;
    let sumSquaresSelf = 0;
    let sumSquaresOther = 0;
    let overlap = 0;

    for (const entry of scan) {
        const userId = entry.userId;
        if (hidden !== null && hidden.userId === userId &&
            (hidden.itemId === itemA || hidden.itemId === itemB)) {
            continue;
        }
        const other = ratingMatrix[userId][otherItemId];
        if (other === 0) {
            continue;
        }
        const self = entry.rating;
        overlap++;
        dot += self * other;
        sumSquaresSelf += self * self;
        sumSquaresOther += other * other;
    }

    return similarityFromTotals(dot, sumSquaresSelf, sumSquaresOther, overlap);
}

// One pass over the users of `itemId` and everything those users rated, filling
// `sink` with the similarity totals between `itemId` and each co-rated item.
// `sink` maps a candidate id to a Map keyed by the anchor item it was compared
// against, because the prediction rule needs a separate similarity per pair
// rather than one pooled score.
function collectItemNeighbours(itemId, hidden, sink) {
    const perCandidate = new Map();
    for (const entry of itemRatings[itemId]) {
        const userId = entry.userId;
        if (hidden !== null && hidden.userId === userId && hidden.itemId === itemId) {
            continue;
        }
        const self = entry.rating;
        for (const other of userRatings[userId]) {
            const otherItemId = other.itemId;
            if (otherItemId === itemId) {
                continue;
            }
            if (hidden !== null && hidden.userId === userId && hidden.itemId === otherItemId) {
                continue;
            }
            let accumulator = perCandidate.get(otherItemId);
            if (accumulator === undefined) {
                accumulator = { dot: 0, sumSquaresSelf: 0, sumSquaresOther: 0, overlap: 0 };
                perCandidate.set(otherItemId, accumulator);
            }
            const otherRating = other.rating;
            accumulator.dot += self * otherRating;
            accumulator.sumSquaresSelf += self * self;
            accumulator.sumSquaresOther += otherRating * otherRating;
            accumulator.overlap++;
        }
    }

    for (const [candidateId, accumulator] of perCandidate) {
        let byAnchor = sink.get(candidateId);
        if (byAnchor === undefined) {
            byAnchor = new Map();
            sink.set(candidateId, byAnchor);
        }
        byAnchor.set(itemId, accumulator);
    }
}

function userMean(userId, hidden) {
    const count = userRatingCounts[userId];
    if (count === 0) {
        return null;
    }
    if (hidden !== null && hidden.userId === userId) {
        const remaining = count - 1;
        return remaining > 0 ? (userRatingSums[userId] - hidden.rating) / remaining : null;
    }
    return userRatingSums[userId] / count;
}

function itemMean(itemId, hidden) {
    const count = itemRatingCounts[itemId];
    if (count === 0) {
        return null;
    }
    if (hidden !== null && hidden.itemId === itemId) {
        const remaining = count - 1;
        return remaining > 0 ? (itemRatingSums[itemId] - hidden.rating) / remaining : null;
    }
    return itemRatingSums[itemId] / count;
}

// The single aggregation rule, expressed on totals so it can be reused by the
// professor's slide fixture without constructing contribution objects.
// A zero denominator is an explicit fallback, never a silent zero.
function aggregatePredictionTotals(baseline, sumOfEffects, sumOfAbsoluteSimilarities) {
    const safeBaseline = clampRating(baseline);
    const denominator = sumOfAbsoluteSimilarities;
    if (!Number.isFinite(denominator) || denominator <= 0) {
        return {
            predictedRating: safeBaseline,
            baseline: safeBaseline,
            usedFallback: true,
            fallbackReason: 'no-contributors',
            contributorCount: 0,
            denominator: 0,
            overlaps: []
        };
    }
    return {
        predictedRating: clampRating(baseline + sumOfEffects / denominator),
        baseline: safeBaseline,
        usedFallback: false,
        fallbackReason: null,
        contributorCount: 0,
        denominator,
        overlaps: []
    };
}

function aggregatePrediction(baseline, contributions) {
    let sumOfEffects = 0;
    let sumOfAbsoluteSimilarities = 0;
    const overlaps = [];
    for (const contribution of contributions) {
        sumOfEffects += contribution.similarity * contribution.deviation;
        sumOfAbsoluteSimilarities += Math.abs(contribution.similarity);
        if (Number.isFinite(contribution.overlap)) {
            overlaps.push(contribution.overlap);
        }
    }
    const result = aggregatePredictionTotals(baseline, sumOfEffects, sumOfAbsoluteSimilarities);
    result.contributorCount = contributions.length;
    result.overlaps = overlaps;
    return result;
}

function fallbackPrediction(baseline, reason) {
    const safeBaseline = clampRating(baseline);
    return {
        predictedRating: safeBaseline,
        baseline: safeBaseline,
        usedFallback: true,
        fallbackReason: reason,
        contributorCount: 0,
        denominator: 0,
        overlaps: []
    };
}

function withTiming(result, started) {
    result.elapsedMs = now() - started;
    return result;
}

function topUserNeighbours(activeUserId, hidden, limit) {
    const neighbours = [];
    for (let userId = 1; userId <= numUsers; userId++) {
        if (userId === activeUserId) {
            continue;
        }
        const evidence = userSimilarityWithEvidence(activeUserId, userId, hidden);
        if (evidence.similarity > 0) {
            neighbours.push({ userId, similarity: evidence.similarity, overlap: evidence.overlap });
        }
    }
    neighbours.sort((a, b) => b.similarity - a.similarity || a.userId - b.userId);
    return neighbours.slice(0, limit);
}

// prediction(u, i) = userMean(u) + sum(sim * (r(v,i) - userMean(v))) / sum(|sim|)
function predictUserBased(activeUserId, itemId, hidden) {
    const baseline = userMean(activeUserId, hidden);
    if (baseline === null) {
        return fallbackPrediction(globalRatingMean, 'cold-start-user');
    }

    const contributions = [];
    for (const neighbour of topUserNeighbours(activeUserId, hidden, NEIGHBOUR_LIMIT)) {
        if (hidden !== null && hidden.userId === neighbour.userId && hidden.itemId === itemId) {
            continue;
        }
        const rating = ratingMatrix[neighbour.userId][itemId];
        if (rating === 0) {
            continue;
        }
        const mean = userMean(neighbour.userId, hidden);
        if (mean === null) {
            continue;
        }
        contributions.push({
            similarity: neighbour.similarity,
            deviation: rating - mean,
            overlap: neighbour.overlap
        });
    }

    if (contributions.length === 0) {
        return fallbackPrediction(baseline, 'no-contributors');
    }
    return aggregatePrediction(baseline, contributions);
}

// prediction(u, i) = itemMean(i) + sum(sim * (r(u,j) - itemMean(j))) / sum(|sim|)
function predictItemBased(activeUserId, itemId, hidden) {
    const itemBaseline = itemMean(itemId, hidden);
    const userBaseline = userMean(activeUserId, hidden);
    const baseline = itemBaseline !== null ? itemBaseline : userBaseline;
    if (baseline === null) {
        return fallbackPrediction(globalRatingMean, 'cold-start-item');
    }
    if (itemBaseline === null) {
        return fallbackPrediction(baseline, 'cold-start-item');
    }

    const ratedEntries = userRatings[activeUserId].filter(entry =>
        !(hidden !== null && hidden.userId === activeUserId && hidden.itemId === entry.itemId));
    if (ratedEntries.length === 0) {
        return fallbackPrediction(baseline, 'cold-start-user');
    }

    const ranked = [];
    for (const entry of ratedEntries) {
        const evidence = itemSimilarityWithEvidence(itemId, entry.itemId, hidden);
        if (evidence.similarity > 0) {
            ranked.push({
                itemId: entry.itemId,
                rating: entry.rating,
                similarity: evidence.similarity,
                overlap: evidence.overlap
            });
        }
    }
    ranked.sort((a, b) => b.similarity - a.similarity || a.itemId - b.itemId);

    const contributions = [];
    for (const neighbour of ranked.slice(0, NEIGHBOUR_LIMIT)) {
        const mean = itemMean(neighbour.itemId, hidden);
        if (mean === null) {
            continue;
        }
        contributions.push({
            similarity: neighbour.similarity,
            deviation: neighbour.rating - mean,
            overlap: neighbour.overlap
        });
    }

    if (contributions.length === 0) {
        return fallbackPrediction(baseline, 'no-contributors');
    }
    return aggregatePrediction(baseline, contributions);
}

// A documented heuristic, not a calibrated probability.
function evidenceLabelFor(result) {
    if (result.usedFallback) {
        return 'FALLBACK';
    }
    const medianOverlap = medianOf(result.overlaps);
    if (result.contributorCount >= 10 && medianOverlap >= 10 && result.denominator >= 2) {
        return 'HIGH';
    }
    if (result.contributorCount >= 3 && medianOverlap >= 3 && result.denominator >= 0.5) {
        return 'MEDIUM';
    }
    return 'LOW';
}

function canonicalTitlesFor(entries) {
    const titles = new Set();
    for (const entry of entries) {
        const movie = moviesById.get(entry.itemId);
        if (movie !== undefined) {
            titles.add(movie.canonicalTitle);
        }
    }
    return titles;
}

function toRecommendation(movie, prediction) {
    return {
        id: movie.id,
        title: movie.title,
        score: prediction.predictedRating,
        contributorCount: prediction.contributorCount,
        denominator: prediction.denominator,
        medianOverlap: medianOf(prediction.overlaps),
        evidenceLabel: evidenceLabelFor(prediction)
    };
}

function selectTop(candidates, topK) {
    candidates.sort((a, b) =>
        b.score - a.score ||
        b.contributorCount - a.contributorCount ||
        a.title.localeCompare(b.title) ||
        a.id - b.id);

    const picked = [];
    const seenCanonical = new Set();
    for (const candidate of candidates) {
        const canonical = moviesById.get(candidate.id).canonicalTitle;
        if (seenCanonical.has(canonical)) {
            continue;
        }
        seenCanonical.add(canonical);
        picked.push(candidate);
        if (picked.length === topK) {
            break;
        }
    }
    return picked;
}

function getUserBasedRecommendations(activeUserId, topK = 5) {
    const started = now();
    const ratedEntries = userRatings[activeUserId] || [];
    if (ratedEntries.length === 0) {
        const empty = [];
        empty.elapsedMs = now() - started;
        return empty;
    }

    const baseline = userMean(activeUserId, null);
    const ratedItemIds = new Set(ratedEntries.map(entry => entry.itemId));
    const ratedCanonical = canonicalTitlesFor(ratedEntries);
    const neighbours = topUserNeighbours(activeUserId, null, NEIGHBOUR_LIMIT);

    const candidates = [];
    for (const [itemId, movie] of moviesById) {
        if (ratedItemIds.has(itemId) || ratedCanonical.has(movie.canonicalTitle)) {
            continue;
        }
        const contributions = [];
        for (const neighbour of neighbours) {
            const rating = ratingMatrix[neighbour.userId][itemId];
            if (rating === 0) {
                continue;
            }
            const mean = userMean(neighbour.userId, null);
            if (mean === null) {
                continue;
            }
            contributions.push({
                similarity: neighbour.similarity,
                deviation: rating - mean,
                overlap: neighbour.overlap
            });
        }
        if (contributions.length === 0) {
            continue;
        }
        const prediction = aggregatePrediction(baseline, contributions);
        if (prediction.usedFallback) {
            continue;
        }
        candidates.push(toRecommendation(movie, prediction));
    }

    return withTiming(selectTop(candidates, topK), started);
}

function getItemBasedRecommendations(activeUserId, topK = 5) {
    const started = now();
    const ratedEntries = userRatings[activeUserId] || [];
    if (ratedEntries.length === 0) {
        const empty = [];
        empty.elapsedMs = now() - started;
        return empty;
    }

    const ratedByItem = new Map(ratedEntries.map(entry => [entry.itemId, entry.rating]));
    const ratedCanonical = canonicalTitlesFor(ratedEntries);

    const sink = new Map();
    for (const entry of ratedEntries) {
        collectItemNeighbours(entry.itemId, null, sink);
    }

    const candidates = [];
    for (const [itemId, byAnchor] of sink) {
        if (ratedByItem.has(itemId)) {
            continue;
        }
        const movie = moviesById.get(itemId);
        if (movie === undefined || ratedCanonical.has(movie.canonicalTitle)) {
            continue;
        }
        const baseline = itemMean(itemId, null);
        if (baseline === null) {
            continue;
        }

        const ranked = [];
        for (const [anchorId, accumulator] of byAnchor) {
            const evidence = similarityFromTotals(
                accumulator.dot,
                accumulator.sumSquaresSelf,
                accumulator.sumSquaresOther,
                accumulator.overlap
            );
            if (evidence.similarity > 0) {
                ranked.push({
                    itemId: anchorId,
                    similarity: evidence.similarity,
                    overlap: evidence.overlap
                });
            }
        }
        ranked.sort((a, b) => b.similarity - a.similarity || a.itemId - b.itemId);

        const contributions = [];
        for (const neighbour of ranked.slice(0, NEIGHBOUR_LIMIT)) {
            const rating = ratedByItem.get(neighbour.itemId);
            const mean = itemMean(neighbour.itemId, null);
            if (rating === undefined || mean === null) {
                continue;
            }
            contributions.push({
                similarity: neighbour.similarity,
                deviation: rating - mean,
                overlap: neighbour.overlap
            });
        }
        if (contributions.length === 0) {
            continue;
        }
        const prediction = aggregatePrediction(baseline, contributions);
        if (prediction.usedFallback) {
            continue;
        }
        candidates.push(toRecommendation(movie, prediction));
    }

    return withTiming(selectTop(candidates, topK), started);
}

// The professor's item-based worked example. Signed similarities and the
// printed row values are reproduced verbatim from the slide, where they are
// already rounded, so the rounded-row aggregate and the printed slide totals
// disagree in the third decimal while both round to 2.58.
const PROFESSOR_EXAMPLE = {
    baseline: 3.67,
    sumOfEffects: -2.764,
    sumOfAbsoluteSimilarities: 2.543,
    expectedPrediction: 2.58,
    rows: [
        { label: 'Star Wars', rating: 5, itemMean: 3.33, similarity: -0.99, effect: -1.65 },
        { label: 'Dune', rating: 3, itemMean: 3.00, similarity: 0.72, effect: 0 },
        { label: 'Interstellar', rating: 5, itemMean: 3.67, similarity: -0.84, effect: -1.12 }
    ]
};

function professorWorkedExample() {
    const fromSlideTotals = aggregatePredictionTotals(
        PROFESSOR_EXAMPLE.baseline,
        PROFESSOR_EXAMPLE.sumOfEffects,
        PROFESSOR_EXAMPLE.sumOfAbsoluteSimilarities
    );
    const fromRoundedRows = aggregatePrediction(
        PROFESSOR_EXAMPLE.baseline,
        PROFESSOR_EXAMPLE.rows.map(row => ({
            similarity: row.similarity,
            deviation: row.rating - row.itemMean,
            overlap: null
        }))
    );
    return { fromSlideTotals, fromRoundedRows };
}

function predictTargetPair(activeUserId, itemId) {
    const observed = ratingMatrix[activeUserId] ? ratingMatrix[activeUserId][itemId] : 0;
    const hasObserved = observed > 0;
    // One masking record, consulted by every mean, every similarity
    // intersection and every prediction sum below, then simply dropped.
    const hidden = hasObserved ? { userId: activeUserId, itemId, rating: observed } : null;

    const userStarted = now();
    const userBased = predictUserBased(activeUserId, itemId, hidden);
    userBased.elapsedMs = now() - userStarted;

    const itemStarted = now();
    const itemBased = predictItemBased(activeUserId, itemId, hidden);
    itemBased.elapsedMs = now() - itemStarted;

    return {
        movie: moviesById.get(itemId),
        observed: hasObserved ? observed : null,
        userBased,
        itemBased
    };
}

// Initialize the application when the window loads
window.onload = async function() {
    const userBased = document.getElementById('user-based-result');
    const itemBased = document.getElementById('item-based-result');

    try {
        userBased.textContent = 'Loading movie data...';
        itemBased.textContent = 'Loading movie data...';
        setStatus('Loading MovieLens 100K data...');

        await loadData();

        refreshMovieIndex();
        populateUserDropdown();
        populateMovieDropdown();

        userBased.textContent = 'Data loaded. Select a user.';
        itemBased.textContent = 'Data loaded. Select a user.';
        setStatus(`Loaded ${numUsers} users, ${numMovies} movies, ${ratings.length} ratings.`);
    } catch (error) {
        console.error('Initialization error:', error);
        setStatus('Failed to load data.');
    }
};

// Populate the user dropdown with one option per user id found in u.data
function populateUserDropdown() {
    const selectElement = document.getElementById('user-select');
    if (!selectElement) {
        return;
    }

    while (selectElement.options.length > 1) {
        selectElement.remove(1);
    }

    for (let userId = 1; userId <= numUsers; userId++) {
        const option = document.createElement('option');
        option.value = userId;
        option.textContent = `User ${userId}`;
        selectElement.appendChild(option);
    }
}

function populateMovieDropdown() {
    const selectElement = document.getElementById('movie-select');
    if (!selectElement) {
        return;
    }

    // index.html ships one placeholder option already, so the list is cleared
    // down to zero entries rather than down to the first one. Keeping index 0
    // and appending another placeholder would leave two of them.
    while (selectElement.options.length > 0) {
        selectElement.remove(0);
    }

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'No target movie (Top-5 only)';
    selectElement.appendChild(placeholder);

    const sorted = [...movies].sort((a, b) => a.title.localeCompare(b.title));
    for (const movie of sorted) {
        const option = document.createElement('option');
        option.value = movie.id;
        // "unknown" is a flag, not a genre, so a movie with no genre flags
        // gets no parenthetical rather than a misleading label.
        option.textContent = movie.genres.length > 0
            ? `${movie.title} (${movie.genres.join(', ')})`
            : movie.title;
        selectElement.appendChild(option);
    }
}

function createElement(tagName, className, text) {
    const node = document.createElement(tagName);
    if (className) {
        node.className = className;
    }
    if (text !== undefined && text !== null) {
        node.textContent = String(text);
    }
    return node;
}

function setStatus(message) {
    const status = document.getElementById('status');
    if (status) {
        status.textContent = message;
    }
}

function evidenceBadge(label) {
    return createElement('span', `evidence evidence-${label.toLowerCase()}`, label);
}

function renderList(elementId, items, message) {
    const container = document.getElementById(elementId);
    if (!container) {
        return;
    }

    container.textContent = '';
    container.classList.remove('error');

    if (message) {
        container.appendChild(createElement('p', null, message));
        return;
    }
    if (!items || items.length === 0) {
        container.appendChild(createElement('p', null, 'No supported recommendations for this user.'));
        return;
    }

    const list = createElement('ul', 'rec-list');
    items.forEach((item, index) => {
        const row = createElement('li', 'rec-item');
        row.appendChild(createElement('span', 'rec-rank', `${index + 1}.`));
        row.appendChild(createElement('span', 'rec-title', item.title));
        row.appendChild(createElement('span', 'rec-score', item.score.toFixed(2)));
        row.appendChild(evidenceBadge(item.evidenceLabel));
        row.appendChild(createElement('span', 'rec-meta',
            `${item.contributorCount} contributors · overlap ${formatNumber(item.medianOverlap)}`));
        list.appendChild(row);
    });
    container.appendChild(list);
}

function appendDetail(list, term, value) {
    list.appendChild(createElement('dt', null, term));
    list.appendChild(createElement('dd', null, value));
}

function buildPredictionCard(label, result) {
    const card = createElement('div', result.usedFallback ? 'prediction-card is-fallback' : 'prediction-card');
    card.appendChild(createElement('h4', null, label));

    const headline = result.usedFallback
        ? `baseline ${result.baseline.toFixed(2)} (fallback)`
        : result.predictedRating.toFixed(2);
    card.appendChild(createElement('p', 'prediction-value', headline));
    card.appendChild(evidenceBadge(evidenceLabelFor(result)));

    const detail = createElement('dl', 'prediction-detail');
    appendDetail(detail, 'Baseline', result.baseline.toFixed(2));
    appendDetail(detail, 'Contributors', String(result.contributorCount));
    appendDetail(detail, 'Denominator', result.denominator.toFixed(3));
    appendDetail(detail, 'Median overlap', formatNumber(medianOf(result.overlaps)));
    appendDetail(detail, 'Elapsed', `${formatNumber(result.elapsedMs)} ms`);
    if (result.usedFallback) {
        appendDetail(detail, 'Fallback reason', result.fallbackReason);
    }
    card.appendChild(detail);
    return card;
}

function renderTargetPanel(payload) {
    const panel = document.getElementById('target-result');
    if (!panel) {
        return;
    }

    panel.textContent = '';
    if (!payload) {
        panel.appendChild(createElement('p', 'muted',
            'Select a target movie to compare a single predicted rating.'));
        return;
    }

    panel.appendChild(createElement('h3', null, payload.movie.title));
    if (payload.observed !== null) {
        panel.appendChild(createElement('p', 'observed',
            `Observed rating ${payload.observed.toFixed(0)} — held out of the calculation below.`));
    } else {
        panel.appendChild(createElement('p', 'muted', 'Not yet rated by this user.'));
    }

    const grid = createElement('div', 'prediction-grid');
    grid.appendChild(buildPredictionCard('User-Based', payload.userBased));
    grid.appendChild(buildPredictionCard('Item-Based', payload.itemBased));
    panel.appendChild(grid);
}

// Provided — read the selected user and render both recommendation lists
async function getRecommendations() {
    const selectElement = document.getElementById('user-select');
    const userId = Number.parseInt(selectElement.value, 10);

    if (!Number.isInteger(userId)) {
        renderList('user-based-result', [], 'Please select a user first.');
        renderList('item-based-result', [], 'Please select a user first.');
        renderTargetPanel(null);
        setStatus('Select a user to begin.');
        return;
    }

    if (moviesById.size !== movies.length) {
        refreshMovieIndex();
    }

    setStatus('Computing User-Based CF...');
    await yieldToBrowser();
    const started = now();
    const userBased = getUserBasedRecommendations(userId);

    setStatus('Computing Item-Based CF...');
    await yieldToBrowser();
    const itemBased = getItemBasedRecommendations(userId);

    renderList('user-based-result', userBased);
    renderList('item-based-result', itemBased);

    const movieSelect = document.getElementById('movie-select');
    const itemId = Number.parseInt(movieSelect ? movieSelect.value : '', 10);
    if (Number.isInteger(itemId)) {
        setStatus('Computing target prediction...');
        await yieldToBrowser();
        renderTargetPanel(predictTargetPair(userId, itemId));
    } else {
        renderTargetPanel(null);
    }

    setStatus(`Done in ${formatNumber(now() - started)} ms — ` +
        `User-Based ${formatNumber(userBased.elapsedMs)} ms, Item-Based ${formatNumber(itemBased.elapsedMs)} ms.`);
}
