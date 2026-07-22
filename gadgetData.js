/**
 * GADGET DATA FILE
 * 
 * This file contains all gadget-related data for the game.
 * 
 * CAPACITY VALUES BY LEVEL:
 * - GADGET_CAPACITY_BY_LEVEL: Dictionary mapping level numbers to [HP1, HP2, HP3] arrays
 * - Edit this to change capacity values for any level
 * - Each level has 3 HP values for different difficulty tiers
 * - Currently supports 64 levels
 * 
 * GADGET SPRITES:
 * - GADGET_SPRITES: Array of gadget sprite definitions (ORDERLESS).
 * - Each entry has: name, normal_sprite, burnedout_sprite, connection_height, connection_left_padding
 * - The order of this array does NOT matter — gadgets are looked up by name.
 * - Add more gadgets by appending; edit a gadget's data in one place only.
 *
 * LEVEL ORDER:
 * - GADGET_LEVEL_ORDER: Array of gadget NAMES only — defines which gadget appears
 *   at each level (index 0 = level 1, index 1 = level 2, ...). Cycles past the end.
 * - Rearrange / swap levels here freely without touching the gadget data above.
 * 
 * IMPORTANT: Capacity values are SEPARATE from gadget appearance
 * - Capacity values are always determined by the level, not by which sprite is shown
 * - The game cycles through available sprites as levels progress
 * 
 * All sprite files should be placed in: graphics/gadgets/
 */

// ============================================================
// CAPACITY VALUES BY LEVEL (from CSV data)
// ============================================================
var GADGET_CAPACITY_BY_LEVEL = {
    1: [25, 50, 100],
    2: [150, 250, 500],
    3: [750, 1250, 2000],
    4: [2500, 3750, 5000],
    5: [5000, 6000, 10000],
    6: [2500, 2500, 2500],
    7: [7500, 15000, 25000],
    8: [25000, 40000, 50000],
    9: [150000, 150000, 150000],
    10: [150000, 200000, 250000],
    11: [500000, 750000, 1000000],
    12: [1500000, 2000000, 2500000],
    13: [1800000, 1900000, 1900000],
    14: [3500000, 4000000, 4300000],
    15: [9000000, 9300000, 9600000],
    16: [19000000, 19500000, 20000000],
    17: [40000000, 45000000, 50000000],
    18: [50000000, 75000000, 100000000],
    19: [100000000, 150000000, 200000000],
    20: [200000000, 250000000, 300000000],
    21: [400000000, 500000000, 550000000],
    22: [550000000, 600000000, 690000000],
    23: [700000000, 800000000, 900000000],
    24: [1200000000, 1200000000, 1200000000],
    25: [1300000000, 1300000000, 1200000000],
    26: [1100000000, 1200000000, 1300000000],
    27: [1300000000, 1400000000, 1500000000],
    28: [1500000000, 1700000000, 1800000000],
    29: [50000000, 75000000, 100000000],
    30: [2000000000, 2200000000, 2300000000],
    31: [2200000000, 2400000000, 2600000000],
    32: [2500000000, 2600000000, 2800000000],
    33: [2900000000, 3000000000, 3200000000],
    34: [3000000000, 3300000000, 3500000000],
    35: [3500000000, 3800000000, 4000000000],
    36: [4300000000, 4600000000, 4900000000],
    37: [5000000000, 5300000000, 5600000000],
    38: [5600000000, 6100000000, 6500000000],
    39: [6000000000, 6500000000, 5700000000],
    40: [7000000000, 7500000000, 8000000000],
    41: [8000000000, 9000000000, 10000000000],
    42: [20000000000, 25000000000, 30000000000],
    43: [30000000000, 40000000000, 50000000000],
    44: [50000000000, 60000000000, 70000000000],
    45: [70000000000, 80000000000, 90000000000],
    46: [90000000000, 95000000000, 100000000000],
    47: [120000000000, 130000000000, 140000000000],
    48: [140000000000, 160000000000, 180000000000],
    49: [200000000000, 225000000000, 250000000000],
    50: [250000000000, 300000000000, 350000000000],
    51: [400000000000, 450000000000, 500000000000],
    52: [500000000000, 600000000000, 750000000000],
    53: [750000000000, 900000000000, 1000000000000],
    54: [1000000000000, 1250000000000, 1500000000000],
    55: [1500000000000, 1750000000000, 2000000000000],
    56: [2000000000000, 2250000000000, 2500000000000],
    57: [2500000000000, 2750000000000, 3000000000000],
    58: [3000000000000, 3500000000000, 4000000000000],
    59: [4000000000000, 4500000000000, 5000000000000],
    60: [5000000000000, 5500000000000, 6000000000000],
    61: [6000000000000, 7000000000000, 7500000000000],
    62: [7000000000000, 7500000000000, 8000000000000],
    63: [250000000000, 375000000000, 500000000000],
    64: [8000000000000, 9000000000000, 10000000000000]
};
var GADGET_REWARD = {
    1:[],
}

