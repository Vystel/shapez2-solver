import {
    Shape, ShapeOperationConfig,
    _getAllRotations, _getPaintColors, _getCrystalColors, _getSimilarity,
    halfCut, cut, swapHalves, rotate90CW, rotate90CCW, rotate180, stack, topPaint, pushPin, genCrystal
} from './shapeOperations.js';

const operations = {
    "Rotator CW": { fn: rotate90CW, inputCount: 1 },
    "Rotator CCW": { fn: rotate90CCW, inputCount: 1 },
    "Rotator 180": { fn: rotate180, inputCount: 1 },
    "Half Destroyer": { fn: halfCut, inputCount: 1 },
    "Cutter": { fn: cut, inputCount: 1 },
    "Swapper": { fn: swapHalves, inputCount: 2 },
    "Stacker": { fn: stack, inputCount: 2 },
    "Painter": { fn: topPaint, inputCount: 1, needsColor: true },
    "Pin Pusher": { fn: pushPin, inputCount: 1 },
    "Crystal Generator": { fn: genCrystal, inputCount: 1, needsColor: true }
};

let cancelled = false;

self.onmessage = async function (e) {
    const { action, data } = e.data;

    if (action === 'solve') {
        const {
            targetShapeCode,
            startingShapeCodes,
            enabledOperations,
            maxLayers,
            maxStatesPerLevel,
            preventWaste,
            orientationSensitive,
            monolayerPainting
        } = data;

        cancelled = false;
        const result = await shapeSolver(
            targetShapeCode,
            startingShapeCodes,
            enabledOperations,
            maxLayers,
            maxStatesPerLevel,
            preventWaste,
            orientationSensitive,
            monolayerPainting
        );
        self.postMessage({ type: 'result', result });
    } else if (action === 'cancel') {
        cancelled = true;
        self.postMessage({ type: 'status', message: 'Cancelled.' });
    }
};

