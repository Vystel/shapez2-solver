import { COLOR_CODES, BASE_COLORS, MIX_COMBINATIONS } from './shapeConstants.js';

const SEARCH_INPUT_LIMIT = 20;
const MAX_SOLUTIONS      = 40;
const DFS_TIME_LIMIT_MS  = 2000;
const EXTRA_DEPTH_STEPS  = 1;

const ALL_COLOR_CODES = Object.values(COLOR_CODES).map((c) => c.toUpperCase());

const COLOR_NAME_TO_CODE = Object.freeze(
    Object.fromEntries(
        Object.entries(COLOR_CODES).map(([name, code]) => [name.toLowerCase(), code.toUpperCase()])
    )
);

const MIX_PAIRS = ALL_COLOR_CODES.flatMap((a, i) =>
    ALL_COLOR_CODES.slice(i).map((b) => [a, b])
);

function zeroCounts() {
    return Object.fromEntries(ALL_COLOR_CODES.map((c) => [c, 0]));
}

function stateKey(state) {
    return ALL_COLOR_CODES.map((c) => state[c]).join(',');
}

function isGoal(state, want) {
    return ALL_COLOR_CODES.every((c) => state[c] >= want[c]);
}

function canMix(a, b, state) {
    if (a === b) return a === 'W' && state[a] >= 2;
    return state[a] > 0 && state[b] > 0;
}

function applyMix(state, a, b) {
    const next = { ...state };
    next[a] -= 1;
    next[b] -= 1;
    next[MIX_COMBINATIONS[a][b]] += 2;
    return next;
}

function findShortestSolution(have, want) {
    const queue   = [{ state: { ...have }, steps: [] }];
    const visited = new Set();
    let head = 0;

    while (head < queue.length) {
        const { state, steps } = queue[head++];

        if (isGoal(state, want)) return steps;

        const key = stateKey(state);
        if (visited.has(key)) continue;
        visited.add(key);

        for (const [a, b] of MIX_PAIRS) {
            if (!canMix(a, b, state)) continue;
            queue.push({
                state: applyMix(state, a, b),
                steps: [...steps, { c1: a, c2: b, mixed: MIX_COMBINATIONS[a][b] }],
            });
        }
    }

    return null;
}

function findAllSolutions(have, want, maxSolutions = MAX_SOLUTIONS) {
    const shortest = findShortestSolution(have, want);
    if (!shortest) return [];

    const depthLimit = shortest.length + EXTRA_DEPTH_STEPS;
    const deadline   = Date.now() + DFS_TIME_LIMIT_MS;
    const solutions  = [];
    const seenKeys   = new Set();

    function dfs(state, steps) {
        if (solutions.length >= maxSolutions || Date.now() > deadline) return;

        if (isGoal(state, want)) {
            const key = steps.map(({ c1, c2, mixed }) => `${c1}${c2}${mixed}`).sort().join('|');
            if (!seenKeys.has(key)) {
                seenKeys.add(key);
                solutions.push([...steps]);
            }
            return;
        }

        if (steps.length >= depthLimit) return;

        for (const [a, b] of MIX_PAIRS) {
            if (!canMix(a, b, state)) continue;
            const mixed = MIX_COMBINATIONS[a][b];
            steps.push({ c1: a, c2: b, mixed });
            dfs(applyMix(state, a, b), steps);
            steps.pop();
        }
    }

    dfs({ ...have }, []);
    solutions.sort((a, b) => a.length - b.length);
    return solutions;
}

function generateRgbCombinations(total) {
    const results = [];

    function distribute(pos, remaining, current) {
        if (pos === BASE_COLORS.length - 1) {
            results.push([...current, remaining]);
            return;
        }
        for (let n = remaining; n >= 0; n--) {
            current.push(n);
            distribute(pos + 1, remaining - n, current);
            current.pop();
        }
    }

    distribute(0, total, []);
    return results;
}

function countsFromCombo(combo) {
    const counts = zeroCounts();
    BASE_COLORS.forEach((color, i) => { counts[color] = combo[i]; });
    return counts;
}

export function readColorCounts(inputClass) {
    const counts = zeroCounts();

    document.querySelectorAll('.mix-color-row').forEach((row) => {
        const code = COLOR_NAME_TO_CODE[row.dataset.color];
        if (!code) return;
        counts[code] = Math.max(0, Number.parseInt(row.querySelector(`.${inputClass}`)?.value, 10) || 0);
    });

    return counts;
}

function solveManual(have, want, setStatus) {
    setStatus('Solving mix…', 'running');

    const solutions = findAllSolutions(have, want);
    if (!solutions.length) {
        setStatus('No solution found. Try adding more input colors.', 'error');
        alert('No solution found! Try adding more input colors.');
        return null;
    }

    solutions.forEach((steps) => { steps.have = { ...have }; });
    setStatus(`Mix solved · ${solutions.length} solution${solutions.length !== 1 ? 's' : ''} found`, 'done');
    return { solutions, have };
}

function solveOptimized(want, setStatus) {
    const minInputs = Math.max(Object.values(want).reduce((s, n) => s + n, 0), 1);
    let totalInputs = minInputs;

    setStatus('Optimizing mix…', 'running');

    while (totalInputs <= SEARCH_INPUT_LIMIT) {
        setStatus(`Optimizing mix · trying ${totalInputs} input${totalInputs !== 1 ? 's' : ''}…`, 'running');

        const allSolutions = [];

        for (const combo of generateRgbCombinations(totalInputs)) {
            const inputCounts = countsFromCombo(combo);
            const solutions   = findAllSolutions(inputCounts, want);
            solutions.forEach((steps) => { steps.have = { ...inputCounts }; });
            allSolutions.push(...solutions);
        }

        if (allSolutions.length) {
            allSolutions.sort((a, b) => a.length - b.length);
            setStatus(
                `Mix optimized · ${allSolutions.length} solution${allSolutions.length !== 1 ? 's' : ''} · ${totalInputs} input${totalInputs !== 1 ? 's' : ''}`,
                'done'
            );
            return { solutions: allSolutions, have: null };
        }

        totalInputs++;
    }

    setStatus('No solution found within search limit.', 'error');
    alert('No solution found within the search limit. Try adding more output colors.');
    return null;
}

export function solveMixAll(have, want, manualInputs, setStatus = () => {}) {
    return manualInputs
        ? solveManual(have, want, setStatus)
        : solveOptimized(want, setStatus);
}

let cancelled = false;
 
self.onmessage = ({ data: { action, data } }) => {
    if (action === 'cancel') {
        cancelled = true;
        return;
    }
 
    if (action === 'solve') {
        cancelled = false;
        const { have, want, manualInputs } = data;
 
        const setStatus = (message, status) => {
            if (!cancelled) self.postMessage({ type: 'status', message, status });
        };
 
        const result = solveMixAll(have, want, manualInputs, setStatus);
        if (!cancelled) self.postMessage({ type: 'result', result });
    }
};
 