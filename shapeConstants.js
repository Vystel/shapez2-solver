export const SHAPE_LAYER_SEPARATOR = ':';

export const PART_CODES = Object.freeze({
    NOTHING: '-',
    CIRCLE: 'C',
    RECTANGLE: 'R',
    STAR: 'S',
    DIAMOND: 'W',
    HEXAGON: 'H',
    FLOWER: 'F',
    GEAR: 'G',
    PIN: 'P',
    CRYSTAL: 'c',
    REFINED: 'X',
    EXOTIC: 'Y'
});

export const UNPAINTABLE_PARTS = [
    PART_CODES.NOTHING,
    PART_CODES.PIN,
    PART_CODES.CRYSTAL,
    PART_CODES.REFINED,
    PART_CODES.EXOTIC
];

export const REPLACED_BY_CRYSTAL = [PART_CODES.PIN, PART_CODES.NOTHING];
export const NON_RENEWABLE_PARTS = [PART_CODES.CIRCLE, PART_CODES.RECTANGLE, PART_CODES.STAR, PART_CODES.DIAMOND, PART_CODES.HEXAGON, PART_CODES.FLOWER, PART_CODES.GEAR, PART_CODES.REFINED, PART_CODES.EXOTIC ];

export const COLOR_CODES = Object.freeze({
    RED: 'r',
    GREEN: 'g',
    BLUE: 'b',
    YELLOW: 'y',
    CYAN: 'c',
    MAGENTA: 'm',
    WHITE: 'w',
    BLACK: 'k',
    GRAY: 'u'
});

export const BASE_COLORS = ['R', 'G', 'B'];
export const UNCOLORED_CODE = 'u';

export const MIX_COMBINATIONS = Object.freeze({
    R: Object.freeze({ R: 'R', G: 'Y', B: 'M', C: 'W', M: 'R', Y: 'R', W: 'R', K: 'R', U: 'R' }),
    G: Object.freeze({ R: 'Y', G: 'G', B: 'C', C: 'G', M: 'W', Y: 'G', W: 'G', K: 'G', U: 'G' }),
    B: Object.freeze({ R: 'M', G: 'C', B: 'B', C: 'B', M: 'B', Y: 'W', W: 'B', K: 'B', U: 'B' }),
    C: Object.freeze({ R: 'W', G: 'G', B: 'B', C: 'C', M: 'W', Y: 'W', W: 'C', K: 'C', U: 'C' }),
    M: Object.freeze({ R: 'R', G: 'W', B: 'B', C: 'W', M: 'M', Y: 'W', W: 'M', K: 'M', U: 'M' }),
    Y: Object.freeze({ R: 'R', G: 'G', B: 'W', C: 'W', M: 'R', Y: 'Y', W: 'Y', K: 'Y', U: 'Y' }),
    W: Object.freeze({ R: 'R', G: 'G', B: 'B', C: 'C', M: 'M', Y: 'Y', W: 'K', K: 'U', U: 'W' }),
    K: Object.freeze({ R: 'R', G: 'G', B: 'B', C: 'C', M: 'M', Y: 'Y', W: 'U', K: 'K', U: 'K' }),
    U: Object.freeze({ R: 'R', G: 'G', B: 'B', C: 'C', M: 'M', Y: 'Y', W: 'W', K: 'K', U: 'U' })
});

export const COLOR_VALUES = Object.freeze({
    u: 'rgb(121,138,150)',
    r: 'rgb(244,44,86)',
    g: 'rgb(113,195,43)',
    b: 'rgb(75,137,237)',
    c: 'rgb(29,195,145)',
    m: 'rgb(184,68,198)',
    y: 'rgb(232,148,47)',
    w: 'rgb(255,255,255)',
    k: 'rgb(65,64,59)',
    p: 'rgb(195,53,255)',
    o: 'rgb(254,153,0)'
});

export const COLOR_MODES = Object.freeze({
    rgb: Object.freeze({
        u: COLOR_VALUES.u,
        r: COLOR_VALUES.r,
        g: COLOR_VALUES.g,
        b: COLOR_VALUES.b,
        c: COLOR_VALUES.c,
        m: COLOR_VALUES.m,
        y: COLOR_VALUES.y,
        w: COLOR_VALUES.w,
        k: COLOR_VALUES.k
    }),
    ryb: Object.freeze({
        u: COLOR_VALUES.u,
        r: COLOR_VALUES.r,
        g: COLOR_VALUES.y,
        b: COLOR_VALUES.b,
        c: COLOR_VALUES.g,
        m: COLOR_VALUES.p,
        y: COLOR_VALUES.o,
        w: COLOR_VALUES.k,
        k: COLOR_VALUES.w
    }),
    cmyk: Object.freeze({
        u: COLOR_VALUES.u,
        r: COLOR_VALUES.c,
        g: COLOR_VALUES.m,
        b: COLOR_VALUES.y,
        c: COLOR_VALUES.r,
        m: COLOR_VALUES.g,
        y: COLOR_VALUES.b,
        w: COLOR_VALUES.k,
        k: COLOR_VALUES.w
    })
});
