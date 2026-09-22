// Global variables
let model;
let isTraining = false;

// Initialize application when window loads
window.onload = async function() {
    try {
        // Update status
        updateStatus('Loading MovieLens data...');
        
        // Load data first
        await loadData();
        
        // Populate dropdowns
        populateUserDropdown();
        populateMovieDropdown();
        
        // Update status and start training
        updateStatus('Data loaded. Training model...');
        
        // Train the model
        await trainModel();
        
    } catch (error) {
        console.error('Initialization error:', error);
        updateStatus('Error initializing application: ' + error.message, true);
    }
};

function populateUserDropdown() {
    const userSelect = document.getElementById('user-select');
    userSelect.innerHTML = '';
    
    // Add users (assuming user IDs are sequential from 1 to numUsers)
    for (let i = 1; i <= numUsers; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `User ${i}`;
        userSelect.appendChild(option);
    }
}

function populateMovieDropdown() {
    const movieSelect = document.getElementById('movie-select');
    movieSelect.innerHTML = '';
    
    // Add movies
    movies.forEach(movie => {
        const option = document.createElement('option');
        option.value = movie.id;
        option.textContent = movie.year ? `${movie.title} (${movie.year})` : movie.title;
        movieSelect.appendChild(option);
    });
}

function createModel(numUsers, numMovies, latentDim = 10) {
    // User input
    const userInput = tf.input({shape: [1], name: 'userInput'});
    
    // Movie input  
    const movieInput = tf.input({shape: [1], name: 'movieInput'});
    
    // User embedding
    const userEmbedding = tf.layers.embedding({
        inputDim: numUsers + 1,
        outputDim: latentDim,
        name: 'userEmbedding'
    }).apply(userInput);
    
    // Movie embedding
    const movieEmbedding = tf.layers.embedding({
        inputDim: numMovies + 1,
        outputDim: latentDim, 
        name: 'movieEmbedding'
    }).apply(movieInput);
    
    // Reshape embeddings to flatten them
    const userVector = tf.layers.flatten().apply(userEmbedding);
    const movieVector = tf.layers.flatten().apply(movieEmbedding);
    
    // Dot product of user and movie vectors
    const dotProduct = tf.layers.dot({axes: 1}).apply([userVector, movieVector]);
    
    // Reshape to get a single output value
    const prediction = tf.layers.reshape({targetShape: [1]}).apply(dotProduct);
    
    // Create model
    const model = tf.model({
        inputs: [userInput, movieInput],
        outputs: prediction
    });
    
    return model;
}

async function trainModel() {
    try {
        isTraining = true;
        document.getElementById('predict-btn').disabled = true;
        
        // Create model
        model = createModel(numUsers, numMovies, 10);
        
        // Compile model
        model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'meanSquaredError'
        });
        
        // Prepare training data
        const userIds = ratings.map(r => r.userId);
        const movieIds = ratings.map(r => r.movieId);
        const ratingValues = ratings.map(r => r.rating);
        
        const userTensor = tf.tensor2d(userIds, [userIds.length, 1]);
        const movieTensor = tf.tensor2d(movieIds, [movieIds.length, 1]);
        const ratingTensor = tf.tensor2d(ratingValues, [ratingValues.length, 1]);
        
        // Train model
        updateStatus('Training model... (This may take a moment)');
        
        await model.fit([userTensor, movieTensor], ratingTensor, {
            epochs: 10,
            batchSize: 64,
            validationSplit: 0.1,
            callbacks: {
                onEpochEnd: (epoch, logs) => {
                    updateStatus(`Training epoch ${epoch + 1}/10 - loss: ${logs.loss.toFixed(4)}`);
                }
            }
        });
        
        // Clean up tensors
        tf.dispose([userTensor, movieTensor, ratingTensor]);
        
        // Update UI
        updateStatus('Model training completed successfully!');
        document.getElementById('predict-btn').disabled = false;
        isTraining = false;
        
    } catch (error) {
        console.error('Training error:', error);
        updateStatus('Error training model: ' + error.message, true);
        isTraining = false;
    }
}

async function predictRating() {
    if (isTraining) {
        updateResult('Model is still training. Please wait...', 'medium');
        return;
    }
    
    const userId = parseInt(document.getElementById('user-select').value);
    const movieId = parseInt(document.getElementById('movie-select').value);
    
    if (!userId || !movieId) {
        updateResult('Please select both a user and a movie.', 'medium');
        return;
    }
    
    try {
        // Create input tensors
        const userTensor = tf.tensor2d([[userId]]);
        const movieTensor = tf.tensor2d([[movieId]]);
        
        // Make prediction
        const prediction = model.predict([userTensor, movieTensor]);
        const rating = await prediction.data();
        const predictedRating = rating[0];
        
        // Clean up tensors
        tf.dispose([userTensor, movieTensor, prediction]);
        
        // Display result
        const movie = movies.find(m => m.id === movieId);
        const movieTitle = movie ? (movie.year ? `${movie.title} (${movie.year})` : movie.title) : `Movie ${movieId}`;
        
        let ratingClass = 'medium';
        if (predictedRating >= 4) ratingClass = 'high';
        else if (predictedRating <= 2) ratingClass = 'low';
        
        updateResult(
            `Predicted rating for User ${userId} on "${movieTitle}": <strong>${predictedRating.toFixed(2)}/5</strong>`,
            ratingClass
        );
        
    } catch (error) {
        console.error('Prediction error:', error);
        updateResult('Error making prediction: ' + error.message, 'low');
    }
}

// UI helper functions
function updateStatus(message, isError = false) {
    const statusElement = document.getElementById('status');
    statusElement.textContent = message;
    statusElement.style.borderLeftColor = isError ? '#e74c3c' : '#3498db';
    statusElement.style.background = isError ? '#fdedec' : '#f8f9fa';
}

function updateResult(message, className = '') {
    const resultElement = document.getElementById('result');
    resultElement.innerHTML = message;
    resultElement.className = `result ${className}`;
}
