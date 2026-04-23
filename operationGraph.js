import { createShapeCanvas } from './shapeRendering.js';
import { getCurrentColorMode, getMixColor } from './colorMode.js';
import { COLOR_CODES, COLOR_MODES } from './shapeConstants.js';

// constants 

const DEFAULT_DIRECTION = 'LR';
const MIX_GRAPH_COLOR_CODES   = Object.values(COLOR_CODES).map((c) => c.toUpperCase());
const ELK_DIRECTION_BY_RANKDIR = Object.freeze({
    LR: 'RIGHT', RL: 'LEFT', TB: 'DOWN', BT: 'UP',
});

// state

let cyInstance       = null;
let graph3dInstance  = null;

const explorerState = {
    popup:          null,
    popupContainer: null,
    selectedShapeId: null,
    graphCache:     null,
};

export function getCyInstance() { return cyInstance; }

// graph utils
function getGraphContainer() {
    return document.getElementById('graph-container');
}

function getDirection() {
    return document.getElementById('direction-select')?.value ?? DEFAULT_DIRECTION;
}

function destroyCyGraph() {
    cyInstance?.destroy();
    cyInstance = null;
}

function destroy3dGraph() {
    explorerState.popupContainer?.remove();
    explorerState.popup          = null;
    explorerState.popupContainer = null;
    explorerState.selectedShapeId = null;
    explorerState.graphCache      = null;

    graph3dInstance?.pauseAnimation?.();
    graph3dInstance?.onNodeClick?.(null);
    graph3dInstance?.onBackgroundClick?.(null);
    graph3dInstance?._destructor?.();
    graph3dInstance = null;
}

function resetGraphs(container) {
    destroyCyGraph();
    destroy3dGraph();
    const freshContainer = container.cloneNode(false);
    freshContainer.style.position = 'absolute';
    freshContainer.style.inset = '0';
    container.replaceWith(freshContainer);
    return freshContainer;
}

// ELK layout
function buildBaseLayout(rankDir, animate = false) {
    const elkDirection = ELK_DIRECTION_BY_RANKDIR[rankDir] ?? ELK_DIRECTION_BY_RANKDIR[DEFAULT_DIRECTION];
    return {
        name: 'elk',
        fit: true,
        padding: 40,
        nodeDimensionsIncludeLabels: false,
        elk: {
            'elk.algorithm':                                  'layered',
            'elk.direction':                                  elkDirection,
            'elk.edgeRouting':                                'ORTHOGONAL',
            'elk.separateConnectedComponents':                'false',
            'elk.layered.thoroughness':                       '20',
            'elk.layered.nodePlacement.bk.fixedAlignment':    'BALANCED',
            'elk.layered.spacing.nodeNodeBetweenLayers':      '80',
            'elk.layered.spacing.edgeNodeBetweenLayers':      '0',
            'elk.layered.spacing.edgeEdgeBetweenLayers':      '0',
            'elk.spacing.nodeNode':                           '40',
            'elk.spacing.edgeNode':                           '80',
            'elk.spacing.edgeEdge':                           '0',
        },
        ...(animate ? { animate: true, animationDuration: 500 } : {}),
    };
}

// cytoscape styles
const CYTO_BASE_STYLES = [
    {
        selector: 'node',
        style: {
            label:              'data(label)',
            color:              '#fff',
            'text-valign':      'bottom',
            'text-halign':      'center',
            'text-outline-width': 1,
            'text-outline-color': '#333',
            width:              '80px',
            height:             '80px',
            'font-size':        '10px',
        },
    },
    {
        selector: '.shape',
        style: {
            'background-image':   'data(shapeCanvas)',
            'background-fit':     'contain',
            'background-opacity': 0.1,
            'font-family':        'monospace',
        },
    },
    {
        selector: '.op',
        style: {
            'background-image':   'data(image)',
            'background-fit':     'cover',
            'background-opacity': 0,
            shape:                'rectangle',
            'background-color':   'transparent',
            'border-width':       0,
            width:                '60px',
            height:               '60px',
        },
    },
    {
        selector: '.colored-op',
        style: {
            shape:                'ellipse',
            'background-color':   'data(backgroundColor)',
            'background-opacity': 0.5,
        },
    },
    {
        selector: 'edge',
        style: {
            width:                  2,
            'line-color':           '#aaa',
            'target-arrow-color':   '#aaa',
            'target-arrow-shape':   'triangle',
            'curve-style':          'bezier',
        },
    },
];

// solver graph
function operationImagePath(name) {
    return `images/operations/${name.toLowerCase().replace(/\s+/g, '-')}.png`;
}

