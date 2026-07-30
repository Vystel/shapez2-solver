// JS port of a file in Loupau38's Shapez 2 Library https://pypi.org/project/shapez2/
import { PART_CODES, SHAPE_LAYER_SEPARATOR, UNCOLORED_CODE, UNPAINTABLE_PARTS, REPLACED_BY_CRYSTAL } from './shapeConstants.js';

const PART_BIT_WIDTH = 4;
const COLOR_BIT_MASK = (1 << PART_BIT_WIDTH) - 1;
const SHAPE_BIT_SHIFT = PART_BIT_WIDTH;
const SHAPE_BIT_MASK = COLOR_BIT_MASK << SHAPE_BIT_SHIFT;

const PART_CODE_LIST = Object.values(PART_CODES);
const PART_TO_INDEX = new Map(PART_CODE_LIST.map((code, index) => [code, index]));
const INDEX_TO_PART = PART_CODE_LIST;

const COLOR_CODE_LIST = [PART_CODES.NOTHING, UNCOLORED_CODE, 'r', 'g', 'b', 'c', 'm', 'y', 'w', 'k'];
const COLOR_TO_INDEX = new Map(COLOR_CODE_LIST.map((code, index) => [code, index]));
const INDEX_TO_COLOR = COLOR_CODE_LIST;

const NOTHING_SHAPE_BITS = (PART_TO_INDEX.get(PART_CODES.NOTHING) ?? 0) << SHAPE_BIT_SHIFT;
const PIN_SHAPE_BITS = (PART_TO_INDEX.get(PART_CODES.PIN) ?? 0) << SHAPE_BIT_SHIFT;
const CRYSTAL_SHAPE_BITS = (PART_TO_INDEX.get(PART_CODES.CRYSTAL) ?? 0) << SHAPE_BIT_SHIFT;
const UNCOLORED_COLOR_BITS = COLOR_TO_INDEX.get(UNCOLORED_CODE) ?? 0;
const NOTHING_COLOR_BITS = COLOR_TO_INDEX.get(PART_CODES.NOTHING) ?? 0;

const EMPTY_PART = NOTHING_SHAPE_BITS | NOTHING_COLOR_BITS;
const PIN_PART = PIN_SHAPE_BITS | NOTHING_COLOR_BITS;

const UNPAINTABLE_SHAPE_BITS = new Set(
    UNPAINTABLE_PARTS.map((shapeCode) => (PART_TO_INDEX.get(shapeCode) ?? 0) << SHAPE_BIT_SHIFT)
);

const REPLACED_BY_CRYSTAL_SHAPE_BITS = new Set(
    REPLACED_BY_CRYSTAL.map((shapeCode) => (PART_TO_INDEX.get(shapeCode) ?? 0) << SHAPE_BIT_SHIFT)
);

const CRYSTAL_SHAPE_ONLY_PART = CRYSTAL_SHAPE_BITS | NOTHING_COLOR_BITS;

function encodeColor(colorCode) {
    return COLOR_TO_INDEX.get(colorCode) ?? UNCOLORED_COLOR_BITS;
}

function encodePart(shapeCode, colorCode) {
    const shapeIndex = PART_TO_INDEX.get(shapeCode) ?? (PART_TO_INDEX.get(PART_CODES.NOTHING) ?? 0);
    const colorIndex = COLOR_TO_INDEX.get(colorCode) ?? UNCOLORED_COLOR_BITS;
    return (shapeIndex << SHAPE_BIT_SHIFT) | colorIndex;
}

function decodeShape(partBits) {
    return INDEX_TO_PART[(partBits & SHAPE_BIT_MASK) >> SHAPE_BIT_SHIFT] ?? PART_CODES.NOTHING;
}

function decodeColor(partBits) {
    return INDEX_TO_COLOR[partBits & COLOR_BIT_MASK] ?? UNCOLORED_CODE;
}

function getShapeBits(partBits) {
    return partBits & SHAPE_BIT_MASK;
}

function getColorBits(partBits) {
    return partBits & COLOR_BIT_MASK;
}

function withColorBits(partBits, colorBits) {
    return (partBits & SHAPE_BIT_MASK) | colorBits;
}

function isNothingPart(partBits) {
    return getShapeBits(partBits) === NOTHING_SHAPE_BITS;
}

function isCrystalPart(partBits) {
    return getShapeBits(partBits) === CRYSTAL_SHAPE_BITS;
}

