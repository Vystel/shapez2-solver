import { createShapeCanvas, createShapeElement } from './shapeRendering.js';
import { Shape, _extractLayers } from './shapeOperations.js';
import { getCyInstance, copyGraphToClipboard, applyGraphLayout, renderGraph, renderSpaceGraph, renderMixGraph } from './operationGraph.js';
import { showValidationErrors } from './shapeValidation.js';
import { readColorCounts } from './mixingSolver.js';
import { getCurrentColorMode, getMixColor } from './colorMode.js';
import { COLOR_MODES, NON_RENEWABLE_PARTS } from './shapeConstants.js';

// constants
const SOLVER_LABELS   = { start: '▶ Solve',   cancel: '⏹ Cancel' };
const EXPLORER_LABELS = { start: '▶ Explore', cancel: '⏹ Cancel' };
const MIX_LABELS      = { start: '▶ Solve',   cancel: '⏹ Cancel' };

// main state
const state = {
    targetShapeCodes:        [],
    startingShapeCodes:      ['CuCuCuCu', 'RuRuRuRu', 'SuSuSuSu', 'WuWuWuWu'],
    solverWorker:            null,
    explorerWorker:          null,
    mixWorker:               null,
    mixSolutions:            [],
    mixFallbackHaveCounts:   null,
    selectedMixSolutionIndex: 0,
};

// DOM utils
const byId  = (id)               => document.getElementById(id);
const qs    = (sel, root = document) => root?.querySelector(sel)     ?? null;
const qsa   = (sel, root = document) => Array.from(root?.querySelectorAll(sel) ?? []);
const readInt = (id, fallback)   => Number.parseInt(byId(id)?.value, 10) || fallback;

// status bar
function setStatus(text, status = 'idle') {
    const dot   = byId('status-dot');
    const label = byId('status-text');
    if (label) label.textContent = text;
    if (dot)   dot.className = `status-dot ${status}`;
}

// shape lists
function renderShapeList(containerId, shapeCodes, onRemove) {
    const container = byId(containerId);
    if (!container) return;

    container.innerHTML = '';

    if (shapeCodes.length === 0) {
        const empty = document.createElement('span');
        empty.className = 'shape-empty';
        empty.textContent = 'None added yet.';
        container.appendChild(empty);
        return;
    }

    for (const [index, code] of shapeCodes.entries()) {
        const item      = document.createElement('div');
        item.className  = 'shape-item';
        item.dataset.shapeCode = code;

        const label     = document.createElement('span');
        label.className = 'shape-code';
        label.textContent = code;

        const removeBtn     = document.createElement('button');
        removeBtn.className = 'shape-remove';
        removeBtn.title     = 'Remove';
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', () => onRemove(index));

        item.append(createShapeElement(code), label, removeBtn);
        container.appendChild(item);
    }
}

const refreshTargetList = () =>
    renderShapeList('target-shapes', state.targetShapeCodes, (i) => {
        state.targetShapeCodes.splice(i, 1);
        refreshTargetList();
    });

const refreshStartingList = () =>
    renderShapeList('starting-shapes', state.startingShapeCodes, (i) => {
        state.startingShapeCodes.splice(i, 1);
        refreshStartingList();
    });

function addShapeFromInput(listType) {
    const isTarget = listType === 'target';
    const input    = byId(isTarget ? 'target-input' : 'starting-input');
    const code     = input?.value.trim() ?? '';

    if (!code || !showValidationErrors(code, `${listType} shape`)) return;

    if (isTarget) {
        state.targetShapeCodes.push(code);
        refreshTargetList();
    } else {
        state.startingShapeCodes.push(code);
        refreshStartingList();
    }

    if (input) { input.value = ''; input.focus(); }
}

// worker utils
function createSolverWorker() {
    return new Worker(new URL('./shapeSolver.js', import.meta.url), { type: 'module' });
}

function createMixWorker() {
    return new Worker(new URL('./mixingSolver.js', import.meta.url), { type: 'module' });
}

function stopWorker(worker) {
    if (!worker) return null;
    worker.postMessage({ action: 'cancel' });
    worker.terminate();
    return null;
}

