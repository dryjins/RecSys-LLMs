// app.js
class PageRankApp {
    constructor() {
        this.graph = null;
        this.pageRankScores = null;
        this.selectedNode = null;
        this.isComputing = false;
        
        this.initializeEventListeners();
        this.loadDefaultData();
    }

    initializeEventListeners() {
        document.getElementById('computeBtn').addEventListener('click', () => this.computePageRank());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetGraph());
    }

    async loadDefaultData() {
        try {
            // Load the karate club dataset
            const response = await fetch('data/karate.csv');
            const csvText = await response.text();
            this.graph = this.parseCSVToGraph(csvText);
            this.renderGraph();
            this.updateTable();
        } catch (error) {
            console.error('Error loading data:', error);
            alert('Error loading graph data. Please check if data/karate.csv exists.');
        }
    }

    parseCSVToGraph(csvText) {
        const edges = [];
        const nodes = new Set();
        
        const lines = csvText.trim().split('\n');
        for (const line of lines) {
            const [source, target] = line.split(',').map(Number);
            edges.push({ source, target });
            nodes.add(source);
            nodes.add(target);
        }

        // Create adjacency list
        const adjacencyList = {};
        Array.from(nodes).sort((a, b) => a - b).forEach(node => {
            adjacencyList[node] = [];
        });

        edges.forEach(edge => {
            adjacencyList[edge.source].push(edge.target);
            adjacencyList[edge.target].push(edge.source); // Undirected graph
        });

        return {
            nodes: Array.from(nodes).sort((a, b) => a - b).map(id => ({ id })),
            edges: edges,
            adjacencyList: adjacencyList
        };
    }

    async computePageRank() {
        if (this.isComputing) return;
        
        this.isComputing = true;
        document.getElementById('computeBtn').disabled = true;
        document.getElementById('computeBtn').textContent = 'Computing...';

        try {
            this.pageRankScores = await computePageRank(this.graph.adjacencyList, 50, 0.85);
            this.updateTable();
            this.renderGraph();
        } catch (error) {
            console.error('Error computing PageRank:', error);
            alert('Error computing PageRank scores.');
        } finally {
            this.isComputing = false;
            document.getElementById('computeBtn').disabled = false;
            document.getElementById('computeBtn').textContent = 'Compute PageRank';
        }
    }

    resetGraph() {
        this.pageRankScores = null;
        this.selectedNode = null;
        this.loadDefaultData();
        document.getElementById('nodeDetails').innerHTML = '<p>Click on a node in the graph or table to see details</p>';
    }

    updateTable() {
        const tableBody = document.getElementById('tableBody');
        tableBody.innerHTML = '';

        this.graph.nodes.forEach(node => {
            const row = document.createElement('tr');
            row.dataset.nodeId = node.id;
            
            const friends = this.graph.adjacencyList[node.id] || [];
            const pageRank = this.pageRankScores ? this.pageRankScores[node.id].toFixed(4) : 'N/A';
            
            row.innerHTML = `
                <td>${node.id}</td>
                <td>${pageRank}</td>
                <td>${friends.join(', ')}</td>
            `;
            
            row.addEventListener('click', () => this.selectNode(node.id));
            
            if (this.selectedNode === node.id) {
                row.classList.add('selected');
            }
            
            tableBody.appendChild(row);
        });
    }

    selectNode(nodeId) {
        this.selectedNode = nodeId;
        
        // Update table selection
        document.querySelectorAll('#tableBody tr').forEach(row => {
            row.classList.toggle('selected', parseInt(row.dataset.nodeId) === nodeId);
        });
        
        // Update graph selection
        if (window.graphRenderer) {
            window.graphRenderer.highlightNode(nodeId);
        }
        
        this.showNodeDetails(nodeId);
    }

    showNodeDetails(nodeId) {
        const nodeDetails = document.getElementById('nodeDetails');
        const friends = this.graph.adjacencyList[nodeId] || [];
        
        let recommendationsHtml = '';
        if (this.pageRankScores) {
            const recommendations = this.getRecommendations(nodeId);
            if (recommendations.length > 0) {
                recommendationsHtml = `
                    <div class="recommendations">
                        <h4>Recommended New Friends (Top 3 by PageRank):</h4>
                        ${recommendations.map(rec => `
                            <div class="recommendation-item">
                                Node ${rec.node} (PageRank: ${rec.score.toFixed(4)})
                                <button onclick="app.connectNodes(${nodeId}, ${rec.node})">Connect</button>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                recommendationsHtml = '<p>No new friend recommendations available.</p>';
            }
        } else {
            recommendationsHtml = '<p>Compute PageRank to see recommendations.</p>';
        }
        
        nodeDetails.innerHTML = `
            <div class="node-info">
                <h4>Node ${nodeId}</h4>
                <p><strong>Current Friends:</strong> ${friends.length > 0 ? friends.join(', ') : 'None'}</p>
                ${recommendationsHtml}
            </div>
        `;
    }

    getRecommendations(nodeId) {
        if (!this.pageRankScores) return [];
        
        const currentFriends = new Set(this.graph.adjacencyList[nodeId] || []);
        currentFriends.add(nodeId); // Exclude self
        
        const recommendations = [];
        
        this.graph.nodes.forEach(node => {
            if (!currentFriends.has(node.id)) {
                recommendations.push({
                    node: node.id,
                    score: this.pageRankScores[node.id]
                });
            }
        });
        
        // Sort by PageRank score descending and take top 3
        return recommendations.sort((a, b) => b.score - a.score).slice(0, 3);
    }

    connectNodes(sourceId, targetId) {
        // Add edge to graph
        this.graph.edges.push({ source: sourceId, target: targetId });
        
        // Update adjacency list
        if (!this.graph.adjacencyList[sourceId].includes(targetId)) {
            this.graph.adjacencyList[sourceId].push(targetId);
        }
        if (!this.graph.adjacencyList[targetId].includes(sourceId)) {
            this.graph.adjacencyList[targetId].push(sourceId);
        }
        
        // Recompute PageRank
        this.computePageRank();
        
        // Show success message
        alert(`Connected node ${sourceId} with node ${targetId}! PageRank recomputed.`);
    }
}

// Initialize app when page loads
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new PageRankApp();
});