function deepCopyLayers(layers) {
    const result = new Array(layers.length);
    for (let i = 0; i < layers.length; i++) {
        result[i] = Uint8Array.from(layers[i]);
    }
    return result;
}

function createEmptyLayer(numParts) {
    const layer = new Uint8Array(numParts);
    layer.fill(EMPTY_PART);
    return layer;
}

function layerCodeToBits(layerCode) {
    const numParts = layerCode.length / 2;
    const layer = new Uint8Array(numParts);

    for (let i = 0; i < numParts; i++) {
        const shape = layerCode[i * 2];
        const color = layerCode[i * 2 + 1];
        layer[i] = encodePart(shape, color);
    }

    return layer;
}

function layerToCode(layer) {
    let out = '';
    for (let i = 0; i < layer.length; i++) {
        const part = layer[i];
        out += decodeShape(part);
        out += decodeColor(part);
    }
    return out;
}

// shape classes
export class ShapePart {
    constructor(shape, color = PART_CODES.NOTHING) {
        if (typeof shape === 'number' && color === PART_CODES.NOTHING) {
            this.bits = shape & 0xff;
            return;
        }
        this.bits = encodePart(shape, color);
    }

    get shape() {
        return decodeShape(this.bits);
    }

    get color() {
        return decodeColor(this.bits);
    }

    toBits() {
        return this.bits;
    }
}

export class Shape {
    constructor(layers) {
        const normalizedLayers = new Array(layers.length);

        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];

            if (layer instanceof Uint8Array) {
                normalizedLayers[i] = Uint8Array.from(layer);
                continue;
            }

            const normalizedLayer = new Uint8Array(layer.length);
            for (let j = 0; j < layer.length; j++) {
                const part = layer[j];
                if (typeof part === 'number') {
                    normalizedLayer[j] = part & 0xff;
                } else if (part instanceof ShapePart) {
                    normalizedLayer[j] = part.toBits();
                } else {
                    normalizedLayer[j] = encodePart(part.shape, part.color);
                }
            }
            normalizedLayers[i] = normalizedLayer;
        }

        this.layers = normalizedLayers;
        this.numLayers = normalizedLayers.length;
        this.numParts = normalizedLayers[0]?.length ?? 0;
        this._code = null;
        this._empty = null;
        this._bitKey = null;
    }

    static fromListOfLayers(layers) {
        if (!layers.length) {
            return new Shape([createEmptyLayer(0)]);
        }

        if (typeof layers[0] === 'string') {
            const newLayers = layers.map(layerCodeToBits);
            return new Shape(newLayers);
        }

        return new Shape(layers);
    }

    static fromShapeCode(shapeCode) {
        return this.fromListOfLayers(shapeCode.split(SHAPE_LAYER_SEPARATOR));
    }

    toListOfLayers() {
        const list = new Array(this.layers.length);
        for (let i = 0; i < this.layers.length; i++) {
            list[i] = layerToCode(this.layers[i]);
        }
        return list;
    }

    toShapeCode() {
        if (this._code !== null) return this._code;
        this._code = this.toListOfLayers().join(SHAPE_LAYER_SEPARATOR);
        return this._code;
    }

    toBitKey() {
        if (this._bitKey !== null) return this._bitKey;

        let key = `${this.numParts}|${this.numLayers}|`;
        for (let i = 0; i < this.layers.length; i++) {
            const layer = this.layers[i];
            for (let j = 0; j < layer.length; j++) {
                key += String.fromCharCode(256 + layer[j]);
            }
        }

        this._bitKey = key;
        return this._bitKey;
    }

    isEmpty() {
        if (this._empty !== null) return this._empty;

        for (let layerIndex = 0; layerIndex < this.layers.length; layerIndex++) {
            const layer = this.layers[layerIndex];
            for (let partIndex = 0; partIndex < layer.length; partIndex++) {
                if (!isNothingPart(layer[partIndex])) {
                    this._empty = false;
                    return false;
                }
            }
        }

        this._empty = true;
        return true;
    }

    isSingleLayerFullyUncoloredForPaint() {
        if (this.numLayers !== 1) return false;

        const topLayer = this.layers[0];
        for (let i = 0; i < topLayer.length; i++) {
            const part = topLayer[i];
            const shapeBits = getShapeBits(part);
            if (UNPAINTABLE_SHAPE_BITS.has(shapeBits)) continue;
            if (getColorBits(part) !== UNCOLORED_COLOR_BITS) return false;
        }

        return true;
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
    const shape1 = getShapeBits(part1);
    const shape2 = getShapeBits(part2);
    if (shape1 === NOTHING_SHAPE_BITS || shape1 === PIN_SHAPE_BITS) return false;
    if (shape2 === NOTHING_SHAPE_BITS || shape2 === PIN_SHAPE_BITS) return false;
    return true;
}

