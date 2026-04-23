import { COLOR_MODES, PART_CODES, SHAPE_LAYER_SEPARATOR } from './shapeConstants.js';

const VALID_SHAPES = new Set(Object.values(PART_CODES));
const VALID_COLORS = new Set([PART_CODES.NOTHING, ...Object.keys(COLOR_MODES.rgb)]);

function validateLayer(layer, layerIndex) {
    const errors = [];
    const label  = `Layer ${layerIndex + 1}`;

    if (layer.length === 0) {
        errors.push(`${label} is empty. Each layer must contain shape-color pairs.`);
        return errors;
    }

    if (layer.length % 2 !== 0) {
        errors.push(`${label} must contain an even number of characters (each shape must have a color).`);
        return errors;
    }

    for (let i = 0; i < layer.length; i += 2) {
        const shape     = layer[i];
        const color     = layer[i + 1];
        const partLabel = `${label}, Part ${(i / 2) + 1}`;

        if (!VALID_SHAPES.has(shape)) errors.push(`${partLabel}: '${shape}' is not a valid shape.`);
        if (!VALID_COLORS.has(color)) errors.push(`${partLabel}: '${color}' is not a valid color.`);

        if (shape === PART_CODES.NOTHING && color !== PART_CODES.NOTHING)
            errors.push(`${partLabel}: A 'Nothing' shape cannot have a color.`);

        if (shape === PART_CODES.PIN && color !== PART_CODES.NOTHING)
            errors.push(`${partLabel}: A 'Pin' shape cannot have a color.`);
    }

    return errors;
}

export function validateShapeCode(shapeCode) {
    if (typeof shapeCode !== 'string') return { isValid: false, errors: ['The shape code must be a string.'] };
    if (!shapeCode.length)             return { isValid: false, errors: ['The shape code cannot be empty.'] };

    const layers = shapeCode.split(SHAPE_LAYER_SEPARATOR);
    if (!layers.length)                return { isValid: false, errors: ['The shape code must contain at least one layer.'] };

    const errors             = [];
    let expectedParts        = null;

    for (let i = 0; i < layers.length; i++) {
        errors.push(...validateLayer(layers[i], i));

        const numParts = layers[i].length / 2;
        if (expectedParts === null) {
            expectedParts = numParts;
        } else if (numParts !== expectedParts) {
            errors.push(`Layer ${i + 1} has ${numParts} parts, but expected ${expectedParts}. All layers must have the same number of parts.`);
        }
    }

    return { isValid: errors.length === 0, errors };
}

export function showValidationErrors(shapeCode, context = 'shape') {
    const { isValid, errors } = validateShapeCode(shapeCode);
    if (isValid) return true;
    alert(`Invalid ${context} code: ${shapeCode}\n\nErrors:\n${errors.join('\n')}`);
    return false;
}