import { createShapeCanvas, createShapeElement, SHAPES_CONFIG, COLOR_MODES, colorValues } from './shapeRendering.js';
import { Shape, _extractLayers } from './shapeOperations.js';
import { cyInstance, copyGraphToClipboard, applyGraphLayout, renderGraph } from './operationGraph.js';
import { showValidationErrors } from './shapeValidation.js';

// Changing Color Mode
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

// Initialize with 4 Main Shapes
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

// Add Shape to Inputs
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

// Remove Shape Inputs
document.getElementById('starting-shapes').addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-shape')) {
        e.target.parentElement.remove();
    }
});

// Auto Input Shapes
document.getElementById('extract-shapes-btn').addEventListener('click', () => {
    const modal = document.getElementById('extract-modal');
    modal.style.display = 'flex';
});

document.getElementById('extract-cancel').addEventListener('click', () => {
    const modal = document.getElementById('extract-modal');
    modal.style.display = 'none';
});

document.getElementById('extract-confirm').addEventListener('click', () => {
    const targetInput = document.getElementById('target-shape');
    const shapeCode = targetInput.value.trim();
    const extractMode = document.querySelector('input[name="extract-mode"]:checked').value;
    const includePins = document.getElementById('include-pins').checked;
    const includeColor = document.getElementById('include-color').checked;

    if (!shapeCode) {
        alert('Please enter a target shape code.');
        document.getElementById('extract-modal').style.display = 'none';
        return;
    }

    if (!showValidationErrors(shapeCode, 'target shape')) {
        document.getElementById('extract-modal').style.display = 'none';
        return;
    }

    try {
        // Clear existing starting shapes
        const startingShapesContainer = document.getElementById('starting-shapes');
        startingShapesContainer.innerHTML = '';

        // Extract shape variants
        const extractedShapes = _extractLayers(
            Shape.fromShapeCode(shapeCode),
            extractMode,
            includePins,
            includeColor
        );

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

        document.getElementById('extract-modal').style.display = 'none';
    } catch (error) {
        alert(`Failed to extract shapes: ${error.message}`);
        document.getElementById('extract-modal').style.display = 'none';
    }
});

// Tab Switching
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

// Operation Toggling
document.querySelectorAll('.operation-item').forEach(item => {
    item.addEventListener('click', function () {
        this.classList.toggle('enabled');
    });
});

// Solve Button
let solverWorker = null;
document.getElementById('solve-btn').addEventListener('click', async () => {
    const solveButton = document.getElementById('solve-btn');
    const statusElement = document.getElementById('status');
    let isSolving = solveButton.textContent === 'Solve';

    if (isSolving) {
        // Collect input values from the UI
        const targetShapeCode = document.getElementById('target-shape').value.trim();
        const startingShapeCodes = Array.from(document.querySelectorAll('#starting-shapes .shape-item .shape-label')).map(label => label.textContent);
        const enabledOperations = Array.from(document.querySelectorAll('#enabled-operations .operation-item.enabled')).map(e => e.getAttribute('data-operation'));
        const maxLayers = parseInt(document.getElementById('max-layers').value) || 4;
        const maxStatesPerLevel = parseInt(document.getElementById('max-states-per-level').value) || 1000;
        const preventWaste = document.getElementById('prevent-waste').checked;
        const orientationSensitive = document.getElementById('orientation-sensitive').checked;

        // Validate target shape code
        if (!showValidationErrors(targetShapeCode, 'target shape')) {
            return;
        }

        // Validate starting shape codes
        for (const shapeCode of startingShapeCodes) {
            if (!showValidationErrors(shapeCode, 'starting shape')) {
                return;
            }
        }

        // Initialize Web Worker
        if (solverWorker) {
            solverWorker.terminate();
        }
        solverWorker = new Worker(new URL('./shapeSolver.js', import.meta.url), { type: 'module' });

        // Handle worker messages
        solverWorker.onmessage = (e) => {
            const { type, message, result } = e.data;
            if (type === 'status') {
                statusElement.textContent = message;
            } else if (type === 'result') {
                if (result) {
                    const { solutionPath, depth, statesExplored } = result;

                    if (solutionPath) {
                        renderGraph(solutionPath);
                        const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
                        statusElement.textContent = `Solved in ${elapsed}s using ${depth} Operations`;
                    } else {
                        statusElement.textContent = `No solution found.`;
                    }
                }
                solveButton.textContent = 'Solve';
                solverWorker.terminate();
                solverWorker = null;
            }
        };

        // Start solving
        solveButton.textContent = 'Cancel';
        const startTime = performance.now();
        solverWorker.postMessage({
            action: 'solve',
            data: {
                targetShapeCode,
                startingShapeCodes,
                enabledOperations,
                maxLayers,
                preventWaste,
                orientationSensitive,
                maxStatesPerLevel
            }
        });
    } else {
        // Cancel the solver
        if (solverWorker) {
            solverWorker.postMessage({ action: 'cancel' });
            solverWorker.terminate();
            solverWorker = null;
        }
        solveButton.textContent = 'Solve';
        statusElement.textContent = 'Cancelled.';
    }
});

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initializeDefaultShapes();
    const colorModeSelect = document.getElementById('color-mode-select');
    if (colorModeSelect) {
        colorModeSelect.addEventListener('change', refreshShapeColors);
    }
});

// Graph Controls
document.getElementById('snapshot-btn').addEventListener('click', copyGraphToClipboard);
document.getElementById('direction-select').addEventListener('change', (event) => {
    applyGraphLayout(event.target.value);
});