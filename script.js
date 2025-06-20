// ==================== Imports ====================
import { renderShape, createShapeCanvas, isValidShapeCode, SHAPES_CONFIG, COLOR_MODES } from './shapeRendering.js';

// ==================== Global State ====================
let currentSolverController = null;

// ==================== Constants ====================
const NOTHING_CHAR = "-";
const SHAPE_LAYER_SEPARATOR = ":";
const PIN_CHAR = "P";
const CRYSTAL_CHAR = "c";
const UNPAINTABLE_SHAPES = [CRYSTAL_CHAR, PIN_CHAR, NOTHING_CHAR];
const REPLACED_BY_CRYSTAL = [PIN_CHAR, NOTHING_CHAR];

// ==================== Shape Classes ====================
class ShapePart {
    constructor(shape, color) {
        this.shape = shape;
        this.color = color;
    }
}

class Shape {
    constructor(layers) {
        this.layers = layers;
        this.numLayers = layers.length;
        this.numParts = layers[0].length;
    }

    static fromListOfLayers(layers) {
        const newLayers = [];
        const numParts = layers[0].length / 2;
        for (const layer of layers) {
            const newLayer = [];
            for (let partIndex = 0; partIndex < numParts; partIndex++) {
                newLayer.push(new ShapePart(
                    layer[partIndex * 2],
                    layer[partIndex * 2 + 1]
                ));
            }
            newLayers.push(newLayer);
        }
        return new Shape(newLayers);
    }

    static fromShapeCode(shapeCode) {
        return this.fromListOfLayers(shapeCode.split(SHAPE_LAYER_SEPARATOR));
    }

    toListOfLayers() {
        return this.layers.map(layer => 
            layer.map(part => part.shape + part.color).join('')
        );
    }

    toShapeCode() {
        return this.toListOfLayers().join(SHAPE_LAYER_SEPARATOR);
    }

    isEmpty() {
        return this.toListOfLayers().join('').split('').every(c => c === NOTHING_CHAR);
    }
}

class InvalidOperationInputs extends Error {}

class ShapeOperationConfig {
    constructor(maxShapeLayers = 4) {
        this.maxShapeLayers = maxShapeLayers;
    }
}

// ==================== Shape Operation Helper Functions ====================
function _gravityConnected(part1, part2) {
    if ([NOTHING_CHAR, PIN_CHAR].includes(part1.shape) || [NOTHING_CHAR, PIN_CHAR].includes(part2.shape)) {
        return false;
    }
    return true;
}

function _crystalsFused(part1, part2) {
    return part1.shape === CRYSTAL_CHAR && part2.shape === CRYSTAL_CHAR;
}

function _getCorrectedIndex(list, index) {
    if (index > list.length - 1) {
        return index - list.length;
    }
    if (index < 0) {
        return list.length + index;
    }
    return index;
}

function _getConnectedSingleLayer(layer, index, connectedFunc) {
    if (layer[index].shape === NOTHING_CHAR) {
        return [];
    }

    const connected = [index];
    let previousIndex = index;

    for (let i = index + 1; i < layer.length + index; i++) {
        const curIndex = _getCorrectedIndex(layer, i);
        if (!connectedFunc(layer[previousIndex], layer[curIndex])) {
            break;
        }
        connected.push(curIndex);
        previousIndex = curIndex;
    }

    previousIndex = index;
    for (let i = index - 1; i > -layer.length + index; i--) {
        const curIndex = _getCorrectedIndex(layer, i);
        if (connected.includes(curIndex)) {
            break;
        }
        if (!connectedFunc(layer[previousIndex], layer[curIndex])) {
            break;
        }
        connected.push(curIndex);
        previousIndex = curIndex;
    }

    return connected;
}

