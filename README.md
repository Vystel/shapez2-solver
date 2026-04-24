# Shapez 2 Solver

A web-based tool for the game [Shapez 2](https://shapez2.com/) that tries to find the most efficient solutions for creating a target shape from given starting shapes using a set of allowed operations.

## Features

- Handles all the main Shapez 2 operations (cutting, rotating, stacking, painting, etc.)
- Shapes work with any amount of parts. (Hex shapes are supported!)
- Shows you a visual flowchart of the solution steps, which can be copied it as an image.
- Renders shapes visually with customizable color modes (RGB, RYB, CMYK).
- Has several settings to control the solver to the user's liking.
- User-friendly interface.

## Development

The app now uses Vite for local development and bundling:

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite, normally `http://127.0.0.1:1420`.

## macOS Desktop App

This repo also includes a [Tauri](https://tauri.app/) shell so the existing frontend can be packaged as a native macOS app without rewriting the solver UI.

```bash
npm install
npm run tauri:dev
```

To produce a distributable `.app` bundle on macOS:

```bash
npm run tauri:build
```

The built application is written to:

```text
src-tauri/target/release/bundle/macos/Shapez 2 Solver.app
```

Building the desktop app requires a working Rust toolchain in addition to Node.js.

## GitHub Releases

GitHub Actions now publishes release assets automatically when you push a version tag that starts with `v`.

```bash
git tag v1.0.0
git push origin v1.0.0
```

That workflow builds both Apple Silicon and Intel macOS bundles and uploads the generated `.app` and `.dmg` files to the matching GitHub Release.

## Credits & Sources

- Shape operation logic ported to JS from [Loupau38's Shapez 2 Library](https://pypi.org/project/shapez2/).
- Shape rendering code adapted from [Loupau38's Shape Viewer](https://github.com/Loupau38/loupau38.github.io/blob/main/assets/scripts/shapeViewer.js).
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
