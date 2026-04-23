// JS port of a file in Loupau38's Shapez 2 Library https://pypi.org/project/shapez2/ 
import { PART_CODES, SHAPE_LAYER_SEPARATOR, UNCOLORED_CODE, UNPAINTABLE_PARTS, REPLACED_BY_CRYSTAL } from './shapeConstants.js';

function deepCopyLayers(layers) {
    const result = new Array(layers.length);
    for (let i = 0; i < layers.length; i++) {
        const src = layers[i];
        const dst = new Array(src.length);
        for (let j = 0; j < src.length; j++) {
            dst[j] = new ShapePart(src[j].shape, src[j].color);
        }
        result[i] = dst;
    }
    return result;
}

// shape classes
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
        this._code = null;
        this._empty = null;
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
        if (this._code !== null) return this._code;
        this._code = this.toListOfLayers().join(SHAPE_LAYER_SEPARATOR);
        return this._code;
    }

    isEmpty() {
        if (this._empty !== null) return this._empty;
        this._empty = this.layers.every(
            layer => layer.every(p => p.shape === PART_CODES.NOTHING)
        );
        return this._empty;
    }
}

export class InvalidOperationInputs extends Error {}

export class ShapeOperationConfig {
    constructor(maxShapeLayers = 4) {
        this.maxShapeLayers = maxShapeLayers;
    }
}

// operation utils
function _gravityConnected(part1, part2) {
    if ([PART_CODES.NOTHING, PART_CODES.PIN].includes(part1.shape) || [PART_CODES.NOTHING, PART_CODES.PIN].includes(part2.shape)) {
        return false;
    }
    return true;
}