function _getConnectedMultiLayer(layers, layerIndex, partIndex, connectedFunc) {
    if (layers[layerIndex][partIndex].shape === NOTHING_CHAR) {
        return [];
    }

    const connected = [[layerIndex, partIndex]];
    for (const [curLayer, curPart] of connected) {
        // same layer
        for (const partIdx of _getConnectedSingleLayer(layers[curLayer], curPart, connectedFunc)) {
            if (!connected.some(([l, p]) => l === curLayer && p === partIdx)) {
                connected.push([curLayer, partIdx]);
            }
        }

        // layer below
        const toCheckLayer = curLayer - 1;
        const toCheckPart = curPart;
        if (curLayer > 0 && !connected.some(([l, p]) => l === toCheckLayer && p === toCheckPart)) {
            if (connectedFunc(layers[curLayer][curPart], layers[toCheckLayer][toCheckPart])) {
                connected.push([toCheckLayer, toCheckPart]);
            }
        }

        // layer above
        const toCheckLayerAbove = curLayer + 1;
        const toCheckPartAbove = curPart;
        if (curLayer < layers.length - 1 && !connected.some(([l, p]) => l === toCheckLayerAbove && p === toCheckPartAbove)) {
            if (connectedFunc(layers[curLayer][curPart], layers[toCheckLayerAbove][toCheckPartAbove])) {
                connected.push([toCheckLayerAbove, toCheckPartAbove]);
            }
        }
    }

    return connected;
}

function _breakCrystals(layers, layerIndex, partIndex) {
    for (const [curLayer, curPart] of _getConnectedMultiLayer(layers, layerIndex, partIndex, _crystalsFused)) {
        layers[curLayer][curPart] = new ShapePart(NOTHING_CHAR, NOTHING_CHAR);
    }
}

function _makeLayersFall(layers) {
    function sepInGroups(layer) {
        const handledIndexes = [];
        const groups = [];
        for (let partIndex = 0; partIndex < layer.length; partIndex++) {
            if (handledIndexes.includes(partIndex)) continue;
            const group = _getConnectedSingleLayer(layer, partIndex, _gravityConnected);
            if (group.length > 0) {
                groups.push(group);
                handledIndexes.push(...group);
            }
        }
        return groups;
    }

    function isPartSupported(layerIndex, partIndex, visitedParts, supportedPartStates) {
        if (supportedPartStates[layerIndex][partIndex] !== null) {
            return supportedPartStates[layerIndex][partIndex];
        }

        const curPart = layers[layerIndex][partIndex];

        function inner() {
            if (layers[layerIndex][partIndex].shape === NOTHING_CHAR) {
                return false;
            }

            if (layerIndex === 0) {
                return true;
            }

            const toGiveVisitedParts = [...visitedParts, [layerIndex, partIndex]];

            const partUnderneath = [layerIndex - 1, partIndex];
            if (
                !visitedParts.some(([l, p]) => l === partUnderneath[0] && p === partUnderneath[1]) &&
                isPartSupported(partUnderneath[0], partUnderneath[1], toGiveVisitedParts, supportedPartStates)
            ) {
                return true;
            }

            const nextPartPos = [layerIndex, _getCorrectedIndex(layers[layerIndex], partIndex + 1)];
            if (
                !visitedParts.some(([l, p]) => l === nextPartPos[0] && p === nextPartPos[1]) &&
                _gravityConnected(curPart, layers[nextPartPos[0]][nextPartPos[1]]) &&
                isPartSupported(nextPartPos[0], nextPartPos[1], toGiveVisitedParts, supportedPartStates)
            ) {
                return true;
            }

            const prevPartPos = [layerIndex, _getCorrectedIndex(layers[layerIndex], partIndex - 1)];
            if (
                !visitedParts.some(([l, p]) => l === prevPartPos[0] && p === prevPartPos[1]) &&
                _gravityConnected(curPart, layers[prevPartPos[0]][prevPartPos[1]]) &&
                isPartSupported(prevPartPos[0], prevPartPos[1], toGiveVisitedParts, supportedPartStates)
            ) {
                return true;
            }

            const partAbove = [layerIndex + 1, partIndex];
            if (
                partAbove[0] < layers.length &&
                !visitedParts.some(([l, p]) => l === partAbove[0] && p === partAbove[1]) &&
                _crystalsFused(curPart, layers[partAbove[0]][partAbove[1]]) &&
                isPartSupported(partAbove[0], partAbove[1], toGiveVisitedParts, supportedPartStates)
            ) {
                return true;
            }

            return false;
        }

        const result = inner();
        supportedPartStates[layerIndex][partIndex] = result;
        return result;
    }

    // First pass of calculating supported parts
    let supportedPartStates = layers.map(layer => layer.map(() => null));
    for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
        for (let partIndex = 0; partIndex < layers[layerIndex].length; partIndex++) {
            isPartSupported(layerIndex, partIndex, [], supportedPartStates);
        }
    }

    // If a crystal is marked as unsupported it will fall and thus break
    for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
        for (let partIndex = 0; partIndex < layers[layerIndex].length; partIndex++) {
            const part = layers[layerIndex][partIndex];
            if (part.shape === CRYSTAL_CHAR && !supportedPartStates[layerIndex][partIndex]) {
                layers[layerIndex][partIndex] = new ShapePart(NOTHING_CHAR, NOTHING_CHAR);
            }
        }
    }

    // Second pass of calculating supported parts
    supportedPartStates = layers.map(layer => layer.map(() => null));
    for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
        for (let partIndex = 0; partIndex < layers[layerIndex].length; partIndex++) {
            isPartSupported(layerIndex, partIndex, [], supportedPartStates);
        }
    }

    for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
        const layer = layers[layerIndex];
        if (layerIndex === 0) continue;

        for (const group of sepInGroups(layer)) {
            if (group.some(p => supportedPartStates[layerIndex][p])) continue;

            let fallToLayerIndex;
            for (fallToLayerIndex = layerIndex; fallToLayerIndex >= 0; fallToLayerIndex--) {
                if (fallToLayerIndex === 0) break;
                let fall = true;
                for (const partIndex of group) {
                    if (layers[fallToLayerIndex - 1][partIndex].shape !== NOTHING_CHAR) {
                        fall = false;
                        break;
                    }
                }
                if (!fall) break;
            }

            for (const partIndex of group) {
                layers[fallToLayerIndex][partIndex] = layers[layerIndex][partIndex];
                layers[layerIndex][partIndex] = new ShapePart(NOTHING_CHAR, NOTHING_CHAR);
            }
        }
    }

    return layers;
}

