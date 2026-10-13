// Global variables for storing movie and rating data
let movies = [];
let ratings = [];

// Collaborative filtering structures (populated by buildRatingMatrix)
let numUsers = 0;
let numMovies = 0;
let ratingMatrix = null;

// Sparse structures. userRatings[userId] and itemRatings[itemId] hold the
// non-zero entries only, so similarity never scans the 93.7% empty matrix.
// The running sums let a single hidden interaction be removed in O(1), which
// is what keeps a held-out rating out of its own prediction.
let userRatings = [];
let itemRatings = [];
let userRatingSums = null;
let userRatingCounts = null;
let itemRatingSums = null;
let itemRatingCounts = null;
let globalRatingMean = 0;

let dataDiagnostics = { itemRows: 0, ratingRows: 0, malformedItemRows: 0, malformedRatingRows: 0 };

// u.item rows carry exactly 24 pipe-separated fields:
//   0 id | 1 title | 2 release date | 3 video release date | 4 IMDb URL | 5..23 genre flags
// Field 5 is the "unknown" flag and is not one of the 18 meaningful genres, so
// fields 6..23 hold Action through Western. Reading field 5 as "Action" is what
// shifted every genre by one and dropped Western in the original scaffold.
const ITEM_FIELD_COUNT = 24;
const UNKNOWN_FLAG_FIELD = 5;
const GENRE_FLAG_START = 6;

const genreNames = [
    "Action", "Adventure", "Animation", "Children's", "Comedy",
    "Crime", "Documentary", "Drama", "Fantasy", "Film-Noir",
    "Horror", "Musical", "Mystery", "Romance", "Sci-Fi",
    "Thriller", "War", "Western"
];

// MovieLens u.item is Latin-1 encoded. TextDecoder honours the label here,
// whereas response.text() would always assume UTF-8 and corrupt 9 titles.
const itemDecoder = new TextDecoder('windows-1252');

function resetDataStructures() {
    movies = [];
    ratings = [];
    numUsers = 0;
    numMovies = 0;
    ratingMatrix = null;
    userRatings = [];
    itemRatings = [];
    userRatingSums = null;
    userRatingCounts = null;
    itemRatingSums = null;
    itemRatingCounts = null;
    globalRatingMean = 0;
    dataDiagnostics = { itemRows: 0, ratingRows: 0, malformedItemRows: 0, malformedRatingRows: 0 };
}

// Primary function to load data from files
async function loadData() {
    resetDataStructures();
    try {
        const moviesResponse = await fetch('u.item');
        if (!moviesResponse.ok) {
            throw new Error(`Failed to load movie data: ${moviesResponse.status}`);
        }
        const itemText = itemDecoder.decode(await moviesResponse.arrayBuffer());
        parseItemData(itemText);

        const ratingsResponse = await fetch('u.data');
        if (!ratingsResponse.ok) {
            throw new Error(`Failed to load rating data: ${ratingsResponse.status}`);
        }
        parseRatingData(await ratingsResponse.text());

        numUsers = ratings.reduce((max, r) => Math.max(max, r.userId), 0);
        numMovies = movies.length;
        buildRatingMatrix();
    } catch (error) {
        console.error('Error loading data:', error);
        reportLoadError(error);
        throw error;
    }
}

function reportLoadError(error) {
    if (typeof document === 'undefined') {
        return;
    }
    const errorTarget = document.getElementById('user-based-result');
    if (errorTarget) {
        errorTarget.textContent =
            `Error: ${error.message}. Please make sure u.item and u.data are in the correct location.`;
        errorTarget.classList.add('error');
    }
}

// Trim, collapse runs of whitespace and lowercase. The trailing year is kept
// because it is part of the displayed title and helps separate remakes.
function buildCanonicalTitle(title) {
    return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

// Parse movie data from u.item format
function parseItemData(text) {
    const lines = text.split('\n');

    for (const line of lines) {
        if (line.trim() === '') {
            continue;
        }

        const fields = line.split('|');
        if (fields.length !== ITEM_FIELD_COUNT) {
            dataDiagnostics.malformedItemRows++;
            continue;
        }

        const id = Number.parseInt(fields[0], 10);
        const title = fields[1].trim();
        if (!Number.isInteger(id) || id < 1 || title === '') {
            dataDiagnostics.malformedItemRows++;
            continue;
        }

        const unknownGenre = fields[UNKNOWN_FLAG_FIELD] === '1';
        const genres = [];
        for (let offset = 0; offset < genreNames.length; offset++) {
            if (fields[GENRE_FLAG_START + offset] === '1') {
                genres.push(genreNames[offset]);
            }
        }

        movies.push({ id, title, canonicalTitle: buildCanonicalTitle(title), unknownGenre, genres });
    }

    dataDiagnostics.itemRows = movies.length;
}

// Parse rating data from u.data format
function parseRatingData(text) {
    const lines = text.split('\n');

    for (const line of lines) {
        if (line.trim() === '') {
            continue;
        }

        const fields = line.split('\t');
        if (fields.length !== 4) {
            dataDiagnostics.malformedRatingRows++;
            continue;
        }

        const userId = Number.parseInt(fields[0], 10);
        const itemId = Number.parseInt(fields[1], 10);
        const rating = Number.parseFloat(fields[2]);
        const timestamp = Number.parseInt(fields[3], 10);

        const valid = Number.isInteger(userId) && userId >= 1 &&
            Number.isInteger(itemId) && itemId >= 1 &&
            Number.isFinite(rating) && rating >= 1 && rating <= 5 &&
            Number.isInteger(timestamp);
        if (!valid) {
            dataDiagnostics.malformedRatingRows++;
            continue;
        }

        ratings.push({ userId, itemId, rating, timestamp });
    }

    dataDiagnostics.ratingRows = ratings.length;
}

// Builds the dense (numUsers + 1) x (numMovies + 1) matrix required by
// week3/readme.md section 4.5 plus the sparse side structures. Rows are
// Float32Array: 1..5 are exact and a missing entry stays 0, which is
// unambiguous because MovieLens never uses 0 as a rating.
function buildRatingMatrix() {
    const maxItemId = movies.reduce((max, movie) => Math.max(max, movie.id), 0);
    const width = Math.max(maxItemId, numMovies) + 1;

    ratingMatrix = new Array(numUsers + 1);
    userRatings = new Array(numUsers + 1);
    itemRatings = new Array(width);
    userRatingSums = new Float64Array(numUsers + 1);
    userRatingCounts = new Int32Array(numUsers + 1);
    itemRatingSums = new Float64Array(width);
    itemRatingCounts = new Int32Array(width);

    for (let userId = 1; userId <= numUsers; userId++) {
        ratingMatrix[userId] = new Float32Array(width);
        userRatings[userId] = [];
    }
    for (let itemId = 0; itemId < width; itemId++) {
        itemRatings[itemId] = [];
    }

    let grandSum = 0;
    for (const record of ratings) {
        if (record.userId < 1 || record.userId > numUsers) {
            continue;
        }
        if (record.itemId < 1 || record.itemId >= width) {
            continue;
        }

        ratingMatrix[record.userId][record.itemId] = record.rating;
        userRatings[record.userId].push({ itemId: record.itemId, rating: record.rating });
        itemRatings[record.itemId].push({ userId: record.userId, rating: record.rating });
        userRatingSums[record.userId] += record.rating;
        userRatingCounts[record.userId]++;
        itemRatingSums[record.itemId] += record.rating;
        itemRatingCounts[record.itemId]++;
        grandSum += record.rating;
    }

    globalRatingMean = ratings.length > 0 ? grandSum / ratings.length : 0;
}