function createShapeNode(id, shapeCode, size = 240) {
    return {
        data: { id, label: shapeCode, shapeCanvas: createShapeCanvas(shapeCode, size).toDataURL() },
        classes: 'shape',
    };
}

function buildOperationNode(step, stepIndex) {
    const { operation, params = {} } = step;
    let label           = operation;
    let classes         = 'op';
    let backgroundColor = '#000';

    if (operation === 'Painter' || operation === 'Crystal Generator') {
        const { color } = params;
        label += ` (${color})`;
        const mapped = COLOR_MODES?.[getCurrentColorMode()]?.[color];
        if (mapped) { backgroundColor = mapped; classes += ' colored-op'; }
    }

    return {
        data: { id: `op-${stepIndex}`, label, image: operationImagePath(operation), backgroundColor },
        classes,
    };
}

export function renderGraph(solutionPath) {
    let container = getGraphContainer();
    if (!container) return;

    container = resetGraphs(container);
    if (!solutionPath?.length) return;

    const elements       = [];
    const seenShapeNodes = new Set();

    solutionPath.forEach((step, stepIndex) => {
        const opNode = buildOperationNode(step, stepIndex);
        const opId   = opNode.data.id;
        elements.push(opNode);

        for (const { id, shape } of [...step.inputs, ...step.outputs]) {
            const shapeId = `shape-${id}`;
            if (!seenShapeNodes.has(shapeId)) {
                elements.push(createShapeNode(shapeId, shape));
                seenShapeNodes.add(shapeId);
            }
            const isInput = step.inputs.some((i) => i.id === id);
            elements.push({ data: { source: isInput ? shapeId : opId, target: isInput ? opId : shapeId } });
        }
    });

    cyInstance = cytoscape({
        container,
        elements,
        style:  CYTO_BASE_STYLES,
        layout: buildBaseLayout(getDirection()),
        userZoomingEnabled:  true,
        userPanningEnabled:  true,
        boxSelectionEnabled: true,
        autoungrabify:       false,
        wheelSensitivity:    0.1,
    });

    cyInstance.on('tap', 'node.shape', async (event) => {
        try { await navigator.clipboard.writeText(event.target.data('label')); }
        catch (err) { console.error('Failed to copy:', err); }
    });
}

// mix graph
function createColorNode(id, colorCode) {
    return {
        data:  { id, label: colorCode, colorKey: colorCode },
        style: { 'background-color': getMixColor(colorCode) },
    };
}

function buildMixElementsCompact(steps, inputCounts) {
    const elements = [];
    const pool     = Object.fromEntries(MIX_GRAPH_COLOR_CODES.map((c) => [c, []]));

    const makeToken = (kind, sourceId) => ({ kind, sourceId });

    for (const color of MIX_GRAPH_COLOR_CODES) {
        const count = inputCounts?.[color] || 0;
        for (let i = 0; i < count; i++) {
            const id = `in_${color}_${i}`;
            elements.push(createColorNode(id, color));
            pool[color].push(makeToken('input', id));
        }
    }

    steps.forEach(({ c1, c2, mixed }, stepIndex) => {
        const mixerId = `mix_${stepIndex}`;
        elements.push({ data: { id: mixerId, label: '' }, classes: 'mixer' });

        [c1, c2].forEach((color, slot) => {
            const token = pool[color].shift();
            if (!token) return;
            elements.push({
                data: {
                    id:           `${token.sourceId}__${mixerId}__${stepIndex}_${slot}`,
                    source:       token.sourceId,
                    target:       mixerId,
                    edgeColorKey: color,
                },
            });
        });

        for (let i = 0; i < 2; i++) pool[mixed].push(makeToken('mixer', mixerId));
    });

    for (const color of MIX_GRAPH_COLOR_CODES) {
        pool[color].forEach((token, i) => {
            const outId = `final_${color}_${i}`;
            elements.push(createColorNode(outId, color));
            elements.push({
                data: { id: `${token.sourceId}__${outId}`, source: token.sourceId, target: outId, edgeColorKey: color },
            });
        });
    }

    return elements;
}

