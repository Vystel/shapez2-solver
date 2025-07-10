// ==================== Imports ====================
import { Shape, CRYSTAL_CHAR, UNPAINTABLE_SHAPES, cut, halfCut, rotate90CW, rotate90CCW, rotate180, swapHalves, stack, topPaint, pushPin, genCrystal, ShapeOperationConfig } from './shapeOperations.js'; // Import ShapeOperationConfig
import { createShapeCanvas, baseColors } from './shapeRendering.js';
import { renderGraph } from './operationGraph.js';

// ==================== Operation Definitions ====================
export const operations = {
    cutter: {
        inputs: 1,
        apply: (shapeCode, config) => {
            const shape = Shape.fromShapeCode(shapeCode);
            const results = cut(shape, config);
            return results.map(s => s.toShapeCode());
        },
        toString: (inputId, output1Id, output2Id) => `${inputId}:cut:${output1Id},${output2Id}`
    },

    halfDestroyer: {
        inputs: 1,
        apply: (shapeCode, config) => {
            const shape = Shape.fromShapeCode(shapeCode);
            const results = halfCut(shape, config);
            return results.map(s => s.toShapeCode());
        },
        toString: (inputId, outputId) => `${inputId}:hcut:${outputId}`
    },

    rotateCW: {
        inputs: 1,
        apply: (shapeCode, config) => {
            const shape = Shape.fromShapeCode(shapeCode);
            const results = rotate90CW(shape, config);
            return results.map(s => s.toShapeCode());
        },
        toString: (inputId, outputId) => `${inputId}:r90cw:${outputId}`
    },

    rotateCCW: {
        inputs: 1,
        apply: (shapeCode, config) => {
            const shape = Shape.fromShapeCode(shapeCode);
            const results = rotate90CCW(shape, config);
            return results.map(s => s.toShapeCode());
        },
        toString: (inputId, outputId) => `${inputId}:r90ccw:${outputId}`
    },

    rotate180: {
        inputs: 1,
        apply: (shapeCode, config) => {
            const shape = Shape.fromShapeCode(shapeCode);
            const results = rotate180(shape, config);
            return results.map(s => s.toShapeCode());
        },
        toString: (inputId, outputId) => `${inputId}:r180:${outputId}`
    },

    swapper: {
        inputs: 2,
        apply: (shapeCode1, shapeCode2, config) => {
            const shape1 = Shape.fromShapeCode(shapeCode1);
            const shape2 = Shape.fromShapeCode(shapeCode2);
            const results = swapHalves(shape1, shape2, config);
            return results.map(s => s.toShapeCode());
        },
        toString: (input1Id, input2Id, output1Id, output2Id) => `${input1Id},${input2Id}:swap:${output1Id},${output2Id}`
    },

    stacker: {
        inputs: 2,
        apply: (bottomShapeCode, topShapeCode, config) => {
            const bottomShape = Shape.fromShapeCode(bottomShapeCode);
            const topShape = Shape.fromShapeCode(topShapeCode);
            const results = stack(bottomShape, topShape, config);
            return results.map(s => s.toShapeCode());
        },
        toString: (bottomId, topId, outputId) => `${bottomId},${topId}:stack:${outputId}`
    },

    painter: {
        inputs: 1,
        apply: (shapeCode, color, config) => {
            const shape = Shape.fromShapeCode(shapeCode);
            const results = topPaint(shape, color, config);
            return results.map(s => s.toShapeCode());
        },
        toString: (inputId, color, outputId) => `${inputId},${color}:paint:${outputId}`
    },

    pinPusher: {
        inputs: 1,
        apply: (shapeCode, config) => {
            const shape = Shape.fromShapeCode(shapeCode);
            const results = pushPin(shape, config);
            return results.map(s => s.toShapeCode());
        },
        toString: (inputId, outputId) => `${inputId}:pin:${outputId}`
    },

    crystalGenerator: {
        inputs: 1,
        apply: (shapeCode, color, config) => {
            const shape = Shape.fromShapeCode(shapeCode);
            const results = genCrystal(shape, color, config);
            return results.map(s => s.toShapeCode());
        },
        toString: (inputId, color, outputId) => `${inputId},${color}:crystal:${outputId}`
    }
};

