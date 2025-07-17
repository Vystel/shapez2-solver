// ==================== Imports ====================
import { colorValues } from './shapeRendering.js';
import { getCurrentColorMode } from './main.js';
import { ShapeOperationConfig } from './shapeOperations.js'; // Import ShapeOperationConfig

// ==================== Global State ====================
export let cyInstance = null;

// ==================== Graph Rendering Functions ====================
export function renderGraph(solution, operations, createShapeCanvas) {
    const container = document.getElementById('graph-container');
    container.innerHTML = '';
    if (!solution) return;

    // Retrieve maxShapeLayers from the input element for rendering
    const maxShapeLayers = parseInt(document.getElementById('max-layers').value) || 4;
    const renderConfig = new ShapeOperationConfig(maxShapeLayers);

    // Parse solution to build ID into shape mapping
    const idToShape = {};
    const steps = solution.split(';');

    for (const step of steps) {
        if (step.includes('=')) {
            // Initial shape assignment
            const [id, shape] = step.split('=');
            idToShape[id] = shape;
        } else {
            // Operation - parse inputs and outputs
            const parts = step.split(':');
            if (parts.length !== 3) continue;

            const [inputPart, op, outputPart] = parts;
            const outputs = outputPart.split(',');
            const inputs = inputPart.split(',');

            // Record new shapes (for painter, first input is shape)
            if (op === 'paint') {
                idToShape[outputs[0]] = operations.painter.apply(
                    idToShape[inputs[0]], inputs[1], renderConfig
                )[0];
            } else if (op === 'crystal') {
                idToShape[outputs[0]] = operations.crystalGenerator.apply(
                    idToShape[inputs[0]], inputs[1], renderConfig
                )[0];
            } else {
                const inputShapes = inputs.filter(inp => idToShape[inp]).map(inp => idToShape[inp]);
                const outputShapes = applyOperation(op, operations, renderConfig, ...inputShapes);
                outputs.forEach((outId, i) => {
                    if (outputShapes[i]) idToShape[outId] = outputShapes[i];
                });
            }
        }
    }

    // Build graph elements
    const elements = [];
    const nodeMap = {};

    // Create nodes and edges
    for (const step of steps) {
        if (step.includes('=')) {
            // Initial shape
            const [id, shape] = step.split('=');
            const nodeId = `node-${id}`;
            nodeMap[id] = nodeId;
            const shapeCanvas = createShapeCanvas(shape, 120);
            elements.push({
                data: {
                    id: nodeId,
                    label: shape,
                    shapeCanvas: shapeCanvas.toDataURL()
                },
                classes: 'shape'
            });
        } else {
            // Operation
            const [inputPart, op, outputPart] = step.split(':');
            const opId = `op-${step}`;
            const inputs = inputPart.split(',');
            const outputs = outputPart.split(',');

            // Add operation node
            let opLabel = op;
            let nodeClasses = 'op';
            let backgroundColor = '#000';

            if (op === 'paint' || op === 'crystal') {
                opLabel += ` (${inputs[1]})`;
                const colorMode = getCurrentColorMode();
                if (colorValues[colorMode][inputs[1]]) {
                    backgroundColor = colorValues[colorMode][inputs[1]];
                    nodeClasses += ' colored-op';
                }
            }

            elements.push({
                data: {
                    id: opId,
                    label: opLabel,
                    image: `images/${op}.png`,
                    backgroundColor: backgroundColor
                },
                classes: nodeClasses
            });

            // Connect inputs to operation
            inputs.forEach(input => {
                if (input in nodeMap) {
                    elements.push({
                        data: { source: nodeMap[input], target: opId }
                    });
                }
            });

            // Create output nodes and connect
            outputs.forEach(output => {
                const nodeId = `node-${output}`;
                nodeMap[output] = nodeId;

                // Use shape from mapping - create canvas for visualization
                const shapeCode = idToShape[output] || output;
                const shapeCanvas = createShapeCanvas(shapeCode, 120);
                elements.push({
                    data: {
                        id: nodeId,
                        label: shapeCode,
                        shapeCanvas: shapeCanvas.toDataURL()
                    },
                    classes: 'shape'
                });

                // Connect operation to output
                elements.push({
                    data: { source: opId, target: nodeId }
                });
            });
        }
    }

    // Get the initial direction from the select element
    const directionSelect = document.getElementById('direction-select');
    const selectedDirection = directionSelect ? directionSelect.value : 'LR'; // Default to 'LR' if element not found

    // Render graph
    cyInstance = cytoscape({
        container,
        elements,
        style: [
            {
                selector: 'node',
                style: {
                    'label': 'data(label)',
                    'color': '#fff',
                    'text-valign': 'bottom',
                    'text-halign': 'center',
                    'text-outline-width': 1,
                    'text-outline-color': '#333',
                    'width': '80px',
                    'height': '80px',
                    'font-size': '10px'
                }
            },
            {
                selector: '.shape',
                style: {
                    'background-image': 'data(shapeCanvas)',
                    'background-fit': 'contain',
                    'background-opacity': 0.1,
                    'font-family': 'monospace'
                }
            },
            {
                selector: '.op',
                style: {
                    'background-image': 'data(image)',
                    'background-fit': 'cover',
                    'background-opacity': 0,
                    'shape': 'rectangle',
                    'background-color': 'transparent',
                    'border-width': 0,
                    'width': '60px',
                    'height': '60px',
                    'label': 'data(label)',
                    'text-valign': 'bottom',
                    'text-halign': 'center'
                }
            },
            {
                selector: '.colored-op',
                style: {
                    'shape': 'ellipse',
                    'background-color': 'data(backgroundColor)',
                    'background-opacity': 0.5
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 2,
                    'line-color': '#aaa',
                    'target-arrow-color': '#aaa',
                    'target-arrow-shape': 'triangle',
                    'curve-style': 'bezier'
                }
            }
        ],
        layout: {
            name: 'dagre',
            rankDir: selectedDirection,
            nodeSep: 50,
            edgeSep: 10,
            rankSep: 100
        },
        userZoomingEnabled: true,
        userPanningEnabled: true,
        boxSelectionEnabled: true,
        autoungrabify: false,
        wheelSensitivity: 0.1
    });
}

// Helper function to apply operations for graph rendering
function applyOperation(opName, operationsRef, config, ...shapes) {
    switch (opName) {
        case 'hcut': return operationsRef.halfDestroyer.apply(shapes[0], config);
        case 'cut': return operationsRef.cutter.apply(shapes[0], config);
        case 'swap': return operationsRef.swapper.apply(...shapes, config);
        case 'r90cw': return operationsRef.rotateCW.apply(shapes[0], config);
        case 'r90ccw': return operationsRef.rotateCCW.apply(shapes[0], config);
        case 'r180': return operationsRef.rotate180.apply(shapes[0], config);
        case 'stack': return operationsRef.stacker.apply(...shapes, config);
        case 'pin': return operationsRef.pinPusher.apply(shapes[0], config);
        case 'paint': return []; // Handled separately
        case 'crystal': return []; // Handled separately
        default: return [];
    }
}

export function getCyInstance() {
    return cyInstance;
}