function buildMixElementsExpanded(steps, inputCounts) {
    const elements = [];
    const pool     = Object.fromEntries(MIX_GRAPH_COLOR_CODES.map((c) => [c, []]));

    for (const color of MIX_GRAPH_COLOR_CODES) {
        const count = inputCounts?.[color] || 0;
        for (let i = 0; i < count; i++) {
            const id = `in_${color}_${i}`;
            elements.push(createColorNode(id, color));
            pool[color].push(id);
        }
    }

    steps.forEach(({ c1, c2, mixed }, stepIndex) => {
        const mixerId = `mix_${stepIndex}`;
        elements.push({ data: { id: mixerId, label: '' }, classes: 'mixer' });

        [c1, c2].forEach((color) => {
            let sourceId = pool[color].shift();
            if (!sourceId) {
                sourceId = `gen_${color}_${stepIndex}_${Math.random().toString(36).slice(2, 7)}`;
                elements.push(createColorNode(sourceId, color));
            }
            elements.push({ data: { id: `${sourceId}__${mixerId}`, source: sourceId, target: mixerId, edgeColorKey: color } });
        });

        for (let i = 0; i < 2; i++) {
            const outId = `out_${mixed}_${stepIndex}_${i}`;
            elements.push(createColorNode(outId, mixed));
            elements.push({ data: { id: `${mixerId}__${outId}`, source: mixerId, target: outId, edgeColorKey: mixed } });
            pool[mixed].push(outId);
        }
    });

    return elements;
}

const MIX_CYTO_STYLES = [
    {
        selector: 'node',
        style: {
            label:              'data(label)',
            'text-valign':      'center',
            'text-halign':      'center',
            'background-color': '#ccc',
            shape:              'ellipse',
            width:              '60px',
            height:             '60px',
            'font-size':        14,
            color:              '#111',
        },
    },
    {
        selector: '.mixer',
        style: {
            label:              'Mixer',
            'text-valign':      'bottom',
            'text-halign':      'center',
            'font-size':        '10px',
            'text-outline-width':  1,
            'text-outline-color':  '#333',
            'background-image': 'images/operations/color-mixer.png',
            'background-fit':   'cover',
            'background-opacity': 0,
            shape:              'rectangle',
            'background-color': 'transparent',
            color:              '#fff',
            'border-width':     0,
            width:              '60px',
            height:             '60px',
        },
    },
    {
        selector: 'edge',
        style: { width: 4, 'line-color': '#ccc' },
    },
];

export function renderMixGraph(steps, inputCounts, options = {}) {
    let container = getGraphContainer();
    if (!container) return;

    container = resetGraphs(container);

    const compact  = options.compactMixGraph ?? true;
    const elements = compact
        ? buildMixElementsCompact(steps, inputCounts)
        : buildMixElementsExpanded(steps, inputCounts);

    cyInstance = cytoscape({
        container,
        elements,
        style:               MIX_CYTO_STYLES,
        layout:              buildBaseLayout(getDirection()),
        userZoomingEnabled:  true,
        userPanningEnabled:  true,
        wheelSensitivity:    0.1,
    });

    cyInstance.edges('[edgeColorKey]').forEach((edge) => {
        edge.style('line-color', getMixColor(edge.data('edgeColorKey')));
    });

    document.getElementById('placeholder')?.style.setProperty('display', 'none');
}

// UI actions
export async function copyGraphToClipboard() {
    if (cyInstance) {
        const blob = cyInstance.png({ output: 'blob', scale: 1, full: true });
        try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            alert('Graph image copied to clipboard!');
        } catch (err) {
            console.error('Failed to copy image:', err);
            alert('Failed to copy image to clipboard.');
        }
        return;
    }

    if (graph3dInstance) {
        const canvas = graph3dInstance.renderer().domElement;
        graph3dInstance.renderer().render(graph3dInstance.scene(), graph3dInstance.camera());
        canvas.toBlob(async (blob) => {
            if (!blob) { alert('Failed to export 3D graph.'); return; }
            try {
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                alert('Graph image copied to clipboard!');
            } catch (err) {
                console.error('Failed to copy 3D image:', err);
                alert('Failed to copy image to clipboard.');
            }
        }, 'image/png');
        return;
    }

    alert('No graph to copy.');
}

export function applyGraphLayout(direction) {
    if (!cyInstance) return;
    cyInstance.layout(buildBaseLayout(direction || getDirection(), true)).run();
}

// explorer 3D graph
function buildExplorerNeighbors(graph) {
    const shapeById  = new Map(graph.shapes.map((s) => [s.id,  s]));
    const opById     = new Map(graph.ops.map((op) => [op.id, op]));
    const shapeOpsIn  = new Map();
    const shapeOpsOut = new Map();
    const opInputs    = new Map();
    const opOutputs   = new Map();

    graph.edges.forEach(({ source, target }) => {
        if (source.startsWith('shape-') && target.startsWith('op-')) {
            (shapeOpsOut.get(source) ?? (shapeOpsOut.set(source, []), shapeOpsOut.get(source))).push(target);
            (opInputs.get(target)    ?? (opInputs.set(target, []),    opInputs.get(target))).push(source);
        } else if (source.startsWith('op-') && target.startsWith('shape-')) {
            (shapeOpsIn.get(target)  ?? (shapeOpsIn.set(target, []),  shapeOpsIn.get(target))).push(source);
            (opOutputs.get(source)   ?? (opOutputs.set(source, []),   opOutputs.get(source))).push(target);
        }
    });

    return { shapeById, opById, shapeOpsIn, shapeOpsOut, opInputs, opOutputs };
}