function _crystalsFused(part1, part2) {
    return getShapeBits(part1) === CRYSTAL_SHAPE_BITS && getShapeBits(part2) === CRYSTAL_SHAPE_BITS;
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
    if (isNothingPart(layer[index])) {
        return [];
    }

    const isConnected = new Uint8Array(layer.length);
    const connected = [index];
    isConnected[index] = 1;
    let previousIndex = index;

    for (let i = index + 1; i < layer.length + index; i++) {
        const curIndex = _getCorrectedIndex(layer, i);
        if (!connectedFunc(layer[previousIndex], layer[curIndex])) {
            break;
        }
        connected.push(curIndex);
        isConnected[curIndex] = 1;
        previousIndex = curIndex;
    }

    previousIndex = index;
    for (let i = index - 1; i > -layer.length + index; i--) {
        const curIndex = _getCorrectedIndex(layer, i);
        if (isConnected[curIndex]) {
            break;
        }
        if (!connectedFunc(layer[previousIndex], layer[curIndex])) {
            break;
        }
        connected.push(curIndex);
        isConnected[curIndex] = 1;
        previousIndex = curIndex;
    }

    return connected;
}

function _getConnectedMultiLayer(layers, layerIndex, partIndex, connectedFunc) {
    if (isNothingPart(layers[layerIndex][partIndex])) {
        return [];
    }

    const visited = layers.map((layer) => new Uint8Array(layer.length));
    const connected = [[layerIndex, partIndex]];
    visited[layerIndex][partIndex] = 1;

    for (let i = 0; i < connected.length; i++) {
        const [curLayer, curPart] = connected[i];
        for (const partIdx of _getConnectedSingleLayer(layers[curLayer], curPart, connectedFunc)) {
            if (!visited[curLayer][partIdx]) {
                visited[curLayer][partIdx] = 1;
                connected.push([curLayer, partIdx]);
            }
        }

        const toCheckLayer = curLayer - 1;
        const toCheckPart = curPart;
        if (curLayer > 0 && !visited[toCheckLayer][toCheckPart]) {
            if (connectedFunc(layers[curLayer][curPart], layers[toCheckLayer][toCheckPart])) {
                visited[toCheckLayer][toCheckPart] = 1;
                connected.push([toCheckLayer, toCheckPart]);
            }
        }

        const toCheckLayerAbove = curLayer + 1;
        const toCheckPartAbove = curPart;
        if (curLayer < layers.length - 1 && !visited[toCheckLayerAbove][toCheckPartAbove]) {
            if (connectedFunc(layers[curLayer][curPart], layers[toCheckLayerAbove][toCheckPartAbove])) {
                visited[toCheckLayerAbove][toCheckPartAbove] = 1;
                connected.push([toCheckLayerAbove, toCheckPartAbove]);
            }
        }
    }

    return connected;
}

function _breakCrystals(layers, layerIndex, partIndex) {
    for (const [curLayer, curPart] of _getConnectedMultiLayer(layers, layerIndex, partIndex, _crystalsFused)) {
        layers[curLayer][curPart] = EMPTY_PART;
    }
}

