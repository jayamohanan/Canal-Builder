// ============================================================================
// LEVELS — what the game IS, level by level
// ============================================================================
// Split out of config.js, which holds how things BEHAVE. The test for whether
// something belongs here: does it change when you add a level or a crop, or
// when you tune how something feels? Growth speed, sway, dim alpha and camera
// follow are tuning and stay in config.js. The running order of the farms is
// content and lives here.
//
// ── WHAT A LEVEL IS ─────────────────────────────────────────────────────────
// One object per level, holding its map and its crop together.
//
// They used to be two things in two places: an entry in LEVELS naming a map,
// and a position in CROP_CYCLE naming a crop. They were matched by INDEX and
// wrapped SEPARATELY — 7 maps against 11 crops meant the pairing drifted every
// time round, so the same field grew something different on each pass and no
// one could say what a level was without counting entries in two lists.
//
// Now one line is one level and they cannot come apart.
//
//   FILE   path to the Tiled .tmj — field layout, canals, crop cells, props
//   CROP   which sheet grows here; a name in CROP_LIBRARY below
//   COST   optional: work to cut this level, overriding COST[] by position
//   PONDS  optional: marker id -> pond art, for maps painting pond markers
//
// The key names are the ones the code already reads, so binding the crop in
// costs nothing elsewhere — map loading, pond art and the debug report are
// untouched.
//
// Loaded BEFORE config.js (see index.html), which reads LEVEL_DATA below.
// ============================================================================

const LEVEL_DATA = {

    // ── THE RUNNING ORDER ───────────────────────────────────────────────────
    // Entry 1 is level 1. The list WRAPS: with seven entries, level 8 is entry
    // 1 again — the same map growing the same crop, which is now a property of
    // the pair rather than an accident of two lists sliding past each other.
    //
    // Adding a level: one line. Reordering: move the line, and its crop travels
    // with it.
    LEVELS: [
        { FILE: 'level_maps/level_08.tmj', CROP: 'corn' },
        { FILE: 'level_maps/level_07.tmj', CROP: 'tomato' },
        { FILE: 'level_maps/level_06.tmj', CROP: 'carrot' },
        { FILE: 'level_maps/level_01.tmj', CROP: 'mango' },
        { FILE: 'level_maps/level_02.tmj', CROP: 'green-beans' },
        { FILE: 'level_maps/level_03.tmj', CROP: 'corn' },
        { FILE: 'level_maps/level_04.tmj', CROP: 'hops' },
        { FILE: 'level_maps/level_05.tmj', CROP: 'egg-plant' },
        // Unused sheets, ready to pair: melon, potato, grape.
        // A level that paints pond markers names its art here:
        //   { FILE: '…', CROP: 'melon', PONDS: { 1: 'pond1_dry' } },
    ],

    // ── CROP LIBRARY ────────────────────────────────────────────────────────
    // What a crop NAME means. Levels reference names; this says where the sheet
    // lives and how its frames are read. Not level-ordered — a dictionary.
    //
    // CLASS decides how the frames after the growth run are interpreted:
    //   trellis  last frame is the SUPPORT, drawn behind and never animated
    //   root     last frame is the pulled vegetable, for harvest; no fruit
    //   (unset)  normal — last frame is the fruit, drawn over the final body
    CROP_LIBRARY: {
        DIR: 'graphics/crops1/',
        EXT: '.png',
        CLASS: {
            'hops':        'trellis',
            'green-beans': 'trellis',
            'carrot':      'root',
            'potato':      'root',
        },
    },

    // ── COST CURVE ──────────────────────────────────────────────────────────
    // Work to cut each level, by position in the running order. Taken from
    // Blumgi Merge's Total HP column verbatim. A Level may name its own COST to
    // break the curve; otherwise it takes the entry at its index.
    //
    // Per-tile hardness is this divided by the map's row count, so a short map
    // is harder per tile than a long one of the same cost. Nothing authors that
    // and nothing stores it.
    COST: [
        100, 350, 1800, 8000, 22500,                   // 1-5
        42000, 15000, 95000, 230000, 600000,           // 6-10
        1200000, 4500000, 5600000, 11800000, 27900000, // 11-15
        58500000, 135000000, 225000000, 450000000, 750000000, // 16-20
        1500000000, 1800000000, 2400000000, 3100000000, 3400000000, // 21-25
        3600000000, 4200000000, 5000000000, 225000000, 6500000000, // 26-30
        7200000000, 7900000000, 9000000000, 9800000000, 11300000000, // 31-35
        13800000000, 15900000000, 18200000000, 19500000000, 22500000000, // 36-40
        27000000000, 75000000000, 120000000000, 180000000000, 240000000000, // 41-45
        285000000000, 390000000000, 480000000000, 675000000000, 900000000000, // 46-50
        1350000000000, 1850000000000, 2650000000000, 3750000000000, 5250000000000, // 51-55
        6750000000000, 8250000000000, 10500000000000, 13500000000000, 16500000000000, // 56-60
        20500000000000, 22500000000000, 1125000000000, 27000000000000, 27000000000000, // 61-65
    ],

    // Multiplies the whole column. Dormant at 1. Rescaling preserves every
    // ratio, so the numbers can move off Blumgi's literal values at any point
    // without re-testing balance — it changes the display, nothing else.
    COST_SCALE: 1,

    // How a level's cost divides ALONG the level: a soft opening, a medium
    // middle, a hard final third. Taken from the split between Blumgi's three
    // monsters, which is stable across their whole table (level 1 is 20/30/50,
    // level 65 is 30/33/37, average 28/33/39). Keeps the texture of their
    // three-monster structure inside our one-machine model — the rig visibly
    // labours as a level closes.
    STRETCHES: [0.28, 0.33, 0.39],
};

// Say so loudly if a level is half-defined. Both halves are needed to build
// anything, and a missing crop in particular fails as a silently bare field.
for (let i = 0; i < LEVEL_DATA.LEVELS.length; i++) {
    const lv = LEVEL_DATA.LEVELS[i];
    if (!lv.FILE || !lv.CROP) {
        console.error(`[levels] entry ${i + 1} is incomplete — ` +
            `map=${lv.FILE || '(none)'} crop=${lv.CROP || '(none)'}. ` +
            `A level needs both.`);
    }
}
