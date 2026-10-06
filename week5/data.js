// ---------------------------------------------------------------------------
// week5/data.js — MovieLens 100k data layer (classic <script>, no modules)
//
// Loads u.item (movies) and u.data (ratings), builds a sparse-friendly
// rating matrix, and splits every user's ratings chronologically 80/10/10.
//
// Genre alignment note (fixes the Week-2 off-by-one):
//   A u.item row has 24 '|'-separated fields:
//     0 id | 1 title | 2 release | 3 video | 4 url | 5 unknown |
//     6 Action | 7 Adventure | ... | 23 Western
//   Field index 5 is the legacy 19th genre flag "unknown", NOT the first real
//   genre. The 18 real flags therefore live at indices 6..23, so we read them
//   with fields.slice(6, 24) and pair them with the 18-name `genreNames`
//   list below. (The earlier fields.slice(5, 24) + 18 names pairing was off
//   by one.)
// ---------------------------------------------------------------------------

// Global variables for storing movie and rating data
let movies = [];          // [{ id, title, genres: string[] }]
let ratings = [];         // [{ userId, movieId, rating, timestamp }]

// Collaborative filtering structures (populated by buildRatingMatrix)
let numUsers = 0;         // highest user id found in u.data
let numMovies = 0;        // number of parsed movies
let ratingMatrix = null;  // (numUsers + 1) x (maxMovieId + 1); 0 = unobserved

// Genre names for the 18 real flags (u.item field indices 6..23)
const genreNames = [
    "Action", "Adventure", "Animation", "Children's", "Comedy",
    "Crime", "Documentary", "Drama", "Fantasy", "Film-Noir",
    "Horror", "Musical", "Mystery", "Romance", "Sci-Fi",
    "Thriller", "War", "Western"
];

// Users skipped while splitting (e.g. too few ratings), collected by
// splitByTimestamp() for reporting.
let SPLIT_EXCLUSIONS = [];

// Primary function to load data from files
async function loadData() {
    try {
        // Load and parse movie data
        const moviesResponse = await fetch('u.item');
        if (!moviesResponse.ok) {
            throw new Error(`Failed to load movie data: ${moviesResponse.status}`);
        }
        const moviesText = await moviesResponse.text();
        parseItemData(moviesText);

        // Load and parse rating data
        const ratingsResponse = await fetch('u.data');
        if (!ratingsResponse.ok) {
            throw new Error(`Failed to load rating data: ${ratingsResponse.status}`);
        }
        const ratingsText = await ratingsResponse.text();
        parseRatingData(ratingsText);

        // Derive matrix dimensions, then build the rating matrix
        numUsers = ratings.reduce((max, r) => Math.max(max, r.userId), 0);
        numMovies = movies.length;
        buildRatingMatrix();
    } catch (error) {
        console.error('Error loading data:', error);
        const errorTarget = document.getElementById('result');
        if (errorTarget) {
            errorTarget.textContent =
                `Error: ${error.message}. Please make sure u.item and u.data are in the correct location.`;
            errorTarget.className = 'error';
        }
        throw error; // Re-throw so the page script can handle the error
    }
}

// Parse movie data from u.item format: "id|title|release|video|url|g0|...|g18"
// genreNames has 18 entries, matched against the real flags at indices 6..23.
function parseItemData(text) {
    const lines = text.split('\n');

    for (const line of lines) {
        if (line.trim() === '') continue;

        const fields = line.split('|');
        if (fields.length < 24) continue; // Skip malformed rows

        const id = parseInt(fields[0]);
        const title = fields[1];

        // Read the 18 real genre flags (index 5 is the 'unknown' placeholder)
        const genreValues = fields.slice(6, 24).map(value => parseInt(value));
        const genres = genreNames.filter((_, index) => genreValues[index] === 1);

        movies.push({ id, title, genres });
    }
}

// Parse rating data from u.data format: "userId\tmovieId\trating\ttimestamp"
function parseRatingData(text) {
    const lines = text.split('\n');

    for (const line of lines) {
        if (line.trim() === '') continue;

        const fields = line.split('\t');
        if (fields.length < 4) continue; // Skip malformed rows

        const userId = parseInt(fields[0]);
        const movieId = parseInt(fields[1]);
        const rating = parseFloat(fields[2]);
        const timestamp = parseInt(fields[3]);

        ratings.push({ userId, movieId, rating, timestamp });
    }
}

// Build the sparse-friendly rating matrix.
// Shape: (numUsers + 1) x (maxMovieId + 1), indexed by raw ids, so that
//   ratingMatrix[userId][movieId] === rating
// and an unobserved pair is 0. MovieLens ratings are 1-5, so 0 is unambiguous.
function buildRatingMatrix() {
    const maxMovieId = movies.reduce((max, m) => Math.max(max, m.id), 0);

    ratingMatrix = [];
    for (let u = 0; u <= numUsers; u++) {
        ratingMatrix.push(new Array(maxMovieId + 1).fill(0));
    }

    for (const r of ratings) {
        if (r.userId <= numUsers && r.movieId <= maxMovieId) {
            ratingMatrix[r.userId][r.movieId] = r.rating;
        }
    }
}

// TODO(hw5): split EACH user's ratings by ascending timestamp into 80/10/10.
// Returns { train, val, test }, each an array of the same
// { userId, movieId, rating, timestamp } objects.
//
// Rules:
//   - counts are deterministic: nTrain = floor(0.8 * n), nVal = floor(0.1 * n),
//     nTest = n - nTrain - nVal (the remainder)
//   - users with fewer than 5 ratings are skipped and recorded in
//     SPLIT_EXCLUSIONS
//   - timestamp ties are broken by movieId so the split is deterministic
function splitByTimestamp() {
    const MIN_RATINGS = 5;

    const byUser = new Map();
    for (const r of ratings) {
        if (!byUser.has(r.userId)) byUser.set(r.userId, []);
        byUser.get(r.userId).push(r);
    }

    const train = [];
    const val = [];
    const test = [];

    SPLIT_EXCLUSIONS = [];

    for (const [userId, userRatings] of byUser) {
        const n = userRatings.length;
        if (n < MIN_RATINGS) {
            SPLIT_EXCLUSIONS.push({
                userId,
                count: n,
                reason: `fewer than ${MIN_RATINGS} ratings`
            });
            continue;
        }

        const sorted = userRatings.slice().sort((a, b) =>
            a.timestamp - b.timestamp || a.movieId - b.movieId
        );

        const nTrain = Math.floor(0.8 * n);
        const nVal = Math.floor(0.1 * n);

        for (let i = 0; i < n; i++) {
            if (i < nTrain) train.push(sorted[i]);
            else if (i < nTrain + nVal) val.push(sorted[i]);
            else test.push(sorted[i]);
        }
    }

    return { train, val, test };
}
