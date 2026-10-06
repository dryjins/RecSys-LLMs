// graph.js
class GraphRenderer {
    constructor(containerId) {
        this.containerId = containerId;
        this.svg = null;
        this.simulation = null;
        this.nodes = [];
        this.links = [];
        this.width = 0;
        this.height = 0;
        this.selectedNode = null;
        
        this.initializeSVG();
    }

    initializeSVG() {
        const container = document.getElementById(this.containerId);
        this.width = container.clientWidth;
        this.height = container.clientHeight;

        this.svg = d3.select(`#${this.containerId}`)
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height);

        // Add zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                this.svg.select('g').attr('transform', event.transform);
            });

        this.svg.call(zoom)
            .append('g');
    }

    renderGraph(graph, pageRankScores = null) {
        this.nodes = graph.nodes.map(node => ({
            ...node,
            pageRank: pageRankScores ? pageRankScores[node.id] : 0.1
        }));

        this.links = graph.edges.map(edge => ({
            source: edge.source,
            target: edge.target
        }));

        this.updateGraph();
    }

    updateGraph() {
        const g = this.svg.select('g');
        
        // Clear existing elements
        g.selectAll('*').remove();

        // Create force simulation
        this.simulation = d3.forceSimulation(this.nodes)
            .force('link', d3.forceLink(this.links).id(d => d.id).distance(50))
            .force('charge', d3.forceManyBody().strength(-100))
            .force('center', d3.forceCenter(this.width / 2, this.height / 2))
            .force('collision', d3.forceCollide().radius(20));

        // Create links
        const link = g.append('g')
            .selectAll('line')
            .data(this.links)
            .enter()
            .append('line')
            .attr('class', 'link')
            .attr('stroke', '#999')
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', 1);

        // Create nodes
        const node = g.append('g')
            .selectAll('circle')
            .data(this.nodes)
            .enter()
            .append('circle')
            .attr('class', 'node')
            .attr('r', d => this.getNodeRadius(d.pageRank))
            .attr('fill', d => this.getNodeColor(d.pageRank))
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5)
            .call(d3.drag()
                .on('start', (event, d) => this.dragStarted(event, d))
                .on('drag', (event, d) => this.dragged(event, d))
                .on('end', (event, d) => this.dragEnded(event, d)))
            .on('click', (event, d) => this.nodeClicked(event, d));

        // Add node labels
        const label = g.append('g')
            .selectAll('text')
            .data(this.nodes)
            .enter()
            .append('text')
            .text(d => d.id)
            .attr('font-size', '10px')
            .attr('dx', 12)
            .attr('dy', 4)
            .attr('pointer-events', 'none');

        // Add tooltips
        node.append('title')
            .text(d => `Node ${d.id}\nPageRank: ${d.pageRank ? d.pageRank.toFixed(4) : 'N/A'}`);

        // Update positions on simulation tick
        this.simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);

            label
                .attr('x', d => d.x)
                .attr('y', d => d.y);
        });
    }

    getNodeRadius(pageRank) {
        if (!pageRank || pageRank === 0.1) return 8;
        // Scale radius based on PageRank (8 to 20 pixels)
        return 8 + (pageRank * 120);
    }

    getNodeColor(pageRank) {
        if (!pageRank || pageRank === 0.1) return '#ccc';
        
        // Color scale from blue (low) to red (high)
        const intensity = Math.min(pageRank * 10, 1);
        const r = Math.floor(100 + intensity * 155);
        const g = Math.floor(100 + (1 - intensity) * 155);
        const b = Math.floor(200 - intensity * 100);
        
        return `rgb(${r}, ${g}, ${b})`;
    }

    dragStarted(event, d) {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    dragEnded(event, d) {
        if (!event.active) this.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    nodeClicked(event, d) {
        event.stopPropagation();
        this.highlightNode(d.id);
        
        // Notify app about node selection
        if (window.app) {
            window.app.selectNode(d.id);
        }
    }

    highlightNode(nodeId) {
        // Remove previous selection
        this.svg.selectAll('.node.selected')
            .classed('selected', false)
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5);

        this.svg.selectAll('.node')
            .filter(d => d.id === nodeId)
            .classed('selected', true)
            .attr('stroke', '#ff6b6b')
            .attr('stroke-width', 3);

        this.selectedNode = nodeId;
    }

    updatePageRankScores(pageRankScores) {
        this.nodes.forEach(node => {
            node.pageRank = pageRankScores[node.id];
        });
        this.updateGraph();
    }
}

// Initialize graph renderer when page loads
let graphRenderer;
document.addEventListener('DOMContentLoaded', () => {
    graphRenderer = new GraphRenderer('graph');
    window.graphRenderer = graphRenderer;
});