function _makeLayersFall(layers) {
    function sepInGroups(layer) {
        const handledIndexes = new Uint8Array(layer.length);
        const groups = [];
        for (let partIndex = 0; partIndex < layer.length; partIndex++) {
            if (handledIndexes[partIndex]) continue;
            const group = _getConnectedSingleLayer(layer, partIndex, _gravityConnected);
            if (group.length > 0) {
                groups.push(group);
                for (const idx of group) handledIndexes[idx] = 1;
            }
        }
        return groups;
    }

    const layerCount = layers.length;
    const numParts = layers[0]?.length ?? 0;
    const nodeCount = layerCount * numParts;
    const supportedPartStates = Array.from({ length: layerCount }, () => new Int8Array(numParts).fill(-1));
    const supportVisited = new Uint8Array(nodeCount);

    function getLinearIndex(layerIndex, partIndex) {
        return (layerIndex * numParts) + partIndex;
    }

    function isPartSupported(layerIndex, partIndex) {
        const cached = supportedPartStates[layerIndex][partIndex];
        if (cached !== -1) {
            return cached === 1;
        }

        const curPart = layers[layerIndex][partIndex];
        const currentLinearIndex = getLinearIndex(layerIndex, partIndex);

        function inner() {
            if (isNothingPart(layers[layerIndex][partIndex])) {
                return false;
            }

            if (layerIndex === 0) {
                return true;
            }

            supportVisited[currentLinearIndex] = 1;

            const partUnderneath = [layerIndex - 1, partIndex];
            const underneathLinearIndex = getLinearIndex(partUnderneath[0], partUnderneath[1]);
            if (!supportVisited[underneathLinearIndex] && isPartSupported(partUnderneath[0], partUnderneath[1])) {
                supportVisited[currentLinearIndex] = 0;
                return true;
            }

            const nextPartPos = [layerIndex, _getCorrectedIndex(layers[layerIndex], partIndex + 1)];
            const nextLinearIndex = getLinearIndex(nextPartPos[0], nextPartPos[1]);
            if (
                !supportVisited[nextLinearIndex] &&
                _gravityConnected(curPart, layers[nextPartPos[0]][nextPartPos[1]]) &&
                isPartSupported(nextPartPos[0], nextPartPos[1])
            ) {
                supportVisited[currentLinearIndex] = 0;
                return true;
            }

            const prevPartPos = [layerIndex, _getCorrectedIndex(layers[layerIndex], partIndex - 1)];
            const prevLinearIndex = getLinearIndex(prevPartPos[0], prevPartPos[1]);
            if (
                !supportVisited[prevLinearIndex] &&
                _gravityConnected(curPart, layers[prevPartPos[0]][prevPartPos[1]]) &&
                isPartSupported(prevPartPos[0], prevPartPos[1])
            ) {
                supportVisited[currentLinearIndex] = 0;
                return true;
            }

            const partAbove = [layerIndex + 1, partIndex];
            const aboveInBounds = partAbove[0] < layerCount;
            if (
                aboveInBounds &&
                !supportVisited[getLinearIndex(partAbove[0], partAbove[1])] &&
                _crystalsFused(curPart, layers[partAbove[0]][partAbove[1]]) &&
                isPartSupported(partAbove[0], partAbove[1])
            ) {
                supportVisited[currentLinearIndex] = 0;
                return true;
            }

            supportVisited[currentLinearIndex] = 0;
            return false;
        }

        const result = inner();
        supportedPartStates[layerIndex][partIndex] = result ? 1 : 0;
        return result;
    }

    for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
        for (let partIndex = 0; partIndex < layers[layerIndex].length; partIndex++) {
            isPartSupported(layerIndex, partIndex);
        }
    }

    for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
        for (let partIndex = 0; partIndex < layers[layerIndex].length; partIndex++) {
            const part = layers[layerIndex][partIndex];
            if (isCrystalPart(part) && supportedPartStates[layerIndex][partIndex] !== 1) {
                layers[layerIndex][partIndex] = EMPTY_PART;
            }
        }
    }

    for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
        supportedPartStates[layerIndex].fill(-1);
    }

    for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
        for (let partIndex = 0; partIndex < layers[layerIndex].length; partIndex++) {
            isPartSupported(layerIndex, partIndex);
        }
    }

    for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
        const layer = layers[layerIndex];
        if (layerIndex === 0) continue;

        for (const group of sepInGroups(layer)) {
            if (group.some((p) => supportedPartStates[layerIndex][p] === 1)) continue;

            let fallToLayerIndex;
            for (fallToLayerIndex = layerIndex; fallToLayerIndex >= 0; fallToLayerIndex--) {
                if (fallToLayerIndex === 0) break;
                let fall = true;
                for (const partIndex of group) {
                    if (!isNothingPart(layers[fallToLayerIndex - 1][partIndex])) {
                        fall = false;
                        break;
                    }
                }
                if (!fall) break;
            }

            for (const partIndex of group) {
                layers[fallToLayerIndex][partIndex] = layers[layerIndex][partIndex];
                layers[layerIndex][partIndex] = EMPTY_PART;
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
        const layer = layers[i];
        let hasPart = false;
        for (let j = 0; j < layer.length; j++) {
            if (!isNothingPart(layer[j])) {
                hasPart = true;
                break;
            }
        }
        if (hasPart) {
            return layers.slice(0, i + 1);
        }
    }

    return [layers[0]];
}

