import {
    Shape, ShapeOperationConfig,
    _getPaintColors, _getCrystalColors, _getSimilarity,
    halfCut, cut, swapHalves, rotate90CW, rotate90CCW, rotate180, stack, topPaint, pushPin, genCrystal
} from './shapeOperations.js';

const operations = {
    "Rotator CW": { fn: rotate90CW, inputCount: 1 },
    "Rotator CCW": { fn: rotate90CCW, inputCount: 1 },
    "Rotator 180": { fn: rotate180, inputCount: 1 },
    "Half Destroyer": { fn: halfCut, inputCount: 1 },
    "Cutter": { fn: cut, inputCount: 1 },
    "Swapper": { fn: swapHalves, inputCount: 2, orderedInputs: false },
    "Stacker": { fn: stack, inputCount: 2, orderedInputs: true },
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
            cleanPainting
        );
        self.postMessage({ type: 'result', result });
    } else if (action === 'explore') {
        cancelled = false;
        const { startingShapeCodes, enabledOperations, depthLimit, maxLayers } = data;
        try {
            const graph = await shapeExplorer(startingShapeCodes, enabledOperations, depthLimit || 999, maxLayers || 4);
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

async function shapeSolver(targetShapeCodes, startingShapeCodes, enabledOperations, maxLayers, maxStatesPerLevel = Infinity, preventWaste, orientationSensitive, cleanPainting) {
    const config = new ShapeOperationConfig(maxLayers);
    const startTime = performance.now();
    let lastUpdate = startTime;
    let depth = 0;

    const targetObjects = targetShapeCodes.map((code) => Shape.fromShapeCode(code));

    const targetAcceptableSets = targetObjects.map((targetShape) => {
        const acceptable = new Set();

        if (orientationSensitive) {
            acceptable.add(targetShape.toBitKey());
            return acceptable;
        }

        let current = targetShape;
        for (let rotation = 0; rotation < targetShape.numParts; rotation++) {
            acceptable.add(current.toBitKey());
            current = rotate90CW(current, config)[0];
        }

        return acceptable;
    });

    const anyTargetAcceptableKey = new Set();
    for (const acceptable of targetAcceptableSets) {
        for (const key of acceptable) {
            anyTargetAcceptableKey.add(key);
        }
    }

    const enabledOperationDefs = enabledOperations
        .map((name) => ({ name, ...operations[name] }))
        .filter((entry) => entry.fn);

    // crystal generation only needs colors present in targets
    const targetCrystalColors = new Set(
        targetObjects.flatMap(t => [..._getCrystalColors(t)])
    );
    const targetCrystalColorList = [...targetCrystalColors];

    const similarityCache = new Map();
    const shapeHeuristicCache = new Map();

    function getCachedSimilarity(shapeObj) {
        const key = shapeObj.toBitKey();
        let score = similarityCache.get(key);
        if (score === undefined) {
            score = 0;
            for (const t of targetObjects) {
                const s = _getSimilarity(shapeObj, t);
                if (s > score) score = s;
            }
            similarityCache.set(key, score);
        }
        return score;
    }

    function getCachedShapeHeuristic(shapeObj) {
        const key = shapeObj.toBitKey();
        let info = shapeHeuristicCache.get(key);
        if (info !== undefined) return info;

        const matchTargets = [];
        for (let i = 0; i < targetAcceptableSets.length; i++) {
            if (targetAcceptableSets[i].has(key)) {
                matchTargets.push(i);
            }
        }

        info = {
            similarity: getCachedSimilarity(shapeObj),
            matchTargets
        };
        shapeHeuristicCache.set(key, info);
        return info;
    }

    const paintColorsCache = new Map(); // inputShapeBitKey -> string[]
    const unaryOperationCache = new Map();
    const binaryOperationCache = new Map();
    const MAX_UNARY_CACHE_SIZE = 250000;
    const MAX_BINARY_CACHE_SIZE = 250000;

    function getCachedPaintColors(inputShape) {
        const key = inputShape.toBitKey();
        let colors = paintColorsCache.get(key);
        if (colors === undefined) {
            colors = [...new Set(targetObjects.flatMap(t => _getPaintColors(inputShape, t)))];
            paintColorsCache.set(key, colors);
        }
        return colors;
    }

    function getCachedUnaryOutputs(opName, fn, inputShape, color) {
        const shapeKey = inputShape.toBitKey();
        const cacheKey = color === undefined
            ? `${opName}|${shapeKey}`
            : `${opName}|${shapeKey}|${color}`;

        let cachedOutputs = unaryOperationCache.get(cacheKey);
        if (cachedOutputs !== undefined) return cachedOutputs;

        cachedOutputs = color === undefined ? fn(inputShape, config) : fn(inputShape, color, config);
        if (unaryOperationCache.size > MAX_UNARY_CACHE_SIZE) {
            unaryOperationCache.clear();
        }
        unaryOperationCache.set(cacheKey, cachedOutputs);
        return cachedOutputs;
    }

    function getCachedBinaryOutputs(opName, fn, leftShape, rightShape, orderedInputs) {
        const leftKey = leftShape.toBitKey();
        const rightKey = rightShape.toBitKey();
        const cachePairKey = orderedInputs || leftKey <= rightKey
            ? `${leftKey}|${rightKey}`
            : `${rightKey}|${leftKey}`;
        const cacheKey = `${opName}|${cachePairKey}`;

        let cachedOutputs = binaryOperationCache.get(cacheKey);
        if (cachedOutputs !== undefined) return cachedOutputs;

        const inputA = orderedInputs || leftKey <= rightKey ? leftShape : rightShape;
        const inputB = orderedInputs || leftKey <= rightKey ? rightShape : leftShape;
        cachedOutputs = fn(inputA, inputB, config);
        if (binaryOperationCache.size > MAX_BINARY_CACHE_SIZE) {
            binaryOperationCache.clear();
        }
        binaryOperationCache.set(cacheKey, cachedOutputs);
        return cachedOutputs;
    }

    // match each target to one of the remaining available shapes
    function checkGoal(availableIds) {
        const remainingKeys = [];
        for (const id of availableIds) {
            remainingKeys.push(shapeKeys.get(id));
        }

        for (const acceptableSet of targetAcceptableSets) {
            let totalTp = 0;
            for (let i = 0; i < remainingKeys.length; i++) {
                if (acceptableSet.has(remainingKeys[i])) totalTp += 1.0;
            }

            if (totalTp < 1.0 - 1e-9) return false;
        }

        if (preventWaste) {
            for (let i = 0; i < remainingKeys.length; i++) {
                if (!anyTargetAcceptableKey.has(remainingKeys[i])) {
                    return false;
                }
            }
        }

        return true;
    }

    // score states by average similarity
    function calculateStateScore(availableIds) {
        if (!availableIds.size) return 0;

        let totalSimilarity = 0;
        let exactMatchCount = 0;
        const targetCoverage = new Float64Array(targetAcceptableSets.length);
        let wasteCount = 0;

        for (const id of availableIds) {
            const shapeObj = shapes.get(id);
            const { similarity, matchTargets } = getCachedShapeHeuristic(shapeObj);
            totalSimilarity += similarity;

            if (matchTargets.length > 0) {
                exactMatchCount++;
                for (const targetIndex of matchTargets) {
                    targetCoverage[targetIndex] += 1.0;
                }
            } else {
                wasteCount++;
            }
        }

        let coveredTargets = 0;
        for (let i = 0; i < targetCoverage.length; i++) {
            if (targetCoverage[i] >= 1.0 - 1e-9) coveredTargets++;
        }

        const avgSimilarity = totalSimilarity / availableIds.size;
        const exactRatio = exactMatchCount / availableIds.size;
        const targetCoverageRatio = targetAcceptableSets.length === 0 ? 1 : (coveredTargets / targetAcceptableSets.length);
        const wastePenalty = wasteCount > 0 ? Math.min(0.35, wasteCount * 0.08) : 0;

        return (
            (avgSimilarity * 0.55) +
            (targetCoverageRatio * 0.35) +
            (exactRatio * 0.10) -
            wastePenalty
        );
    }

    function getStateKey(availableIds) {
        const parts = [];
        for (const id of availableIds) {
            parts.push(shapeKeys.get(id));
        }
        parts.sort();
        return parts.join('|');
    }

    let nextId = 0;
    const shapes = new Map();
    const shapeKeys = new Map();
    const initialAvailableIds = new Set();

    for (const code of startingShapeCodes) {
        const shapeObj = Shape.fromShapeCode(code);
        shapes.set(nextId, shapeObj);
        shapeKeys.set(nextId, shapeObj.toBitKey());
        initialAvailableIds.add(nextId);
        nextId++;
    }

    function registerShape(id, shapeObj) {
        shapes.set(id, shapeObj);
        shapeKeys.set(id, shapeObj.toBitKey());
    }

    const queue   = [{ availableIds: initialAvailableIds, path: [], depth: 0, score: calculateStateScore(initialAvailableIds) }];
    const visited = new Set([getStateKey(initialAvailableIds)]);
    let queueIndex = 0;

    function pruneStatesAtDepth(states, maxStates) {
        if (states.length <= maxStates) return states;
        states.sort((a, b) => b.score - a.score);
        return states.slice(0, maxStates);
    }

    // breadth-first search through reachable states (BFS)
    while (queueIndex < queue.length && !cancelled) {
        depth = queue[queueIndex].depth;
        const depthStartIndex = queueIndex;
        while (queueIndex < queue.length && queue[queueIndex].depth === depth) {
            queueIndex++;
        }
        const nextDepthStates = [];

        for (let stateIndex = depthStartIndex; stateIndex < queueIndex; stateIndex++) {
            if (cancelled) break;

            const current = queue[stateIndex];
            const { availableIds, path } = current;

            // check goal
            if (checkGoal(availableIds)) {
                const solutionPath = path.map(step => ({
                    operation: step.type,
                    inputs:    step.inputIds.map(id => ({ id, shape: shapes.get(id).toShapeCode() })),
                    outputs:   step.outputIds.map(id => ({ id, shape: shapes.get(id).toShapeCode() })),
                    params:    step.color ? { color: step.color } : {}
                }));
                return { solutionPath, depth, statesExplored: visited.size };
            }

            for (const op of enabledOperationDefs) {
                if (cancelled) break;
                const { name: opName, fn, inputCount, needsColor, orderedInputs = true } = op;

                if (inputCount === 1) {
                    for (const id of availableIds) {
                        if (cancelled) break;
                        const inputShape = shapes.get(id);
                        const inputKey = shapeKeys.get(id);

                        if (needsColor) {
                            if (cleanPainting && opName === "Painter") {
                                if (!inputShape.isSingleLayerFullyUncoloredForPaint()) continue;
                            }

                            const colors = opName === "Painter"
                                ? getCachedPaintColors(inputShape)
                                : targetCrystalColorList;

                            for (const color of colors) {
                                const outputs = getCachedUnaryOutputs(opName, fn, inputShape, color);
                                if (outputs.length === 1 && outputs[0].toBitKey() === inputKey) {
                                    continue;
                                }
                                const newIds = [];
                                for (const outputShape of outputs) {
                                    if (!outputShape.isEmpty()) {
                                        const newId = nextId++;
                                        registerShape(newId, outputShape);
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
                                    } else {
                                        for (const newId of newIds) {
                                            shapes.delete(newId);
                                            shapeKeys.delete(newId);
                                        }
                                    }
                                }
                            }
                        } else {
                            const outputs = getCachedUnaryOutputs(opName, fn, inputShape);
                            if (outputs.length === 1 && outputs[0].toBitKey() === inputKey) {
                                continue;
                            }
                            const newIds = [];
                            for (const outputShape of outputs) {
                                if (!outputShape.isEmpty()) {
                                    const newId = nextId++;
                                    registerShape(newId, outputShape);
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
                                } else {
                                    for (const newId of newIds) {
                                        shapes.delete(newId);
                                        shapeKeys.delete(newId);
                                    }
                                }
                            }
                        }
                    }
                } else if (inputCount === 2) {
                    const ids = Array.from(availableIds);
                    for (let i = 0; i < ids.length && !cancelled; i++) {
                        const jStart = orderedInputs ? 0 : i + 1;
                        for (let j = jStart; j < ids.length && !cancelled; j++) {
                            if (i === j) continue;
                            const id1 = ids[i];
                            const id2 = ids[j];
                            const inputShape1 = shapes.get(id1);
                            const inputShape2 = shapes.get(id2);
                            const outputs = getCachedBinaryOutputs(opName, fn, inputShape1, inputShape2, orderedInputs);
                            const newIds = [];
                            for (const outputShape of outputs) {
                                if (!outputShape.isEmpty()) {
                                    const newId = nextId++;
                                    registerShape(newId, outputShape);
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
                                } else {
                                    for (const newId of newIds) {
                                        shapes.delete(newId);
                                        shapeKeys.delete(newId);
                                    }
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

        if (queueIndex > 2048 && queueIndex * 2 > queue.length) {
            queue.splice(0, queueIndex);
            queueIndex = 0;
        }

        const now = performance.now();
        if (now - lastUpdate > 200) {
            const prunedCount = nextDepthStates.length - prunedNextStates.length;
            const pruneInfo = prunedCount > 0 ? ` | Pruned ${prunedCount} States` : '';
            const pendingStates = queue.length - queueIndex;
            self.postMessage({
                type: 'status',
                message: `Solving at Depth ${depth} → ${pendingStates} States | ${visited.size} Total States${pruneInfo}`
            });
            lastUpdate = now;
        }
    }

    if (cancelled) return null;
    self.postMessage({ type: 'result', result: { solutionPath: null, depth, statesExplored: visited.size } });
    return null;
}

async function shapeExplorer(startingShapeCodes, enabledOperations, depthLimit, maxLayers) {
    const config = new ShapeOperationConfig(maxLayers);
    const enabledOperationDefs = enabledOperations
        .map((name) => ({ name, ...operations[name] }))
        .filter((entry) => entry.fn);

    let nextShapeId = 0;
    let nextOpId = 0;
    const shapeKeyToId = new Map();
    const shapeById = new Map();
    const shapesList = [];
    const opsList = [];
    const edges = [];

    function addShapeIfNew(shapeOrCode) {
        const shapeObj = shapeOrCode instanceof Shape ? shapeOrCode : Shape.fromShapeCode(shapeOrCode);
        const key = shapeObj.toBitKey();

        if (!shapeKeyToId.has(key)) {
            const id = nextShapeId++;
            shapeKeyToId.set(key, id);
            shapeById.set(id, shapeObj);
            shapesList.push({ id, code: shapeObj.toShapeCode() });
            return { id, added: true };
        }
        return { id: shapeKeyToId.get(key), added: false };
    }

    function getShapeById(id) {
        return shapeById.get(id);
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

        for (const op of enabledOperationDefs) {
            if (cancelled) {
                return null;
            }

            const { name: opName, fn, inputCount, needsColor } = op;

            if (inputCount === 1) {
                for (const id of primaryIds) {
                    if (cancelled) break;

                    const inputShape = getShapeById(id);
                    if (inputShape.isEmpty()) continue;
                    const inputKey = inputShape.toBitKey();
                    const colors = needsColor ? ["r"] : [null];

                    for (const color of colors) {
                        if (cancelled) break;

                        const outputs = needsColor ? fn(inputShape, color, config) : fn(inputShape, config);
                        const outputKeys = outputs.map((outputShape) => outputShape.toBitKey());

                        if (outputKeys.some((outputKey) => outputKey === inputKey)) {
                            continue;
                        }

                        const opId = `op-${nextOpId++}`;
                        opsList.push({ id: opId, type: opName, params: color ? { color } : {} });
                        edges.push({ source: `shape-${id}`, target: opId });

                        for (const outputShape of outputs) {
                            const { id: outId, added } = addShapeIfNew(outputShape);
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
                            const outA = fn(s1, s2, config).map((outputShape) => outputShape.toBitKey());
                            const outB = fn(s2, s1, config).map((outputShape) => outputShape.toBitKey());
                            const sameOutputs = outA.length === outB.length && outA.every((key, index) => key === outB[index]);

                            if (sameOutputs && id1 > id2) {
                                continue;
                            }
                        }

                        const outputs = fn(s1, s2, config);
                        const outputKeys = outputs.map((outputShape) => outputShape.toBitKey());
                        const key1 = s1.toBitKey();
                        const key2 = s2.toBitKey();

                        if (outputKeys.some((outputKey) => outputKey === key1 || outputKey === key2)) {
                            continue;
                        }

                        const opId = `op-${nextOpId++}`;
                        opsList.push({ id: opId, type: opName, params: {} });
                        edges.push({ source: `shape-${id1}`, target: opId });
                        edges.push({ source: `shape-${id2}`, target: opId });

                        for (const outputShape of outputs) {
                            const { id: outId, added } = addShapeIfNew(outputShape);
                            if (outId === null) continue;
                            if (added) {
                                availableIds.add(outId);
                                newlyDiscovered.add(outId);
                            }
                            edges.push({ source: opId, target: `shape-${outId}` });
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

