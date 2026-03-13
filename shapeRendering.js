// Special thanks to https://github.com/Loupau38/loupau38.github.io/blob/main/assets/scripts/shapeViewer.js
import { getCurrentColorMode } from './main.js';

const quadShapesConfig = "quad";
const hexShapesConfig = "hex";

export const baseColors = {
    "u": "rgb(121,138,150)",
    "r": "rgb(244,44,86)",
    "g": "rgb(113,195,43)",
    "b": "rgb(75,137,237)",
    "c": "rgb(29,195,145)",
    "m": "rgb(184,68,198)",
    "y": "rgb(232,148,47)",
    "w": "rgb(255,255,255)",
    "k": "rgb(65,64,59)",
    "p": "rgb(195,53,255)",
    "o": "rgb(254,153,0)",
};
export const colorValues = {
    "rgb": {
        "u": baseColors["u"],
        "r": baseColors["r"],
        "g": baseColors["g"],
        "b": baseColors["b"],
        "c": baseColors["c"],
        "m": baseColors["m"],
        "y": baseColors["y"],
        "w": baseColors["w"],
        "k": baseColors["k"]
    },
    "ryb": {
        "u": baseColors["u"],
        "r": baseColors["r"],
        "g": baseColors["y"],
        "b": baseColors["b"],
        "c": baseColors["g"],
        "m": baseColors["p"],
        "y": baseColors["o"],
        "w": baseColors["k"],
        "k": baseColors["w"]
    },
    "cmyk": {
        "u": baseColors["u"],
        "r": baseColors["c"],
        "g": baseColors["m"],
        "b": baseColors["y"],
        "c": baseColors["r"],
        "m": baseColors["g"],
        "y": baseColors["b"],
        "w": baseColors["k"],
        "k": baseColors["w"]
    }
};

const shapeBorderColor = "rgb(48,37,47)";
const BGCircleColor = "rgba(0,0,0,0)";
const shadowColor = "rgba(50,50,50,0.5)";
const pinColor = "rgb(64,67,71)";

// according to 'dnSpy > ShapeMeshGenerator > GenerateShapeMesh()', this value should be 0.85
// according to ingame screenshots, it should be 0.77
// according to me, the closest to ingame is 0.8
// but, to me, the best for this context is 0.75
const layerSizeReduction = 0.75;

// below are sizes in pixels taken from a screenshot of the ingame shape viewer
const defaultImageSize = 602;
const defaultBGCircleDiameter = 520;
const defaultShapeDiameter = 407;

const BGCircleDiameter = defaultBGCircleDiameter / defaultImageSize;
const shapeDiameter = defaultShapeDiameter / defaultImageSize;

const sqrt2 = Math.sqrt(2);
const sqrt3 = Math.sqrt(3);
const sqrt6 = Math.sqrt(6);

function darkenColor(color) {
    color = color.slice(4, -1);
    let [r, g, b] = color.split(",");
    r = Math.round(parseInt(r) / 2);
    g = Math.round(parseInt(g) / 2);
    b = Math.round(parseInt(b) / 2);
    return `rgb(${r},${g},${b})`;
}

function brightenColor(color, amount = 0.3) {
    color = color.slice(4, -1);
    let [r,g,b] = color.split(",").map(v => parseInt(v));

    r = Math.round(r + (255 - r) * amount);
    g = Math.round(g + (255 - g) * amount);
    b = Math.round(b + (255 - b) * amount);

    return `rgb(${r},${g},${b})`;
}

function drawPolygon(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.closePath();
}