function _cleanUpEmptyUpperLayers(layers) {
    for (let i = layers.length - 1; i >= 0; i--) {
        if (layers[i].some(p => p.shape !== NOTHING_CHAR)) {
            return layers.slice(0, i + 1);
        }
    }
    return [];
}

function _differentNumPartsUnsupported(func) {
    return function(...args) {
        let config = new ShapeOperationConfig();
        let shapes = [];
        
        // Extract shapes and config from arguments
        for (let i = 0; i < args.length; i++) {
            if (args[i] instanceof Shape) {
                shapes.push(args[i]);
            } else if (args[i] instanceof ShapeOperationConfig) {
                config = args[i];
            }
        }
        
        if (shapes.length > 0) {
            const expected = shapes[0].numParts;
            for (const shape of shapes.slice(1)) {
                if (shape.numParts !== expected) {
                    throw new InvalidOperationInputs(
                        `Shapes with differing number of parts per layer are not supported for operation '${func.name}'`
                    );
                }
            }
        }
        return func(...args, config);
    };
}

// ==================== Shape Operations ====================
function cut(shape, config = new ShapeOperationConfig()) {
    const takeParts = Math.ceil(shape.numParts / 2);
    const cutPoints = [[0, shape.numParts - 1], [shape.numParts - takeParts, shape.numParts - takeParts - 1]];
    const layers = JSON.parse(JSON.stringify(shape.layers)); // Deep copy
    
    for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
        for (const [start, end] of cutPoints) {
            if (_crystalsFused(layers[layerIndex][start], layers[layerIndex][end])) {
                _breakCrystals(layers, layerIndex, start);
            }
        }
    }
    
    const shapeA = [];
    const shapeB = [];
    for (const layer of layers) {
        shapeA.push([
            ...Array(shape.numParts - takeParts).fill(new ShapePart(NOTHING_CHAR, NOTHING_CHAR)),
            ...layer.slice(-takeParts)
        ]);
        shapeB.push([
            ...layer.slice(0, -takeParts),
            ...Array(takeParts).fill(new ShapePart(NOTHING_CHAR, NOTHING_CHAR))
        ]);
    }
    
    const [processedA, processedB] = [
        _cleanUpEmptyUpperLayers(_makeLayersFall(shapeA)),
        _cleanUpEmptyUpperLayers(_makeLayersFall(shapeB))
    ];
    
    return [new Shape(processedA), new Shape(processedB)];
}

