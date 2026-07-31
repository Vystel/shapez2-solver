import {
    Shape, ShapeOperationConfig,
    _getAllRotations, _getPaintColors, _getCrystalColors, _getSimilarity,
    halfCut, cut, swapHalves, rotate90CW, rotate90CCW, rotate180, stack, topPaint, pushPin, genCrystal
} from './shapeOperations.js';
import { UNCOLORED_CODE, UNPAINTABLE_PARTS } from './shapeConstants.js';

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
            targetShapeCodes,
            startingShapeCodes,
            enabledOperations,
            maxLayers,
            maxStatesPerLevel,
            preventWaste,
            orientationSensitive,
            allowSplitting,
            cleanPainting
        } = data;

        cancelled = false;
        const result = await shapeSolver(
            targetShapeCodes,
            startingShapeCodes,
            enabledOperations,
            maxLayers,
            maxStatesPerLevel,
            preventWaste,
            orientationSensitive,
            allowSplitting,
            cleanPainting
        );
        self.postMessage({ type: 'result', result });
    } else if (action === 'explore') {
        cancelled = false;
        const { startingShapeCodes, enabledOperations, depthLimit, maxLayers, skipTwoInputOps } = data;
        try {
            const graph = await shapeExplorer(
                startingShapeCodes,
                enabledOperations,
                depthLimit || 999,
                maxLayers || 4,
                skipTwoInputOps
            );
            if (!cancelled) {
                self.postMessage({ type: 'result', result: graph });
            }
        } catch (err) {
            self.postMessage({ type: 'status', message: `Error: ${err.message}` });
        }
    } else if (action === 'cancel') {
        cancelled = true;
        self.postMessage({ type: 'status', message: 'Cancelled.' });
    }
};