// ============================================================
// GADGET SPRITE DEFINITIONS
// ============================================================
var GADGET_SPRITES = [
     {
        "name": "bluetooth_speaker",
        "normal_sprite": "bluetooth_speaker.png",
        "burnedout_sprite": "bluetooth_speaker_burnedout.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5
    },
     {
        "name": "bulb",
        "normal_sprite": "bulb.png",
        "burnedout_sprite": "bulb_burnedout.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5,
        "charge_effect": "glow",
        "charge_effect_params": {
            // filament center of the 314x503 bulb sprite = (157, 187) px
            "anchor": { "x": 0.5, "y": 0.372 },
            "tint": 0xfff2a0,     // warm bulb glow
            "maxAlpha": 1.0,
            "sizeScale": 1.3,     // glow display width = gadget width * 1.3
            "startScale": 0.85,
            "endScale": 1.15
        }
    },
     {
        "name": "brush",
        "normal_sprite": "brush.png",
        "burnedout_sprite": "brush_burnedout.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5
    },
   
    
    {
        "name": "radio",
        "normal_sprite": "radio.png",
        "burnedout_sprite": "radio_burnedout.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5
    },
    {
        "name": "phone",
        "normal_sprite": "phone.png",
        "burnedout_sprite": "phone_burnedout.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5
    },
    {
        "name": "laptop",
        "normal_sprite": "laptop.png",
        "burnedout_sprite": "laptop_burnedout.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5
    },
    {
        "name": "aircooler",
        "normal_sprite": "air_cooler.png",
        "burnedout_sprite": "air_cooler_burnedout.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5
    },
     {
        "name": "desktop",
        "normal_sprite": "desktop.png",
        "burnedout_sprite": "desktop_burnedout.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5
    },
    {
        "name": "fridge",
        "normal_sprite": "fridge.png",
        "burnedout_sprite": "fridge_burnedout.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5
    },
    {
        "name": "mixi",
        "normal_sprite": "mixi.png",
        "burnedout_sprite": "mixi_burnedout.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5
    },
    {
        // Washing machine: washing_machine.png is the body; the "washer" charge
        // effect layers three swirl images (the rotating drum) on top at offset
        // (35,77) from the body's top-left, swapping swirl0→swirl1→swirl2 across
        // equal charge thirds while a shared spin accelerates from still to full.
        "name": "washing_machine",
        "normal_sprite": "washing_machine/washing_machine.png",
        "burnedout_sprite": "washing_machine/washing_machine.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5,
        "charge_effect": "washer",
        "charge_effect_params": {
            "swirls": [
                "washing_machine/swirl0.png",
                "washing_machine/swirl1.png",
                "washing_machine/swirl2.png"
            ],
            "offset": { "x": 35, "y": 77 },
            "minRpm": 0,     // starts stationary
            "maxRpm": 150,   // full-spin top speed
            "rampExp": 2.0   // >1 = slow early, keeps accelerating as charge fills
        }
    },
    {
        "name": "cooktop",
        "normal_sprite": "cooktop.png",
        "burnedout_sprite": "cooktop_burnedout.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5
    },
    {
        "name": "ac",
        "normal_sprite": "ac.png",
        "burnedout_sprite": "ac_burnedout.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5
    },
    {
        "name": "geyser",
        "normal_sprite": "geyser.png",
        "burnedout_sprite": "geyser_burnedout.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5
    },
     {
        "name": "car",
        "normal_sprite": "car.png",
        "burnedout_sprite": "car_burnedout.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5
    },
    {
        // Animated sprite sheet (704x384, 8 frames in a 4x2 grid, 176x192 each).
        // Loaded as a spritesheet in preload; the gadget sprite is an animated
        // Sprite whose loop speed scales with charge. The PNG paths below are only
        // placeholders for the generic loader (the spritesheet drives the visual).
        "name": "sewing_machine",
        "normal_sprite": "sewing_machine.png",
        "burnedout_sprite": "sewing_machine.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5
    },
    {
        // Table fan: body.png is the base sprite (drives display size); the blade
        // and front grill are layered on top by the "fan" charge effect. The blade
        // spins clockwise, ramping from slow to fan-like top speed as charge fills.
        "name": "table_fan",
        "normal_sprite": "table_fan/body.png",
        "burnedout_sprite": "table_fan/body.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5,
        "charge_effect": "fan",
        "charge_effect_params": {
            "blade": "table_fan/blade.png",
            "grill": "table_fan/front_grill.png",
            "maxRpm": 300,   // top spin speed
            "rampExp": 2.0   // >1 = slow early, keeps accelerating as charge fills
        }
    },
    {
        // Record player: record_player.png is the body; the "record_player" charge
        // effect layers two reels (disc over tape) on top at fixed offsets. Both
        // discs spin up to a small constant speed while charging, and the reels
        // trade size — tape1 shrinks 1→0.1 as tape2 grows 0.1→1 — to mimic tape
        // unwinding from the left reel onto the right.
        "name": "record_player",
        "normal_sprite": "record_player/record_player.png",
        "burnedout_sprite": "record_player/record_player.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5,
        "charge_effect": "record_player",
        "charge_effect_params": {
            "disc": "record_player/disc.png",
            "tape": "record_player/tape.png",
            "discSize": { "w": 110, "h": 110 },
            "tapeSize": { "w": 78, "h": 78 },
            "offsets": {
                "disc1": { "x": 6.5, "y": 11 },
                "disc2": { "x": 136, "y": 11 },
                "tape1": { "x": 22.5, "y": 27 },
                "tape2": { "x": 152, "y": 27 }
            },
            "discRpm": 45,        // small constant spin speed
            "tapeMinScale": 0.35,
            "tapeMaxScale": 1.0,
            "tapeMask": {
                // circular hole in each reel — tape is hidden INSIDE the circle.
                // centre relative to record_player top-left, radius in px.
                "left":  { "x": 61,  "y": 65 },
                "right": { "x": 191, "y": 65 },
                "radius": 15
            }
        }
    },
    {
        // Blender: blender.png is the base jar; the "blender" charge effect layers
        // six swirl images (the contents) on top, cross-fading swirl1→swirl6 as it
        // charges while a shared spin accelerates from a slow crawl to full blast.
        "name": "blender",
        "normal_sprite": "blender/blender.png",
        "burnedout_sprite": "blender/blender.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5,
        "charge_effect": "blender",
        "charge_effect_params": {
            "swirls": [
                "blender/swirl1.png", "blender/swirl2.png", "blender/swirl3.png",
                "blender/swirl4.png", "blender/swirl5.png", "blender/swirl6.png"
            ],
            "minRpm": 18,    // small starting crawl
            "maxRpm": 500,   // full-blast top speed
            "rampExp": 2.0   // >1 = slow early, keeps accelerating as charge fills
        }
    },
    {
        // Reciprocating saw: handle.png is the base gadget (fit into the standard
        // max-area rect like every other gadget). The "reciprocating_saw" charge
        // effect drives a Scotch-yoke mechanism layered behind the handle: a DISC
        // rotates clockwise, and the YOKE + BLADE are pushed back and forth
        // horizontally by cos(disc angle). All offsets are the sprite's TOP-LEFT in
        // handle-native px (scaled with the handle). At disc angle 0° everything sits
        // at its max-right (spawn) position; at 180° at its max-left; one full disc
        // revolution = one complete to-fro stroke.
        "name": "reciprocating_saw",
        "normal_sprite": "reciprocating_saw/handle.png",
        "burnedout_sprite": "reciprocating_saw/handle.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5,
        "charge_effect": "reciprocating_saw",
        "charge_effect_params": {
            "blade": "reciprocating_saw/blade.png",
            "disc":  "reciprocating_saw/disc.png",
            "yoke":  "reciprocating_saw/yoke.png",
            "partsOffset": { "x": 0, "y": 0 },   // global nudge for disc+yoke+blade (native px)
            // Reference display sizes (current file dims). Fixed here so a higher-res
            // PNG just renders crisper without changing how big the part appears.
            "discSize":  { "w": 30,  "h": 30 },
            "yokeSize":  { "w": 53,  "h": 34 },
            "bladeSize": { "w": 124, "h": 12 },
            "discOffset": { "x": 50, "y": 13 },  // disc top-left (rotates about its centre)
            "bladeRight": 102, "bladeLeft": 82, "bladeY": 22,  // blade x at 0° / 180°, fixed y
            "yokeRight":  70,  "yokeLeft":  48, "yokeY":  11,  // yoke  x at 0° / 180°, fixed y
            "minRpm": 60,     // disc rpm just after charging begins
            "maxRpm": 600,    // disc rpm at full charge
            "rampExp": 2.0    // >1 = slow early, keeps accelerating as charge fills
        }
    },
];

