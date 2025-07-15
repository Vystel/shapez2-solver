// Special thanks to https://github.com/Loupau38/loupau38.github.io/blob/main/assets/scripts/shapeViewer.js
import { getCurrentColorMode } from './main.js';

// exported constants
export const SHAPES_CONFIG = {
    QUAD: "quad",
    HEX: "hex"
};

export const COLOR_MODES = {
    RGB: "rgb",
    RYB: "ryb", 
    CMYK: "cmyk"
};

export const baseColors = {
    "u": "rgb(164,158,165)",
    "r": "rgb(255,0,0)",
    "g": "rgb(0,255,0)",
    "b": "rgb(67,110,223)",
    "c": "rgb(0,255,255)",
    "m": "rgb(255,0,255)",
    "y": "rgb(255,255,0)",
    "w": "rgb(255,255,255)",
    "k": "rgb(86,77,78)",
    "p": "rgb(167,41,207)",
    "o": "rgb(213,133,13)",
};

// internal constants
export const colorValues = {
    "rgb" : {
        "u" : baseColors["u"],
        "r" : baseColors["r"],
        "g" : baseColors["g"],
        "b" : baseColors["b"],
        "c" : baseColors["c"],
        "m" : baseColors["m"],
        "y" : baseColors["y"],
        "w" : baseColors["w"]
    },
    "ryb" : {
        "u" : baseColors["u"],
        "r" : baseColors["r"],
        "g" : baseColors["y"],
        "b" : baseColors["b"],
        "c" : baseColors["g"],
        "m" : baseColors["p"],
        "y" : baseColors["o"],
        "w" : baseColors["k"]
    },
    "cmyk" : {
        "u" : baseColors["u"],
        "r" : baseColors["c"],
        "g" : baseColors["m"],
        "b" : baseColors["y"],
        "c" : baseColors["r"],
        "m" : baseColors["g"],
        "y" : baseColors["b"],
        "w" : baseColors["k"]
    }
};

const shapeBorderColor = "rgb(35,25,35)";
const BGCircleColor = "rgba(0,0,0,0)";
const shadowColor = "rgba(50,50,50,0.5)";
const pinColor = "rgb(71,69,75)";

const layerSizeReduction = 0.75;

// original constants
const defaultImageSize = 602;
const defaultBGCircleDiameter = 520;
const defaultShapeDiameter = 407;
const defaultBorderSize = 15;

const BGCircleDiameter = defaultBGCircleDiameter / defaultImageSize;
const shapeDiameter = defaultShapeDiameter / defaultImageSize;
const borderSize = defaultBorderSize / defaultImageSize;

const sqrt2 = Math.sqrt(2);
const sqrt3 = Math.sqrt(3);
const sqrt6 = Math.sqrt(6);

// utilities
function darkenColor(color) {
    color = color.slice(4, -1);
    let [r, g, b] = color.split(",");
    r = Math.round(parseInt(r) / 2);
    g = Math.round(parseInt(g) / 2);
    b = Math.round(parseInt(b) / 2);
    return `rgb(${r},${g},${b})`;
}

function radians(angle) {
    return angle * (Math.PI / 180);
}

function drawPolygon(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.closePath();
}