async function shapeSolver(targetShapeCodes, startingShapeCodes, enabledOperations, maxLayers, maxStatesPerLevel = Infinity, preventWaste, orientationSensitive, allowSplitting, cleanPainting) {
    const config = new ShapeOperationConfig(maxLayers);
    const startTime = performance.now();
    let lastUpdate = startTime;
    let depth = 0;

    const targetObjects = targetShapeCodes.map(c => Shape.fromShapeCode(c));

    const targetAcceptableSets = targetObjects.map((tObj, i) => {
        const s = new Set();
        if (orientationSensitive) {
            s.add(targetShapeCodes[i]);
        } else {
            for (const code of _getAllRotations(tObj, config)) s.add(code);
        }
        return s;
    });

    // crystal generation only needs colors present in targets
    const targetCrystalColors = new Set(
        targetObjects.flatMap(t => [..._getCrystalColors(t)])
    );

    const similarityCache = new Map();

    function getCachedSimilarity(code) {
        let score = similarityCache.get(code);
        if (score === undefined) {
            const shapeObj = Shape.fromShapeCode(code);
            score = 0;
            for (const t of targetObjects) {
                const s = _getSimilarity(shapeObj, t);
                if (s > score) score = s;
            }
            similarityCache.set(code, score);
        }
        return score;
    }

    const paintColorsCache = new Map(); // inputShapeCode → string[]

    function getCachedPaintColors(inputShape) {
        const code = inputShape.toShapeCode();
        let colors = paintColorsCache.get(code);
        if (colors === undefined) {
            colors = [...new Set(targetObjects.flatMap(t => _getPaintColors(inputShape, t)))];
            paintColorsCache.set(code, colors);
        }
        return colors;
    }

    // match each target to one of the remaining available shapes
    function checkGoal(availableIds) {
        const remaining = [];
        for (const id of availableIds) {
            remaining.push({
                code: shapes.get(id),
                tp: allowSplitting ? (throughput.get(id) ?? 1.0) : 1.0
            });
        }

        for (const acceptableSet of targetAcceptableSets) {
            const matchIdx = [];
            for (let i = 0; i < remaining.length; i++) {
                if (acceptableSet.has(remaining[i].code)) matchIdx.push(i);
            }

            const totalTp = matchIdx.reduce((sum, i) => sum + remaining[i].tp, 0);
            if (totalTp < 1.0 - 1e-9) return false;

            let needed = 1.0;
            const toRemove = new Set();
            for (const i of matchIdx) {
                if (needed <= 1e-9) break;
                const consume = Math.min(remaining[i].tp, needed);
                needed -= consume;
                remaining[i].tp -= consume;
                if (remaining[i].tp < 1e-9) toRemove.add(i);
            }
            for (let i = remaining.length - 1; i >= 0; i--) {
                if (toRemove.has(i)) remaining.splice(i, 1);
            }
        }

        if (preventWaste && remaining.some(item =>
            item.tp > 1e-9 && !targetAcceptableSets.some(s => s.has(item.code))
        )) return false;

        return true;
    }

    // score states by average similarity
    function calculateStateScore(availableIds) {
        if (!availableIds.size) return 0;
        let total = 0;
        for (const id of availableIds) {
            total += getCachedSimilarity(shapes.get(id));
        }
        return total / availableIds.size;
    }

    function getStateKey(availableIds) {
        const parts = [];
        for (const id of availableIds) {
            const code = shapes.get(id);
            if (allowSplitting) {
                parts.push(`${code}@${throughput.get(id) ?? 1.0}`);
            } else {
                parts.push(code);
            }
        }
        parts.sort();
        return parts.join('|');
    }

    const shapeObjects = new Map();

    let nextId = 0;
    const shapes = new Map();
    const throughput = new Map();
    const initialAvailableIds = new Set();

    for (const code of startingShapeCodes) {
        shapes.set(nextId, code);
        shapeObjects.set(nextId, Shape.fromShapeCode(code));
        throughput.set(nextId, 1.0);
        initialAvailableIds.add(nextId);
        nextId++;
    }

    function registerShape(id, shapeObj, tp) {
        const code = shapeObj.toShapeCode();
        shapes.set(id, code);
        shapeObjects.set(id, shapeObj);
        throughput.set(id, tp);
    }

    const queue   = [{ availableIds: initialAvailableIds, path: [], depth: 0, score: calculateStateScore(initialAvailableIds) }];
    const visited = new Set([getStateKey(initialAvailableIds)]);

    function pruneStatesAtDepth(states, maxStates) {
        if (states.length <= maxStates) return states;
        states.sort((a, b) => b.score - a.score);
        return states.slice(0, maxStates);
    }

    // breadth-first search through reachable states (BFS)
    while (queue.length > 0 && !cancelled) {
        const currentDepthStates = [];
        while (queue.length > 0 && queue[0].depth === depth) {
            currentDepthStates.push(queue.shift());
        }

        const nextDepthStates = [];

        for (const current of currentDepthStates) {
            if (cancelled) break;

            const { availableIds, path } = current;

            // check goal
            if (checkGoal(availableIds)) {
                const solutionPath = path.map(step => ({
                    operation: step.type,
                    inputs:    step.inputIds.map(id => ({ id, shape: shapes.get(id) })),
                    outputs:   step.outputIds.map(id => ({ id, shape: shapes.get(id) })),
                    params:    step.color ? { color: step.color } : {}
                }));
                return { solutionPath, depth, statesExplored: visited.size };
            }

            // splitter duplicates a shape and halves throughput
            if (allowSplitting) {
                for (const id of availableIds) {
                    const code = shapes.get(id);
                    const idA = nextId++;
                    const idB = nextId++;
                    const parentTp = throughput.get(id) ?? 1.0;
                    const childTp = parentTp / 2;

                    shapes.set(idA, code);
                    shapeObjects.set(idA, shapeObjects.get(id));
                    throughput.set(idA, childTp);

                    shapes.set(idB, code);
                    shapeObjects.set(idB, shapeObjects.get(id));
                    throughput.set(idB, childTp);

                    const newAvailableIds = new Set(availableIds);
                    newAvailableIds.delete(id);
                    newAvailableIds.add(idA);
                    newAvailableIds.add(idB);

                    const stateKey = getStateKey(newAvailableIds);
                    if (!visited.has(stateKey)) {
                        visited.add(stateKey);
                        const newPath = [...path, { type: "Splitter", inputIds: [id], outputIds: [idA, idB] }];
                        nextDepthStates.push({ availableIds: newAvailableIds, path: newPath, depth: depth + 1, score: calculateStateScore(newAvailableIds) });
                    }
                }
            }

            for (const opName of enabledOperations) {
                if (cancelled) break;
                const op = operations[opName];
                if (!op) continue;
                const { fn, inputCount, needsColor } = op;

                if (inputCount === 1) {
                    for (const id of availableIds) {
                        if (cancelled) break;
                        const inputShape = shapeObjects.get(id);
                        const inputTp = throughput.get(id) ?? 1.0;

                        if (needsColor) {
                            if (cleanPainting && opName === "Painter") {
                                if (inputShape.layers.length !== 1) continue;
                                const topLayer = inputShape.layers[0];
                                const allUncolored = topLayer.every(part =>
                                    UNPAINTABLE_PARTS.includes(part.shape) || part.color === UNCOLORED_CODE
                                );
                                if (!allUncolored) continue;
                            }

                            const colors = opName === "Painter"
                                ? getCachedPaintColors(inputShape)
                                : [...targetCrystalColors];

                            for (const color of colors) {
                                const outputs = fn(inputShape, color, config);
                                const newIds = [];
                                for (const outputShape of outputs) {
                                    if (!outputShape.isEmpty()) {
                                        const newId = nextId++;
                                        registerShape(newId, outputShape, inputTp);
                                        newIds.push(newId);
                                    }
                                }
                                if (newIds.length > 0) {
                                    const newAvailableIds = new Set(availableIds);
                                    newAvailableIds.delete(id);
                                    for (const newId of newIds) newAvailableIds.add(newId);
                                    const stateKey = getStateKey(newAvailableIds);
                                    if (!visited.has(stateKey)) {
                                        visited.add(stateKey);
                                        const newPath = [...path, { type: opName, inputIds: [id], color, outputIds: newIds }];
                                        nextDepthStates.push({ availableIds: newAvailableIds, path: newPath, depth: depth + 1, score: calculateStateScore(newAvailableIds) });
                                    }
                                }
                            }
                        } else {
                            const outputs = fn(inputShape, config);
                            const newIds = [];
                            for (const outputShape of outputs) {
                                if (!outputShape.isEmpty()) {
                                    const newId = nextId++;
                                    registerShape(newId, outputShape, inputTp);
                                    newIds.push(newId);
                                }
                            }
                            if (newIds.length > 0) {
                                const newAvailableIds = new Set(availableIds);
                                newAvailableIds.delete(id);
                                for (const newId of newIds) newAvailableIds.add(newId);
                                const stateKey = getStateKey(newAvailableIds);
                                if (!visited.has(stateKey)) {
                                    visited.add(stateKey);
                                    const newPath = [...path, { type: opName, inputIds: [id], outputIds: newIds }];
                                    nextDepthStates.push({ availableIds: newAvailableIds, path: newPath, depth: depth + 1, score: calculateStateScore(newAvailableIds) });
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
                            const inputShape1 = shapeObjects.get(id1);
                            const inputShape2 = shapeObjects.get(id2);
                            const outputs = fn(inputShape1, inputShape2, config);
                            const newIds = [];
                            const combinedTp = Math.min(throughput.get(id1) ?? 1.0, throughput.get(id2) ?? 1.0);
                            for (const outputShape of outputs) {
                                if (!outputShape.isEmpty()) {
                                    const newId = nextId++;
                                    registerShape(newId, outputShape, combinedTp);
                                    newIds.push(newId);
                                }
                            }
                            if (newIds.length > 0) {
                                const newAvailableIds = new Set(availableIds);
                                newAvailableIds.delete(id1);
                                newAvailableIds.delete(id2);
                                for (const newId of newIds) newAvailableIds.add(newId);
                                const stateKey = getStateKey(newAvailableIds);
                                if (!visited.has(stateKey)) {
                                    visited.add(stateKey);
                                    const newPath = [...path, { type: opName, inputIds: [id1, id2], outputIds: newIds }];
                                    nextDepthStates.push({ availableIds: newAvailableIds, path: newPath, depth: depth + 1, score: calculateStateScore(newAvailableIds) });
                                }
                            }
                        }
                    }
                }
            }
        }

        // keep only the best-scoring states for the next depth (beam search)
        const prunedNextStates = pruneStatesAtDepth(nextDepthStates, maxStatesPerLevel);

        for (const state of prunedNextStates) {
            queue.push(state);
        }

        if (queue.length > 0) {
            depth = queue[0].depth;
        }

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

    if (cancelled) return null;
    self.postMessage({ type: 'result', result: { solutionPath: null, depth, statesExplored: visited.size } });
    return null;
}

async function shapeExplorer(startingShapeCodes, enabledOperations, depthLimit, maxLayers, skipTwoInputOps = false) {
    const config = new ShapeOperationConfig(maxLayers);

    let nextShapeId = 0;
    let nextOpId = 0;
    const shapeCodeToId = new Map();
    const shapesList = [];
    const opsList = [];
    const edges = [];

    function addShapeIfNew(code) {
        if (!shapeCodeToId.has(code)) {
            const id = nextShapeId++;
            shapeCodeToId.set(code, id);
            shapesList.push({ id, code });
            return { id, added: true };
        }
        return { id: shapeCodeToId.get(code), added: false };
    }

    function getShapeById(id) {
        return Shape.fromShapeCode(shapesList.find(s => s.id === id).code);
    }

    const availableIds = new Set();
    for (const code of startingShapeCodes) {
        const { id } = addShapeIfNew(code);
        availableIds.add(id);
    }

    let frontier = new Set(availableIds);

    for (let depth = 1; depth <= depthLimit; depth++) {
        if (cancelled) {
            return null;
        }

        const newlyDiscovered = new Set();
        const startIds = Array.from(availableIds);
        const primaryIds = Array.from(frontier);

        if (primaryIds.length === 0) break;

        for (const opName of enabledOperations) {
            if (cancelled) {
                return null;
            }

            const op = operations[opName];
            if (!op) continue;

            const { fn, inputCount, needsColor } = op;

            if (inputCount === 1) {
                for (const id of primaryIds) {
                    if (cancelled) break;
                    
                    const inputShape = getShapeById(id);
                    if (inputShape.isEmpty()) continue;
                    const colors = needsColor ? ["r"] : [null];

                    for (const color of colors) {
                        if (cancelled) break;
                        
                        const outputs = needsColor ? fn(inputShape, color, config) : fn(inputShape, config);
                        const outputCodes = outputs.map(o => o.toShapeCode()).filter(Boolean);

                        if (outputCodes.some(oc => oc === shapesList[id].code)) {
                            continue;
                        }

                        const opId = `op-${nextOpId++}`;
                        opsList.push({ id: opId, type: opName, params: color ? { color } : {} });
                        edges.push({ source: `shape-${id}`, target: opId });

                        for (const oc of outputCodes) {
                            const { id: outId, added } = addShapeIfNew(oc);
                            if (outId === null) continue;
                            if (added) {
                                availableIds.add(outId);
                                newlyDiscovered.add(outId);
                            }
                            edges.push({ source: opId, target: `shape-${outId}` });
                        }
                    }
                }
            } else if (inputCount === 2) {
                const isStacker = opName === "Stacker";

                for (const id1 of startIds) {
                    if (cancelled) break;
                    
                    const s1 = getShapeById(id1);
                    if (s1.isEmpty()) continue;
                    
                    for (const id2 of primaryIds) {
                        if (cancelled) break;

                        if (id1 === id2 && !isStacker) continue;
                        if (id1 > id2 && !isStacker) continue;

                        const s2 = getShapeById(id2);
                        if (s2.isEmpty()) continue;

                        if (isStacker && id1 !== id2) {
                            const outA = fn(getShapeById(id1), getShapeById(id2), config)
                                .map(o => o.toShapeCode()).filter(Boolean);
                            const outB = fn(getShapeById(id2), getShapeById(id1), config)
                                .map(o => o.toShapeCode()).filter(Boolean);

                            if (JSON.stringify(outA) === JSON.stringify(outB) && id1 > id2) {
                                continue;
                            }
                        }

                        const outputs = fn(getShapeById(id1), getShapeById(id2), config);
                        const outputCodes = outputs.map(o => o.toShapeCode()).filter(Boolean);

                        const code1 = shapesList[id1].code;
                        const code2 = shapesList[id2].code;

                        if (outputCodes.some(oc => oc === code1 || oc === code2)) {
                            continue;
                        }

                        const recordOp = !skipTwoInputOps;
                        let opId = null;
                        if (recordOp) {
                            opId = `op-${nextOpId++}`;
                            opsList.push({ id: opId, type: opName, params: {} });
                            edges.push({ source: `shape-${id1}`, target: opId });
                            edges.push({ source: `shape-${id2}`, target: opId });
                        }

                        for (const oc of outputCodes) {
                            const { id: outId, added } = addShapeIfNew(oc);
                            if (outId === null) continue;
                            if (added) {
                                availableIds.add(outId);
                                newlyDiscovered.add(outId);
                            }
                            if (recordOp) {
                                edges.push({ source: opId, target: `shape-${outId}` });
                            }
                        }
                    }
                }
            }
        }
        frontier = newlyDiscovered;
    }

    if (!cancelled) {
        const shapesNodes = shapesList.map(s => ({ id: `shape-${s.id}`, code: s.code }));
        self.postMessage({ type: 'status', message: `Exploration complete. Shapes: ${shapesNodes.length}, Ops: ${opsList.length}` });
        return { shapes: shapesNodes, ops: opsList, edges };
    }
    
    return null;
}