// ============================================================
// LEVEL ORDER (gadget names only)
// ============================================================
// Defines which gadget appears at each level. Index 0 = level 1, etc.
// Swap entries here to rearrange levels — no need to touch GADGET_SPRITES.
// Cycles back to the start once levels run past the end of this list.
var GADGET_LEVEL_ORDER = [

    "reciprocating_saw",
    "table_fan",
    "blender",
     "washing_machine",
     "record_player",
    
   
    
    "sewing_machine",
    "brush",
    
    "bluetooth_speaker",
    "cooktop",
        "bulb",
    

    
    "radio",
    "phone",
    "laptop",
    "aircooler",
    "desktop",
    "fridge",
    "mixi",
    
    "cooktop",
    "ac",
    "geyser",
    "car",
];

// Name → sprite-definition lookup, built once from the orderless GADGET_SPRITES.
var GADGET_SPRITES_BY_NAME = GADGET_SPRITES.reduce((map, sprite) => {
    map[sprite.name] = sprite;
    return map;
}, {});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get gadget capacity values for a specific level
 * @param {number} level - The level number (1-64)
 * @returns {Array<number>|null} Array of [HP1, HP2, HP3] or null if not found
 */
function getGadgetCapacity(level) {
    return GADGET_CAPACITY_BY_LEVEL[level] || null;
}

