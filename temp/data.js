// Global variables to store parsed data
let movies = [];
let ratings = [];
let numUsers = 0;
let numMovies = 0;

// Movie data structure: { id: number, title: string, year: number }
// Rating data structure: { userId: number, movieId: number, rating: number }

async function loadData() {
    try {
        // Load movie data
        const movieResponse = await fetch('u.item');
        const movieText = await movieResponse.text();
        movies = parseItemData(movieText);
        numMovies = movies.length;

        // Load rating data
        const ratingResponse = await fetch('u.data');
        const ratingText = await ratingResponse.text();
        ratings = parseRatingData(ratingText);
        
        // Calculate number of unique users
        const uniqueUsers = new Set(ratings.map(r => r.userId));
        numUsers = uniqueUsers.size;

        console.log(`Loaded ${movies.length} movies and ${ratings.length} ratings from ${numUsers} users`);
        
        return { movies, ratings, numUsers, numMovies };
    } catch (error) {
        console.error('Error loading data:', error);
        throw error;
    }
}

function parseItemData(text) {
    const lines = text.split('\n');
    const movieData = [];
    
    for (const line of lines) {
        if (line.trim() === '') continue;
        
        const parts = line.split('|');
        if (parts.length >= 2) {
            const id = parseInt(parts[0]);
            // Extract title and year from the title field (format: "Title (Year)")
            const titleMatch = parts[1].match(/(.+)\s+\((\d{4})\)$/);
            let title = parts[1];
            let year = null;
            
            if (titleMatch) {
                title = titleMatch[1].trim();
                year = parseInt(titleMatch[2]);
            }
            
            movieData.push({
                id: id,
                title: title,
                year: year
            });
        }
    }
    
    return movieData;
}

function parseRatingData(text) {
    const lines = text.split('\n');
    const ratingData = [];
    
    for (const line of lines) {
        if (line.trim() === '') continue;
        
        const parts = line.split('\t');
        if (parts.length >= 3) {
            ratingData.push({
                userId: parseInt(parts[0]),
                movieId: parseInt(parts[1]),
                rating: parseFloat(parts[2])
            });
        }
    }
    
    return ratingData;
}