function runWorker({ button, labels, message, workerFactory = createSolverWorker, payload, onResult, onError }) {
    const isStart = button.textContent.trim() === labels.start;

    if (!isStart) {
        return 'cancel';
    }

    const worker    = workerFactory();
    const startTime = performance.now();

    button.textContent = labels.cancel;
    setStatus(message, 'running');

    worker.onmessage = ({ data: { type, message: msg, result } }) => {
        if (type === 'status') { setStatus(msg, 'running'); return; }
        if (type !== 'result') return;
        button.textContent = labels.start;
        onResult(result, startTime);
        worker.terminate();
    };

    worker.onerror = ({ message: msg }) => {
        setStatus(`Worker error: ${msg}`, 'error');
        button.textContent = labels.start;
        if (onError) onError();
        worker.terminate();
    };

    worker.postMessage(payload);
    return worker;
}

// solver & explorer panels
function collectStartingCodes() {
    return qsa('#starting-shapes .shape-item[data-shape-code]')
        .map((el) => el.dataset.shapeCode)
        .filter(Boolean);
}

function collectEnabledOperations() {
    return qsa('#enabled-operations .operation-item.enabled')
        .map((el) => el.dataset.operation)
        .filter(Boolean);
}

function readSolverOptions() {
    return {
        maxLayers:          readInt('max-layers', 4),
        maxStatesPerLevel:  readInt('max-states-per-level', 7500),
        preventWaste:       byId('prevent-waste')?.checked           ?? false,
        orientationSensitive: byId('orientation-sensitive')?.checked ?? false,
        allowSplitting:     byId('allow-splitting')?.checked         ?? false,
        cleanPainting:      byId('clean-painting')?.checked          ?? false,
    };
}

function validateSolveInputs(startingCodes) {
    if (!state.targetShapeCodes.length) {
        alert('Add at least one output shape.');
        return false;
    }
    for (const code of [...state.targetShapeCodes, ...startingCodes]) {
        if (!showValidationErrors(code, 'shape')) return false;
    }

    const nonRenewableSet = new Set(NON_RENEWABLE_PARTS);
    const countPartsByType = (shapeCodes) => {
        const counts = new Map();

        for (const code of shapeCodes) {
            for (const layer of code.split(':')) {
                for (let i = 0; i < layer.length; i += 2) {
                    const part = layer[i];
                    if (!nonRenewableSet.has(part)) continue;
                    counts.set(part, (counts.get(part) ?? 0) + 1);
                }
            }
        }

        return counts;
    };

    const inputPartCounts = countPartsByType(startingCodes);
    const outputPartCounts = countPartsByType(state.targetShapeCodes);
    const shortages = [];

    for (const part of NON_RENEWABLE_PARTS) {
        const inputCount = inputPartCounts.get(part) ?? 0;
        const outputCount = outputPartCounts.get(part) ?? 0;
        if (inputCount < outputCount) {
            shortages.push(`${part}: need ${outputCount}, have ${inputCount}`);
        }
    }

    if (shortages.length) {
        alert(
            `Impossible solution: not enough non-renewable parts in inputs to satisfy outputs.\n\n` +
            `Shortages:\n${shortages.join('\n')}`
        );
        return false;
    }

    return true;
}

function setupSolverPanel() {
    const btn = qs('#panel-solver .btn-primary');
    if (!btn) return;

    btn.addEventListener('click', () => {
        if (state.solverWorker) {
            state.solverWorker = stopWorker(state.solverWorker);
            btn.textContent = SOLVER_LABELS.start;
            setStatus('Cancelled.', 'idle');
            return;
        }

        const startingCodes = collectStartingCodes();
        if (!validateSolveInputs(startingCodes)) return;

        state.solverWorker = runWorker({
            button:  btn,
            labels:  SOLVER_LABELS,
            message: 'Solving…',
            payload: {
                action: 'solve',
                data: {
                    targetShapeCodes:  [...state.targetShapeCodes],
                    startingShapeCodes: startingCodes,
                    enabledOperations:  collectEnabledOperations(),
                    ...readSolverOptions(),
                },
            },
            onResult(result, startTime) {
                state.solverWorker = null;
                if (result?.solutionPath) {
                    renderGraph(result.solutionPath);
                    byId('placeholder')?.style.setProperty('display', 'none');
                    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
                    setStatus(`Solved in ${elapsed}s · depth ${result.depth} · ${result.statesExplored} states`, 'done');
                } else {
                    setStatus('No solution found.', 'error');
                }
            },
            onError() { state.solverWorker = null; },
        });
    });
}

