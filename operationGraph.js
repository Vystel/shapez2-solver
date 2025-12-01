import { colorValues } from './shapeRendering.js';
import { getCurrentColorMode } from './main.js';
import { createShapeCanvas } from './shapeRendering.js';

export let cyInstance = null;

export function renderGraph(solutionPath) {
    const container = document.getElementById('graph-container');
    container.innerHTML = '';

    if (cyInstance) {
        cyInstance.destroy();
        cyInstance = null;
    }

    if (graph3dInstance) {
        graph3dInstance._destructor();
        graph3dInstance = null;
    }

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

    // Click-to-copy for shape nodes
    cyInstance.on('tap', 'node.shape', async (evt) => {
        const code = evt.target.data('label');
        try {
            await navigator.clipboard.writeText(code);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    });
}

export async function copyGraphToClipboard() {
    const cy = cyInstance;
    const g3d = graph3dInstance;

    // --- 2D GRAPH (Cytoscape) ---
    if (cy) {
        const graphImage = cy.png({
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
            alert('Failed to copy image to clipboard.');
        }

        return;
    }

    // --- 3D GRAPH (ForceGraph3D) ---
    if (g3d) {
        const renderer = g3d.renderer();
        const canvas = renderer.domElement;

        renderer.render(g3d.scene(), g3d.camera());

        canvas.toBlob(async blob => {
            if (!blob) {
                alert('Failed to export 3D graph.');
                return;
            }

            try {
                const item = new ClipboardItem({ 'image/png': blob });
                await navigator.clipboard.write([item]);
                alert('Graph image copied to clipboard!');
            } catch (err) {
                console.error('Failed to copy 3D image:', err);
                alert('Failed to copy image to clipboard.');
            }
        }, 'image/png');

        return;
    }

    alert('No graph to copy.');
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

export let graph3dInstance = null;

export function renderSpaceGraph(graph) {
    const container = document.getElementById('graph-container');
    container.innerHTML = '';
    container.style.position = 'relative';

    if (graph3dInstance) {
        graph3dInstance._destructor();
        graph3dInstance = null;
    }

    if (cyInstance) {
        cyInstance.destroy();
        cyInstance = null;
    }

    if (!graph) return;

    const nodes = [];
    const links = [];
    const nodeMap = new Map();

    // Shape nodes
    for (const s of graph.shapes) {
        const nodeId = s.id;
        const canvas = createShapeCanvas(s.code, 120);

        const node = {
            id: nodeId,
            kind: 'shape',
            label: s.code,
            image: canvas.toDataURL()
        };
        nodeMap.set(nodeId, node);
        nodes.push(node);
    }

    // Operation nodes
    for (const op of graph.ops) {
        const opId = op.id;

        const img = `images/operations/${op.type.toLowerCase().replace(/\s+/g,'-')}.png`;

        nodes.push({
            id: opId,
            kind: 'op',
            label: op.type,
            image: img
        });
    }
    
    // Edges
    for (const e of graph.edges) {
        links.push({
            source: e.source,
            target: e.target,
            kind:
                e.target.startsWith('op-') ? 'to-op' :
                e.source.startsWith('op-') ? 'from-op' :
                ''
        });
    }

    // Initialize 3D force graph
    graph3dInstance = ForceGraph3D()(container)
        .graphData({ nodes, links })
        .showNavInfo(false)
        .forceEngine('d3')
        .d3AlphaDecay(0.005)
        .d3VelocityDecay(0.1)
        .backgroundColor('rgba(0,0,0,0)')
        .nodeAutoColorBy(null)
        .nodeOpacity(0.9)
        .linkOpacity(0.4)
        .linkColor(link => link.kind === 'to-op' ? '#999' : link.kind === 'from-op' ? '#FC9A19' : '#999')
        .linkDirectionalArrowLength(4)
        .linkDirectionalArrowRelPos(1)
        
        .nodeThreeObject(node => {
            const group = new THREE.Group();
            let sprite;

            if (node.kind === 'shape') {
                const tex = new THREE.TextureLoader().load(node.image, t => { t.colorSpace = THREE.SRGBColorSpace; t.premultiplyAlpha = false; });
                const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, premultipliedAlpha: false, depthTest: true, depthWrite: false, });
                sprite = new THREE.Sprite(mat);
                sprite.scale.set(15, 15, 1);
            } else {
                const tex = new THREE.TextureLoader().load(node.image, t => { t.colorSpace = THREE.SRGBColorSpace; t.premultiplyAlpha = false; });
                const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, premultipliedAlpha: false, depthTest: true, depthWrite: false, });
                sprite = new THREE.Sprite(mat);
                sprite.scale.set(12, 12, 1);
            }

            group.add(sprite);
            return group;
        })
        .nodeLabel(node => node.label);

    graph3dInstance.onNodeClick(node => {
        if (node.kind === 'shape') {
            navigator.clipboard.writeText(node.label).catch(() => {});
        }
    });

    return graph3dInstance;
}