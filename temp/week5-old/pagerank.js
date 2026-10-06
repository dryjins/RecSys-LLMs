// pagerank.js
/**
 * Computes PageRank scores for nodes in a graph using TensorFlow.js
 * @param {Object} adjacencyList - Graph represented as adjacency list
 * @param {number} iterations - Number of PageRank iterations
 * @param {number} dampingFactor - Damping factor (typically 0.85)
 * @returns {Promise<Object>} Object mapping node IDs to PageRank scores
 */
async function computePageRank(adjacencyList, iterations = 50, dampingFactor = 0.85) {
    const nodeIds = Object.keys(adjacencyList).map(Number).sort((a, b) => a - b);
    const n = nodeIds.length;
    
    // Create node ID to index mapping
    const nodeToIndex = {};
    nodeIds.forEach((id, index) => {
        nodeToIndex[id] = index;
    });

    // Build transition matrix M
    const M = [];
    for (let i = 0; i < n; i++) {
        M[i] = new Array(n).fill(0);
    }

    // Fill transition matrix
    nodeIds.forEach(sourceId => {
        const sourceIndex = nodeToIndex[sourceId];
        const neighbors = adjacencyList[sourceId];
        const outDegree = neighbors.length;
        
        if (outDegree === 0) {
            // Handle dangling nodes by distributing evenly
            for (let j = 0; j < n; j++) {
                M[j][sourceIndex] = 1 / n;
            }
        } else {
            neighbors.forEach(targetId => {
                const targetIndex = nodeToIndex[targetId];
                M[targetIndex][sourceIndex] = 1 / outDegree;
            });
        }
    });

    // Convert to TensorFlow tensors
    const M_tensor = tf.tensor2d(M);
    const damping_tensor = tf.scalar(dampingFactor);
    const teleport_tensor = tf.scalar((1 - dampingFactor) / n);
    const ones_tensor = tf.ones([n, 1]);

    // Initialize PageRank vector
    let pr_vector = tf.ones([n, 1]).div(tf.scalar(n));

    // Power iteration
    for (let iter = 0; iter < iterations; iter++) {
        const term1 = M_tensor.matMul(pr_vector).mul(damping_tensor);
        const term2 = ones_tensor.mul(teleport_tensor);
        pr_vector = term1.add(term2);
        
        // Normalize
        const sum = pr_vector.sum();
        pr_vector = pr_vector.div(sum);
    }

    // Get final scores
    const scores = await pr_vector.array();
    
    // Clean up tensors
    M_tensor.dispose();
    damping_tensor.dispose();
    teleport_tensor.dispose();
    ones_tensor.dispose();
    pr_vector.dispose();

    // Map scores back to node IDs
    const result = {};
    nodeIds.forEach((id, index) => {
        result[id] = scores[index][0];
    });

    return result;
}
