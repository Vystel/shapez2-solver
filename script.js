// ==================== Global State ====================
let currentSolverController = null;

// ==================== Utility Functions ====================
function getStartingShapes() {
    return Array.from(document.querySelectorAll('#starting-shapes .shape-item span:first-child'))
        .map(span => span.textContent);
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

// ==================== Shape Input Management ====================
document.getElementById('add-shape-btn').addEventListener('click', () => {
    const input = document.getElementById('new-shape-input');
    const shapeCode = input.value.trim();
    if (!shapeCode) return;

    const shapeItem = document.createElement('div');
    shapeItem.className = 'shape-item';
    shapeItem.innerHTML = `
    <span>${shapeCode}</span>
    <span class="remove-shape" data-shape="${shapeCode}">×</span>
  `;

    document.getElementById('starting-shapes').appendChild(shapeItem);
    input.value = '';
});

document.getElementById('starting-shapes').addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-shape')) {
        e.target.parentElement.remove();
    }
});

// ==================== Operation Definitions ====================
const operations = {
    halfDestroyer: {
        inputs: 1,
        outputs: 1,
        apply: shape => [
            shape.split(':').map(layer => {
                const half = layer.length / 2;
                return layer.slice(0, half) + '-'.repeat(half);
            }).join(':')
        ],
        toString: (inputId, outputId) => `${inputId}:hcut:${outputId}`
    },

    cutter: {
        inputs: 1,
        outputs: 2,
        apply: shape => {
            const parts = shape.split(':');
            const east = parts.map(l => {
                const half = l.length / 2;
                return l.slice(0, half) + '-'.repeat(half);
            }).join(':');
            const west = parts.map(l => {
                const half = l.length / 2;
                return '-'.repeat(half) + l.slice(half);
            }).join(':');
            return [east, west];
        },
        toString: (inputId, o1, o2) => `${inputId}:cut:${o1},${o2}`
    },

    swapper: {
        inputs: 2,
        outputs: 2,
        apply: (a, b) => {
            const aParts = a.split(':'), bParts = b.split(':');
            const maxLen = Math.max(aParts.length, bParts.length);
            const pad = '--------';
            const getLayer = (parts, i) => parts[i] || pad;

            const out1 = Array.from({ length: maxLen }, (_, i) => {
                const la = getLayer(aParts, i);
                const lb = getLayer(bParts, i);
                const half = la.length / 2;
                return la.slice(0, half) + lb.slice(half);
            }).join(':');

            const out2 = Array.from({ length: maxLen }, (_, i) => {
                const la = getLayer(aParts, i);
                const lb = getLayer(bParts, i);
                const half = lb.length / 2;
                return lb.slice(0, half) + la.slice(half);
            }).join(':');

            return [out1, out2];
        },
        toString: (a, b, o1, o2) => `${a},${b}:swap:${o1},${o2}`
    },

    rotateCW: {
        inputs: 1,
        outputs: 1,
        apply: shape => [
            shape.split(':').map(l => {
                if (l.length % 2 !== 0) return l;
                return l.slice(-2) + l.slice(0, -2);
            }).join(':')
        ],
        toString: (i, o) => `${i}:r90cw:${o}`
    },

    rotateCCW: {
        inputs: 1,
        outputs: 1,
        apply: shape => [
            shape.split(':').map(l => {
                if (l.length % 2 !== 0) return l;
                return l.slice(2) + l.slice(0, 2);
            }).join(':')
        ],
        toString: (i, o) => `${i}:r90ccw:${o}`
    },

    rotate180: {
        inputs: 1,
        outputs: 1,
        apply: shape => [
            shape.split(':').map(l => {
                if (l.length % 2 !== 0) return l;
                const half = l.length / 2;
                return l.slice(half) + l.slice(0, half); // invert halves
            }).join(':')
        ],
        toString: (i, o) => `${i}:r180:${o}`
    },

    painter: {
        inputs: 2,
        outputs: 1,
        apply: (shape, color) => {
            if (!/^[rgbcmyw]$/.test(color)) throw new Error(`Invalid color: ${color}`);
            const layers = shape.split(':');
            const last = layers[layers.length - 1];
            layers[layers.length - 1] = last.split('').map((c, i, a) =>
                (i % 2 === 1 && a[i - 1] !== '-' && c !== '-') ? color : c
            ).join('');
            return [layers.join(':')];
        },
        toString: (inputId, color, outputId) => `${inputId},${color}:paint:${outputId}`
    },

    stacker: {
        inputs: 2,
        outputs: 1,
        apply: (shape1, shape2) => {
            const layers1 = shape1.split(':');
            const layers2 = shape2.split(':');
            const combinedLayers = layers1.concat(layers2).slice(0, 4);
            return [combinedLayers.join(':')];
        },
        toString: (inputId1, inputId2, outputId) => `${inputId1},${inputId2}:stack:${outputId}`
    },

    pinPusher: {
        inputs: 1,
        outputs: 1,
        apply: (shape) => {
            const layers = shape.split(':');
            const firstLayer = layers[0] || '--------';

            const quarters = [0, 2, 4, 6].map(i => firstLayer.substring(i, i + 2));
            const pinLayer = quarters.map(q => q === '--' ? '--' : 'P-').join('');

            const newLayers = [pinLayer, ...layers.slice(0, 3)];
            return [newLayers.join(':')];
        },
        toString: (inputId, outputId) => `${inputId}:pin:${outputId}`
    }
};