async function shapeSolver(targetShapeCode, startingShapeCodes, enabledOperations, maxLayers, maxStatesPerLevel = Infinity, preventWaste, orientationSensitive, monolayerPainting) {
    const target = Shape.fromShapeCode(targetShapeCode);
    const targetCrystalColors = _getCrystalColors(target);
    const config = new ShapeOperationConfig(maxLayers);
    const startTime = performance.now();
    let lastUpdate = startTime;
    let depth = 0;

    // Precompute acceptable shape codes
    const acceptable = new Set();
    if (orientationSensitive) {
        acceptable.add(targetShapeCode);
    } else {
        const rotations = _getAllRotations(target, config);
        for (const code of rotations) {
            acceptable.add(code);
        }
    }

    // Initialize shapes with unique IDs
    let nextId = 0;
    const shapes = new Map();
    const initialAvailableIds = new Set();
    for (const code of startingShapeCodes) {
        shapes.set(nextId, code);
        initialAvailableIds.add(nextId);
        nextId++;
    }

    // Function to calculate similarity score for a state
    function calculateStateScore(availableIds) {
        const shapeCodes = Array.from(availableIds).map(id => shapes.get(id));
        const shapeObjects = shapeCodes.map(code => Shape.fromShapeCode(code));

        let totalSimilarity = 0;
        for (const shape of shapeObjects) {
            totalSimilarity += _getSimilarity(shape, target);
        }

        return shapeObjects.length > 0 ? totalSimilarity / shapeObjects.length : 0;
    }

    // Function to turn a state's shapes into a string for visited check
    function getStateKey(availableIds) {
        const countMap = {};
        for (const id of availableIds) {
            const code = shapes.get(id);
            countMap[code] = (countMap[code] || 0) + 1;
        }
        const entries = Object.entries(countMap).sort();
        return JSON.stringify(entries);
    }

    // Solver setup
    const queue = [{ availableIds: initialAvailableIds, path: [], depth: 0, score: calculateStateScore(initialAvailableIds) }];
    const visited = new Set();
    visited.add(getStateKey(initialAvailableIds));

    // Function to prune states at current depth level
    function pruneStatesAtDepth(states, maxStates) {
        if (states.length <= maxStates) {
            return states;
        }

        // Sort by score (higher is better)
        states.sort((a, b) => b.score - a.score);

        // Keep only the top maxStates
        return states.slice(0, maxStates);
    }

    // Solver loop
    while (queue.length > 0 && !cancelled) {
        const currentDepthStates = [];
        while (queue.length > 0 && queue[0].depth === depth) {
            currentDepthStates.push(queue.shift());
        }

        const nextDepthStates = [];

        for (const current of currentDepthStates) {
            if (cancelled) break;

            const availableIds = current.availableIds;
            const path = current.path;

            // Check if goal is reached
            const shapeCodes = Array.from(availableIds).map(id => shapes.get(id));
            const hasTarget = shapeCodes.some(code => acceptable.has(code));
            const allTarget = preventWaste ? shapeCodes.every(code => acceptable.has(code)) : true;
            if (hasTarget && allTarget) {
                const solutionPath = path.map(step => ({
                    operation: step.type,
                    inputs: step.inputIds.map(id => ({ id, shape: shapes.get(id) })),
                    outputs: step.outputIds.map(id => ({ id, shape: shapes.get(id) })),
                    params: step.color ? { color: step.color } : {}
                }));
                return {
                    solutionPath,
                    depth,
                    statesExplored: visited.size
                };
            }

            // Generate next states
            for (const opName of enabledOperations) {
                if (cancelled) break;
                const op = operations[opName];
                if (!op) continue;
                const { fn, inputCount, needsColor } = op;

                if (inputCount === 1) {
                    for (const id of availableIds) {
                        if (cancelled) break;
                        const inputShape = Shape.fromShapeCode(shapes.get(id));
                        if (needsColor) {
                            if (monolayerPainting && opName === "Painter" && inputShape.layers.length !== 1) {
                                continue; // Skip painting this shape if it has more than one layer
                            }
                            const colors = opName === "Painter" ? _getPaintColors(inputShape, target) : targetCrystalColors;
                            for (const color of colors) {
                                const outputs = fn(inputShape, color, config);
                                const newIds = [];
                                for (const outputShape of outputs) {
                                    if (!outputShape.isEmpty()) {
                                        const newId = nextId++;
                                        shapes.set(newId, outputShape.toShapeCode());
                                        newIds.push(newId);
                                    }
                                }
                                if (newIds.length > 0) {
                                    const newAvailableIds = new Set(availableIds);
                                    newAvailableIds.delete(id);
                                    for (const newId of newIds) {
                                        newAvailableIds.add(newId);
                                    }
                                    const stateKey = getStateKey(newAvailableIds);
                                    if (!visited.has(stateKey)) {
                                        visited.add(stateKey);
                                        const newPath = [...path, { type: opName, inputIds: [id], color, outputIds: newIds }];
                                        const newScore = calculateStateScore(newAvailableIds);
                                        nextDepthStates.push({ availableIds: newAvailableIds, path: newPath, depth: depth + 1, score: newScore });
                                    }
                                }
                            }
                        } else {
                            const outputs = fn(inputShape, config);
                            const newIds = [];
                            for (const outputShape of outputs) {
                                if (!outputShape.isEmpty()) {
                                    const newId = nextId++;
                                    shapes.set(newId, outputShape.toShapeCode());
                                    newIds.push(newId);
                                }
                            }
                            if (newIds.length > 0) {
                                const newAvailableIds = new Set(availableIds);
                                newAvailableIds.delete(id);
                                for (const newId of newIds) {
                                    newAvailableIds.add(newId);
                                }
                                const stateKey = getStateKey(newAvailableIds);
                                if (!visited.has(stateKey)) {
                                    visited.add(stateKey);
                                    const newPath = [...path, { type: opName, inputIds: [id], outputIds: newIds }];
                                    const newScore = calculateStateScore(newAvailableIds);
                                    nextDepthStates.push({ availableIds: newAvailableIds, path: newPath, depth: depth + 1, score: newScore });
                                }
                            }
                        }
                    }
                } else if (inputCount === 2) {
                    const ids = Array.from(availableIds);
                    for (let i = 0; i < ids.length && !cancelled; i++) {
                        for (let j = 0; j < ids.length && !cancelled; j++) {
                            if (i === j) continue;
                            const id1 = ids[i];
                            const id2 = ids[j];
                            const inputShape1 = Shape.fromShapeCode(shapes.get(id1));
                            const inputShape2 = Shape.fromShapeCode(shapes.get(id2));
                            const outputs = fn(inputShape1, inputShape2, config);
                            const newIds = [];
                            for (const outputShape of outputs) {
                                if (!outputShape.isEmpty()) {
                                    const newId = nextId++;
                                    shapes.set(newId, outputShape.toShapeCode());
                                    newIds.push(newId);
                                }
                            }
                            if (newIds.length > 0) {
                                const newAvailableIds = new Set(availableIds);
                                newAvailableIds.delete(id1);
                                newAvailableIds.delete(id2);
                                for (const newId of newIds) {
                                    newAvailableIds.add(newId);
                                }
                                const stateKey = getStateKey(newAvailableIds);
                                if (!visited.has(stateKey)) {
                                    visited.add(stateKey);
                                    const newPath = [...path, { type: opName, inputIds: [id1, id2], outputIds: newIds }];
                                    const newScore = calculateStateScore(newAvailableIds);
                                    nextDepthStates.push({ availableIds: newAvailableIds, path: newPath, depth: depth + 1, score: newScore });
                                }
                            }
                        }
                    }
                }
            }
        }

        // Prune states for next depth level
        const prunedNextStates = pruneStatesAtDepth(nextDepthStates, maxStatesPerLevel);

        // Add pruned states back to queue
        for (const state of prunedNextStates) {
            queue.push(state);
        }

        // Move to next depth level
        if (queue.length > 0) {
            depth = queue[0].depth;
        }

        // Periodic status update
        const now = performance.now();
        if (now - lastUpdate > 200) {
            const prunedCount = nextDepthStates.length - prunedNextStates.length;
            const pruneInfo = prunedCount > 0 ? ` | Pruned ${prunedCount} States` : '';
            self.postMessage({
                type: 'status',
                message: `Solving at Depth ${depth} → ${queue.length} States | ${visited.size} Total States${pruneInfo}`
            });
            lastUpdate = now;
        }
    }

    if (cancelled) {
        return null;
    }
    self.postMessage({ type: 'result', result: { solutionPath: null, depth, statesExplored: visited.size } });
    return null;
}