function renderPart(ctx, partShape, partColor, layerIndex, shapesConfig, colorMode, layerScale) {

    const drawShadow = layerIndex != 0;
    const color = colorValues[colorMode][partColor];
    const curBorderSize = 0.1;

    function standardDraw(drawPath, borderColor = shapeBorderColor) {
        return [
            (() => {
                drawPath();
                ctx.fillStyle = color;
                ctx.fill();
            }),
            (() => {
                drawPath();
                ctx.strokeStyle = borderColor;
                ctx.lineWidth = curBorderSize;
                ctx.lineJoin = "round";
                ctx.stroke();
            })
        ];
    }

    if (partShape == "-") {
        return [(() => { }), (() => { })]
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
        let pinCenterX;
        let pinCenterY;
        if (shapesConfig == quadShapesConfig) {
            pinCenterX = 1 / 3;
            pinCenterY = 2 / 3;
        } else if (shapesConfig == hexShapesConfig) {
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
            (() => { })
        ];
    }

    if (partShape == "c") {
        const darkenedColor = darkenColor(color);
        const brighterColor = brightenColor(color);
 
        if (shapesConfig == quadShapesConfig) {
            function drawCrystalPath() {
                ctx.beginPath();
                ctx.moveTo(0, 1);
                ctx.arc(0, 1, 1, -Math.PI / 2, 0);
                ctx.closePath();
            }
 
            // Gradient direction alternates per layer: bright corner → dark arc midpoint
            function makeGradient() {
                const grad = ctx.createConicGradient(-Math.PI / 2, 0, 1);

                grad.addColorStop(0.00, darkenedColor);
                grad.addColorStop(0.1, color);
                grad.addColorStop(0.2, darkenedColor);
                grad.addColorStop(0.3, color);
                grad.addColorStop(0.4, darkenedColor);
                grad.addColorStop(0.5, color);

                return grad;
            }
 
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
                    drawCrystalPath();
                    ctx.fillStyle = makeGradient();
                    ctx.fill();
                }),
                (() => {
                    drawCrystalPath();
                    ctx.strokeStyle = brighterColor;
                    ctx.lineWidth = curBorderSize;
                    ctx.lineJoin = "round";
                    ctx.stroke();
                })
            ];
        } else if (shapesConfig == hexShapesConfig) {
            const points = [
                [0, 0],
                [sqrt3 / 2, 0.5],
                [0, 1]
            ];
            const shadowPoints = [
                [points[0][0], points[0][1] - (curBorderSize / 2)],
                [points[1][0] + ((sqrt3 / 2) * (curBorderSize / 2)), points[1][1] - (curBorderSize / 4)],
                [points[2][0], points[2][1]]
            ];
 
            function makeGradient() {
                const grad = ctx.createLinearGradient(
                    points[0][0], points[0][1],   // start
                    points[1][0], points[1][1]    // toward outer corner
                );

                grad.addColorStop(0.0, darkenedColor);
                grad.addColorStop(0.33, color);
                grad.addColorStop(0.66, darkenedColor);
                grad.addColorStop(1, color);

                return grad;
            }
 
            return [
                (() => {
                    if (drawShadow) {
                        drawPolygon(ctx, shadowPoints);
                        ctx.fillStyle = shadowColor;
                        ctx.fill();
                    }
                    drawPolygon(ctx, points);
                    ctx.fillStyle = makeGradient();
                    ctx.fill();
                }),
                (() => {
                    drawPolygon(ctx, points);
                    ctx.strokeStyle = brighterColor;
                    ctx.lineWidth = curBorderSize;
                    ctx.lineJoin = "round";
                    ctx.stroke();
                })
            ];
        }
    }

    if (partShape == "X") {
        const c = 0.4; // chamfer size for cut corners

        function drawPath() {
            ctx.beginPath();
            ctx.moveTo(0, 1);
            ctx.lineTo(0, c);
            ctx.lineTo(c, 0);
            ctx.lineTo(0.5, 0);
            ctx.lineTo(1, 0.5);
            ctx.lineTo(1, 1 - c);
            ctx.lineTo(1 - c, 1);
            ctx.closePath();
        }

        function makeGradient() {
            const grad = ctx.createRadialGradient(
                0.5, 0.5, 0.1,   // center (small radius)
                0.5, 0.5, 0.9    // outer edge
            );

            grad.addColorStop(0.0, color);          // center normal
            grad.addColorStop(1.0, brightenColor(color));  // brighter edges

            return grad;
        }

        function addBlue(color, amount = 40) {
            const m = color.match(/\d+/g).map(Number); // assumes rgb/rgba
            m[2] = Math.min(255, m[2] + amount);       // increase blue
            return `rgb(${m[0]}, ${m[1]}, ${m[2]})`;
        }

        return [
            (() => {
                if (drawShadow) {
                    drawPath();
                    ctx.fillStyle = shadowColor;
                    ctx.fill();
                }

                drawPath();
                ctx.fillStyle = makeGradient();
                ctx.fill();
            }),
            (() => {
                drawPath();
                ctx.strokeStyle = addBlue(darkenColor(addBlue(color)), 20);
                ctx.lineWidth = curBorderSize;
                ctx.lineJoin = "round";
                ctx.stroke();
            })
        ];
    }

    if (partShape == "Y") {
        const c = 0.5; // chamfer size for cut corners

        function drawPath() {
            ctx.beginPath();
            ctx.moveTo(0, 1);
            ctx.lineTo(0, c);
            ctx.lineTo(c, 0);
            ctx.lineTo(0.5, 0);
            ctx.lineTo(0.5, 0.5);
            ctx.lineTo(1, 0.5);
            ctx.lineTo(1, 1 - c);
            ctx.lineTo(1 - c, 1);
            ctx.closePath();
        }

        function makeGradient() {
            const grad = ctx.createRadialGradient(
                0.5, 0.5, 0.1,   // center (small radius)
                0.5, 0.5, 0.9    // outer edge
            );

            grad.addColorStop(0.0, color);          // center normal
            grad.addColorStop(1.0, brightenColor(color));  // brighter edges

            return grad;
        }

        function addBlue(color, amount = 30) {
            const m = color.match(/\d+/g).map(Number); // assumes rgb/rgba
            m[2] = Math.min(255, m[2] + amount);       // increase blue
            return `rgb(${m[0]}, ${m[1]}, ${m[2]})`;
        }

        return [
            (() => {
                if (drawShadow) {
                    drawPath();
                    ctx.fillStyle = shadowColor;
                    ctx.fill();
                }

                drawPath();
                ctx.fillStyle = makeGradient();
                ctx.fill();
            }),
            (() => {
                drawPath();
                ctx.strokeStyle = addBlue(darkenColor(addBlue(color)), 20);
                ctx.lineWidth = curBorderSize;
                ctx.lineJoin = "round";
                ctx.stroke();
            })
        ];
    }

    throw new Error("Invalid shape");
}

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