// ==================== BFS Solver Class ====================
class BFSSolver {
    constructor(startingShapes, targetShape, operations) {
        this.startingShapes = startingShapes;
        this.targetShape = targetShape;
        this.operations = operations;
        this.nextId = startingShapes.length + 1;
    }
}

// ==================== Solver Controller ====================
class BFSSolverController {
    constructor(solver) {
        this.solver = solver;
        this.cancelled = false;
        this.statusElement = document.getElementById('status-msg');
    }

    async start() {
        const initial = this.solver.startingShapes.map((s, i) => ({
            id: i + 1,
            shape: s
        }));

        const initialState = {
            availableShapes: [...initial],
            solution: initial.map(shape => `${shape.id}=${shape.shape}`).join(';')
        };

        let depth = 0;
        let currentLevel = [initialState];
        const visited = new Set();
        visited.add(this.getStateKey(initialState.availableShapes));
        const t0 = performance.now();

        while (currentLevel.length > 0 && !this.cancelled) {
            const nextLevel = [];

            // Process all states at current depth
            for (const state of currentLevel) {
                // Check if we've found the solution
                if (state.availableShapes.some(s => s.shape === this.solver.targetShape)) {
                    const elapsed = (performance.now() - t0) / 1000;
                    this.statusElement.textContent = `Solved in ${elapsed.toFixed(2)}s at depth ${depth}, ${visited.size} states`;
                    this.displaySolution(state.solution);
                    return;
                }

                // Try all operations
                for (const [opName, op] of Object.entries(this.solver.operations)) {
                    // Skip if not enough shapes
                    if (state.availableShapes.length < op.inputs) continue;

                    // Get valid combinations - SPECIAL HANDLING FOR PAINTER
                    if (opName === 'painter') {
                        // For painter, we need shape + color combinations
                        const validShapes = state.availableShapes.filter(s => s.shape !== '--------');
                        const colors = [...new Set(this.solver.targetShape.match(/[rgbcmyw]/g) || [])];

                        for (const shape of validShapes) {
                            for (const color of colors) {
                                try {
                                    const outputs = op.apply(shape.shape, color);
                                    this.processState(
                                        state,
                                        [shape], // Only the shape is the input (color is extra data)
                                        op,
                                        outputs,
                                        [color], // Pass color as extra data
                                        nextLevel,
                                        visited
                                    );
                                } catch (e) {
                                    // Invalid operation, skip
                                }
                            }
                        }
                    } else {
                        // Normal operation handling
                        const validShapes = state.availableShapes.filter(s => s.shape !== '--------');
                        const combos = this.getCombinations(validShapes, op.inputs);

                        for (const combo of combos) {
                            try {
                                const inputs = combo.map(s => s.shape);
                                const outputs = op.apply(...inputs);
                                this.processState(state, combo, op, outputs, null, nextLevel, visited);
                            } catch (e) {
                                // Invalid operation, skip
                            }
                        }
                    }
                }
            }

            // Update status and prepare next level
            depth++;
            this.statusElement.textContent = `Depth ${depth} → ${nextLevel.length} states | ${visited.size} total states`;
            currentLevel = nextLevel;
        }

        this.statusElement.textContent = this.cancelled
            ? 'Cancelled'
            : `No solution found after ${depth} steps (${visited.size} states)`;
        this.displaySolution(null);
    }

    getCombinations(arr, k) {
        if (k === 1) return arr.map(v => [v]);
        const result = [];
        for (let i = 0; i <= arr.length - k; i++) {
            const rest = this.getCombinations(arr.slice(i + 1), k - 1);
            for (const combo of rest) result.push([arr[i], ...combo]);
        }
        return result;
    }

