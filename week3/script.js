// ---------------------------------------------------------------------------
// HW3 — Collaborative Filtering core
//
// Missing-value strategy (see week3/readme.md section 6). Choose EXACTLY ONE
// and keep it consistent in cosineSimilarity below:
//
//   [ ] use co-rated entries only
//   [ ] mean imputation
//   [ ] weight similarity by the number of co-rated items
//
// Delete the two you did not choose.
// ---------------------------------------------------------------------------

// Initialize the application when the window loads
window.onload = async function() {
    const userBased = document.getElementById('user-based-result');
    const itemBased = document.getElementById('item-based-result');

    try {
        userBased.innerHTML = '<p>Loading movie data...</p>';
        itemBased.innerHTML = '<p>Loading movie data...</p>';

        await loadData();

        populateUserDropdown();

        userBased.innerHTML = '<p>Data loaded. Select a user.</p>';
        itemBased.innerHTML = '<p>Data loaded. Select a user.</p>';
    } catch (error) {
        console.error('Initialization error:', error);
        // The error message is already shown by data.js
    }
};

// Populate the user dropdown with one option per user id found in u.data
function populateUserDropdown() {
    const selectElement = document.getElementById('user-select');

    // Clear existing options except the first placeholder
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

// ---------------------------------------------------------------------------
// TODO (HW3) — cosine similarity between two rating vectors.
//
// Compare only co-rated (non-zero) entries, per the missing-value strategy
// you chose above. Return 0 when the denominator is 0 (that is, when the two
// vectors share no rated items). See week3/readme.md section 5.3.
//
// Inputs: two arrays of equal length (slice the rating matrix column or row).
// Output: a number in [0, 1].
// ---------------------------------------------------------------------------
function cosineSimilarity(a, b) {
    // your implementation here
    return 0;
}

// ---------------------------------------------------------------------------
// TODO (HW3) — User-Based CF.
//
// Return the top-K recommendations for the active user as an array of
// { title, score }, sorted by score descending.
//
// Suggested steps (week3/readme.md section 5.4):
//   1. compare the active user's rating vector against every other user
//   2. take the N most similar users with positive similarity (e.g. N = 20)
//   3. for each movie the active user has NOT rated, predict a score as the
//      similarity-weighted average of those users' ratings
//   4. sort and take the top K
// ---------------------------------------------------------------------------
function getUserBasedRecommendations(activeUserId, topK = 5) {
    // your implementation here
    return [];
}

// ---------------------------------------------------------------------------
// TODO (HW3) — Item-Based CF.
//
// Return the top-K recommendations for the active user as an array of
// { title, score }, sorted by score descending.
//
// Suggested steps (week3/readme.md section 5.5):
//   1. for each movie the active user has rated, compute the item-item
//      similarity against every other movie's rating column
//   2. for each candidate movie the active user has NOT rated, aggregate the
//      similarities from the rated movies, weighted by the user's rating
//   3. sort and take the top K
// ---------------------------------------------------------------------------
function getItemBasedRecommendations(activeUserId, topK = 5) {
    // your implementation here
    return [];
}

// Provided — read the selected user and render both recommendation lists
function getRecommendations() {
    const selectElement = document.getElementById('user-select');
    const userId = parseInt(selectElement.value, 10);

    if (isNaN(userId)) {
        renderList('user-based-result', [], 'Please select a user first.');
        renderList('item-based-result', [], 'Please select a user first.');
        return;
    }

    renderList('user-based-result', getUserBasedRecommendations(userId));
    renderList('item-based-result', getItemBasedRecommendations(userId));
}

// Provided — render a list of { title, score } into the given element
function renderList(elementId, items, message) {
    const el = document.getElementById(elementId);

    if (message) {
        el.innerHTML = `<p>${message}</p>`;
        return;
    }

    if (!items || items.length === 0) {
        el.innerHTML = '<p>No recommendations. (Implement the TODO above.)</p>';
        return;
    }

    const entries = items
        .map(item => `<li>${item.title} &mdash; ${Number(item.score).toFixed(3)}</li>`)
        .join('');
    el.innerHTML = `<ul>${entries}</ul>`;
}
