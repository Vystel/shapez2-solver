// special thanks to https://github.com/Loupau38/loupau38.github.io/blob/main/assets/scripts/shapeViewer.js
import { getCurrentColorMode } from './colorMode.js';
import { COLOR_MODES, PART_CODES, SHAPE_LAYER_SEPARATOR } from './shapeConstants.js';

const quadShapesConfig = "quad";
const hexShapesConfig = "hex";

const {
    NOTHING,
    CIRCLE,
    RECTANGLE,
    STAR,
    DIAMOND,
    HEXAGON,
    FLOWER,
    GEAR,
    PIN,
    CRYSTAL,
    EXOTIC,
    REFINED
} = PART_CODES;

const shapeBorderColor = "rgb(48,37,47)";
const BGCircleColor = "rgba(0,0,0,0)";
const shadowColor = "rgba(50,50,50,0.5)";
const pinColor = "rgb(64,67,71)";

// according to 'dnSpy > ShapeMeshGenerator > GenerateShapeMesh()', this value should be 0.85
// according to ingame screenshots, it should be 0.77
// according to me, the closest to ingame is 0.8
// but, to me, the best for this context is 0.75
const layerSizeReduction = 0.77;

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

function addBlue(color, amount) {
    const m = color.match(/\d+/g).map(Number);
    m[2] = Math.min(255, m[2] + amount);
    return `rgb(${m[0]}, ${m[1]}, ${m[2]})`;
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

    const drawShadow = layerIndex !== 0;
    const color = COLOR_MODES[colorMode][partColor];
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

    if (partShape === NOTHING) {
        return [(() => { }), (() => { })]
    }

    if (partShape === CIRCLE) {
        function drawPath() {
            ctx.beginPath();
            ctx.moveTo(0, 1);
            ctx.arc(0, 1, 1, -Math.PI / 2, 0);
            ctx.closePath();
        }
        return standardDraw(drawPath);
    }

    if (partShape === RECTANGLE) {
        function drawPath() {
            ctx.beginPath();
            ctx.rect(0, 0, 1, 1);
            ctx.closePath();
        }
        return standardDraw(drawPath);
    }

    if (partShape === STAR) {
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

    if (partShape === DIAMOND) {
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

    if (partShape === HEXAGON) {
        function drawPath() {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(sqrt3 / 2, 0.5);
            ctx.lineTo(0, 1);
            ctx.closePath();
        }
        return standardDraw(drawPath);
    }

    if (partShape === FLOWER) {
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

    if (partShape === GEAR) {
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

    if (partShape === PIN) {
        let pinCenterX;
        let pinCenterY;
        if (shapesConfig === quadShapesConfig) {
            pinCenterX = 1 / 3;
            pinCenterY = 2 / 3;
        } else if (shapesConfig === hexShapesConfig) {
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

    if (partShape === CRYSTAL) {
        const darkenedColor = darkenColor(color);
        const brighterColor = brightenColor(color);
 
        if (shapesConfig === quadShapesConfig) {
            function drawCrystalPath() {
                ctx.beginPath();
                ctx.moveTo(0, 1);
                ctx.arc(0, 1, 1, -Math.PI / 2, 0);
                ctx.closePath();
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
                    const gradient = ctx.createConicGradient(-Math.PI / 2, 0, 1);
                    gradient.addColorStop(0.00, darkenedColor);
                    gradient.addColorStop(0.1, color);
                    gradient.addColorStop(0.2, darkenedColor);
                    gradient.addColorStop(0.3, color);
                    gradient.addColorStop(0.4, darkenedColor);
                    gradient.addColorStop(0.5, color);
                    ctx.fillStyle = gradient;
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
        } else if (shapesConfig === hexShapesConfig) {
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
 
            return [
                (() => {
                    if (drawShadow) {
                        drawPolygon(ctx, shadowPoints);
                        ctx.fillStyle = shadowColor;
                        ctx.fill();
                    }
                    drawPolygon(ctx, points);
                    const gradient = ctx.createLinearGradient(
                        points[0][0], points[0][1],
                        points[1][0], points[1][1]
                    );
                    gradient.addColorStop(0.0, darkenedColor);
                    gradient.addColorStop(0.33, color);
                    gradient.addColorStop(0.66, darkenedColor);
                    gradient.addColorStop(1, color);
                    ctx.fillStyle = gradient;
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

    if (partShape === REFINED) {
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

        return [
            (() => {
                if (drawShadow) {
                    drawPath();
                    ctx.fillStyle = shadowColor;
                    ctx.fill();
                }

                drawPath();
                const gradient = ctx.createRadialGradient(0.5, 0.5, 0.1, 0.5, 0.5, 0.9);
                gradient.addColorStop(0.0, color);
                gradient.addColorStop(1.0, brightenColor(color));
                ctx.fillStyle = gradient;
                ctx.fill();
            }),
            (() => {
                drawPath();
                ctx.strokeStyle = addBlue(darkenColor(addBlue(color, 40)), 20);
                ctx.lineWidth = curBorderSize;
                ctx.lineJoin = "round";
                ctx.stroke();
            })
        ];
    }

    if (partShape === EXOTIC) {
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

        return [
            (() => {
                if (drawShadow) {
                    drawPath();
                    ctx.fillStyle = shadowColor;
                    ctx.fill();
                }

                drawPath();
                const gradient = ctx.createRadialGradient(0.5, 0.5, 0.1, 0.5, 0.5, 0.9);
                gradient.addColorStop(0.0, color);
                gradient.addColorStop(1.0, brightenColor(color));
                ctx.fillStyle = gradient;
                ctx.fill();
            }),
            (() => {
                drawPath();
                ctx.strokeStyle = addBlue(darkenColor(addBlue(color, 40)), 20);
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

    const layers = shapeCode.split(SHAPE_LAYER_SEPARATOR);
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

        // make it so some shapes render earlier/later
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

// utility stuff
export function createShapeCanvas(shapeCode, size = 100) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const colorMode = getCurrentColorMode();

  // determine shapesConfig based on shapeCode
  const firstLayer = shapeCode.split(SHAPE_LAYER_SEPARATOR)[0];
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

  // store shape code as data attribute
  canvas.dataset.shapeCode = shapeCode;
  container.appendChild(canvas);

  return container;
}