function halfCut(shape, config = new ShapeOperationConfig()) {
    return [cut(shape, config)[1]];
}

function rotate90CW(shape, config = new ShapeOperationConfig()) {
    const newLayers = [];
    for (const layer of shape.layers) {
        newLayers.push([layer[layer.length - 1], ...layer.slice(0, -1)]);
    }
    return [new Shape(newLayers)];
}

function rotate90CCW(shape, config = new ShapeOperationConfig()) {
    const newLayers = [];
    for (const layer of shape.layers) {
        newLayers.push([...layer.slice(1), layer[0]]);
    }
    return [new Shape(newLayers)];
}

function rotate180(shape, config = new ShapeOperationConfig()) {
    const takeParts = Math.ceil(shape.numParts / 2);
    const newLayers = [];
    for (const layer of shape.layers) {
        newLayers.push([...layer.slice(takeParts), ...layer.slice(0, takeParts)]);
    }
    return [new Shape(newLayers)];
}

const swapHalves = _differentNumPartsUnsupported(function(shapeA, shapeB, config = new ShapeOperationConfig()) {
    const numLayers = Math.max(shapeA.numLayers, shapeB.numLayers);
    const takeParts = Math.ceil(shapeA.numParts / 2);
    const [shapeACut1, shapeACut2] = cut(shapeA, config);
    const [shapeBCut1, shapeBCut2] = cut(shapeB, config);
    
    const returnShapeA = [];
    const returnShapeB = [];
    
    for (let i = 0; i < numLayers; i++) {
        const layerA1 = shapeACut1.layers[i] || Array(shapeA.numParts).fill(new ShapePart(NOTHING_CHAR, NOTHING_CHAR));
        const layerA2 = shapeACut2.layers[i] || Array(shapeA.numParts).fill(new ShapePart(NOTHING_CHAR, NOTHING_CHAR));
        const layerB1 = shapeBCut1.layers[i] || Array(shapeB.numParts).fill(new ShapePart(NOTHING_CHAR, NOTHING_CHAR));
        const layerB2 = shapeBCut2.layers[i] || Array(shapeB.numParts).fill(new ShapePart(NOTHING_CHAR, NOTHING_CHAR));
        
        returnShapeA.push([
            ...layerA2.slice(0, -takeParts),
            ...layerB1.slice(-takeParts)
        ]);
        returnShapeB.push([
            ...layerB2.slice(0, -takeParts),
            ...layerA1.slice(-takeParts)
        ]);
    }
    
    const processedA = _cleanUpEmptyUpperLayers(returnShapeA);
    const processedB = _cleanUpEmptyUpperLayers(returnShapeB);
    
    return [new Shape(processedA), new Shape(processedB)];
});

const stack = _differentNumPartsUnsupported(function(bottomShape, topShape, config = new ShapeOperationConfig()) {
    const newLayers = [
        ...bottomShape.layers,
        Array(bottomShape.numParts).fill(new ShapePart(NOTHING_CHAR, NOTHING_CHAR)),
        ...topShape.layers
    ];
    const processed = _cleanUpEmptyUpperLayers(_makeLayersFall(newLayers));
    return [new Shape(processed.slice(0, config.maxShapeLayers))];
});

function topPaint(shape, color, config = new ShapeOperationConfig()) {
    const newLayers = shape.layers.slice(0, -1);
    const newTopLayer = shape.layers[shape.layers.length - 1].map(p => 
        new ShapePart(p.shape, UNPAINTABLE_SHAPES.includes(p.shape) ? p.color : color)
    );
    newLayers.push(newTopLayer);
    return [new Shape(newLayers)];
}

