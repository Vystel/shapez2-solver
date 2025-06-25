// ==================== Imports ====================
import { createShapeCanvas, isValidShapeCode, SHAPES_CONFIG, COLOR_MODES } from './shapeRendering.js';
import { Shape, ShapePart, NOTHING_CHAR, PIN_CHAR, CRYSTAL_CHAR } from './shapeOperations.js';
import { ShapeSolver, ShapeSolverController, operations } from './shapeSolver.js';
import { getCyInstance } from './operationGraph.js';

// ==================== Global State ====================
export let currentSolverController = null;

function resetSolverUIState() {
    currentSolverController = null;
    document.getElementById('calculate-btn').textContent = "Solve";
}

// ==================== Shape Display Functions ====================
function createShapeElement(shapeCode) {
    const container = document.createElement('div');
    container.className = 'shape-display';

    const canvas = createShapeCanvas(shapeCode, 40, SHAPES_CONFIG.QUAD, COLOR_MODES.RGB);
    canvas.className = 'shape-canvas';

    const label = document.createElement('span');
    label.className = 'shape-label';
    label.textContent = shapeCode;

    container.appendChild(canvas);
    container.appendChild(label);

    return container;
}

// ==================== Utility Functions ====================
function getStartingShapes() {
    return Array.from(document.querySelectorAll('#starting-shapes .shape-item .shape-label'))
        .map(label => label.textContent);
}

function initializeDefaultShapes() {
    const defaultShapes = ['CuCuCuCu', 'RuRuRuRu', 'SuSuSuSu', 'WuWuWuWu'];
    const container = document.getElementById('starting-shapes');

    defaultShapes.forEach(shapeCode => {
        const shapeItem = document.createElement('div');
        shapeItem.className = 'shape-item';

        const shapeDisplay = createShapeElement(shapeCode);
        const removeBtn = document.createElement('span');
        removeBtn.className = 'remove-shape';
        removeBtn.textContent = '×';
        removeBtn.setAttribute('data-shape', shapeCode);

        shapeItem.appendChild(shapeDisplay);
        shapeItem.appendChild(removeBtn);
        container.appendChild(shapeItem);
    });
}

function getEnabledOperations() {
    const checkboxes = document.querySelectorAll('.operation-toggle');
    const enabledOps = {};
    checkboxes.forEach(checkbox => {
        if (checkbox.checked && operations[checkbox.value]) {
            enabledOps[checkbox.value] = operations[checkbox.value];
        }
    });
    return enabledOps;
}

function extractLayersByColor(shapeCode) {
    const shape = Shape.fromShapeCode(shapeCode);
    const numParts = shape.numParts;

    const groupedLayers = []; // Final list of layers to return

    shape.layers.forEach((layer) => {
        const seenColors = {}; // Track color -> list of positions and shapes

        // Group parts by color character
        layer.forEach((part, partIndex) => {
            if (
                part.shape === NOTHING_CHAR ||
                part.shape === PIN_CHAR ||
                part.shape === CRYSTAL_CHAR
            ) return;

            if (!seenColors[part.color]) {
                seenColors[part.color] = [];
            }
            seenColors[part.color].push({ index: partIndex, shape: part.shape });
        });

        // For each unique color, create a new layer row (shapes with color 'u')
        Object.entries(seenColors).forEach(([, entries]) => {
            const newLayer = Array.from({ length: numParts }, () => new ShapePart(NOTHING_CHAR, NOTHING_CHAR));
            entries.forEach(({ index, shape }) => {
                newLayer[index] = new ShapePart(shape, 'u');
            });
            groupedLayers.push(newLayer);
        });
    });

    // Convert each ShapePart[] into a string
    return groupedLayers.map(layer =>
        layer.map(part => part.shape + part.color).join('')
    );
}

