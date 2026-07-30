# Shapez 2 Solver

A web-based tool for the game [Shapez 2](https://shapez2.com/) that helps players plan factory builds.

## Solving Shapes
 
1. Add one or more **Output** shapes (what you want to produce).
2. Optionally add or adjust **Input** shapes (what you're starting with). Four uncolored basic shapes are pre-loaded by default.
3. Enable or disable **Operations** by clicking their icons.
4. Adjust **Settings** as needed. Configure which machines are available, set layer limits, and tune the search to balance speed against thoroughness.
5. Click **Solve**. This will try to find an operation sequence that transforms your input shapes into your target shapes. 
The result appears as an operation graph in the main panel. Click **Explore** instead to browse all reachable shapes without a specific target, showing it in a 3D graph. Not really useful, but can generate some really cool looking graphs!
 
**Solver options**
| Option | Description |
|--------|-------------|
| Max Layers | Maximum number of layers allowed in any intermediate shape. Defaults to 4 (the standard game limit). |
| Max States Per Level | Caps the BFS frontier size. Lower = faster but may miss solutions. Higher = slower but more thorough. |
| Prevent Waste | Only accepts solutions where all remaining shapes are an output shape. |
| Orientation-Sensitive | Doesn't accept rotated variants of output shapes. |
| Clean Painting | Restricts painting to single-layer, fully unpainted shapes only. |

---
 
## Solving Colors
 
Switch to the **Mixing** tab in the sidebar.

- **Optimized mode** (default) — enter only the *Want* counts; the solver searches for the minimum number of base-color inputs (R/G/B) required to reach the target. Click **Solve** to show all solutions listed by mixer count. Clicking a solution renders its mixing graph.
- **Manual mode** — enter the colors you already have under *Have* and the colors you need under *Want*.

## Features

- Handles all the main Shapez 2 operations (cutting, rotating, stacking, painting, etc.)
- Shapes work with any amount of parts. (Hex shapes are supported!)
- Shows you a visual flowchart of the solution steps, which can be copied it as an image.
- Renders shapes visually with customizable color modes (RGB, RYB, CMYK).
- Has several settings to control the solver to the user's liking.
- User-friendly interface.

## Credits & Sources

- Shape operation logic ported to JS from [Loupau38's Shapez 2 Library](https://pypi.org/project/shapez2/).
- Shape rendering code built upon from [Loupau38's Shape Viewer](https://github.com/Loupau38/loupau38.github.io/blob/main/assets/scripts/shapeViewer.js).
- Uses [Cytoscape.js](https://js.cytoscape.org/) for graph visualization.

## Examples

Omni Swapper (`CuRuSuWu`)
<img width="1782" height="485" alt="image" src="https://github.com/user-attachments/assets/fcb5ad3a-8485-4a85-9b73-e44a5e9d51a1" />

Standalone Pins (`P-P-P-P-`) without using Crystal Generator
<img width="3202" height="355" alt="image" src="https://github.com/user-attachments/assets/7e0a29d0-600c-42c6-8e0c-16d015705c17" />

`cwRwcwCw:cwcwcwcw:CcCcCcCc:CcCcCcCc`
<img width="1842" height="290" alt="image" src="https://github.com/user-attachments/assets/f3fe9590-7374-41a8-b580-33bd51f5a0d3" />

`RuCwP-Cw:----Ru--`
<img width="1792" height="355" alt="image" src="https://github.com/user-attachments/assets/bb6c6579-3317-4100-bfb3-3102154ed230" />

# License and Usage

This project is MIT licensed, allowing free use, modification, and distribution under the condition that credit is given (link to this repository).
Feel free to fork, contribute, or build upon it for your own Shapez 2 projects (and let me know if you do so)!
