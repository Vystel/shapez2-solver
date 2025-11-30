// Imports
import { createShapeCanvas, createShapeElement, colorValues } from './shapeRendering.js';
import { Shape, _extractLayers } from './shapeOperations.js';
import { cyInstance, copyGraphToClipboard, applyGraphLayout, renderGraph, renderSpaceGraph } from './operationGraph.js';
import { showValidationErrors } from './shapeValidation.js';

// Utility Helpers
const $ = (sel) => document.querySelector(sel);
const $all = (sel) => Array.from(document.querySelectorAll(sel));
const byId = (id) => document.getElementById(id);

export function getCurrentColorMode() {
    return byId('color-mode-select')?.value || 'rgb';
}

// Refresh Colors
function refreshShapeColors() {
    const container = byId('graph-container');
    if (!container || !cyInstance) return;

    const mode = getCurrentColorMode();

    // Update shape nodes
    cyInstance.nodes('.shape').forEach((node) => {
        const code = node.data('label');
        const canvas = createShapeCanvas(code, 120);
        node.data('shapeCanvas', canvas.toDataURL());
        node.trigger('style');
    });

    // Update color operations
    cyInstance.nodes('.colored-op').forEach((node) => {
        const parts = node.data('label').split(' ');
        if (parts.length < 2) return;
        const color = parts[1].replace(/[()]/g, '');
        const col = colorValues[mode]?.[color];
        if (col) node.style({ 'background-color': col });
    });

    // Refresh inline canvases
    $all('.shape-canvas').forEach((canvas) => {
        const code = canvas.dataset.shapeCode;
        if (!code) return;
        const newCanvas = createShapeCanvas(code, 40);
        newCanvas.className = 'shape-canvas';
        newCanvas.dataset.shapeCode = code;
        canvas.replaceWith(newCanvas);
    });
}

// Default Shapes
function initializeDefaultShapes() {
    const container = byId('starting-shapes');
    ['CuCuCuCu', 'RuRuRuRu', 'SuSuSuSu', 'WuWuWuWu']
        .forEach((code) => container.appendChild(createShapeItem(code)));
}

function createShapeItem(shapeCode) {
    const item = document.createElement('div');
    item.className = 'shape-item';

    const display = createShapeElement(shapeCode);

    const removeBtn = document.createElement('span');
    removeBtn.className = 'remove-shape';
    removeBtn.textContent = '×';
    removeBtn.dataset.shape = shapeCode;

    item.appendChild(display);
    item.appendChild(removeBtn);

    return item;
}

// Add Shape Button
byId('add-shape-btn').addEventListener('click', () => {
    const input = byId('new-shape-input');
    const code = input.value.trim();
    if (!code) return alert('Please enter a shape code.');
    if (!showValidationErrors(code, 'starting shape')) return;

    byId('starting-shapes').appendChild(createShapeItem(code));
    input.value = '';
});

// Remove Shape Button
byId('starting-shapes').addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-shape')) {
        e.target.parentElement.remove();
    }
});

// Extract Shapes Modal
byId('extract-shapes-btn').addEventListener('click', () => {
    byId('extract-modal').style.display = 'flex';
});

byId('extract-cancel').addEventListener('click', () => {
    byId('extract-modal').style.display = 'none';
});

byId('extract-confirm').addEventListener('click', () => {
    const target = byId('target-shape').value.trim();
    const mode = $('input[name="extract-mode"]:checked').value;
    const includePins = byId('include-pins').checked;
    const includeColor = byId('include-color').checked;

    const modal = byId('extract-modal');

    if (!target) {
        alert('Please enter a target shape code.');
        modal.style.display = 'none';
        return;
    }
    if (!showValidationErrors(target, 'target shape')) {
        modal.style.display = 'none';
        return;
    }

    try {
        const container = byId('starting-shapes');
        container.innerHTML = '';

        const variants = _extractLayers(
            Shape.fromShapeCode(target),
            mode,
            includePins,
            includeColor
        );

        variants.forEach((code) => container.appendChild(createShapeItem(code)));
        modal.style.display = 'none';
    } catch (err) {
        alert(`Failed to extract shapes: ${err.message}`);
        modal.style.display = 'none';
    }
});

// Tabs
$all('.tab-button').forEach((btn) => {
    btn.addEventListener('click', () => {
        $all('.tab-button').forEach((b) => b.classList.remove('active'));
        $all('.tab-content').forEach((c) => c.classList.remove('active'));

        btn.classList.add('active');
        byId(btn.id.replace('-tab-btn', '-content')).classList.add('active');
    });
});

