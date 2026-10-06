**role:**  
You are a senior front-end ML engineer tasked with delivering a web app that demonstrates PageRank-based friend recommendations. The app must run entirely in the browser, using TensorFlow.js for computation and D3.js for interactive network visualization. The goal is an educational demo for MBA/MS students on social graph algorithms.

**task:**  
Build a static website (GitHub Pages compatible) that loads a small social network graph (e.g. karate club CSV, ≤100 nodes), computes PageRank scores for each node using TensorFlow.js, and visualizes the network with D3.js. Provide an interactive table and graph view; when any node is clicked, show its current friends and recommend best new connections based on PageRank score.

**instructions:**  
- Use TensorFlow.js to implement iterative PageRank (30–50 steps, damping factor 0.85).  
- Accept a graph in simple edge-list CSV: `source,target` (node ids, ≤100 nodes, undirected); include a demo file (`data/karate.csv`).  
- Use D3.js for force-directed graph visualization.  
- Table: List node id, PageRank score (rounded), and current friends (connected nodes).  
- On click (node or table row):  
    - Highlight the node in both graph and table.  
    - Display all current friends.  
    - Recommend top 3 new friends (not already connected) by descending PageRank (exclude self).  
    - Optionally, offer a “Connect” button to simulate adding a new friend (edge), update graph and scores.  
- Maintain fast browser performance (all computation client-side, ≤100 nodes).  
- Ensure graph and table have tooltips; color/size nodes by PageRank.
- Use clean, commented JavaScript with clear modularization:
    - `/index.html`: Loads TF.js and D3.js from CDN, minimal UI and data file instructions.
    - `/app.js`: Loads data, handles UI, calls computation and visualization.
    - `/pagerank.js`: Implements PageRank logic (TF.js-based, well-commented).
    - `/graph.js`: D3.js rendering and interaction code.
- For best compatibility, do not use any build tools; ensure all code runs directly from raw GitHub Pages hosting.

**format:**  
Output the code for four files, each in its own fenced code block (no extra text):
1. index.html  
2. app.js  
3. pagerank.js  
4. graph.js  

Do not return anything except the code blocks.  
Assume the following project structure:  
- /index.html  
- /app.js  
- /pagerank.js  
- /graph.js  
- /data/karate.csv  

The UI must allow:  
- Data load and graph rendering  
- PageRank computation and scores visualization  
- Table click, highliting the node in the graph and recommend top 3 friends