// ==================== Utility Functions ====================
function getColorsInShape(shape) {
    const shapeColorMap = new Map();

    for (const layer of shape.layers) {
        for (const part of layer) {
            // Only consider paintable shapes, excluding "u" colors
            if (!UNPAINTABLE_SHAPES.includes(part.shape) && part.color !== "u") {
                if (!shapeColorMap.has(part.shape)) {
                    shapeColorMap.set(part.shape, new Set());
                }
                shapeColorMap.get(part.shape).add(part.color);
            }
        }
    }

    return shapeColorMap;
}

function getValidColorsForShape(inputShape, targetShapeColorMap) {
    const validColors = new Set();
    const inputShapeObj = Shape.fromShapeCode(inputShape);

    for (const layer of inputShapeObj.layers) {
        for (const part of layer) {
            // Only consider paintable shapes
            if (!UNPAINTABLE_SHAPES.includes(part.shape)) {
                // Get colors that are valid for this shape type from target
                const colorsForThisShape = targetShapeColorMap.get(part.shape);
                if (colorsForThisShape) {
                    colorsForThisShape.forEach(color => validColors.add(color));
                }
            }
        }
    }

    return Array.from(validColors);
}

function getCrystalColorsInShape(shape) {
    const crystalColors = new Set();

    for (const layer of shape.layers) {
        for (const part of layer) {
            // Only consider crystal shapes
            if (part.shape === CRYSTAL_CHAR) {
                crystalColors.add(part.color);
            }
        }
    }

    // Return ["u"] if no crystal colors found, otherwise return the colors
    return crystalColors.size > 0 ? Array.from(crystalColors) : ["u"];
}

// ==================== ShapeSolver Class ====================
export class ShapeSolver {
    constructor(startingShapes, targetShape, operations) {
        this.startingShapes = startingShapes;
        this.targetShape = targetShape;
        this.operations = operations;
        this.nextId = startingShapes.length + 1;

        // Performance optimizations
        this.operationCache = new Map();
        this.targetColors = new Set(this.targetShape.match(/[rgbcmyw]/g) || []);
        this.maxStatesPerLevel = parseInt(document.getElementById('max-states-per-level').value) || Infinity;
        // Retrieve maxShapeLayers from the input element
        this.maxShapeLayers = parseInt(document.getElementById('max-layers').value) || 4;


        // Target analysis for heuristics
        this.targetLayers = this.targetShape.split(':');
        this.targetComponents = this.analyzeShapeComponents(this.targetShape);
    }

    // Get all rotations of a shape
    getAllRotations(shapeCode) {
        const rotations = new Set();
        const shape = Shape.fromShapeCode(shapeCode);
        const config = new ShapeOperationConfig(this.maxShapeLayers);
        
        // Original shape
        rotations.add(shapeCode);
        
        try {
            // 90° clockwise
            const rot90 = rotate90CW(shape, config);
            if (rot90.length > 0) {
                rotations.add(rot90[0].toShapeCode());
            }
            
            // 180°
            const rot180 = rotate180(shape, config);
            if (rot180.length > 0) {
                rotations.add(rot180[0].toShapeCode());
            }
            
            // 270° clockwise (90° counter-clockwise)
            const rot270 = rotate90CCW(shape, config);
            if (rot270.length > 0) {
                rotations.add(rot270[0].toShapeCode());
            }
        } catch (e) {
            // If rotation fails, just return the original shape
            console.warn('Rotation failed for shape:', shapeCode);
        }
        
        return Array.from(rotations);
    }

    // Check if any rotation of shape1 matches any rotation of shape2
    shapesMatchAnyOrientation(shape1, shape2) {
        if (shape1 === shape2) return true;
        
        const rotations1 = this.getAllRotations(shape1);
        const rotations2 = this.getAllRotations(shape2);
        
        for (const rot1 of rotations1) {
            if (rotations2.includes(rot1)) {
                return true;
            }
        }
        
        return false;
    }

    // Analyze shape components for heuristic scoring
    analyzeShapeComponents(shape) {
        const layers = shape.split(':');
        const components = new Set();

        for (const layer of layers) {
            // Extract shape and color components
            for (let i = 0; i < layer.length; i += 2) {
                const component = layer.substring(i, i + 2);
                if (component !== '--') {
                    components.add(component);
                    // Also add just the shape part
                    if (component.length === 2) {
                        components.add(component[0] + '-');
                    }
                }
            }
        }

        return components;
    }