export function renderShape(context, size, shapeCode, shapesConfig, colorMode) {

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

    context.save();

    context.scale(size, size);

    context.clearRect(0, 0, 1, 1);

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

        // Build ordered index list so some shapes render earlier/later
        const orderedIndices = [...Array(numParts).keys()].sort((a, b) => {
            const shapeA = layer[a][0];
            const shapeB = layer[b][0];

            const priority = (s) => {
                if (s === "X") return 2;   // render last
                if (s === "c" || s === "Y") return 0; // render first
                return 1; // normal
            };

            return priority(shapeA) - priority(shapeB);
        });

        for (const partIndex of orderedIndices) {
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
                curLayerScale
            );

            shapeRenderer();
            partBorders[partIndex] = borderRenderer;

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
export function createShapeCanvas(shapeCode, size = 100) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const colorMode = getCurrentColorMode();

  // Determine shapesConfig based on shapeCode
  const firstLayer = shapeCode.split(":")[0];
  const numParts = firstLayer.length / 2;
  const shapesConfig = numParts === 6 ? hexShapesConfig : quadShapesConfig;

  renderShape(ctx, size, shapeCode, shapesConfig, colorMode);
  return canvas;
}

export function createShapeElement(shapeCode) {
  const container = document.createElement('div');
  container.className = 'shape-display';

  const canvas = createShapeCanvas(shapeCode, 40);
  canvas.className = 'shape-canvas';

  // Store shape code as data attribute for easy refresh
  canvas.dataset.shapeCode = shapeCode;

  const label = document.createElement('span');
  label.className = 'shape-label';
  label.textContent = shapeCode;

  container.appendChild(canvas);
  container.appendChild(label);

  return container;
}