function _crystalsFused(part1, part2) {
    return part1.shape === PART_CODES.CRYSTAL && part2.shape === PART_CODES.CRYSTAL;
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
    if (layer[index].shape === PART_CODES.NOTHING) {
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
    if (layers[layerIndex][partIndex].shape === PART_CODES.NOTHING) {
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
        layers[curLayer][curPart] = new ShapePart(PART_CODES.NOTHING, PART_CODES.NOTHING);
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
            if (layers[layerIndex][partIndex].shape === PART_CODES.NOTHING) {
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

    // first pass of calculating supported parts
    let supportedPartStates = layers.map(layer => layer.map(() => null));
    for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
        for (let partIndex = 0; partIndex < layers[layerIndex].length; partIndex++) {
            isPartSupported(layerIndex, partIndex, [], supportedPartStates);
        }
    }

    // if a crystal is marked as unsupported it will fall and thus break
    for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
        for (let partIndex = 0; partIndex < layers[layerIndex].length; partIndex++) {
            const part = layers[layerIndex][partIndex];
            if (part.shape === PART_CODES.CRYSTAL && !supportedPartStates[layerIndex][partIndex]) {
                layers[layerIndex][partIndex] = new ShapePart(PART_CODES.NOTHING, PART_CODES.NOTHING);
            }
        }
    }

    // second pass of calculating supported parts
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
                    if (layers[fallToLayerIndex - 1][partIndex].shape !== PART_CODES.NOTHING) {
                        fall = false;
                        break;
                    }
                }
                if (!fall) break;
            }

            for (const partIndex of group) {
                layers[fallToLayerIndex][partIndex] = layers[layerIndex][partIndex];
                layers[layerIndex][partIndex] = new ShapePart(PART_CODES.NOTHING, PART_CODES.NOTHING);
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
        if (layers[i].some(p => p.shape !== PART_CODES.NOTHING)) {
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

// shape operations
export function cut(shape, config = new ShapeOperationConfig()) {
    const takeParts = Math.ceil(shape.numParts / 2);
    const cutPoints = [[0, shape.numParts - 1], [shape.numParts - takeParts, shape.numParts - takeParts - 1]];
    const layers = deepCopyLayers(shape.layers);

    for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
        for (const [start, end] of cutPoints) {
            if (_crystalsFused(layers[layerIndex][start], layers[layerIndex][end])) {
                _breakCrystals(layers, layerIndex, start);
            }
        }
    }

    const EMPTY = new ShapePart(PART_CODES.NOTHING, PART_CODES.NOTHING);
    const shapeA = [];
    const shapeB = [];
    for (const layer of layers) {
        shapeA.push([
            ...Array(shape.numParts - takeParts).fill(EMPTY),
            ...layer.slice(-takeParts)
        ]);
        shapeB.push([
            ...layer.slice(0, -takeParts),
            ...Array(takeParts).fill(EMPTY)
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

    const EMPTY_A = Array(shapeA.numParts).fill(new ShapePart(PART_CODES.NOTHING, PART_CODES.NOTHING));
    const EMPTY_B = Array(shapeB.numParts).fill(new ShapePart(PART_CODES.NOTHING, PART_CODES.NOTHING));

    const returnShapeA = [];
    const returnShapeB = [];

    for (let i = 0; i < numLayers; i++) {
        const layerA1 = shapeACut1.layers[i] || EMPTY_A;
        const layerA2 = shapeACut2.layers[i] || EMPTY_A;
        const layerB1 = shapeBCut1.layers[i] || EMPTY_B;
        const layerB2 = shapeBCut2.layers[i] || EMPTY_B;

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
        ...deepCopyLayers(bottomShape.layers),
        Array(bottomShape.numParts).fill(new ShapePart(PART_CODES.NOTHING, PART_CODES.NOTHING)),
        ...deepCopyLayers(topShape.layers)
    ];
    const processed = _cleanUpEmptyUpperLayers(_makeLayersFall(newLayers));
    return [new Shape(processed.slice(0, config.maxShapeLayers))];
});

export function topPaint(shape, color, config = new ShapeOperationConfig()) {
    const newLayers = shape.layers.slice(0, -1);
    const newTopLayer = shape.layers[shape.layers.length - 1].map(p =>
        new ShapePart(p.shape, UNPAINTABLE_PARTS.includes(p.shape) ? p.color : color)
    );
    newLayers.push(newTopLayer);
    return [new Shape(newLayers)];
}

export function pushPin(shape, config = new ShapeOperationConfig()) {
    const layers = deepCopyLayers(shape.layers);
    const addedPins = [];

    for (const part of layers[0]) {
        if (part.shape === PART_CODES.NOTHING) {
            addedPins.push(new ShapePart(PART_CODES.NOTHING, PART_CODES.NOTHING));
        } else {
            addedPins.push(new ShapePart(PART_CODES.PIN, PART_CODES.NOTHING));
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
            if (REPLACED_BY_CRYSTAL.includes(p.shape)) {
                return new ShapePart(PART_CODES.CRYSTAL, color);
            }
            return new ShapePart(p.shape, p.color);
        })
    );
    return [new Shape(newLayers)];
}

// shape analysis and solve utils
export function _getAllRotations(shape, config) {
    const rotations = new Set();
    let current = shape;

    for (let i = 0; i < current.numParts; i++) {
        rotations.add(current.toShapeCode());
        current = rotate90CW(current, config)[0];
    }

    return rotations;
}

export function _extractLayers(shape, mode = 'part', includePins = true, includeColor = true, includeCrystals = true) {
    const numParts = shape.numParts;
    const results = [];

    shape.layers.forEach((layer) => {
        if (mode === 'layer') {
            const newLayer = Array.from({ length: numParts }, () => new ShapePart(PART_CODES.NOTHING, PART_CODES.NOTHING));

            layer.forEach((part, i) => {
                if (!includePins && part.shape === PART_CODES.PIN) return;
                if (!includeCrystals && part.shape === PART_CODES.CRYSTAL) return;
                if (part.shape === PART_CODES.NOTHING) return;

                const colorToUse = (UNPAINTABLE_PARTS.includes(part.shape))
                    ? part.color
                    : (includeColor ? part.color : UNCOLORED_CODE);

                newLayer[i] = new ShapePart(part.shape, colorToUse);
            });

            results.push(newLayer);
            return;
        }

        if (mode === 'part') {
            layer.forEach((part, i) => {
                if (!includePins && part.shape === PART_CODES.PIN) return;
                if (!includeCrystals && part.shape === PART_CODES.CRYSTAL) return;
                if (part.shape === PART_CODES.NOTHING) return;

                const colorToUse = (UNPAINTABLE_PARTS.includes(part.shape))
                    ? part.color
                    : (includeColor ? part.color : UNCOLORED_CODE);

                const newLayer = Array.from({ length: numParts }, () => new ShapePart(PART_CODES.NOTHING, PART_CODES.NOTHING));
                newLayer[i] = new ShapePart(part.shape, colorToUse);
                results.push(newLayer);
            });

            return;
        }

        const groups = {};

        layer.forEach((part, i) => {
            if (!includePins && part.shape === PART_CODES.PIN) return;
            if (!includeCrystals && part.shape === PART_CODES.CRYSTAL) return;
            if (part.shape === PART_CODES.NOTHING) return;

            let key;

            if (mode === 'color') {
                key = part.color;
            } else if (mode === 'shape') {
                key = part.shape;
            } else if (mode === 'shape-color') {
                key = `${part.shape}-${part.color}`;
            }

            if (!groups[key]) groups[key] = [];
            groups[key].push({ index: i, shape: part.shape, color: part.color });
        });

        Object.values(groups).forEach(entries => {
            const newLayer = Array.from({ length: numParts }, () => new ShapePart(PART_CODES.NOTHING, PART_CODES.NOTHING));

            entries.forEach(({ index, shape, color }) => {
                const colorToUse = (UNPAINTABLE_PARTS.includes(shape))
                    ? color
                    : (includeColor ? color : UNCOLORED_CODE);

                newLayer[index] = new ShapePart(shape, colorToUse);
            });

            results.push(newLayer);
        });
    });

    return results.map(layer =>
        layer.map(p => p.shape + p.color).join('')
    );
}

export function _getPaintColors(inputShape, targetShape) {
    const targetColorMap = new Map();
    for (const layer of targetShape.layers) {
        for (const part of layer) {
            if (!UNPAINTABLE_PARTS.includes(part.shape) && part.color !== UNCOLORED_CODE) {
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
            if (!UNPAINTABLE_PARTS.includes(part.shape)) {
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
            if (part.shape === PART_CODES.CRYSTAL) crystalColors.add(part.color);
        }
    }
    return crystalColors.size > 0 ? Array.from(crystalColors) : [UNCOLORED_CODE]; 
    // if no crystals exist in targets, it will use 'u' to generate crystals because some solutions require generating crystals before breaking them
}

export function _getSimilarity(shape1, shape2, weights = {type: 0.5, color: 0.3, order: 0.2}) {
    const typeSim = _compareCounts(_getPartTypeCounts(shape1), _getPartTypeCounts(shape2));
    const colorSim = _compareCounts(_getPartCounts(shape1), _getPartCounts(shape2));
    const orderSim = _comparePartOrder(shape1, shape2);

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

    return total === 0 ? 1 : match / total;
}

function _comparePartOrder(shape1, shape2) {
    if (shape1.layers.length !== shape2.layers.length) return 0;

    let current = shape1;
    let bestMatchRatio = 0;

    for (let i = 0; i < shape1.numParts; i++) {
        let totalParts = 0;
        let correctParts = 0;

        for (let layerIndex = 0; layerIndex < shape2.layers.length; layerIndex++) {
            const layerA = current.layers[layerIndex];
            const layerB = shape2.layers[layerIndex];

            const len = Math.min(layerA.length, layerB.length);
            totalParts += len;

            for (let j = 0; j < len; j++) {
                if (layerA[j].shape === layerB[j].shape) {
                    correctParts++;
                }
            }
        }

        if (totalParts > 0) {
            const matchRatio = correctParts / totalParts;
            if (matchRatio > bestMatchRatio) {
                bestMatchRatio = matchRatio;
                if (bestMatchRatio === 1) break;
            }
        }

        current = rotate90CW(current)[0];
    }

    return bestMatchRatio;
}