function setupExplorerPanel() {
    const btn = qs('#panel-explorer .btn-primary');
    if (!btn) return;

    btn.addEventListener('click', () => {
        if (state.explorerWorker) {
            state.explorerWorker = stopWorker(state.explorerWorker);
            btn.textContent = EXPLORER_LABELS.start;
            setStatus('Cancelled.', 'idle');
            return;
        }

        const startingCodes = collectStartingCodes();
        for (const code of startingCodes) {
            if (!showValidationErrors(code, 'starting shape')) return;
        }

        state.explorerWorker = runWorker({
            button:  btn,
            labels:  EXPLORER_LABELS,
            message: 'Exploring…',
            payload: {
                action: 'explore',
                data: {
                    startingShapeCodes: startingCodes,
                    enabledOperations:  collectEnabledOperations(),
                    depthLimit:         readInt('depth-limit-input', 999),
                    maxLayers:          readInt('max-layers', 4),
                    skipTwoInputOps:    byId('skip-two-input-ops')?.checked ?? false,
                },
            },
            onResult(result) {
                state.explorerWorker = null;
                if (result) {
                    renderSpaceGraph(result);
                    byId('placeholder')?.style.setProperty('display', 'none');
                    setStatus('Exploration complete.', 'done');
                } else {
                    setStatus('No shapes reachable.', 'idle');
                }
            },
            onError() { state.explorerWorker = null; },
        });
    });
}

// shape extraction modal
function setupExtractModal() {
    const modal   = byId('extract-modal');
    const close   = () => { if (modal) modal.style.display = 'none'; };

    byId('extract-shapes-btn')?.addEventListener('click', () => {
        if (!state.targetShapeCodes.length) { alert('Add at least one output shape first.'); return; }
        if (modal) modal.style.display = 'flex';
    });

    byId('extract-cancel')?.addEventListener('click', close);
    modal?.addEventListener('click', (e) => { if (e.target === modal) close(); });

    byId('extract-confirm')?.addEventListener('click', () => {
        close();
        if (!state.targetShapeCodes.length) { alert('No output shapes to extract from.'); return; }

        const mode         = qs('input[name="extract-mode"]:checked')?.value ?? 'color';
        const includePins  = byId('include-pins')?.checked  ?? false;
        const includeCrystals = byId('include-crystals')?.checked ?? false;
        const includeColor = byId('include-color')?.checked ?? false;
        const extracted    = [];

        for (const code of state.targetShapeCodes) {
            if (!showValidationErrors(code, 'target shape')) return;
            try {
                _extractLayers(Shape.fromShapeCode(code), mode, includePins, includeColor, includeCrystals)
                    .forEach((c) => extracted.push(c));
            } catch (err) {
                alert(`Failed to extract shapes from "${code}": ${err.message}`);
                return;
            }
        }

        state.startingShapeCodes.length = 0;
        state.startingShapeCodes.push(...extracted);
        refreshStartingList();
    });
}

// mixing panel
function renderSelectedMixSolution() {
    if (!state.mixSolutions.length) return;

    const idx   = Math.max(0, Math.min(state.selectedMixSolutionIndex, state.mixSolutions.length - 1));
    const steps = state.mixSolutions[idx];
    const have  = steps.have ?? state.mixFallbackHaveCounts;

    renderMixGraph(steps, have, { compactMixGraph: byId('mix-compact-graph')?.checked ?? true });
    byId('placeholder')?.style.setProperty('display', 'none');
}