    getStateKey(shapes) {
        return shapes.map(s => s.shape).sort().join('|');
    }

    processState(currentState, combo, op, outputs, extraData, nextLevel, visited) {
        // Create new available shapes (remove inputs, add outputs)
        const newAvailable = currentState.availableShapes.filter(
            s => !combo.includes(s)
        );

        const newShapes = outputs.map(shape => ({
            id: this.solver.nextId++,
            shape
        }));

        newAvailable.push(...newShapes);

        // Create operation string - SPECIAL HANDLING FOR PAINTER
        let opStr;
        if (op === operations.painter) {
            opStr = op.toString(combo[0].id, extraData[0], newShapes[0].id);
        } else {
            opStr = op.toString(...combo.map(s => s.id), ...newShapes.map(s => s.id));
        }

        // Create new solution string
        const newSolution = `${currentState.solution};${opStr}`;

        // Check visited state
        const stateKey = this.getStateKey(newAvailable);
        if (visited.has(stateKey)) return;

        visited.add(stateKey);
        nextLevel.push({
            availableShapes: newAvailable,
            solution: newSolution
        });
    }

    cancel() {
        this.cancelled = true;
        this.statusElement.textContent = 'Cancelled.';
    }

    displaySolution(solution) {
        const output = document.getElementById('output');
        output.textContent = solution || 'No solution found.';
        this.renderGraph(solution);
    }

    renderGraph(solution) {
        const container = document.getElementById('graph-container');
        container.innerHTML = '';
        if (!solution) return;

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
                        idToShape[inputs[0]], inputs[1]
                    )[0];
                } else {
                    const inputShapes = inputs.filter(inp => idToShape[inp]).map(inp => idToShape[inp]);
                    const outputShapes = this.applyOperation(op, ...inputShapes);
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
                elements.push({
                    data: { id: nodeId, label: shape },
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
                if (op === 'paint') opLabel += ` (${inputs[1]})`;
                elements.push({
                    data: { id: opId, label: opLabel },
                    classes: 'op'
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

                    // Use shape from mapping
                    const shapeLabel = idToShape[output] || output;
                    elements.push({
                        data: { id: nodeId, label: shapeLabel },
                        classes: 'shape'
                    });

                    // Connect operation to output
                    elements.push({
                        data: { source: opId, target: nodeId }
                    });
                });
            }
        }

        // Render graph
        cytoscape({
            container,
            elements,
            style: [
                {
                    selector: 'node',
                    style: {
                        'background-color': '#888',
                        'label': 'data(label)',
                        'color': '#fff',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'text-outline-width': 1,
                        'text-outline-color': '#333',
                        'width': '60px',
                        'height': '60px'
                    }
                },
                {
                    selector: '.op',
                    style: {
                        'background-color': '#0074D9',
                        'shape': 'rectangle',
                        'width': '40px',
                        'height': '40px'
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 2,
                        'line-color': '#aaa',
                        'target-arrow-color': '#aaa',
                        'target-arrow-shape': 'triangle'
                    }
                }
            ],
            layout: {
                name: 'dagre',
                rankDir: 'LR',
                nodeSep: 50,
                edgeSep: 10,
                rankSep: 100
            },
            userZoomingEnabled: true,
            userPanningEnabled: true,
            boxSelectionEnabled: true,
            autoungrabify: false
        });
    }

    applyOperation(opName, ...shapes) {
        switch (opName) {
            case 'hcut': return operations.halfDestroyer.apply(shapes[0]);
            case 'cut': return operations.cutter.apply(shapes[0]);
            case 'swap': return operations.swapper.apply(...shapes);
            case 'r90cw': return operations.rotateCW.apply(shapes[0]);
            case 'r90ccw': return operations.rotateCCW.apply(shapes[0]);
            case 'r180': return operations.rotate180.apply(shapes[0]);
            case 'stack': return operations.stacker.apply(...shapes);
            case 'pin': return operations.pinPusher.apply(shapes[0]);
            case 'paint': return []; // Handled separately
            default: return [];
        }
    }
}

// ==================== Main Button Logic ====================
document.getElementById('calculate-btn').addEventListener('click', () => {
    const targetShape = document.getElementById('target-shape').value.trim();
    if (!targetShape) return;

    const startingShapes = getStartingShapes();
    const enabledOperations = getEnabledOperations();

    const solver = new BFSSolver(startingShapes, targetShape, enabledOperations);
    currentSolverController = new BFSSolverController(solver);
    currentSolverController.start();
});


document.getElementById('cancel-btn').addEventListener('click', () => {
    if (currentSolverController) {
        currentSolverController.cancel();
    }
});