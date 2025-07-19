// Imports
import { NOTHING_CHAR, SHAPE_LAYER_SEPARATOR, PIN_CHAR, CRYSTAL_CHAR } from './shapeOperations.js';

// Valid shape characters
const VALID_SHAPES = [
    NOTHING_CHAR,
    PIN_CHAR,
    CRYSTAL_CHAR,
    'C', // circle
    'R', // rectangle
    'S', // star
    'W', // diamond
    'H', // hexagon
    'F', // flower
    'G' // gear
];

// Valid color characters
const VALID_COLORS = [
    NOTHING_CHAR,
    'u', // uncolored
    'r', // red
    'g', // green
    'b', // blue
    'y', // yellow
    'c', // cyan
    'm', // magenta
    'w', // white
];

function validateShapeCode(shapeCode) {
    const errors = [];

    // Check if shapeCode is a string
    if (typeof shapeCode !== 'string') {
        return { isValid: false, errors: ['The shape code must be a string.'] };
    }

    // Check if empty
    if (shapeCode.length === 0) {
        return { isValid: false, errors: ['The shape code cannot be empty.'] };
    }

    // Split into layers
    const layers = shapeCode.split(SHAPE_LAYER_SEPARATOR);

    // Check if we have at least one layer
    if (layers.length === 0) {
        errors.push('The shape code must contain at least one layer.');
        return { isValid: false, errors };
    }

    // Check each layer
    let expectedPartsPerLayer = null;

    for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        const layerErrors = validateLayer(layer, i);
        errors.push(...layerErrors);

        // Check for consistent number of parts
        const numParts = layer.length / 2;
        if (expectedPartsPerLayer === null) {
            expectedPartsPerLayer = numParts;
        } else if (numParts !== expectedPartsPerLayer) {
            errors.push(`Layer ${i + 1} has ${numParts} parts, but expected ${expectedPartsPerLayer}. All layers should have the same number of parts.`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

function validateLayer(layer, layerIndex) {
    const errors = [];
    const layerLabel = `Layer ${layerIndex + 1}`;

    // Check if layer is empty
    if (layer.length === 0) {
        errors.push(`${layerLabel} is empty. Each layer must contain shape-color pairs.`);
        return errors;
    }

    // Check if layer length is even
    if (layer.length % 2 !== 0) {
        errors.push(`${layerLabel} must contain an even number of characters (each shape must have a color).`);
        return errors;
    }

    for (let i = 0; i < layer.length; i += 2) {
        const shape = layer[i];
        const color = layer[i + 1];
        const partIndex = i / 2;
        const partLabel = `${layerLabel}, Part ${partIndex + 1}`;

        if (!VALID_SHAPES.includes(shape)) {
            errors.push(`${partLabel}: '${shape}' is not a valid shape.`);
        }

        if (!VALID_COLORS.includes(color)) {
            errors.push(`${partLabel}: '${color}' is not a valid color.`);
        }

        if (shape === NOTHING_CHAR && color !== NOTHING_CHAR) {
            errors.push(`${partLabel}: A 'Nothing' shape cannot have a color.`);
        }

        if (shape === PIN_CHAR && color !== NOTHING_CHAR) {
            errors.push(`${partLabel}: A 'Pin' shape cannot have a color.`);
        }
    }

    return errors;
}

export function showValidationErrors(shapeCode, context = 'shape') {
    const validation = validateShapeCode(shapeCode);
    if (!validation.isValid) {
        const errorMessage = `Invalid ${context} code: ${shapeCode}\n\nErrors:\n${validation.errors.join('\n')}`;
        alert(errorMessage);
        return false;
    }
    return true;
}