/**
 * Get the highest level with defined capacity values
 * @returns {number} The highest level number
 */
function getHighestGadgetLevel() {
    const levels = Object.keys(GADGET_CAPACITY_BY_LEVEL).map(Number);
    return Math.max(...levels);
}

/**
 * Get a gadget sprite definition by name
 * @param {string} name - The gadget name (e.g. "bulb")
 * @returns {Object|null} Gadget sprite object or null if not found
 */
function getGadgetSpriteByName(name) {
    return GADGET_SPRITES_BY_NAME[name] || null;
}

/**
 * Get a gadget sprite definition by index into the level order
 * @param {number} index - The 0-based level-order index
 * @returns {Object|null} Gadget sprite object or null if not found
 */
function getGadgetSprite(index) {
    const name = GADGET_LEVEL_ORDER[index];
    return name ? getGadgetSpriteByName(name) : null;
}

/**
 * Get gadget sprite for a level (cycles through the level order)
 * @param {number} level - The level number
 * @returns {Object|null} Gadget sprite object
 */
function getGadgetSpriteForLevel(level) {
    if (GADGET_LEVEL_ORDER.length === 0) return null;
    const index = (level - 1) % GADGET_LEVEL_ORDER.length;
    return getGadgetSpriteByName(GADGET_LEVEL_ORDER[index]);
}

/**
 * Get complete gadget data for a level (sprite + capacity)
 * @param {number} level - The level number
 * @returns {Object} Object with sprite data and capacity array
 */
function getGadgetData(level) {
    const sprite = getGadgetSpriteForLevel(level);
    const capacity = getGadgetCapacity(level);
    
    return {
        ...sprite,
        capacity: capacity,
        level: level
    };
}
