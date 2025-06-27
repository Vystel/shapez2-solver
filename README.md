# Shapez 2 Solver

This is a web-based tool for the game "Shapez 2" that tries to find the most efficient sequence of operations to produce a shape using a given set of starting shapes.

---

### How to use:

- Type the code for the shape you want to make.
- List the starting shapes you have available and want the solver to work with.
- Press solve to start finding a valid production chain. To make calculations quicker, try adjusting the options!
- If a solution is found, the operation sequence will be displayed as a flowchart.

---

### Features:

- Handles all the main Shapez 2 operations (cutting, rotating, stacking, painting, etc.)
- Shows you a visual flowchart of the solution steps and lets you customize how it looks and export it as an image.
- Shapes work with any amount of parts. (Hex shapes are supported!)
- Has settings to control how thoroughly it searches for solutions.

---

### Sources:

- [shapeOperations.js](https://github.com/tobspr-games/shapez-2-discord-bot) (JS Port)
- [shapeRendering.js](https://github.com/Loupau38/loupau38.github.io/blob/main/assets/scripts/shapeViewer.js)
- operationGraph.js uses [Cytoscape.js Dagre](https://github.com/cytoscape/cytoscape.js-dagre)