// Render a shape part
function renderPart(ctx, partShape, partColor, layerIndex, shapesConfig, colorMode, borderScale) {
    const drawShadow = layerIndex != 0;
    const color = colorValues[colorMode][partColor];
    const curBorderSize = borderSize / borderScale;

    function standardDraw(drawPath) {
        return [
            (() => {
                drawPath();
                ctx.fillStyle = color;
                ctx.fill();
            }),
            (() => {
                drawPath();
                ctx.strokeStyle = shapeBorderColor;
                ctx.lineWidth = curBorderSize;
                ctx.lineJoin = "round";
                ctx.stroke();
            })
        ];
    }

    if (partShape == "-") {
        return [(() => {}),(() => {})]
    }

    if (partShape == "C") {
        function drawPath() {
            ctx.beginPath();
            ctx.moveTo(0, 1);
            ctx.arc(0, 1, 1, -Math.PI / 2, 0);
            ctx.closePath();
        }
        return standardDraw(drawPath);
    }

    if (partShape == "R") {
        function drawPath() {
            ctx.beginPath();
            ctx.rect(0, 0, 1, 1);
            ctx.closePath();
        }
        return standardDraw(drawPath);
    }

    if (partShape == "S") {
        function drawPath() {
            ctx.beginPath();
            ctx.moveTo(1, 0);
            ctx.lineTo(0.5, 1);
            ctx.lineTo(0, 1);
            ctx.lineTo(0, 0.5);
            ctx.closePath();
        }
        return standardDraw(drawPath);
    }

    if (partShape == "W") {
        const sideLength = 1 / 3.75;
        function drawPath() {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(sideLength, 0);
            ctx.arc(1.4, -0.4, 1.18, Math.PI * 0.89, Math.PI * 0.61, true);
            ctx.lineTo(1, 1);
            ctx.lineTo(0, 1);
            ctx.closePath();
        }
        return standardDraw(drawPath);
    }

    if (partShape == "H") {
        function drawPath() {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(sqrt3 / 2, 0.5);
            ctx.lineTo(0, 1);
            ctx.closePath();
        }
        return standardDraw(drawPath);
    }

    if (partShape == "F") {
        const semicircleRadius = (3 - sqrt3) / 4;
        const triangleSideLength = 2 * semicircleRadius;
        const semicircleCenterX = (triangleSideLength * (sqrt3 / 2)) / 2;
        const semicircleCenterY = (
            1
            - triangleSideLength
            + Math.sqrt((semicircleRadius * semicircleRadius) - (semicircleCenterX * semicircleCenterX))
        );
        const semicircleStartAngle = (7 / 6) * Math.PI;
        const semicircleStopAngle = (1 / 6) * Math.PI;
        function drawPath() {
            ctx.beginPath();
            ctx.moveTo(0, 1);
            ctx.lineTo(0, 1 - triangleSideLength);
            ctx.arc(semicircleCenterX, semicircleCenterY, semicircleRadius, semicircleStartAngle, semicircleStopAngle);
            ctx.closePath();
        }
        return standardDraw(drawPath);
    }

    if (partShape == "G") {
        function drawPath() {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(sqrt3 / 6, 0.5);
            ctx.lineTo(sqrt3 / 2, 0.5);
            ctx.lineTo(0, 1);
            ctx.closePath();
        }
        return standardDraw(drawPath);
    }

    if (partShape == "P") {
        let pinCenterX, pinCenterY;
        if (shapesConfig == SHAPES_CONFIG.QUAD) {
            pinCenterX = 1 / 3;
            pinCenterY = 2 / 3;
        } else if (shapesConfig == SHAPES_CONFIG.HEX) {
            pinCenterX = sqrt2 / 6;
            pinCenterY = 1 - (sqrt6 / 6);
        }
        const pinRadius = 1 / 6;
        return [
            (() => {
                if (drawShadow) {
                    ctx.beginPath();
                    ctx.arc(pinCenterX, pinCenterY, pinRadius + (curBorderSize / 2), 0, 2 * Math.PI);
                    ctx.closePath();
                    ctx.fillStyle = shadowColor;
                    ctx.fill();
                }
                ctx.beginPath();
                ctx.arc(pinCenterX, pinCenterY, pinRadius, 0, 2 * Math.PI);
                ctx.closePath();
                ctx.fillStyle = pinColor;
                ctx.fill();
            }),
            (() => {})
        ];
    }

    if (partShape == "c") {
        const darkenedColor = darkenColor(color);
        if (shapesConfig == SHAPES_CONFIG.QUAD) {
            const darkenedAreasOffset = layerIndex % 2 == 0 ? 0 : 22.5;
            const startAngle1 = radians(360 - (67.5 - darkenedAreasOffset));
            const stopAngle1 = radians(360 - (90 - darkenedAreasOffset));
            const startAngle2 = radians(360 - (22.5 - darkenedAreasOffset));
            const stopAngle2 = radians(360 - (45 - darkenedAreasOffset));
            return [
                (() => {
                    if (drawShadow) {
                        ctx.beginPath();
                        ctx.moveTo(0, 1);
                        ctx.arc(0, 1, 1 + (curBorderSize / 2), -Math.PI / 2, 0);
                        ctx.closePath();
                        ctx.fillStyle = shadowColor;
                        ctx.fill();
                    }
                    ctx.beginPath();
                    ctx.moveTo(0, 1);
                    ctx.arc(0, 1, 1, -Math.PI / 2, 0);
                    ctx.closePath();
                    ctx.fillStyle = color;
                    ctx.fill();
                    ctx.beginPath();
                    ctx.moveTo(0, 1);
                    ctx.arc(0, 1, 1, startAngle1, stopAngle1, true);
                    ctx.lineTo(0, 1);
                    ctx.arc(0, 1, 1, startAngle2, stopAngle2, true);
                    ctx.lineTo(0, 1);
                    ctx.closePath();
                    ctx.fillStyle = darkenedColor;
                    ctx.fill();
                }),
                (() => {})
            ];
        } else if (shapesConfig == SHAPES_CONFIG.HEX) {
            const points = [[0, 0], [sqrt3 / 2, 0.5], [0, 1]];
            const shadowPoints = [
                [points[0][0], points[0][1] - (curBorderSize / 2)],
                [points[1][0] + ((sqrt3 / 2) * (curBorderSize / 2)), points[1][1] - (curBorderSize / 4)],
                [points[2][0], points[2][1]]
            ];
            const sideMiddlePoint = [(points[0][0] + points[1][0]) / 2, (points[0][1] + points[1][1]) / 2];
            let darkenedArea;
            if (layerIndex % 2 == 0) {
                darkenedArea = [points[0], sideMiddlePoint, points[2]];
            } else {
                darkenedArea = [sideMiddlePoint, points[1], points[2]];
            }
            return [
                (() => {
                    if (drawShadow) {
                        drawPolygon(ctx, shadowPoints);
                        ctx.fillStyle = shadowColor;
                        ctx.fill();
                    }
                    drawPolygon(ctx, points);
                    ctx.fillStyle = color;
                    ctx.fill();
                    drawPolygon(ctx, darkenedArea);
                    ctx.fillStyle = darkenedColor;
                    ctx.fill();
                }),
                (() => {})
            ];
        }
    }

    throw new Error("Invalid shape");
}

