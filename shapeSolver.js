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
// Gets all colors present in a given shape, mapped by the shape of the part
function getColorsInShape(shape) {
    const shapeColorMap = new Map();

    for (const layer of shape.layers) {
        for (const part of layer) {
            // Only consider paintable shapes that aren't uncolored
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

// Determines valid colors for painting an input shape based on a target shape's colors
function getValidColorsForShape(inputShape, targetShapeColorMap) {
    const validColors = new Set();
    const inputShapeObj = Shape.fromShapeCode(inputShape);

    for (const layer of inputShapeObj.layers) {
        for (const part of layer) {
            // If the part is paintable
            if (!UNPAINTABLE_SHAPES.includes(part.shape)) {
                // Get colors for this specific part shape from the target map
                const colorsForThisShape = targetShapeColorMap.get(part.shape);
                if (colorsForThisShape) {
                    colorsForThisShape.forEach(color => validColors.add(color));
                }
            }
        }
    }

    return Array.from(validColors);
}

// Gets the colors of crystal parts within a shape
function getCrystalColorsInShape(shape) {
    const crystalColors = new Set();

    for (const layer of shape.layers) {
        for (const part of layer) {
            // If the part is a crystal
            if (part.shape === CRYSTAL_CHAR) {
                crystalColors.add(part.color);
            }
        }
    }

    // Returns the crystal colors or ["u"] if no crystals are found
    return crystalColors.size > 0 ? Array.from(crystalColors) : ["u"];
}

export class ShapeSolver {
    constructor(startingShapes, targetShape, operations) {
        this.startingShapes = startingShapes;
        this.targetShape = targetShape;
        this.operations = operations;
        this.nextId = startingShapes.length + 1;
        this.operationCache = new Map();
        this.maxStatesPerLevel = parseInt(document.getElementById('max-states-per-level').value) || Infinity;
        this.maxShapeLayers = parseInt(document.getElementById('max-layers').value) || 4;
        this.targetLayers = this.targetShape.split(':');
        this.targetComponents = this.analyzeShapeComponents(this.targetShape);
    }

    // Generates all possible orientations of a given shape
    getAllRotations(shapeCode) {
        const rotations = new Set();
        let currentShape = Shape.fromShapeCode(shapeCode);
        const config = new ShapeOperationConfig(this.maxShapeLayers);

        rotations.add(currentShape.toShapeCode());

        try {
            // Determine the number of parts in the first layer to decide rotation iterations
            const partAmount = currentShape.layers.length > 0 ? currentShape.layers[0].length : 0;
            for (let i = 0; i < partAmount - 1; i++) { // Iterate to get all unique rotations
                const rotatedShapes = rotate90CW(currentShape, config);
                if (rotatedShapes.length > 0) {
                    currentShape = rotatedShapes[0];
                    rotations.add(currentShape.toShapeCode());
                } else {
                    console.warn('Failed to get orientations for shape:', currentShape.toShapeCode());
                    break;
                }
            }
        } catch (e) {
            console.error('Error during getAllRotations:', e);
            // If an error occurs and no rotations were added, just add the original shape
            if (rotations.size === 0) {
                rotations.add(shapeCode);
            }
        }

        return Array.from(rotations);
    }

    // Checks if two shapes match in any orientation
    shapesMatchAnyOrientation(shape1, shape2) {
        if (shape1 === shape2) return true; // Exact match

        const rotations1 = this.getAllRotations(shape1); // All rotations of shape1
        const rotations2 = this.getAllRotations(shape2); // All rotations of shape2

        for (const rot1 of rotations1) {
            if (rotations2.includes(rot1)) { // If any rotation of shape1 matches any rotation of shape2
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
            for (let i = 0; i < layer.length; i += 2) {
                const component = layer.substring(i, i + 2); // Extract shape part
                if (component !== '--') { // Ignore empty slots
                    components.add(component);
                    // Remove any colors
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
        if (shape === this.targetShape) return 1.0; // Perfect match

        const components = this.analyzeShapeComponents(shape);
        // Find common components
        const intersection = new Set([...components].filter(x => this.targetComponents.has(x)));
        // Find all unique components
        const union = new Set([...components, ...this.targetComponents]);

        if (union.size === 0) return 0; // No components to compare

        // Jaccard index for component similarity
        const jaccard = intersection.size / union.size;
        // Layer count similarity
        const layerSimilarity = Math.min(shape.split(':').length, this.targetLayers.length) / Math.max(shape.split(':').length, this.targetLayers.length);

        // Weighted average of Jaccard and layer similarity
        return (jaccard * 0.7) + (layerSimilarity * 0.3);
    }

    // Retrieves operation results from cache or computes and stores them
    getCachedOperation(opName, ...inputs) {
        const shapes = inputs.slice(0, inputs.length - 1);
        const config = inputs[inputs.length - 1];

        // Create a unique key for caching based on operation, shapes, and max layers
        const key = `${opName}:${shapes.join(',')}:${config.maxShapeLayers}`;
        if (this.operationCache.has(key)) {
            return this.operationCache.get(key); // Return cached result
        }

        try {
            const result = this.operations[opName].apply(...shapes, config); // Apply the operation
            this.operationCache.set(key, result); // Cache the result
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
        this.onSolverFinishedCallback = onSolverFinishedCallback;
        this.cancelled = false;
        this.statusElement = document.getElementById('status-msg');
        this.processedStates = 0;
        this.lastUpdate = 0;
        this.operationConfig = new ShapeOperationConfig(this.solver.maxShapeLayers);
    }

    // Calculates a heuristic score for a given set of available shapes (state)
    calculateStateHeuristic(shapes) {
        let maxSimilarity = 0;           // Maximum similarity of any shape in the state to the target
        let hasTargetComponents = 0;     // Proportion of target components present in the state
        let totalShapes = shapes.length; // Total number of shapes in the state

        for (const shape of shapes) {
            const similarity = this.solver.calculateShapeSimilarity(shape.shape);
            maxSimilarity = Math.max(maxSimilarity, similarity);

            if (this.solver.targetComponents.size > 0) {
                const shapeComponents = this.solver.analyzeShapeComponents(shape.shape);
                // Count common components between current shape and target
                const commonComponents = [...shapeComponents].filter(c => this.solver.targetComponents.has(c));
                hasTargetComponents += commonComponents.length / this.solver.targetComponents.size;
            }
        }

        // Heuristic formula: prioritize similarity, then target components, penalize more shapes
        return maxSimilarity * 1000 + hasTargetComponents * 100 - totalShapes * 10;
    }

    // Starts the search for the solution
    async start() {
        // Initialize the starting state with initial shapes
        const initial = this.solver.startingShapes.map((s, i) => ({
            id: i + 1,
            shape: s
        }));

        const initialState = {
            availableShapes: [...initial], // Shapes currently available for use
            solution: initial.map(shape => `${shape.id}=${shape.shape}`).join(';'), // String representation of solution path
            heuristic: this.calculateStateHeuristic(initial) // Heuristic score for this state
        };

        let depth = 0;
        let currentLevel = [initialState];
        const visited = new Map();
        const stateKey = this.getStateKey(initialState.availableShapes);
        visited.set(stateKey, depth);

        const t0 = performance.now();

        // Main search loop
        while (currentLevel.length > 0 && !this.cancelled) {
            // Sort states by heuristic score (higher is better)
            currentLevel.sort((a, b) => b.heuristic - a.heuristic);

            // Prune states if exceeding the maximum allowed per level
            if (currentLevel.length > this.solver.maxStatesPerLevel) {
                currentLevel = currentLevel.slice(0, this.solver.maxStatesPerLevel);
            }

            const nextLevel = []; // States for the next search depth

            // Process states in batches to allow UI updates and prevent freezing
            const batchSize = Math.min(50, currentLevel.length);
            for (let batchStart = 0; batchStart < currentLevel.length; batchStart += batchSize) {
                if (this.cancelled) break;

                const batch = currentLevel.slice(batchStart, batchStart + batchSize);

                for (const state of batch) {
                    // Check if we've found the solution
                    const preventWaste = document.getElementById('prevent-waste-checkbox')?.checked;
                    const matchExactOrientation = document.getElementById('orientation-sensitivity-checkbox')?.checked;
                    // Filter out "empty" shapes
                    const nonEmptyShapes = state.availableShapes.filter(s => !/^[-]+$/.test(s.shape));

                    let matchingTargets;
                    if (matchExactOrientation) { // checkbox checked
                        // Check for exact orientation match with target
                        matchingTargets = nonEmptyShapes.filter(s => s.shape === this.solver.targetShape);
                    } else { // checkbox NOT checked
                        // Check if any orientation matches the target
                        matchingTargets = nonEmptyShapes.filter(s => this.solver.shapesMatchAnyOrientation(s.shape, this.solver.targetShape));
                    }

                    // Goal state considering the preventWaste option
                    const isGoalState = preventWaste
                        ? nonEmptyShapes.length > 0 && matchingTargets.length === nonEmptyShapes.length
                        : matchingTargets.length > 0;
                    
                    // If the goal has been reached, show the solution
                    if (isGoalState) {
                        const elapsed = (performance.now() - t0) / 1000;
                        this.statusElement.textContent = `Solved in ${elapsed.toFixed(2)}s at depth ${depth}, ${visited.size} states`;
                        renderGraph(state.solution, operations, baseColors, createShapeCanvas);
                        this.cleanup();
                        return;
                    }

                    // Iterate through all available operations
                    for (const [opName, op] of Object.entries(this.solver.operations)) {
                        if (this.cancelled) return;

                        // Skip operations if not enough input shapes are available
                        if (state.availableShapes.length < op.inputs) continue;

                        // Special handling for operations requiring colors
                        if (opName === 'painter' || opName === 'crystalGenerator') {
                            const validShapes = state.availableShapes.filter(s => !/^[-]+$/.test(s.shape));
                            const targetShapeObj = Shape.fromShapeCode(this.solver.targetShape);

                            if (opName === 'crystalGenerator') {
                                const colorsToUse = getCrystalColorsInShape(targetShapeObj); // Get target crystal colors
                                for (const shape of validShapes) {
                                    for (const color of colorsToUse) {
                                        try {
                                            // Apply crystal generation
                                            const outputs = this.solver.getCachedOperation(opName, shape.shape, color, this.operationConfig);
                                            if (outputs) {
                                                this.processState(
                                                    state,
                                                    [shape], // Input shape for the operation
                                                    op,
                                                    outputs,
                                                    [color], // Extra data: the color used
                                                    nextLevel,
                                                    visited,
                                                    depth
                                                );
                                            }
                                        } catch (e) {
                                            // Ignore any errors
                                        }
                                    }
                                }
                            } else { // Painter operation
                                const targetShapeColorMap = getColorsInShape(targetShapeObj); // Get target shape's color map
                                for (const shape of validShapes) {
                                    const colorsToUse = getValidColorsForShape(shape.shape, targetShapeColorMap); // Get valid colors for painting
                                    for (const color of colorsToUse) {
                                        try {
                                            // Apply painter operation
                                            const outputs = this.solver.getCachedOperation(opName, shape.shape, color, this.operationConfig);
                                            if (outputs) {
                                                // Check if painting this shape with this color is useful
                                                const paintedShape = outputs[0];
                                                const similarity = this.solver.calculateShapeSimilarity(paintedShape);

                                                // Only process promising painted shapes or in early depths
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
                                            // Catch and ignore errors for individual operations
                                        }
                                    }
                                }
                            }
                        } else { // General operations (cutter, rotator, swapper, stacker, pinPusher)
                            const validShapes = state.availableShapes.filter(s => !/^[-]+$/.test(s.shape));
                            // Get combinations of shapes for the operation's input
                            const combos = this.getCombinationsOptimized(validShapes, op.inputs);

                            let combosToTry = combos;
                            // Heuristic pruning for combinations at deeper levels to optimize performance
                            if (depth > 3 && combos.length > 20) {
                                // Sort combinations by potential (shapes with higher similarity to target)
                                combosToTry = combos.sort((a, b) => {
                                    const scoreA = a.reduce((sum, shape) => sum + this.solver.calculateShapeSimilarity(shape.shape), 0);
                                    const scoreB = b.reduce((sum, shape) => sum + this.solver.calculateShapeSimilarity(shape.shape), 0);
                                    return scoreB - scoreA;
                                }).slice(0, 20); // Take only the top 20
                            }

                            for (const combo of combosToTry) {
                                if (this.cancelled) return;
                                const inputs = combo.map(s => s.shape);

                                // Special case for stacker: try both orders of input shapes
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
                                    // For other operations, just apply with the current combination
                                    try {
                                        const outputs = this.solver.getCachedOperation(opName, ...inputs, this.operationConfig);
                                        if (outputs) {
                                            // Check if any output shape is promising (similar to target or is target)
                                            const hasPromising = outputs.some(output =>
                                                this.solver.calculateShapeSimilarity(output) > 0.1 ||
                                                output === this.solver.targetShape
                                            );

                                            // Only process if promising or in early depths
                                            if (hasPromising || depth < 3) {
                                                this.processState(state, combo, op, outputs, null, nextLevel, visited, depth);
                                            }
                                        }
                                    } catch (e) { }
                                }
                            }
                        }
                    }
                }

                // Yield control to the event loop to prevent UI freezing
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            depth++; // Increment depth for the next level
            const now = performance.now();
            // Update status message periodically
            if (now - this.lastUpdate > 200) {
                this.statusElement.textContent = `Depth ${depth} → ${nextLevel.length} states | ${visited.size} total states | Pruned to top ${this.solver.maxStatesPerLevel}`;
                this.lastUpdate = now;
                await new Promise(resolve => setTimeout(resolve, 0)); // Yield again for UI update
            }

            currentLevel = nextLevel; // Move to the next level
        }

        // If the loop finishes without finding a solution
        const reason = this.cancelled ? 'Cancelled' : `No solution found after ${depth} steps`;
        this.statusElement.textContent = `${reason} (${visited.size} states)`;
        renderGraph(null); // Clear the graph
        this.cleanup(); // Perform cleanup
    }

    // Optimized function to get combinations, specifically for k=1 and k=2
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
        return this.getCombinations(arr, k); // Fallback to general combination function
    }

    // General recursive function to get combinations of k elements from an array
    getCombinations(arr, k) {
        if (k === 1) return arr.map(v => [v]);
        const result = [];
        for (let i = 0; i <= arr.length - k; i++) {
            const rest = this.getCombinations(arr.slice(i + 1), k - 1);
            for (const combo of rest) result.push([arr[i], ...combo]);
        }
        return result;
    }

    // Generates a unique key for a state based on its available shapes
    getStateKey(shapes) {
        return shapes.map(s => s.shape).sort().join('|'); // Sort shapes for consistent key
    }

    // Processes a new state generated by an operation
    processState(currentState, combo, op, outputs, extraData, nextLevel, visited, currentDepth) {
        // Remove used shapes from available shapes
        const newAvailable = currentState.availableShapes.filter(s => !combo.includes(s));

        // Add new shapes generated by the operation
        const newShapes = outputs.map(shape => ({
            id: this.solver.nextId++,
            shape
        }));

        newAvailable.push(...newShapes);

        const stateKey = this.getStateKey(newAvailable);
        const existingDepth = visited.get(stateKey);

        // Pruning: if this state has been visited at an equal or shallower depth, skip
        if (existingDepth !== undefined && existingDepth <= currentDepth + 1) {
            return;
        }

        const heuristic = this.calculateStateHeuristic(newAvailable);
        // Pruning: if heuristic is very low at deeper levels, skip
        if (heuristic < -100 && currentDepth > 2) {
            return;
        }

        let opStr;
        // Format the operation string based on the operation type
        if (op === operations.painter) {
            opStr = op.toString(combo[0].id, extraData[0], newShapes[0].id);
        } else if (op === operations.crystalGenerator) {
            opStr = op.toString(combo[0].id, extraData[0], newShapes[0].id);
        } else {
            opStr = op.toString(...combo.map(s => s.id), ...newShapes.map(s => s.id));
        }

        // Append the new operation to the solution path
        const newSolution = `${currentState.solution};${opStr}`;

        visited.set(stateKey, currentDepth + 1); // Mark state as visited with its depth
        nextLevel.push({
            availableShapes: newAvailable,
            solution: newSolution,
            heuristic: heuristic
        });
    }

    // Cancels the ongoing search
    cancel() {
        this.cancelled = true;
        this.statusElement.textContent = 'Cancelled.';
        this.cleanup();
    }

    // Cleans up after the solver finishes or is cancelled
    cleanup() {
        if (this.onSolverFinishedCallback) {
            this.onSolverFinishedCallback();
        }
    }
}