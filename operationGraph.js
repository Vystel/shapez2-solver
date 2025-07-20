import { colorValues } from './shapeRendering.js';
import { getCurrentColorMode } from './main.js';
import { createShapeCanvas } from './shapeRendering.js';

export let cyInstance = null;

export function renderGraph(solutionPath) {
    const container = document.getElementById('graph-container');
    container.innerHTML = '';
    if (!solutionPath || solutionPath.length === 0) return;

    const elements = [];
    const nodeMap = {};

    solutionPath.forEach((step, stepIndex) => {
        const { operation, inputs, outputs, params } = step;
        const opId = `op-${stepIndex}`;

        // Operation node
        let opLabel = operation;
        let nodeClasses = 'op';
        let backgroundColor = '#000';

        if (operation === 'Painter' || operation === 'Crystal Generator') {
            const color = params.color;
            opLabel += ` (${color})`;
            const colorMode = getCurrentColorMode();
            if (colorValues[colorMode][color]) {
                backgroundColor = colorValues[colorMode][color];
                nodeClasses += ' colored-op';
            }
        }

        elements.push({
            data: {
                id: opId,
                label: opLabel,
                image: `images/operations/${operation.toLowerCase().replace(/\s+/g, '-')}.png`,
                backgroundColor: backgroundColor
            },
            classes: nodeClasses
        });

        // Input shapes
        inputs.forEach(input => {
            const nodeId = `shape-${input.id}`;
            if (!nodeMap[nodeId]) {
                const shapeCanvas = createShapeCanvas(input.shape, 120);
                elements.push({
                    data: {
                        id: nodeId,
                        label: input.shape,
                        shapeCanvas: shapeCanvas.toDataURL()
                    },
                    classes: 'shape'
                });
                nodeMap[nodeId] = true;
            }
            elements.push({ data: { source: nodeId, target: opId } });
        });

        // Output shapes
        outputs.forEach(output => {
            const nodeId = `shape-${output.id}`;
            if (!nodeMap[nodeId]) {
                const shapeCanvas = createShapeCanvas((output.shape), 120);
                elements.push({
                    data: {
                        id: nodeId,
                        label: output.shape,
                        shapeCanvas: shapeCanvas.toDataURL()
                    },
                    classes: 'shape'
                });
                nodeMap[nodeId] = true;
            }
            elements.push({ data: { source: opId, target: nodeId } });
        });
    });

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
                    'height': '60px'
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

export async function copyGraphToClipboard() {
    const cyInstance = getCyInstance(); // Get the Cytoscape instance
    if (!cyInstance) return;

    const graphImage = cyInstance.png({
        output: 'blob',
        scale: 1,
        full: true
    });

    try {
        const clipboardItem = new ClipboardItem({ 'image/png': graphImage });
        await navigator.clipboard.write([clipboardItem]);
        alert('Graph image copied to clipboard!');
    } catch (error) {
        console.error('Failed to copy image to clipboard:', error);
        alert('Failed to copy image to clipboard. Your browser may not support this or you need to grant permission.');
    }
}

export function applyGraphLayout(direction) {
    const cyInstance = getCyInstance();
    if (!cyInstance) return;

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

export function getCyInstance() {
    return cyInstance;
}