function renderMixSolutionsList(solutions, fallbackHave) {
    const container = byId('mix-solutions');
    if (!container) return;

    state.mixSolutions            = solutions ?? [];
    state.mixFallbackHaveCounts   = fallbackHave ?? null;
    state.selectedMixSolutionIndex = 0;
    container.innerHTML = '';

    if (!solutions?.length) {
        const empty = document.createElement('div');
        empty.className   = 'mix-solutions-empty';
        empty.textContent = 'No solutions found.';
        container.appendChild(empty);
        return;
    }

    const header       = document.createElement('div');
    header.className   = 'subsection-label';
    header.innerHTML   = `Solutions<span class="mix-solutions-count">${solutions.length}</span>`;
    container.appendChild(header);

    const list       = document.createElement('div');
    list.className   = 'mix-solutions-list scroll-thin';
    container.appendChild(list);

    const showUsage  = !(byId('mix-manual-inputs')?.checked ?? false);
    const usageKeys  = [
        { key: 'R', cls: 'is-red'   },
        { key: 'G', cls: 'is-green' },
        { key: 'B', cls: 'is-blue'  },
    ];

    solutions.forEach((steps, i) => {
        const btn = document.createElement('button');
        btn.className = 'mix-solution-item';

        const idxLabel   = Object.assign(document.createElement('span'), { className: 'mix-sol-idx',   textContent: `#${i + 1}` });
        const stepLabel  = Object.assign(document.createElement('span'), { className: 'mix-sol-steps', textContent: `${steps.length} step${steps.length !== 1 ? 's' : ''}` });
        btn.append(idxLabel, stepLabel);

        if (showUsage) {
            const have = steps.have ?? fallbackHave;
            const wrap = document.createElement('span');
            wrap.className = 'mix-sol-usage';

            usageKeys.forEach(({ key, cls }) => {
                const item   = Object.assign(document.createElement('span'), { className: `mix-sol-usage-item ${cls}` });
                const swatch = Object.assign(document.createElement('span'), { className: `mix-sol-usage-swatch ${cls}` });
                const amount = Object.assign(document.createElement('span'), { className: `mix-sol-usage-amount ${cls}`, textContent: String(have?.[key] ?? 0) });
                item.append(swatch, amount);
                wrap.appendChild(item);
            });

            btn.appendChild(wrap);
        }

        btn.addEventListener('click', () => {
            state.selectedMixSolutionIndex = i;
            renderSelectedMixSolution();
        });

        list.appendChild(btn);
    });

    renderSelectedMixSolution();
}

function setMixManualMode(enabled) {
    qsa('.mix-input.mix-have').forEach((el) => { el.style.display = enabled ? '' : 'none'; });
    const headers = qs('.mix-col-headers');
    if (headers) headers.style.display = enabled ? '' : 'none';
    qsa('.mix-color-row, .mix-col-headers').forEach((el) => {
        el.style.gridTemplateColumns = enabled ? '1fr 56px 56px' : '1fr 56px';
    });
}

function setupMixingPanel() {
    byId('reset-mix-btn')?.addEventListener('click', () => {
        qsa('.mix-input').forEach((el) => { el.value = 0; });
        const c = byId('mix-solutions');
        if (c) c.innerHTML = '';
    });

    byId('mix-manual-inputs')?.addEventListener('change', (e) => setMixManualMode(e.target.checked));
    byId('mix-compact-graph')?.addEventListener('change', renderSelectedMixSolution);

    const btn = byId('solve-mix');
    btn?.addEventListener('click', () => {
        if (state.mixWorker) {
            state.mixWorker = stopWorker(state.mixWorker);
            btn.textContent = MIX_LABELS.start;
            setStatus('Cancelled.', 'idle');
            return;
        }

        const isManual = byId('mix-manual-inputs')?.checked ?? false;
        const have     = isManual ? readColorCounts('mix-have') : null;
        const want     = readColorCounts('mix-want');

        state.mixWorker = runWorker({
            button:  btn,
            labels:  MIX_LABELS,
            message: isManual ? 'Solving mix…' : 'Optimizing mix…',
            workerFactory: createMixWorker,
            payload: { action: 'solve', data: { have, want, manualInputs: isManual } },
            onResult(result) {
                state.mixWorker = null;
                if (result) {
                    renderMixSolutionsList(result.solutions, result.have);
                } else {
                    setStatus('No solution found.', 'error');
                }
            },
            onError() { state.mixWorker = null; },
        });
    });

    setMixManualMode(false);
}