function pushPin(shape, config = new ShapeOperationConfig()) {
    const layers = JSON.parse(JSON.stringify(shape.layers)); // Deep copy
    const addedPins = [];
    
    for (const part of layers[0]) {
        if (part.shape === NOTHING_CHAR) {
            addedPins.push(new ShapePart(NOTHING_CHAR, NOTHING_CHAR));
        } else {
            addedPins.push(new ShapePart(PIN_CHAR, NOTHING_CHAR));
        }
    }
    
    let newLayers;
    if (layers.length < config.maxShapeLayers) {
        newLayers = [addedPins, ...layers];
    } else {
        newLayers = [addedPins, ...layers.slice(0, config.maxShapeLayers - 1)];
        const removedLayer = layers[config.maxShapeLayers - 1];
        for (let partIndex = 0; partIndex < newLayers[newLayers.length - 1].length; partIndex++) {
            const part = newLayers[newLayers.length - 1][partIndex];
            if (_crystalsFused(part, removedLayer[partIndex])) {
                _breakCrystals(newLayers, newLayers.length - 1, partIndex);
            }
        }
    }
    
    const processed = _cleanUpEmptyUpperLayers(_makeLayersFall(newLayers));
    return [new Shape(processed)];
}

function genCrystal(shape, color, config = new ShapeOperationConfig()) {
    const newLayers = shape.layers.map(layer => 
        layer.map(p => {
            // Only replace pins and nothing with crystals
            if (REPLACED_BY_CRYSTAL.includes(p.shape)) {
                return new ShapePart(CRYSTAL_CHAR, color);
            }
            // Keep existing shapes unchanged (don't paint them)
            return new ShapePart(p.shape, p.color);
        })
    );
    return [new Shape(newLayers)];
}

// ==================== Operation Definitions ====================
const operations = {
    cutter: {
        inputs: 1,
        apply: (shapeCode) => {
            const shape = Shape.fromShapeCode(shapeCode);
            const results = cut(shape);
            return results.map(s => s.toShapeCode());
        },
        toString: (inputId, output1Id, output2Id) => `${inputId}:cut:${output1Id},${output2Id}`
    },
    
    halfDestroyer: {
        inputs: 1,
        apply: (shapeCode) => {
            const shape = Shape.fromShapeCode(shapeCode);
            const results = halfCut(shape);
            return results.map(s => s.toShapeCode());
        },
        toString: (inputId, outputId) => `${inputId}:hcut:${outputId}`
    },
    
    rotateCW: {
        inputs: 1,
        apply: (shapeCode) => {
            const shape = Shape.fromShapeCode(shapeCode);
            const results = rotate90CW(shape);
            return results.map(s => s.toShapeCode());
        },
        toString: (inputId, outputId) => `${inputId}:r90cw:${outputId}`
    },
    
    rotateCCW: {
        inputs: 1,
        apply: (shapeCode) => {
            const shape = Shape.fromShapeCode(shapeCode);
            const results = rotate90CCW(shape);
            return results.map(s => s.toShapeCode());
        },
        toString: (inputId, outputId) => `${inputId}:r90ccw:${outputId}`
    },
    
    rotate180: {
        inputs: 1,
        apply: (shapeCode) => {
            const shape = Shape.fromShapeCode(shapeCode);
            const results = rotate180(shape);
            return results.map(s => s.toShapeCode());
        },
        toString: (inputId, outputId) => `${inputId}:r180:${outputId}`
    },
    
    swapper: {
        inputs: 2,
        apply: (shapeCode1, shapeCode2) => {
            const shape1 = Shape.fromShapeCode(shapeCode1);
            const shape2 = Shape.fromShapeCode(shapeCode2);
            const results = swapHalves(shape1, shape2);
            return results.map(s => s.toShapeCode());
        },
        toString: (input1Id, input2Id, output1Id, output2Id) => `${input1Id},${input2Id}:swap:${output1Id},${output2Id}`
    },
    
    stacker: {
        inputs: 2,
        apply: (bottomShapeCode, topShapeCode) => {
            const bottomShape = Shape.fromShapeCode(bottomShapeCode);
            const topShape = Shape.fromShapeCode(topShapeCode);
            const results = stack(bottomShape, topShape);
            return results.map(s => s.toShapeCode());
        },
        toString: (bottomId, topId, outputId) => `${bottomId},${topId}:stack:${outputId}`
    },
    
    painter: {
        inputs: 1,
        apply: (shapeCode, color) => {
            const shape = Shape.fromShapeCode(shapeCode);
            const results = topPaint(shape, color);
            return results.map(s => s.toShapeCode());
        },
        toString: (inputId, color, outputId) => `${inputId},${color}:paint:${outputId}`
    },
    
    pinPusher: {
        inputs: 1,
        apply: (shapeCode) => {
            const shape = Shape.fromShapeCode(shapeCode);
            const results = pushPin(shape);
            return results.map(s => s.toShapeCode());
        },
        toString: (inputId, outputId) => `${inputId}:pin:${outputId}`
    },
    
    crystalGenerator: {
        inputs: 1,
        apply: (shapeCode, color) => {
            const shape = Shape.fromShapeCode(shapeCode);
            const results = genCrystal(shape, color);
            return results.map(s => s.toShapeCode());
        },
        toString: (inputId, color, outputId) => `${inputId},${color}:crystal:${outputId}`
    }
};