    // Calculate how similar a shape is to the target (0-1, higher is better)
    calculateShapeSimilarity(shape) {
        if (shape === this.targetShape) return 1.0;

        const components = this.analyzeShapeComponents(shape);
        const intersection = new Set([...components].filter(x => this.targetComponents.has(x)));
        const union = new Set([...components, ...this.targetComponents]);

        if (union.size === 0) return 0;

        // Jaccard similarity + layer count bonus
        const jaccard = intersection.size / union.size;
        const layerSimilarity = Math.min(shape.split(':').length, this.targetLayers.length) / Math.max(shape.split(':').length, this.targetLayers.length);

        return (jaccard * 0.7) + (layerSimilarity * 0.3);
    }

    // Cache operation results to avoid recomputation
    getCachedOperation(opName, ...inputs) {
        const shapes = inputs.slice(0, inputs.length - 1);
        const config = inputs[inputs.length - 1];

        const key = `${opName}:${shapes.join(',')}:${config.maxShapeLayers}`;
        if (this.operationCache.has(key)) {
            return this.operationCache.get(key);
        }

        try {
            const result = this.operations[opName].apply(...shapes, config);
            this.operationCache.set(key, result);
            return result;
        } catch (e) {
            this.operationCache.set(key, null);
            return null;
        }
    }
}

// ==================== Solver Controller ====================
export class ShapeSolverController {
    constructor(solver, onSolverFinishedCallback) {
        this.solver = solver;
        this.onSolverFinishedCallback = onSolverFinishedCallback; // Store the callback
        this.cancelled = false;
        this.statusElement = document.getElementById('status-msg');
        this.processedStates = 0;
        this.lastUpdate = 0;
        this.operationConfig = new ShapeOperationConfig(this.solver.maxShapeLayers);
    }

    // Calculate heuristic score for a state (higher is better)
    calculateStateHeuristic(shapes) {
        let maxSimilarity = 0;
        let hasTargetComponents = 0;
        let totalShapes = shapes.length;

        for (const shape of shapes) {
            const similarity = this.solver.calculateShapeSimilarity(shape.shape);
            maxSimilarity = Math.max(maxSimilarity, similarity);

            // Bonus for having target components
            if (this.solver.targetComponents.size > 0) {
                const shapeComponents = this.solver.analyzeShapeComponents(shape.shape);
                const commonComponents = [...shapeComponents].filter(c => this.solver.targetComponents.has(c));
                hasTargetComponents += commonComponents.length / this.solver.targetComponents.size;
            }
        }

        return maxSimilarity * 1000 + hasTargetComponents * 100 - totalShapes * 10;
    }