// color mode
function refreshShapeColors() {
    const cy        = getCyInstance();
    const colorMode = getCurrentColorMode();

    if (cy) {
        cy.nodes('.shape').forEach((node) => {
            try {
                node.data('shapeCanvas', createShapeCanvas(node.data('label'), 120).toDataURL());
                node.trigger('style');
            } catch { /* best-effort */ }
        });

        cy.nodes('.colored-op').forEach((node) => {
            const token = node.data('label').split(' ').at(-1)?.replace(/[()]/g, '');
            const color = token ? COLOR_MODES?.[colorMode]?.[token] : null;
            if (color) node.style({ 'background-color': color });
        });

        cy.nodes('[colorKey]').forEach((node) => {
            node.style('background-color', getMixColor(node.data('colorKey')));
        });

        cy.edges('[edgeColorKey]').forEach((edge) => {
            edge.style('line-color', getMixColor(edge.data('edgeColorKey')));
        });
    }

    qsa('.shape-canvas').forEach((canvas) => {
        const code = canvas.dataset.shapeCode;
        if (!code) return;
        try {
            const fresh = createShapeCanvas(code, 40);
            Object.assign(fresh, { className: 'shape-canvas' });
            fresh.dataset.shapeCode = code;
            canvas.replaceWith(fresh);
        } catch { /* best-effort */ }
    });
}

// sidebar
function setSidebarCollapsed(collapsed) {
    const sidebar = qs('.sidebar');
    if (!sidebar) return;

    sidebar.classList.toggle('collapsed', collapsed);

    const polyline = byId('sidebar-toggle')?.querySelector('svg polyline');
    polyline?.setAttribute('points', collapsed ? '9 18 15 12 9 6' : '15 18 9 12 15 6');

    const floatBtn = byId('sidebar-toggle-float');
    if (floatBtn) floatBtn.style.display = collapsed ? 'flex' : 'none';
}

function setupSidebar() {
    byId('sidebar-toggle')?.addEventListener('click',       () => setSidebarCollapsed(true));
    byId('sidebar-toggle-float')?.addEventListener('click', () => setSidebarCollapsed(false));
}

// tabs & collapsible sections
function setupTabGroup(tabSelector, panelSelector) {
    qsa(tabSelector).forEach((tab) => {
        tab.addEventListener('click', () => {
            const name = tab.dataset.panel ?? tab.dataset.mode;
            if (!name) return;
            qsa(tabSelector).forEach((t)  => t.classList.remove('active'));
            qsa(panelSelector).forEach((p) => p.classList.remove('active'));
            tab.classList.add('active');
            byId(`panel-${name}`)?.classList.add('active');
        });
    });
}

function setupCollapsibleSections() {
    qsa('.section-header').forEach((header) => {
        header.addEventListener('click', () => {
            const body   = header.nextElementSibling;
            const isOpen = body?.classList.toggle('open');
            header.classList.toggle('open', isOpen);
        });
    });
}

// init
function initializeUi() {
    refreshTargetList();
    refreshStartingList();
    setStatus('Idle', 'idle');

    // shape input fields
    byId('add-target-shape-btn')?.addEventListener('click',  () => addShapeFromInput('target'));
    byId('add-starting-shape-btn')?.addEventListener('click', () => addShapeFromInput('starting'));
    byId('target-input')?.addEventListener('keydown',   (e) => { if (e.key === 'Enter') addShapeFromInput('target'); });
    byId('starting-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') addShapeFromInput('starting'); });

    // layout & navigation
    setupSidebar();
    setupCollapsibleSections();
    setupTabGroup('.sidebar-tab', '.sidebar-panel');
    setupTabGroup('.mode-tab',    '.mode-panel');

    // operations toggle buttons
    qsa('.operation-item').forEach((item) => {
        item.addEventListener('click', () => item.classList.toggle('enabled'));
    });

    // panels
    setupExtractModal();
    setupSolverPanel();
    setupExplorerPanel();
    setupMixingPanel();

    // graph controls
    byId('direction-select')?.addEventListener('change',  (e) => applyGraphLayout(e.target.value));
    byId('color-mode-select')?.addEventListener('change', refreshShapeColors);
    qs('.snapshot-btn')?.addEventListener('click', copyGraphToClipboard);
}

document.addEventListener('DOMContentLoaded', initializeUi);