// Operation Toggle
$all('.operation-item').forEach((item) => {
    item.addEventListener('click', () => item.classList.toggle('enabled'));
});

// Solver Worker
let solverWorker = null;
byId('solve-btn').addEventListener('click', () => {
    const btn = byId('solve-btn');
    const status = byId('status');

    const solving = btn.textContent === 'Solve';
    if (!solving) {
        if (solverWorker) {
            solverWorker.postMessage({ action: 'cancel' });
            solverWorker.terminate();
            solverWorker = null;
        }
        btn.textContent = 'Solve';
        status.textContent = 'Cancelled.';
        return;
    }

    // Gather inputs
    const target = byId('target-shape').value.trim();
    const starting = $all('#starting-shapes .shape-item .shape-label').map((x) => x.textContent);
    const ops = $all('#enabled-operations .operation-item.enabled').map((x) => x.dataset.operation);

    const maxLayers = parseInt(byId('max-layers').value) || 4;
    const maxStates = parseInt(byId('max-states-per-level').value) || 1000;
    const preventWaste = byId('prevent-waste').checked;
    const orientationSensitive = byId('orientation-sensitive').checked;
    const monolayerPainting = byId('monolayer-painting').checked;

    if (!showValidationErrors(target, 'target shape')) return;
    for (const code of starting) {
        if (!showValidationErrors(code, 'starting shape')) return;
    }

    // Start worker
    if (solverWorker) solverWorker.terminate();
    solverWorker = new Worker(new URL('./shapeSolver.js', import.meta.url), { type: 'module' });

    const startTime = performance.now();

    solverWorker.onmessage = ({ data }) => {
        const { type, message, result } = data;

        if (type === 'status') {
            status.textContent = message;
            return;
        }

        if (type === 'result') {
            if (result?.solutionPath) {
                renderGraph(result.solutionPath);
                const t = ((performance.now() - startTime) / 1000).toFixed(2);
                status.textContent = `Solved in ${t}s at Depth ${result.depth} → ${result.statesExplored} States`;
            } else {
                status.textContent = 'No solution found.';
            }

            btn.textContent = 'Solve';
            solverWorker.terminate();
            solverWorker = null;
        }
    };

    btn.textContent = 'Cancel';
    solverWorker.postMessage({
        action: 'solve',
        data: {
            targetShapeCode: target,
            startingShapeCodes: starting,
            enabledOperations: ops,
            maxLayers,
            maxStatesPerLevel: maxStates,
            preventWaste,
            orientationSensitive,
            monolayerPainting
        }
    });
});

// Space Explorer
let spaceWorker = null;
byId('explore-btn').addEventListener('click', () => {
    const btn = byId('explore-btn');
    const status = byId('status');
    const exploring = btn.textContent === 'Explore';

    if (!exploring) {
        if (spaceWorker) {
            spaceWorker.postMessage({ action: 'cancel' });
            spaceWorker.terminate();
            spaceWorker = null;
        }
        btn.textContent = 'Explore';
        status.textContent = 'Cancelled.';
        return;
    }

    const starting = $all('#starting-shapes .shape-item .shape-label').map((x) => x.textContent);
    const ops = $all('#enabled-operations .operation-item.enabled').map((x) => x.dataset.operation);
    const depthLimit = parseInt(byId('depth-limit-input').value) || 999;
    const maxLayers = parseInt(byId('max-layers').value) || 4;

    for (const code of starting) {
        if (!showValidationErrors(code, 'starting shape')) return;
    }

    if (spaceWorker) spaceWorker.terminate();
    spaceWorker = new Worker(new URL('./shapeSolver.js', import.meta.url), { type: 'module' });

    spaceWorker.onmessage = ({ data }) => {
        const { type, message, result } = data;

        if (type === 'status') {
            status.textContent = message;
            return;
        }

        if (type === 'result') {
            btn.textContent = 'Explore';
            
            if (result) {
                renderSpaceGraph(result);
            }

            spaceWorker.terminate();
            spaceWorker = null;
        }
    };

    btn.textContent = 'Cancel';
    status.textContent = 'Exploring...';

    spaceWorker.postMessage({
        action: 'explore',
        data: { startingShapeCodes: starting, enabledOperations: ops, depthLimit, maxLayers }
    });
});

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initializeDefaultShapes();
    byId('color-mode-select')?.addEventListener('change', refreshShapeColors);
});

// Graph Controls
byId('snapshot-btn').addEventListener('click', copyGraphToClipboard);
byId('direction-select').addEventListener('change', (e) => {
    applyGraphLayout(e.target.value);
});