function getExplorerOpsForShape(shapeId) {
    if (!explorerState.graphCache) return { incoming: [], outgoing: [] };

    const { shapeById, opById, shapeOpsIn, shapeOpsOut, opInputs, opOutputs } = explorerState.graphCache;

    function buildEntries(opIds, inputsFn, neighborKey) {
        return (opIds ?? []).flatMap((opId) => {
            const operation = opById.get(opId);
            if (!operation) return [];
            return (inputsFn.get(opId) ?? [])
                .filter((nid) => neighborKey === 'outgoing' ? nid !== shapeId : true)
                .map((nid) => {
                    const shape = shapeById.get(nid);
                    return shape ? { operation, viaShapeCode: shape.code, toShapeId: nid } : null;
                })
                .filter(Boolean);
        });
    }

    return {
        incoming: buildEntries(shapeOpsIn.get(shapeId),  opInputs,  'incoming'),
        outgoing: buildEntries(shapeOpsOut.get(shapeId), opOutputs, 'outgoing'),
    };
}

function createExplorerNavButtons(entries, direction) {
    const fragment = document.createDocumentFragment();

    entries.forEach(({ operation, viaShapeCode, toShapeId }) => {
        const btn = document.createElement('button');
        btn.type  = 'button';
        btn.className = 'explorer-nav-btn';

        const opIcon = Object.assign(document.createElement('img'), {
            className: 'explorer-nav-op-icon', src: operationImagePath(operation.type), alt: operation.type,
        });

        const shapeIcon = Object.assign(document.createElement('img'), {
            className: 'explorer-nav-shape-icon', src: createShapeCanvas(viaShapeCode, 120).toDataURL(), alt: viaShapeCode,
        });

        const textWrap = document.createElement('div');
        textWrap.className = 'explorer-nav-text';
        textWrap.append(
            Object.assign(document.createElement('div'), { className: 'explorer-nav-op-name',    textContent: operation.type }),
            Object.assign(document.createElement('div'), { className: 'explorer-nav-shape-code', textContent: direction === 'from' ? `from ${viaShapeCode}` : `to ${viaShapeCode}` }),
        );

        btn.append(opIcon, textWrap, shapeIcon);
        btn.addEventListener('click', () => focusExplorerShape(toShapeId));
        fragment.appendChild(btn);
    });

    return fragment;
}

function renderExplorerPopup(node) {
    const { popup, popupContainer } = explorerState;
    if (!popup || !popupContainer) return;

    popup.innerHTML = '';
    const { incoming, outgoing } = getExplorerOpsForShape(node.id);

    // Header
    const header = document.createElement('div');
    header.className = 'explorer-popup-header';

    const meta = document.createElement('div');
    meta.className = 'explorer-popup-meta';

    const title = Object.assign(document.createElement('div'), { className: 'explorer-popup-title', textContent: node.label });

    const copyBtn = Object.assign(document.createElement('button'), {
        type: 'button', className: 'explorer-copy-btn', textContent: 'Copy',
    });
    copyBtn.addEventListener('click', () => navigator.clipboard.writeText(node.label).catch(() => {}));

    const actions = document.createElement('div');
    actions.className = 'explorer-popup-actions';
    actions.appendChild(copyBtn);

    meta.append(title, actions);

    const preview = createShapeCanvas(node.label, 108);
    preview.className  = 'explorer-popup-shape-preview';
    preview.dataset.shapeCode = node.label;

    header.append(meta, preview);
    popup.appendChild(header);

    // Sections
    function appendSection(titleText, entries, direction) {
        const sectionTitle = Object.assign(document.createElement('div'), {
            className: 'explorer-popup-section-title', textContent: titleText,
        });
        popup.appendChild(sectionTitle);

        const wrap = document.createElement('div');
        wrap.className = 'explorer-popup-buttons';

        if (entries.length) {
            wrap.appendChild(createExplorerNavButtons(entries, direction));
        } else {
            const empty = Object.assign(document.createElement('div'), {
                className: 'explorer-popup-empty', textContent: `No ${direction} operations`,
            });
            wrap.appendChild(empty);
        }

        popup.appendChild(wrap);
    }

    appendSection('Goes To',    outgoing, 'to');
    appendSection('Comes From', incoming, 'from');

    popupContainer.style.display = 'block';
}

