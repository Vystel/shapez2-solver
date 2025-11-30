// JS port of a file in Loupau38's Shapez 2 Library https://pypi.org/project/shapez2/ 

// Constants
export const NOTHING_CHAR = "-";
export const SHAPE_LAYER_SEPARATOR = ":";
export const PIN_CHAR = "P";
export const CRYSTAL_CHAR = "c";
export const UNPAINTABLE_SHAPES = [CRYSTAL_CHAR, PIN_CHAR, NOTHING_CHAR];
export const REPLACED_BY_CRYSTAL = [PIN_CHAR, NOTHING_CHAR];

// Shape Classes
export class ShapePart {
    constructor(shape, color) {
        this.shape = shape;
        this.color = color;
    }
}

export class Shape {
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

export class InvalidOperationInputs extends Error {}

export class ShapeOperationConfig {
    constructor(maxShapeLayers = 4) {
        this.maxShapeLayers = maxShapeLayers;
    }
}

// Shape Logic & Utility Functions
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
    if (layers.length === 0) {
        return [];
    }

    for (let i = layers.length - 1; i >= 0; i--) {
        if (layers[i].some(p => p.shape !== NOTHING_CHAR)) {
            return layers.slice(0, i + 1);
        }
    }

    return [layers[0]];
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

// Shape Operations
export function cut(shape, config = new ShapeOperationConfig()) {
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

export function halfCut(shape, config = new ShapeOperationConfig()) {
    return [cut(shape, config)[1]];
}

export function rotate90CW(shape, config = new ShapeOperationConfig()) {
    const newLayers = [];
    for (const layer of shape.layers) {
        newLayers.push([layer[layer.length - 1], ...layer.slice(0, -1)]);
    }
    return [new Shape(newLayers)];
}

export function rotate90CCW(shape, config = new ShapeOperationConfig()) {
    const newLayers = [];
    for (const layer of shape.layers) {
        newLayers.push([...layer.slice(1), layer[0]]);
    }
    return [new Shape(newLayers)];
}

export function rotate180(shape, config = new ShapeOperationConfig()) {
    const takeParts = Math.ceil(shape.numParts / 2);
    const newLayers = [];
    for (const layer of shape.layers) {
        newLayers.push([...layer.slice(takeParts), ...layer.slice(0, takeParts)]);
    }
    return [new Shape(newLayers)];
}

export const swapHalves = _differentNumPartsUnsupported(function(shapeA, shapeB, config = new ShapeOperationConfig()) {
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

export const stack = _differentNumPartsUnsupported(function(bottomShape, topShape, config = new ShapeOperationConfig()) {
    const newLayers = [
        ...bottomShape.layers,
        Array(bottomShape.numParts).fill(new ShapePart(NOTHING_CHAR, NOTHING_CHAR)),
        ...topShape.layers
    ];
    const processed = _cleanUpEmptyUpperLayers(_makeLayersFall(newLayers));
    return [new Shape(processed.slice(0, config.maxShapeLayers))];
});

export function topPaint(shape, color, config = new ShapeOperationConfig()) {
    const newLayers = shape.layers.slice(0, -1);
    const newTopLayer = shape.layers[shape.layers.length - 1].map(p =>
        new ShapePart(p.shape, UNPAINTABLE_SHAPES.includes(p.shape) ? p.color : color)
    );
    newLayers.push(newTopLayer);
    return [new Shape(newLayers)];
}

export function pushPin(shape, config = new ShapeOperationConfig()) {
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

export function genCrystal(shape, color, config = new ShapeOperationConfig()) {
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

// Extra functions for Shape Analysis - for Solver
export function _getAllRotations(shape, config) {
    const rotations = new Set();
    let current = shape;

    for (let i = 0; i < current.numParts; i++) {
        rotations.add(current.toShapeCode());
        current = rotate90CW(current, config)[0];
    }

    return rotations;
}

export function _extractLayers(shape, mode = 'part', includePins = true, includeColor = true) {
    const numParts = shape.numParts;
    const groupedLayers = [];

    shape.layers.forEach((layer) => {
        const seen = {};

        layer.forEach((part, partIndex) => {
            if (!includePins && (part.shape === PIN_CHAR)) return;
            if (part.shape === NOTHING_CHAR || part.shape === CRYSTAL_CHAR) return;

            let key;
            if (mode === 'layer') {
                key = "valid";
            } else if (mode === 'part') {
                key = part.shape;
            } else if (mode === 'color') {
                key = part.color;
            } else if (mode === 'part-color') {
                key = `${part.shape}-${part.color}`;
            }

            if (!seen[key]) {
                seen[key] = [];
            }
            seen[key].push({ index: partIndex, shape: part.shape, color: part.color });
        });

        Object.entries(seen).forEach(([, entries]) => {
            const newLayer = Array.from({ length: numParts }, () => new ShapePart(NOTHING_CHAR, NOTHING_CHAR));
            entries.forEach(({ index, shape, color }) => {
                newLayer[index] = new ShapePart(shape, includeColor ? color : 'u');
            });
            groupedLayers.push(newLayer);
        });
    });

    return groupedLayers.map(layer => layer.map(part => part.shape + part.color).join(''));
}

export function _getPaintColors(inputShape, targetShape) {
    const targetColorMap = new Map();
    for (const layer of targetShape.layers) {
        for (const part of layer) {
            if (!UNPAINTABLE_SHAPES.includes(part.shape) && part.color !== "u") {
                if (!targetColorMap.has(part.shape)) {
                    targetColorMap.set(part.shape, new Set());
                }
                targetColorMap.get(part.shape).add(part.color);
            }
        }
    }

    const validColors = new Set();
    const topLayer = inputShape.layers[inputShape.layers.length - 1];
    if (topLayer) {
        for (const part of topLayer) {
            if (!UNPAINTABLE_SHAPES.includes(part.shape)) {
                const targetColors = targetColorMap.get(part.shape);
                if (targetColors) {
                    targetColors.forEach(color => {
                        if (color !== part.color) {
                            validColors.add(color);
                        }
                    });
                }
            }
        }
    }

    return Array.from(validColors);
}

export function _getCrystalColors(shape) {
    const crystalColors = new Set();
    for (const layer of shape.layers) {
        for (const part of layer) {
            if (part.shape === CRYSTAL_CHAR) crystalColors.add(part.color);
        }
    }
    return crystalColors.size > 0 ? Array.from(crystalColors) : ["u"];
}

export function _getSimilarity(shape1, shape2, weights = {type: 0.5, color: 0.3, order: 0.2}) {
    // Part type similarity
    const typeSim = _compareCounts(_getPartTypeCounts(shape1), _getPartTypeCounts(shape2));

    // Part+color similarity
    const colorSim = _compareCounts(_getPartCounts(shape1), _getPartCounts(shape2));

    // Overall similarity
    const orderSim = _comparePartOrder(shape1, shape2);

    // Final score
    return (typeSim * weights.type) +
           (colorSim * weights.color) +
           (orderSim * weights.order);
}

function _getPartTypeCounts(shape) {
    const counts = new Map();
    for (const layer of shape.layers) {
        for (const part of layer) {
            counts.set(part.shape, (counts.get(part.shape) || 0) + 1);
        }
    }
    return counts;
}

function _getPartCounts(shape) {
    const counts = new Map();
    for (const layer of shape.layers) {
        for (const part of layer) {
            const key = `${part.shape}:${part.color}`;
            counts.set(key, (counts.get(key) || 0) + 1);
        }
    }
    return counts;
}

function _compareCounts(countsA, countsB) {
    const keys = new Set([...countsA.keys(), ...countsB.keys()]);
    let total = 0;
    let match = 0;

    for (const key of keys) {
        const a = countsA.get(key) || 0;
        const b = countsB.get(key) || 0;
        match += Math.min(a, b);
        total += Math.max(a, b);
    }

    return total === 0 ? 1 : match / total; // Handles case where both shapes are empty
}

function _comparePartOrder(shape1, shape2) {
    if (shape1.layers.length !== shape2.layers.length) return 0; // Different structure

    const rotations = [];
    let current = shape1;

    // Generate all rotations
    for (let i = 0; i < shape1.numParts; i++) {
        rotations.push(current);
        current = rotate90CW(current)[0];
    }

    let bestMatchRatio = 0;

    for (const rotatedShape of rotations) {
        let totalParts = 0;
        let correctParts = 0;

        for (let layerIndex = 0; layerIndex < shape2.layers.length; layerIndex++) {
            const layerA = rotatedShape.layers[layerIndex];
            const layerB = shape2.layers[layerIndex];

            const len = Math.min(layerA.length, layerB.length);
            totalParts += len;

            for (let i = 0; i < len; i++) {
                if (layerA[i].shape === layerB[i].shape) {
                    correctParts += 1;
                }
            }
        }

        if (totalParts > 0) {
            const matchRatio = correctParts / totalParts;
            if (matchRatio > bestMatchRatio) {
                bestMatchRatio = matchRatio;
            }
        }
    }

    return bestMatchRatio;
}