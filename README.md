# Shapez 2 Solver

A web-based tool for the game [Shapez 2](https://shapez2.com/) that tries to find the most efficient solutions for creating a target shape from given starting shapes using a set of allowed operations.

---

### Features

- Handles all the main Shapez 2 operations (cutting, rotating, stacking, painting, etc.)
- Shapes work with any amount of parts. (Hex shapes are supported!)
- Shows you a visual flowchart of the solution steps, which can be copied it as an image.
- Renders shapes visually with customizable color modes (RGB, RYB, CMYK).
- Has several settings to control the solver to the user's liking.

---

## Credits

- Shape operation logic ported to JS from [Loupau38's Shapez 2 Library](https://pypi.org/project/shapez2/).
- Shape rendering logic adapted from [Loupau38's Shape Viewer](https://github.com/Loupau38/loupau38.github.io/blob/main/assets/scripts/shapeViewer.js).
- Uses [Cytoscape.js](https://js.cytoscape.org/) for graph visualization.