// ==================== Shape Display Functions ====================
function createShapeElement(shapeCode) {
    const container = document.createElement('div');
    container.className = 'shape-display';
    
    const canvas = createShapeCanvas(shapeCode, 60, SHAPES_CONFIG.QUAD, COLOR_MODES.RGB);
    canvas.className = 'shape-canvas';
    
    const label = document.createElement('span');
    label.className = 'shape-label';
    label.textContent = shapeCode;
    
    container.appendChild(canvas);
    container.appendChild(label);
    
    return container;
}

// ==================== Utility Functions ====================
function getStartingShapes() {
    return Array.from(document.querySelectorAll('#starting-shapes .shape-item .shape-label'))
        .map(label => label.textContent);
}

function initializeDefaultShapes() {
    const defaultShapes = ['CuCuCuCu', 'RuRuRuRu', 'SuSuSuSu', 'WuWuWuWu'];
    const container = document.getElementById('starting-shapes');
    
    defaultShapes.forEach(shapeCode => {
        const shapeItem = document.createElement('div');
        shapeItem.className = 'shape-item';
        
        const shapeDisplay = createShapeElement(shapeCode);
        const removeBtn = document.createElement('span');
        removeBtn.className = 'remove-shape';
        removeBtn.textContent = '×';
        removeBtn.setAttribute('data-shape', shapeCode);
        
        shapeItem.appendChild(shapeDisplay);
        shapeItem.appendChild(removeBtn);
        container.appendChild(shapeItem);
    });
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
    if (!shapeCode || !isValidShapeCode(shapeCode)) {
        alert('Invalid shape code. Please enter a valid shape code.');
        return;
    }

    const shapeItem = document.createElement('div');
    shapeItem.className = 'shape-item';
    
    const shapeDisplay = createShapeElement(shapeCode);
    const removeBtn = document.createElement('span');
    removeBtn.className = 'remove-shape';
    removeBtn.textContent = '×';
    removeBtn.setAttribute('data-shape', shapeCode);
    
    shapeItem.appendChild(shapeDisplay);
    shapeItem.appendChild(removeBtn);

    document.getElementById('starting-shapes').appendChild(shapeItem);
    input.value = '';
});