function focusExplorerShape(nodeId, animateMs = 1100) {
    if (!graph3dInstance || !explorerState.graphCache) return;

    const node = graph3dInstance.graphData().nodes.find((n) => n.id === nodeId);
    if (!node) return;

    explorerState.selectedShapeId = nodeId;

    const dist  = 360;
    const mag   = Math.hypot(node.x || 0, node.y || 0, node.z || 0) || 1;
    const ratio = 1 + dist / mag;

    graph3dInstance.cameraPosition(
        { x: (node.x || 0) * ratio, y: (node.y || 0) * ratio, z: (node.z || 0) * ratio },
        { x: node.x || 0,           y: node.y || 0,           z: node.z || 0 },
        animateMs,
    );

    renderExplorerPopup(node);
}

function ensureExplorerPopup(container) {
    if (explorerState.popupContainer) return;

    const popupContainer = document.createElement('div');
    popupContainer.className = 'explorer-node-popup-container';

    const popup = document.createElement('div');
    popup.className = 'explorer-node-popup';
    popupContainer.appendChild(popup);
    container.appendChild(popupContainer);

    explorerState.popup          = popup;
    explorerState.popupContainer = popupContainer;
}

function createSprite(image, scale) {
    const texture = new THREE.TextureLoader().load(image, (t) => {
        t.colorSpace         = THREE.SRGBColorSpace;
        t.premultiplyAlpha   = false;
    });

    const material = new THREE.SpriteMaterial({
        map: texture, transparent: true, premultipliedAlpha: false,
        depthTest: true, depthWrite: false,
    });

    const sprite = new THREE.Sprite(material);
    sprite.scale.set(scale, scale, 1);
    return sprite;
}

export function renderSpaceGraph(graph) {
    let container = getGraphContainer();
    if (!container) return null;

    container = resetGraphs(container);
    if (!graph) return null;

    explorerState.graphCache = buildExplorerNeighbors(graph);

    const forceGraphFactory = globalThis.ForceGraph3D;
    if (typeof forceGraphFactory !== 'function') {
        console.error('3D graph dependency is unavailable. Expected ForceGraph3D on window/globalThis.');
        return null;
    }

    const hasThree = typeof globalThis.THREE !== 'undefined';

    const nodes = [
        ...graph.shapes.map((s)  => ({ id: s.id,  kind: 'shape', label: s.code,       image: createShapeCanvas(s.code, 240).toDataURL() })),
        ...graph.ops.map((op)    => ({ id: op.id, kind: 'op',    label: op.type,      image: operationImagePath(op.type) })),
    ];

    const links = graph.edges.map(({ source, target }) => ({
        source, target,
        kind: target.startsWith('op-') ? 'to-op' : source.startsWith('op-') ? 'from-op' : '',
    }));

    graph3dInstance = forceGraphFactory()(container)
        .graphData({ nodes, links })
        .showNavInfo(false)
        .forceEngine('d3')
        .d3AlphaDecay(0.005)
        .d3VelocityDecay(0.1)
        .backgroundColor('rgba(0,0,0,0)')
        .nodeAutoColorBy(null)
        .nodeOpacity(0.9)
        .linkOpacity(0.4)
        .linkColor((link) => link.kind === 'from-op' ? '#FC9A19' : '#999')
        .linkDirectionalArrowLength(4)
        .linkDirectionalArrowRelPos(1)
        .nodeLabel((node) => node.label);

    if (hasThree) {
        graph3dInstance.nodeThreeObject((node) => {
            const group = new THREE.Group();
            group.add(createSprite(node.image, node.kind === 'shape' ? 15 : 12));
            return group;
        });
    } else {
        graph3dInstance
            .nodeColor((node) => node.kind === 'op' ? '#FC9A19' : '#6FB8FF')
            .nodeVal((node) => node.kind === 'op' ? 4 : 8);
    }

    const controls = graph3dInstance.controls?.();
    if (controls) {
        controls.rotateSpeed = 1.35;
        controls.zoomSpeed   = 0.8;
        controls.panSpeed    = 0.05;
    }

    graph3dInstance.onNodeClick((node) => {
        if (node.kind === 'shape') focusExplorerShape(node.id);
    });

    graph3dInstance.onBackgroundClick(() => {
        explorerState.selectedShapeId = null;
        if (explorerState.popupContainer) explorerState.popupContainer.style.display = 'none';
    });

    ensureExplorerPopup(container);
    return graph3dInstance;
}