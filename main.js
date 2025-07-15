// ==================== Imports ====================
import { createShapeCanvas, SHAPES_CONFIG, COLOR_MODES, colorValues } from './shapeRendering.js';
import { Shape, ShapePart, NOTHING_CHAR, PIN_CHAR, CRYSTAL_CHAR } from './shapeOperations.js';
import { ShapeSolver, ShapeSolverController, operations } from './shapeSolver.js';
import { cyInstance, getCyInstance } from './operationGraph.js';
import { isValidShapeCode, validateShapeCode } from './shapeValidation.js';

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

    // Create canvas with current color mode
    const canvas = createShapeCanvas(shapeCode, 40, SHAPES_CONFIG.QUAD, getCurrentColorMode());
    canvas.className = 'shape-canvas';

    // Store shape code as data attribute for easy refresh
    canvas.dataset.shapeCode = shapeCode;

    const label = document.createElement('span');
    label.className = 'shape-label';
    label.textContent = shapeCode;

    container.appendChild(canvas);
    container.appendChild(label);

    return container;
}

export function getCurrentColorMode() {
    const colorModeSelect = document.getElementById('color-mode-select');
    return colorModeSelect ? colorModeSelect.value : COLOR_MODES.RGB;
}

function refreshShapeColors() {
    const graphContainer = document.getElementById('graph-container');
    if (graphContainer && cyInstance) {
        // Refresh shape nodes
        cyInstance.nodes('.shape').forEach(node => {
            const shapeCode = node.data('label');
            const newCanvas = createShapeCanvas(shapeCode, 120);
            node.data('shapeCanvas', newCanvas.toDataURL());
            node.trigger('style');
        });

        // Refresh operation nodes (paint and crystal)
        cyInstance.nodes('.colored-op').forEach(node => {
            const operationData = node.data('label').split(' ');
            if (operationData.length > 1) {
                // Extract the color from the label
                const color = operationData[1].replace(/[()]/g, '');
                const colorMode = getCurrentColorMode();

                if (color && colorValues[colorMode][color]) {
                    // Update the node's background color
                    node.style({
                        'background-color': colorValues[colorMode][color]
                    });
                }
            }
        });

        // Refresh shape canvas
        document.querySelectorAll('.shape-canvas').forEach(canvas => {
            const shapeCode = canvas.dataset.shapeCode;
            if (shapeCode) {
                const newCanvas = createShapeCanvas(shapeCode, 40, SHAPES_CONFIG.QUAD, getCurrentColorMode());
                canvas.replaceWith(newCanvas);
                newCanvas.className = 'shape-canvas';
                newCanvas.dataset.shapeCode = shapeCode;
            }
        });
    }
}

// ==================== Utility Functions ====================
function getStartingShapes() {
    return Array.from(document.querySelectorAll('#starting-shapes .shape-item .shape-label')).map(label => label.textContent);
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
    return groupedLayers.map(layer => layer.map(part => part.shape + part.color).join(''));
}

// ==================== Enhanced Validation Functions ====================
function showValidationErrors(shapeCode, context = 'shape') {
    const validation = validateShapeCode(shapeCode);
    if (!validation.isValid) {
        const errorMessage = `Invalid ${context} code: ${shapeCode}\n\nErrors:\n${validation.errors.join('\n')}`;
        alert(errorMessage);
        return false;
    }
    return true;
}

// ==================== Shape Input Management ====================
document.getElementById('add-shape-btn').addEventListener('click', () => {
    const input = document.getElementById('new-shape-input');
    const shapeCode = input.value.trim();

    if (!shapeCode) {
        alert('Please enter a shape code.');
        return;
    }

    if (!showValidationErrors(shapeCode, 'starting shape')) {
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

    if (!shapeCode) {
        alert('Please enter a target shape code.');
        return;
    }

    if (!showValidationErrors(shapeCode, 'target shape')) {
        return;
    }

    try {
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
    } catch (error) {
        alert(`Failed to extract shapes: ${error.message}`);
    }
});

// ==================== Tab Switching Logic ====================
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
        // Remove 'active' class from all tab buttons and content
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        // Add 'active' class to the clicked button
        button.classList.add('active');

        // Show the corresponding tab content
        const targetTabId = button.id.replace('-tab-btn', '-content');
        document.getElementById(targetTabId).classList.add('active');
    });
});

// ==================== Initialization ====================
document.addEventListener('DOMContentLoaded', () => {
    initializeDefaultShapes();

    const colorModeSelect = document.getElementById('color-mode-select');
    if (colorModeSelect) {
        colorModeSelect.addEventListener('change', refreshShapeColors);
    }
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

    if (!showValidationErrors(targetShape, 'target shape')) {
        return;
    }

    const startingShapes = getStartingShapes();

    // Validate all starting shapes
    for (const shapeCode of startingShapes) {
        if (!isValidShapeCode(shapeCode)) {
            if (!showValidationErrors(shapeCode, 'starting shape')) {
                return;
            }
        }
    }

    if (startingShapes.length === 0) {
        alert('Please add at least one starting shape.');
        return;
    }

    const enabledOperations = getEnabledOperations();

    if (Object.keys(enabledOperations).length === 0) {
        alert('Please enable at least one operation.');
        return;
    }

    try {
        const solver = new ShapeSolver(startingShapes, targetShape, enabledOperations);
        currentSolverController = new ShapeSolverController(solver, resetSolverUIState);
        currentSolverController.start();

        document.getElementById('calculate-btn').textContent = "Cancel";
    } catch (error) {
        alert(`Failed to start solver: ${error.message}`);
    }
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