document.getElementById('starting-shapes').addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-shape')) {
        e.target.parentElement.remove();
    }
});

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
            for (let i = 0; i < currentLevel.length; i++) {
                if (this.cancelled) return;
                const state = currentLevel[i];
                // Check if we've found the solution
                if (state.availableShapes.some(s => s.shape === this.solver.targetShape)) {
                    const elapsed = (performance.now() - t0) / 1000;
                    this.statusElement.textContent = `Solved in ${elapsed.toFixed(2)}s at depth ${depth}, ${visited.size} states`;
                    this.displaySolution(state.solution);
                    this.cleanup();
                    return;
                }

                // Try all operations
                for (const [opName, op] of Object.entries(this.solver.operations)) {
                    if (this.cancelled) return;
                    // Skip if not enough shapes
                    if (state.availableShapes.length < op.inputs) continue;

                    // Get valid combinations - SPECIAL HANDLING FOR PAINTER
                    if (opName === 'painter' || opName === 'crystalGenerator') {
                        // For painter/crystal, we need shape + color combinations
                        const validShapes = state.availableShapes.filter(s => s.shape !== '--------');
                        const colors = [...new Set(this.solver.targetShape.match(/[rgbcmyw]/g) || [])];

                        for (const shape of validShapes) {
                            if (this.cancelled) return;
                            for (const color of colors) {
                                if (this.cancelled) return;
                                try {
                                    const outputs = op.apply(shape.shape, color);
                                    this.processState(
                                        state,
                                        [shape], // Only the shape is the input (color is extra data)
                                        op,
                                        outputs,
                                        [color], // Pass color as extra data
                                        nextLevel,
                                        visited,
                                        opName
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
                            if (this.cancelled) return;
                            const inputs = combo.map(s => s.shape);

                            // Special case for stacker: try both input orders
                            if (opName === 'stacker') {
                                // Original order
                                try {
                                    const outputs1 = op.apply(...inputs);
                                    this.processState(state, combo, op, outputs1, null, nextLevel, visited, opName);
                                } catch (e) {}

                                // Reversed order
                                try {
                                    const reversedCombo = [...combo].reverse();
                                    const outputs2 = op.apply(...reversedCombo.map(s => s.shape));
                                    this.processState(state, reversedCombo, op, outputs2, null, nextLevel, visited);
                                } catch (e) {}
                            } else {
                                // Default handling
                                try {
                                    const outputs = op.apply(...inputs);
                                    this.processState(state, combo, op, outputs, null, nextLevel, visited);
                                } catch (e) {}
                            }
                        }
                    }
                }
                // Prevent freezing with yield control (every 100 states is probably fine)
                if (i % 100 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                    if (this.cancelled) return;
                }
            }

            // Update status and prepare next level
            depth++;
            this.statusElement.textContent = `Depth ${depth} → ${nextLevel.length} states | ${visited.size} total states`;
            currentLevel = nextLevel;

            // Prevent freezing with yield control (every depth increase, but this is probably not necessary as we already do this every 100 states)
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        this.statusElement.textContent = this.cancelled
            ? 'Cancelled'
            : `No solution found after ${depth} steps (${visited.size} states)`;
        this.displaySolution(null);
        this.cleanup();
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

        // Create operation string - SPECIAL HANDLING FOR PAINTER AND CRYSTAL GENERATOR
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

    cleanup() {
        document.getElementById('calculate-btn').textContent = "Solve";
        currentSolverController = null;
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
                } else if (op === 'crystal') {
                    idToShape[outputs[0]] = operations.crystalGenerator.apply(
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
                const shapeCanvas = createShapeCanvas(shape, 40);
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
                if (op === 'paint') opLabel += ` (${inputs[1]})`;
                if (op === 'crystal') opLabel += ` (${inputs[1]})`;
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

                    // Use shape from mapping - create canvas for visualization
                    const shapeCode = idToShape[output] || output;
                    const shapeCanvas = createShapeCanvas(shapeCode, 40);
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
                        'background-color': '#fff',
                        'border-width': 2,
                        'border-color': '#333'
                    }
                },
                {
                    selector: '.op',
                    style: {
                        'background-color': '#0074D9',
                        'shape': 'rectangle',
                        'width': '60px',
                        'height': '40px',
                        'text-valign': 'center'
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
            case 'crystal': return []; // Handled separately
            default: return [];
        }
    }
}

// ==================== Initialization ====================
document.addEventListener('DOMContentLoaded', () => {
    initializeDefaultShapes();
});

// ==================== Main Button Logic ====================
document.getElementById('calculate-btn').addEventListener('click', () => {
    if (currentSolverController) {
        // Cancel current solver
        currentSolverController.cancel();
        currentSolverController.cleanup();
        return;
    }

    const targetShape = document.getElementById('target-shape').value.trim();
    if (!targetShape) {
        alert('Please enter a target shape code.');
        return;
    }
    if (!isValidShapeCode(targetShape)) {
        alert('Invalid target shape code. Please enter a valid shape code.');
        return;
    }

    const startingShapes = getStartingShapes();
    const enabledOperations = getEnabledOperations();

    const solver = new BFSSolver(startingShapes, targetShape, enabledOperations);
    currentSolverController = new BFSSolverController(solver);
    currentSolverController.start();

    document.getElementById('calculate-btn').textContent = "Cancel";
});