// utility functions for transforming context
function scaleContext(ctx, scale) {
    const translation = (1 - scale) / 2;
    ctx.translate(translation, translation);
    ctx.scale(scale, scale);
}

function rotateContext(ctx, partIndex, numParts) {
    ctx.translate(0, 1);
    ctx.rotate(2 * Math.PI * (partIndex / numParts));
    ctx.translate(0, -1);
}

// main renderer
export function renderShape(context, size, shapeCode, shapesConfig = SHAPES_CONFIG.QUAD, colorMode = COLOR_MODES.RGB) {
    const layers = shapeCode.split(":");
    const numLayers = layers.length;
    const numParts = layers[0].length / 2;
    const shapeParts = [];
    
    for (let layerIndex = 0; layerIndex < numLayers; layerIndex++) {
        const layer = layers[layerIndex];
        shapeParts.push([]);
        for (let partIndex = 0; partIndex < numParts; partIndex++) {
            shapeParts.at(-1).push([layer[partIndex * 2], layer[(partIndex * 2) + 1]]);
        }
    }

    if (!colorMode) {
        const colorModeSelect = document.getElementById('color-mode-select');
        colorMode = colorModeSelect ? colorModeSelect.value : COLOR_MODES.RGB;
    }

    context.save();
    context.scale(size, size);
    context.clearRect(0, 0, 1, 1);

    // Draw background circle
    context.beginPath();
    context.arc(0.5, 0.5, BGCircleDiameter / 2, 0, 2 * Math.PI);
    context.closePath();
    context.fillStyle = BGCircleColor;
    context.fill();

    scaleContext(context, shapeDiameter);

    for (let layerIndex = 0; layerIndex < numLayers; layerIndex++) {
        const layer = shapeParts[layerIndex];
        context.save();
        const curLayerScale = layerSizeReduction ** layerIndex;
        scaleContext(context, curLayerScale);
        context.scale(0.5, 0.5);
        context.translate(1, 0);
        const partBorders = [];

        for (let partIndex = 0; partIndex < numParts; partIndex++) {
            const [partShape, partColor] = layer[partIndex];
            context.save();
            rotateContext(context, partIndex, numParts);
            const [shapeRenderer, borderRenderer] = renderPart(
                context,
                partShape,
                partColor,
                layerIndex,
                shapesConfig,
                colorMode,
                shapeDiameter * curLayerScale * 0.5
            );
            shapeRenderer();
            partBorders.push(borderRenderer);
            context.restore();
        }

        for (let partIndex = 0; partIndex < partBorders.length; partIndex++) {
            const partBorder = partBorders[partIndex];
            context.save();
            rotateContext(context, partIndex, numParts);
            partBorder();
            context.restore();
        }

        context.restore();
    }

    context.restore();
}

// Utility stuff
export function createShapeCanvas(shapeCode, size = 100, shapesConfig = SHAPES_CONFIG.QUAD) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const colorMode = getCurrentColorMode();
    renderShape(ctx, size, shapeCode, shapesConfig, colorMode);
    return canvas;
}