    async start() {
        const initial = this.solver.startingShapes.map((s, i) => ({
            id: i + 1,
            shape: s
        }));

        const initialState = {
            availableShapes: [...initial],
            solution: initial.map(shape => `${shape.id}=${shape.shape}`).join(';'),
            heuristic: this.calculateStateHeuristic(initial)
        };

        let depth = 0;
        let currentLevel = [initialState];
        const visited = new Map();
        const stateKey = this.getStateKey(initialState.availableShapes);
        visited.set(stateKey, depth);

        const t0 = performance.now();

        while (currentLevel.length > 0 && !this.cancelled) {
            // Sort states by heuristic (best first) and limit the number we explore
            currentLevel.sort((a, b) => b.heuristic - a.heuristic);

            // Aggressive pruning: limit states per level
            if (currentLevel.length > this.solver.maxStatesPerLevel) {
                currentLevel = currentLevel.slice(0, this.solver.maxStatesPerLevel);
            }

            const nextLevel = [];

            // Process states in smaller batches for better responsiveness
            const batchSize = Math.min(50, currentLevel.length);
            for (let batchStart = 0; batchStart < currentLevel.length; batchStart += batchSize) {
                if (this.cancelled) break;

                const batch = currentLevel.slice(batchStart, batchStart + batchSize);

                for (const state of batch) {
                    // Check if we've found the solution
                    const preventWaste = document.getElementById('prevent-waste-checkbox')?.checked;
                    const ignoreOrientation = document.getElementById('ignore-orientation-checkbox')?.checked;
                    const nonEmptyShapes = state.availableShapes.filter(s => !/^[-]+$/.test(s.shape));

                    let matchingTargets;
                    if (!ignoreOrientation) {
                        // Orientation-agnostic match (checkbox NOT checked)
                        matchingTargets = nonEmptyShapes.filter(s => this.solver.shapesMatchAnyOrientation(s.shape, this.solver.targetShape));
                    } else {
                        // Exact orientation match (checkbox checked)
                        matchingTargets = nonEmptyShapes.filter(s => s.shape === this.solver.targetShape);
                    }

                    const isGoalState = preventWaste
                        ? nonEmptyShapes.length > 0 && matchingTargets.length === nonEmptyShapes.length
                        : matchingTargets.length > 0;

                    if (isGoalState) {
                        const elapsed = (performance.now() - t0) / 1000;
                        this.statusElement.textContent = `Solved in ${elapsed.toFixed(2)}s at depth ${depth}, ${visited.size} states`;
                        renderGraph(state.solution, operations, baseColors, createShapeCanvas);
                        this.cleanup();
                        return;
                    }

                    // Try all operations
                    for (const [opName, op] of Object.entries(this.solver.operations)) {
                        if (this.cancelled) return;
                        // Skip if not enough shapes
                        if (state.availableShapes.length < op.inputs) continue;

                        if (opName === 'painter' || opName === 'crystalGenerator') {
                            const validShapes = state.availableShapes.filter(s => !/^[-]+$/.test(s.shape));
                            const targetShapeObj = Shape.fromShapeCode(this.solver.targetShape);

                            if (opName === 'crystalGenerator') {
                                const colorsToUse = getCrystalColorsInShape(targetShapeObj);
                                for (const shape of validShapes) {
                                    for (const color of colorsToUse) {
                                        try {
                                            const outputs = this.solver.getCachedOperation(opName, shape.shape, color, this.operationConfig);
                                            if (outputs) {
                                                this.processState(
                                                    state,
                                                    [shape],
                                                    op,
                                                    outputs,
                                                    [color],
                                                    nextLevel,
                                                    visited,
                                                    depth
                                                );
                                            }
                                        } catch (e) {
                                            // Silently skip invalid operations
                                        }
                                    }
                                }
                            } else {
                                // Painter operation - use targeted color selection
                                const targetShapeColorMap = getColorsInShape(targetShapeObj);
                                for (const shape of validShapes) {
                                    const colorsToUse = getValidColorsForShape(shape.shape, targetShapeColorMap);
                                    for (const color of colorsToUse) {
                                        try {
                                            const outputs = this.solver.getCachedOperation(opName, shape.shape, color, this.operationConfig);
                                            if (outputs) {
                                                // Check if painting this shape with this color is useful
                                                const paintedShape = outputs[0];
                                                const similarity = this.solver.calculateShapeSimilarity(paintedShape);

                                                if (similarity > 0.1 || paintedShape === this.solver.targetShape || depth < 2) {
                                                    this.processState(
                                                        state,
                                                        [shape],
                                                        op,
                                                        outputs,
                                                        [color],
                                                        nextLevel,
                                                        visited,
                                                        depth
                                                    );
                                                }
                                            }
                                        } catch (e) {
                                            // Silently skip invalid operations
                                        }
                                    }
                                }
                            }
                        } else {
                            // Normal operation handling
                            const validShapes = state.availableShapes.filter(s => !/^[-]+$/.test(s.shape));
                            const combos = this.getCombinationsOptimized(validShapes, op.inputs);

                            // For deeper levels, be more selective about which combinations to try
                            let combosToTry = combos;
                            if (depth > 3 && combos.length > 20) {
                                // Sort combinations by potential (shapes with higher similarity to target)
                                combosToTry = combos.sort((a, b) => {
                                    const scoreA = a.reduce((sum, shape) => sum + this.solver.calculateShapeSimilarity(shape.shape), 0);
                                    const scoreB = b.reduce((sum, shape) => sum + this.solver.calculateShapeSimilarity(shape.shape), 0);
                                    return scoreB - scoreA;
                                }).slice(0, 20); // Take top 20 combinations
                            }

                            for (const combo of combosToTry) {
                                if (this.cancelled) return;
                                const inputs = combo.map(s => s.shape);

                                // Special case for stacker: try both input orders
                                if (opName === 'stacker') {
                                    // Original order
                                    try {
                                        const outputs1 = this.solver.getCachedOperation(opName, ...inputs, this.operationConfig);
                                        if (outputs1) {
                                            this.processState(state, combo, op, outputs1, null, nextLevel, visited, depth);
                                        }
                                    } catch (e) { }

                                    // Reversed order
                                    try {
                                        const reversedCombo = [...combo].reverse();
                                        const outputs2 = this.solver.getCachedOperation(opName, ...reversedCombo.map(s => s.shape), this.operationConfig);
                                        if (outputs2) {
                                            this.processState(state, reversedCombo, op, outputs2, null, nextLevel, visited, depth);
                                        }
                                    } catch (e) { }
                                } else {
                                    // Default handling
                                    try {
                                        const outputs = this.solver.getCachedOperation(opName, ...inputs, this.operationConfig);
                                        if (outputs) {
                                            // Quick check: does this operation produce something useful?
                                            const hasPromising = outputs.some(output =>
                                                this.solver.calculateShapeSimilarity(output) > 0.1 ||
                                                output === this.solver.targetShape
                                            );

                                            if (hasPromising || depth < 3) { // Be less restrictive early on
                                                this.processState(state, combo, op, outputs, null, nextLevel, visited, depth);
                                            }
                                        }
                                    } catch (e) { }
                                }
                            }
                        }
                    }
                }

                // Allow UI updates between batches
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            depth++;
            const now = performance.now();
            if (now - this.lastUpdate > 200) {
                this.statusElement.textContent = `Depth ${depth} → ${nextLevel.length} states | ${visited.size} total states | Pruned to top ${this.solver.maxStatesPerLevel}`;
                this.lastUpdate = now;
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            currentLevel = nextLevel;
        }

        const reason = this.cancelled ? 'Cancelled' : `No solution found after ${depth} steps`;

        this.statusElement.textContent = `${reason} (${visited.size} states)`;
        renderGraph(null); // Render empty graph or message if no solution
        this.cleanup(); // Call cleanup to reset UI and global state
    }

    // Optimized combination generation
    getCombinationsOptimized(arr, k) {
        if (k === 1) return arr.map(v => [v]);
        if (k === 2) {
            const result = [];
            for (let i = 0; i < arr.length - 1; i++) {
                for (let j = i + 1; j < arr.length; j++) {
                    result.push([arr[i], arr[j]]);
                }
            }
            return result;
        }
        return this.getCombinations(arr, k); // Fallback for k > 2
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

    processState(currentState, combo, op, outputs, extraData, nextLevel, visited, currentDepth) {
        // Create new available shapes (remove inputs, add outputs)
        const newAvailable = currentState.availableShapes.filter(s => !combo.includes(s));

        const newShapes = outputs.map(shape => ({
            id: this.solver.nextId++,
            shape
        }));

        newAvailable.push(...newShapes);

        // Check visited state first (before creating expensive strings)
        const stateKey = this.getStateKey(newAvailable);
        const existingDepth = visited.get(stateKey);

        // Skip if we've seen this state at a shallower or equal depth
        if (existingDepth !== undefined && existingDepth <= currentDepth + 1) {
            return;
        }

        // Early pruning: skip states with very low heuristic scores
        const heuristic = this.calculateStateHeuristic(newAvailable);
        if (heuristic < -100 && currentDepth > 2) { // Don't prune too early
            return;
        }

        // Create operation string
        let opStr;
        if (op === operations.painter) {
            opStr = op.toString(combo[0].id, extraData[0], newShapes[0].id);
        } else if (op === operations.crystalGenerator) {
            opStr = op.toString(combo[0].id, extraData[0], newShapes[0].id);
        } else {
            opStr = op.toString(...combo.map(s => s.id), ...newShapes.map(s => s.id));
        }

        // Create new solution string
        const newSolution = `${currentState.solution};${opStr}`;

        visited.set(stateKey, currentDepth + 1);
        nextLevel.push({
            availableShapes: newAvailable,
            solution: newSolution,
            heuristic: heuristic
        });
    }

    cancel() {
        this.cancelled = true;
        this.statusElement.textContent = 'Cancelled.';
        this.cleanup();
    }

    cleanup() {
        if (this.onSolverFinishedCallback) {
            this.onSolverFinishedCallback();
        }
    }
}