// ==================== Shape Input Management ====================
document.getElementById('add-shape-btn').addEventListener('click', () => {
    const input = document.getElementById('new-shape-input');
    const shapeCode = input.value.trim();
    if (!shapeCode || !isValidShapeCode(shapeCode)) {
        alert('Invalid shape code. Please enter a valid shape code.');
        return;
    }

    const shapeItem = document.createElement('div');
    shapeItem.className = 'shape-item';

    const shapeDisplay = createShapeElement(shapeCode);
    const removeBtn = document.createElement('span');
    removeBtn.className = 'remove-shape';
    removeBtn.textContent = '×';
    removeBtn.setAttribute('data-shape', shapeCode);

    shapeItem.appendChild(shapeDisplay);
    shapeItem.appendChild(removeBtn);

    document.getElementById('starting-shapes').appendChild(shapeItem);
    input.value = '';
});

document.getElementById('starting-shapes').addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-shape')) {
        e.target.parentElement.remove();
    }
});

document.getElementById('extract-shapes-btn').addEventListener('click', () => {
    const targetInput = document.getElementById('target-shape');
    const shapeCode = targetInput.value.trim();

    if (!shapeCode || !isValidShapeCode(shapeCode)) {
        alert('Invalid target shape code. Please enter a valid shape code.');
        return;
    }

    // Clear existing starting shapes
    const startingShapesContainer = document.getElementById('starting-shapes');
    startingShapesContainer.innerHTML = '';

    // Extract shape variants
    const extractedShapes = extractLayersByColor(shapeCode);

    // Create and append shape elements
    extractedShapes.forEach(shapeVariant => {
        const shapeItem = document.createElement('div');
        shapeItem.className = 'shape-item';

        const shapeDisplay = createShapeElement(shapeVariant);
        const removeBtn = document.createElement('span');
        removeBtn.className = 'remove-shape';
        removeBtn.textContent = '×';
        removeBtn.setAttribute('data-shape', shapeVariant);

        shapeItem.appendChild(shapeDisplay);
        shapeItem.appendChild(removeBtn);

        startingShapesContainer.appendChild(shapeItem);
    });
});


// ==================== Initialization ====================
document.addEventListener('DOMContentLoaded', () => {
    initializeDefaultShapes();
});

// ==================== Main Button Logic ====================
document.getElementById('calculate-btn').addEventListener('click', () => {
    if (currentSolverController) {
        // Cancel current solver
        currentSolverController.cancel();
        return;
    }

    const targetShape = document.getElementById('target-shape').value.trim();
    if (!targetShape) {
        alert('Please enter a target shape code.');
        return;
    }
    if (!isValidShapeCode(targetShape)) {
        alert('Invalid target shape code. Please enter a valid shape code.');
        return;
    }

    const startingShapes = getStartingShapes();
    const enabledOperations = getEnabledOperations();

    const solver = new ShapeSolver(startingShapes, targetShape, enabledOperations);
    currentSolverController = new ShapeSolverController(solver, resetSolverUIState);
    currentSolverController.start();

    document.getElementById('calculate-btn').textContent = "Cancel";
});

document.getElementById('snapshot-btn').addEventListener('click', async () => {
    const cyInstance = getCyInstance(); // Get the Cytoscape instance
    if (!cyInstance) return;

    // Export the graph as a high-resolution PNG
    const graphImage = cyInstance.png({
        output: 'blob',
        scale: 1,
        full: true
    });

    try {
        // Create a clipboard item
        const clipboardItem = new ClipboardItem({ 'image/png': graphImage });

        // Copy to clipboard
        await navigator.clipboard.write([clipboardItem]);

        alert('Graph image copied to clipboard!');
    } catch (error) {
        console.error('Failed to copy image to clipboard:', error);
        alert('Failed to copy image to clipboard. Your browser may not support this or you need to grant permission.');
    }
});

document.getElementById('direction-select').addEventListener('change', (event) => {
    const direction = event.target.value;
    const cyInstance = getCyInstance();

    if (cyInstance) {
        const layout = cyInstance.layout({
            name: 'dagre',
            rankDir: direction,
            nodeSep: 50,
            edgeSep: 10,
            rankSep: 100,
            animate: true,
            animationDuration: 500
        });

        layout.run();
    }
});