function _differentNumPartsUnsupported(func) {
    return function(...args) {
        let config = new ShapeOperationConfig();
        const shapes = [];

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
    const splitIndex = shape.numParts - takeParts;
    const cutPoints = [
        [0, shape.numParts - 1],
        [splitIndex, splitIndex - 1]
    ];
    const layers = deepCopyLayers(shape.layers);

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
        const layerA = createEmptyLayer(shape.numParts);
        const layerB = createEmptyLayer(shape.numParts);

        for (let i = 0; i < splitIndex; i++) {
            layerB[i] = layer[i];
        }
        for (let i = splitIndex; i < shape.numParts; i++) {
            layerA[i] = layer[i];
        }

        shapeA.push(layerA);
        shapeB.push(layerB);
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
    const newLayers = new Array(shape.layers.length);

    for (let layerIndex = 0; layerIndex < shape.layers.length; layerIndex++) {
        const layer = shape.layers[layerIndex];
        const newLayer = new Uint8Array(layer.length);

        if (layer.length > 0) {
            newLayer[0] = layer[layer.length - 1];
            for (let i = 0; i < layer.length - 1; i++) {
                newLayer[i + 1] = layer[i];
            }
        }

        newLayers[layerIndex] = newLayer;
    }

    return [new Shape(newLayers)];
}

export function rotate90CCW(shape, config = new ShapeOperationConfig()) {
    const newLayers = new Array(shape.layers.length);

    for (let layerIndex = 0; layerIndex < shape.layers.length; layerIndex++) {
        const layer = shape.layers[layerIndex];
        const newLayer = new Uint8Array(layer.length);

        if (layer.length > 0) {
            for (let i = 1; i < layer.length; i++) {
                newLayer[i - 1] = layer[i];
            }
            newLayer[layer.length - 1] = layer[0];
        }

        newLayers[layerIndex] = newLayer;
    }

    return [new Shape(newLayers)];
}

export function rotate180(shape, config = new ShapeOperationConfig()) {
    const takeParts = Math.ceil(shape.numParts / 2);
    const newLayers = new Array(shape.layers.length);

    for (let layerIndex = 0; layerIndex < shape.layers.length; layerIndex++) {
        const layer = shape.layers[layerIndex];
        const newLayer = new Uint8Array(layer.length);

        for (let i = 0; i < layer.length; i++) {
            newLayer[i] = layer[(i + takeParts) % layer.length];
        }

        newLayers[layerIndex] = newLayer;
    }

    return [new Shape(newLayers)];
}

export const swapHalves = _differentNumPartsUnsupported(function(shapeA, shapeB, config = new ShapeOperationConfig()) {
    const numLayers = Math.max(shapeA.numLayers, shapeB.numLayers);
    const takeParts = Math.ceil(shapeA.numParts / 2);
    const splitIndex = shapeA.numParts - takeParts;

    const [shapeACut1, shapeACut2] = cut(shapeA, config);
    const [shapeBCut1, shapeBCut2] = cut(shapeB, config);

    const EMPTY_A = createEmptyLayer(shapeA.numParts);
    const EMPTY_B = createEmptyLayer(shapeB.numParts);

    const returnShapeA = [];
    const returnShapeB = [];

    for (let i = 0; i < numLayers; i++) {
        const layerA1 = shapeACut1.layers[i] || EMPTY_A;
        const layerA2 = shapeACut2.layers[i] || EMPTY_A;
        const layerB1 = shapeBCut1.layers[i] || EMPTY_B;
        const layerB2 = shapeBCut2.layers[i] || EMPTY_B;

        const newLayerA = createEmptyLayer(shapeA.numParts);
        const newLayerB = createEmptyLayer(shapeB.numParts);

        for (let partIndex = 0; partIndex < splitIndex; partIndex++) {
            newLayerA[partIndex] = layerA2[partIndex];
            newLayerB[partIndex] = layerB2[partIndex];
        }
        for (let partIndex = splitIndex; partIndex < shapeA.numParts; partIndex++) {
            newLayerA[partIndex] = layerB1[partIndex];
            newLayerB[partIndex] = layerA1[partIndex];
        }

        returnShapeA.push(newLayerA);
        returnShapeB.push(newLayerB);
    }

    const processedA = _cleanUpEmptyUpperLayers(returnShapeA);
    const processedB = _cleanUpEmptyUpperLayers(returnShapeB);

    return [new Shape(processedA), new Shape(processedB)];
});

export const stack = _differentNumPartsUnsupported(function(bottomShape, topShape, config = new ShapeOperationConfig()) {
    const newLayers = [
        ...deepCopyLayers(bottomShape.layers),
        createEmptyLayer(bottomShape.numParts),
        ...deepCopyLayers(topShape.layers)
    ];

    const processed = _cleanUpEmptyUpperLayers(_makeLayersFall(newLayers));
    return [new Shape(processed.slice(0, config.maxShapeLayers))];
});

export function topPaint(shape, color, config = new ShapeOperationConfig()) {
    const colorBits = encodeColor(color);
    const newLayers = deepCopyLayers(shape.layers);
    const topIndex = newLayers.length - 1;
    const sourceTop = newLayers[topIndex];
    const paintedTop = new Uint8Array(sourceTop.length);

    for (let i = 0; i < sourceTop.length; i++) {
        const part = sourceTop[i];
        const shapeBits = getShapeBits(part);
        paintedTop[i] = UNPAINTABLE_SHAPE_BITS.has(shapeBits)
            ? part
            : withColorBits(part, colorBits);
    }

    newLayers[topIndex] = paintedTop;
    return [new Shape(newLayers)];
}

export function pushPin(shape, config = new ShapeOperationConfig()) {
    const layers = deepCopyLayers(shape.layers);
    const addedPins = new Uint8Array(shape.numParts);

    for (let i = 0; i < layers[0].length; i++) {
        const part = layers[0][i];
        addedPins[i] = isNothingPart(part) ? EMPTY_PART : PIN_PART;
    }

    let newLayers;
    if (layers.length < config.maxShapeLayers) {
        newLayers = [addedPins, ...layers];
    } else {
        newLayers = [addedPins, ...layers.slice(0, config.maxShapeLayers - 1)];
        const removedLayer = layers[config.maxShapeLayers - 1];
        const topLayer = newLayers[newLayers.length - 1];

        for (let partIndex = 0; partIndex < topLayer.length; partIndex++) {
            if (_crystalsFused(topLayer[partIndex], removedLayer[partIndex])) {
                _breakCrystals(newLayers, newLayers.length - 1, partIndex);
            }
        }
    }

    const processed = _cleanUpEmptyUpperLayers(_makeLayersFall(newLayers));
    return [new Shape(processed)];
}

export function genCrystal(shape, color, config = new ShapeOperationConfig()) {
    const colorBits = encodeColor(color);
    const newLayers = new Array(shape.layers.length);

    for (let layerIndex = 0; layerIndex < shape.layers.length; layerIndex++) {
        const sourceLayer = shape.layers[layerIndex];
        const newLayer = new Uint8Array(sourceLayer.length);

        for (let partIndex = 0; partIndex < sourceLayer.length; partIndex++) {
            const part = sourceLayer[partIndex];
            if (REPLACED_BY_CRYSTAL_SHAPE_BITS.has(getShapeBits(part))) {
                newLayer[partIndex] = withColorBits(CRYSTAL_SHAPE_ONLY_PART, colorBits);
            } else {
                newLayer[partIndex] = part;
            }
        }

        newLayers[layerIndex] = newLayer;
    }

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

function isExtractablePart(part, includePins, includeCrystals) {
    const shapeBits = getShapeBits(part);
    if (!includePins && shapeBits === PIN_SHAPE_BITS) return false;
    if (!includeCrystals && shapeBits === CRYSTAL_SHAPE_BITS) return false;
    if (shapeBits === NOTHING_SHAPE_BITS) return false;
    return true;
}

function normalizePartForExtraction(part, includeColor) {
    const shapeBits = getShapeBits(part);
    if (UNPAINTABLE_SHAPE_BITS.has(shapeBits)) return part;
    const colorBits = includeColor ? getColorBits(part) : UNCOLORED_COLOR_BITS;
    return shapeBits | colorBits;
}

export function _extractLayers(shape, mode = 'part', includePins = true, includeColor = true, includeCrystals = true) {
    const numParts = shape.numParts;
    const results = [];

    for (const layer of shape.layers) {
        if (mode === 'layer') {
            const newLayer = createEmptyLayer(numParts);

            for (let i = 0; i < layer.length; i++) {
                const part = layer[i];
                if (!isExtractablePart(part, includePins, includeCrystals)) continue;
                newLayer[i] = normalizePartForExtraction(part, includeColor);
            }

            results.push(newLayer);
            continue;
        }

        if (mode === 'part') {
            for (let i = 0; i < layer.length; i++) {
                const part = layer[i];
                if (!isExtractablePart(part, includePins, includeCrystals)) continue;

                const newLayer = createEmptyLayer(numParts);
                newLayer[i] = normalizePartForExtraction(part, includeColor);
                results.push(newLayer);
            }
            continue;
        }

        const groups = new Map();

        for (let i = 0; i < layer.length; i++) {
            const part = layer[i];
            if (!isExtractablePart(part, includePins, includeCrystals)) continue;

            let key;
            if (mode === 'color') {
                key = getColorBits(part);
            } else if (mode === 'shape') {
                key = getShapeBits(part);
            } else {
                key = part;
            }

            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push({ index: i, part });
        }

        for (const entries of groups.values()) {
            const newLayer = createEmptyLayer(numParts);
            for (const entry of entries) {
                newLayer[entry.index] = normalizePartForExtraction(entry.part, includeColor);
            }
            results.push(newLayer);
        }
    }

    return results.map(layerToCode);
}

export function _getPaintColors(inputShape, targetShape) {
    const targetColorMap = new Map();

    for (const layer of targetShape.layers) {
        for (let i = 0; i < layer.length; i++) {
            const part = layer[i];
            const shapeBits = getShapeBits(part);
            const colorBits = getColorBits(part);

            if (UNPAINTABLE_SHAPE_BITS.has(shapeBits) || colorBits === UNCOLORED_COLOR_BITS) {
                continue;
            }

            if (!targetColorMap.has(shapeBits)) {
                targetColorMap.set(shapeBits, new Set());
            }
            targetColorMap.get(shapeBits).add(colorBits);
        }
    }

    const validColorBits = new Set();
    const topLayer = inputShape.layers[inputShape.layers.length - 1];

    if (topLayer) {
        for (let i = 0; i < topLayer.length; i++) {
            const part = topLayer[i];
            const shapeBits = getShapeBits(part);
            if (UNPAINTABLE_SHAPE_BITS.has(shapeBits)) continue;

            const targetColors = targetColorMap.get(shapeBits);
            if (!targetColors) continue;

            const inputColorBits = getColorBits(part);
            for (const targetColorBits of targetColors) {
                if (targetColorBits !== inputColorBits) {
                    validColorBits.add(targetColorBits);
                }
            }
        }
    }

    return Array.from(validColorBits).map((colorBits) => INDEX_TO_COLOR[colorBits] ?? UNCOLORED_CODE);
}

export function _getCrystalColors(shape) {
    const crystalColors = new Set();

    for (const layer of shape.layers) {
        for (let i = 0; i < layer.length; i++) {
            const part = layer[i];
            if (isCrystalPart(part)) {
                crystalColors.add(INDEX_TO_COLOR[getColorBits(part)] ?? UNCOLORED_CODE);
            }
        }
    }

    return crystalColors.size > 0 ? Array.from(crystalColors) : [UNCOLORED_CODE];
    // if no crystals exist in targets, it will use 'u' to generate crystals because some solutions require generating crystals before breaking them
}

export function _getSimilarity(shape1, shape2, weights = { type: 0.5, color: 0.3, order: 0.2 }) {
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
        for (let i = 0; i < layer.length; i++) {
            const shapeBits = getShapeBits(layer[i]);
            counts.set(shapeBits, (counts.get(shapeBits) || 0) + 1);
        }
    }
    return counts;
}

function _getPartCounts(shape) {
    const counts = new Map();
    for (const layer of shape.layers) {
        for (let i = 0; i < layer.length; i++) {
            const partBits = layer[i];
            counts.set(partBits, (counts.get(partBits) || 0) + 1);
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
                if (getShapeBits(layerA[j]) === getShapeBits(layerB[j])) {
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
