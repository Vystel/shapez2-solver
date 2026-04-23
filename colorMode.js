import { COLOR_MODES } from './shapeConstants.js';

const DEFAULT_MODE     = 'rgb';
const FALLBACK_COLOR   = '#ccc';

function normalizeColorCode(code) {
    return typeof code === 'string' ? code.toLowerCase() : '';
}

export function getCurrentColorMode() {
    const selected = document.getElementById('color-mode-select')?.value;
    return (selected && COLOR_MODES[selected]) ? selected : DEFAULT_MODE;
}

export function getMixColor(colorCode) {
    const mode = getCurrentColorMode();
    return COLOR_MODES[mode]?.[normalizeColorCode(colorCode)] ?? FALLBACK_COLOR;
}