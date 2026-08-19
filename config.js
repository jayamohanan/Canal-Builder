// Helper: convert CSS hex color string to Phaser hex number
function hexColor(cssColor) {
    if (typeof cssColor === 'string' && cssColor.startsWith('#')) {
        return parseInt(cssColor.substring(1), 16);
    }
    return cssColor;
}

var CONFIG = {
    FONT_FAMILY: 'Arial',
    TEXT_COLOR: '#1A237E',

    // ── Screen split ──────────────────────────────────────────────────────────
    // Landscape puts the UI (grid, coin, spawn button, battery slots) on the LEFT
    // and the farm on the RIGHT. The farm is what the game is about, so it takes
    // the larger share: the UI needs only the grid panel's width plus margins.
    // Portrait stays a 50/50 top/bottom split — see calculateLayout().
    LAYOUT: {
        LANDSCAPE_SPLIT: 0.4,      // UI's share of the width; the farm gets the rest
        // The design reference is a 1440×778 MacBook. REF_W is the UI half AT THAT
        // SPLIT, so changing the split alone never resizes the grid: the scale works
        // out to screenWidth/1440 either way (0.5·W/720 === 0.4·W/576).
        REF_W_PORTRAIT: 720,
        REF_H: 778,
    },

    RESET_PROGRESS: false,
    DEBUG_HALF_LINE: false,  // draw a line splitting partA / partB (vertical in
                             // landscape, horizontal in portrait)
    DEBUG_PERF: true,        // log object / tween / timer / texture counts each
                             // time the world rebases (once per level). Climbing
                             // numbers = something is outliving its band
    BATTERY_START_LEVEL: 1,
    BATTERY_IMAGE_EXTENSIONS: ['svg', 'png', 'jpg', 'webp'],

    // BACKGROUND: {
    //     GRADIENT_START_COLOR: "#79d288",
    //     GRADIENT_END_COLOR: "#79d288",
    // },
     BACKGROUND: {
        GRADIENT_START_COLOR: "#B6915c",
        GRADIENT_END_COLOR: "#B6915c",
    },

    // ── Task list ─────────────────────────────────────────────────────────────
    // Every field is a job with a name and a number. A small list sits at the top
    // left of the FARM half showing two of them: the one being dug, and the one
    // after it greyed out. Finishing a field ticks its row, drops it, promotes the
    // next one and brings a fresh one in below — so the player always sees where
    // they are and what is coming, and the level ending gets a beat of its own
    // before the camera moves on.
    TASKS: {
        ENABLED: false,            // hidden for now — the panel, the tick and the
                                   // list shuffle all still work, they just are
                                   // not built. Flip to true to bring it back
                                   // (the level's ending beat comes back with it)
        TOTAL:   65,               // shown as "1/65"; the run's length
        NAMES: [
            "Jenny's Tomatoes", 'Golden Grove', 'Grape Grove', 'Redberry Farm',
            'Crimson Fields', 'Mango Haven', 'Vine Valley',
        ],
        FALLBACK: '<no name>',     // past the end of NAMES

        // Geometry, px at design scale (they ride the layout's uniform scale).
        PAD:      14,              // inset from the farm half's top-left corner
        WIDTH:    250,             // panel width
        ROW_H:    36,
        COUNT_W:  52,              // the "1/65" column
        COUNT_SIZE: 15,
        NAME_SIZE:  17,
        TICK_R:   11,              // tick ring radius
        TICK_W:   2.5,             // ring thickness

        BG_COLOR:  '#14200f',
        BG_ALPHA:  0.42,
        BG_RADIUS: 10,
        TEXT_COLOR: '#ffffff',
        DIM_ALPHA: 0.45,           // the not-yet-started row
        DONE_COLOR: '#8ce87a',     // ring + check once the field is finished

        // The ending beat, in order.
        TICK_MS:  420,             // the check springing in
        HOLD_MS:  320,             // beat before the list moves
        SHIFT_MS: 380,             // row leaving / promoting / new row arriving
        DEPTH:    20,              // over everything in the field
    },

    BUTTON: {
        SPAWN_WIDTH: 250,
        SPAWN_HEIGHT: 90,
        LEVELUP_WIDTH: 180,
        LEVELUP_HEIGHT: 70,
        LEVELUP_COLOR: "#FF6B9D",
        LEVELUP_BORDER_COLOR: "#E91E63",
        LEVELUP_BORDER_WIDTH: 4,
        BOTTOM_PADDING: 70,
        BUTTON_SPACING: 220,
        BATTERY_ICON_WIDTH: 64,
        BATTERY_ICON_HEIGHT: 64,
        BATTERY_ICON_X: -80,
        BATTERY_ICON_Y: 0,
        COIN_TEXT_SIZE: '32px',
        COIN_TEXT_X: 20,
        COIN_TEXT_Y: 0,
        COIN_ICON_WIDTH: 50,
        COIN_ICON_HEIGHT: 50,
        COIN_ICON_X: 80,
        COIN_ICON_Y: 0,
    },

    AD: {
        DURATION: 15,  // Duration of mock ad in seconds (countdown timer)
        OVERLAY_COLOR: "#000000",
        OVERLAY_ALPHA: 1.0,  // Fully opaque - blocks game view completely
        TIMER_TEXT_SIZE: '120px',
        TIMER_TEXT_COLOR: '#FFFFFF',
    },

    MERGE_GRID: {
        PADDING_FROM_BUTTON_TOP: 50,
        // Drop the whole grid block (panel, cells and — in portrait — the coin
        // line above it) by this much, closing the gap over the spawn button.
        // The panel art carries its own baked shadow well below the last row of
        // cells, so it may run into the button: that is fine, the button is
        // drawn at a far higher depth and covers it.
        PANEL_DROP: 30,                // px @ design scale
    },

    BATTERY_UNLOCK_DISPLAY: {
        DISPLAY_CROWN_PANEL: false,    // OFF — the crown + battery-name line above
                                       // the grid is gone. Everything below still
                                       // works if it is ever wanted back
        SHOW_CROWN_ICON: true,
        SHOW_BATTERY_ICON: false,
        CROWN_ICON_SIZE: 32,
        BATTERY_ICON_SIZE: 32,
        TEXT_SIZE: '24px',
        // TEXT_COLOR: '#FFD700',
        TEXT_COLOR: '#000000',
        // TEXT_STROKE_COLOR: '#8B4513',
        TEXT_STROKE_COLOR: '#000000',
        TEXT_STROKE_THICKNESS: 0,
        CROWN_BATTERY_SPACING: 10,
        BATTERY_TEXT_SPACING: 5,
        VERTICAL_OFFSET: 20,
        PADDING_FROM_LEFT: 10,
    },

    COIN_COUNTER: {
        ALIGN_WITH_GRID_ROW: 1,
        PADDING_FROM_SCREEN_RIGHT: 20,
        TEXT_SIZE: '48px',
        TEXT_COLOR: '#f7ca42',
        TEXT_STROKE_COLOR: '#7e5d11',
        TEXT_STROKE_THICKNESS: 6,
        COIN_ICON_WIDTH: 40,
        COIN_ICON_HEIGHT: 40,
        TEXT_ICON_SPACING: 10,
    },

    CELL: {
        SIZE: 130,
        GAP: 4,
        RADIUS: 15,
        EMPTY_BG_COLOR: "#c2d1e0",
        FILLED_BG_COLOR: "#eaf0f6",
        INSET_SHADOW_COLOR: "#364549",
        INSET_BORDER_WIDTH: 3.5,
        // Grain over the flat cell colour. graphics/cell_noise.png is neutral
        // grey with blurred noise, blended over the fill when the cell faces are
        // baked — so this is the same composite you would build in an image
        // editor, except the colour underneath stays a config value and one
        // grain file serves every face. A change here needs a reload.
        NOISE: {
            ENABLED:  true,
            BLEND:    'overlay',       // 'overlay' | 'soft-light' | 'multiply'
            CONTRAST: 2,               // stretch the tile before blending. The
                                       // file is blurred noise spanning only
                                       // ±18% around neutral grey, so without
                                       // this an editor-style 7% alpha lands
                                       // under a level of 255 — invisible
            ALPHA:    0.25,            // strength of the blend, AFTER contrast.
                                       // Felt rather than seen: ~2 levels of 255
                                       // on a light cell
            TILE:     1,               // 1 = tile stretched to the cell.
                                       // 0.5 = blown up 2× → coarser grain
        },
        BATTERY_DISPLAY_SIZE: 64,
        BATTERY_SCALE: 1.0,
        BATTERY_Y_OFFSET: 5,
        LEVEL_TEXT_SIZE: '11px',
        LEVEL_TEXT_COLOR: '#000000',
        LEVEL_TEXT_Y_OFFSET: -40,
        DRAGGABLE_BG_COLOR: "#FFFFFF",
        DRAGGABLE_BG_ALPHA: 0,
        GRID_PANEL_PADDING: 14,        // the panel is a drawn rounded square now,
                                       // so this is real padding around the cells
                                       // rather than the old art's baked margin
        GRID_PANEL_COLOR: "#ccd5d7",
        GRID_PANEL_RADIUS: 15,
        GRID_PANEL_BORDER_COLOR: "#364549",
        GRID_PANEL_BORDER_WIDTH: 3,
    },

    SPAWN_ANIMATION: {
        INITIAL_SCALE_X: 1.15,
        INITIAL_SCALE_Y: 0.85,
        STRETCH_SCALE_X: 0.9,
        STRETCH_SCALE_Y: 1.1,
        STRETCH_DURATION: 150,
        BOUNCE_SCALE_X: 1.05,
        BOUNCE_SCALE_Y: 0.975,
        BOUNCE_DURATION: 100,
        SETTLE_DURATION: 80,
    },

    POINTER: {
        TUTORIAL_ENABLED: false,       // set true just before shipping — the start mask +
                                       // spawn-button pointer are off during development
        SCALE: 1,
        FILL_COLOR: "#ffd251",
        STROKE_COLOR: "#6d5727",
        STROKE_WIDTH: 3,
        OFFSET_Y: 20,
        ANIMATION_MOVE_UP: 12,
        ANIMATION_SCALE_DOWN: 0.9,
        ANIMATION_DURATION: 200,
        ANIMATION_YOYO: true,
        ANIMATION_REPEAT: -1,
        TUTORIAL_START_DELAY: 500,
        TUTORIAL_FADE_DURATION: 500,
        TUTORIAL_MASK_COLOR: "#000000",
        TUTORIAL_MASK_OPACITY: 0.75,
    },

    MERGE_TUTORIAL: {
        ENABLED: false,                // set true just before shipping — the swap-to-merge
                                       // hand animation is disabled during development
        POINTER_OFFSET_Y: 50,
        ANIMATION_DURATION: 1000,
        ANIMATION_REPEAT: -1,
        ANIMATION_EASE: 'Sine.easeInOut',
    },

    COIN_REWARD_ANIMATION: {
        COIN_COUNT: 6,
        REWARD_COIN_SIZE: 40,          // Match coin icon size for better visibility
        TOP_SPEED_DURATION: 600,
        SPEED_VARIATION: 0.15,
        STAGGER_DELAY: 50,
        INITIAL_STACK_OFFSET: 0,
        DELAY_BEFORE_FLY: 100,        // ms to wait after gadget disappears before coins fly
        EASE: 'Power2',
    },

        // Platform stripes (top half) with battery slot on left, gadget on right
    // ── Battery slots ─────────────────────────────────────────────────────────
    // Three slots in one battery-shaped case. In LANDSCAPE they sit in the UI
    // half above the grid; in portrait they stay at the foot of the farm half.
    // The slot SIZE is derived, not set: the three take the row's full width
    // less the gaps, capped at ONE GRID CELL — a battery in a slot should look
    // like a battery in a cell. (See createSlots / calculateLayout.)
    PLATFORM: {
        SLOT_SIZE: 130,                // reference slot square (px) — the ratio
                                       // every slot-derived size is measured in
        SLOT_RADIUS: 15,               // corner radius (px)
        CHARGE_RATE_GAP: 10,           // gap (px) between charge-rate label bottom and slot top
        CHARGE_RATE_BOLT_SIZE: 18,     // bolt icon display size (px)

        BATTERY_CASE: {
            ENABLED: true,
            PAD:      8,               // case wall → cell (px @ design)
            STROKE:   4,               // case outline thickness
            RADIUS:   14,              // case corner radius
            DIVIDER_W: 3,
            DIVIDER_INSET: 0.14,       // how far short of each wall a divider
                                       // stops, as a fraction of case height.
                                       // Long enough to divide, never touching —
                                       // a divider that meets the wall reads as
                                       // three boxes instead of one battery
            NODE_W:   14,              // the terminal sticking out on the right
            NODE_H:   0.38,            // as a fraction of the case height
            NODE_GAP: 4,               // gap between the case and its terminal, so
                                       // the node reads as a separate piece
            NODE_RADIUS: 5,
            COLOR:      "#364549",     // outline, dividers and terminal
            FILL_COLOR: "#c2d1e0",     // inside the case
            FILL_ALPHA: 0,             // 0 = the case is an outline only. A wash
                                       // across all three divisions reads as one
                                       // slab; leaving it clear lets an OCCUPIED
                                       // division be the only thing with a
                                       // background, which is the signal
        },

        SLOT_ROW_EDGE_PAD: 12,         // least margin each side of the battery,
                                       // which is centred on the half (px @ design)

        // A ghost of the trencher laid inside the battery case — the batteries
        // and the machine they drive read as one object. Same two sprites and
        // same spacing as the field rig (ROAD.TUNNEL.TRENCHER), turned a quarter
        // turn right and scaled so the whole rig spans the case's width.
        TRENCHER_DECO: {
            ENABLED:  true,
            ALPHA:    0.4,
            ANGLE:    -90,             // quarter-turn LEFT: the rig's nose (north
                                       // in the field) points away from the
                                       // terminal, so the belt sits at the
                                       // terminal end. Both the sprites and which
                                       // part is where follow this one number
            LEN_FRAC: 0.64,            // rig length as a fraction of the case width
            DEPTH:    2.7,             // under the case outline (2.8) and the
                                       // occupied divisions (3)
        },

        // Battery icons pulse once per charge tick — the same tick that arms the
        // machine's work burst, which is what makes the two read as one system.
        BATTERY_PULSE_SCALE: 0.6,      // scale the icon springs to
        BATTERY_PULSE_DURATION: 80,    // ms, one way
    },

    // ===================================================================
    // CAR + INCLINE (right-half pivot: batteries charge a car that climbs)
    // ===================================================================

    // ===================================================================
    // ROAD (right-half pivot: congested traffic above the battery slots)
    // ===================================================================
    // Vertical roads running from just above the 3 battery slots up off the top
    // of the screen, laid out side by side. Cars follow the one ahead in their
    // lane so they bunch up like real traffic instead of overlapping, and are
    // recycled through a shared pool once they leave the road.
    //
    // Framed from 4.5× the height of the first pass: every on-screen size and speed
    // below is scaled down to match, so the road reads as thinner and the cars
    // smaller/slower without the traffic behaviour changing. Note this is a
    // hand-scaled framing, not a camera — these numbers are the only "zoom" there
    // is. The road's LENGTH is not part of it: top and bottom are pinned to partB
    // and the battery slots, so zooming out shrinks the scenery and reveals more
    // straight road rather than shortening it. STRIPE_WIDTH is deliberately held
    // back from scaling (see below).
    // ── The land in partB, and the canal being dug up the middle of it ────
    // Batteries power one boring machine. It parks at the head of the canal
    // already built at the foot of the band and digs upward through the green
    // land; water follows it up the cut. When it reaches the top of the band
    // the next band is generated above and the camera rides up to it.
    ROAD: {
        ENABLED: true,             // master switch — when true, partB shows the land

        BOTTOM_MARGIN: 0,          // gap left below the land band (px @ platformScale).
                                   // The band is the whole farm half in landscape;
                                   // in portrait the slots at the foot of the half
                                   // are subtracted first, and this is on top of that
        LAND_COLOR:   0x8ed04f,    // the green ground the channel is cut through

        // ── Tile map (authored in Tiled) ───────────────────────────────────
        // The landscape band is drawn from a Tiled level: one SPRITESHEET of
        // 128px frames, placed on a grid. The .tmj stores the grid of gids
        // (tile numbers); TILES below gives each gid its meaning, since a bare
        // spritesheet carries no per-tile data.
        TILEMAP: {
            ENABLED: true,

            // ── THE LEVEL ROTATION — edit this list ───────────────────────
            // One entry per level, in PLAY ORDER; the run loops at the end.
            // FILE is the Tiled map. Anything else on the entry is that level's
            // own data — see PONDS below.
            //
            // Maps may have different row counts. A band is always the full
            // height of the farm half; a map with fewer rows is anchored to the
            // BOTTOM of its band and the strip left above it is filled with
            // plain ground, so short levels read as a field with open land
            // beyond it rather than leaving a hole between levels.
            LEVELS: [
                 {
                    FILE: 'level_maps/level_03.tmj',
                    // Which pond art this level's markers stand for. The KEY is
                    // the marker's position in markers.tsx (see MARKERS), so the
                    // same two markers mean different ponds in different levels
                    // — paint pond A, decide here which pond it is.
                    PONDS: { 1: 'pond1_dry', 2: 'pond2_dry' },
                },
                { FILE: 'level_maps/level_01.tmj' },
                { FILE: 'level_maps/level_02.tmj' },
               
            ],
            FILE:    'level_maps/level_01.tmj',   // fallback when LEVELS is empty

            // ── Markers ──────────────────────────────────────────────────
            // A map that references MARKER_TILESET is painting MARKERS: tiles
            // that mean something to the code and are never drawn. What they
            // mean comes from their POSITION in that sheet (0 = first tile,
            // reading left to right, top to bottom), NOT from their gid — gids
            // shift whenever any earlier tileset changes size, positions never
            // do. The sheet is found by name in the map, so its firstgid is
            // whatever Tiled made it.
            //
            // APPEND ONLY: add new markers at the end of markers.tsx. Inserting
            // or reordering re-numbers everything after it.
            MARKER_TILESET: 'markers.tsx',
            MARKERS: [
                'crop',        // 0
                'pond_a',      // 1
                'pond_b',      // 2
            ],
            POND_LAYER: 'pond',            // marker layer the ponds are painted on
            POND_DIR:   'graphics/pond/',  // where the pond art lives

            // ── Filling a pond ───────────────────────────────────────────
            // A level names the DRY art (PONDS above); the filled version is the
            // same file with WATER_SUFFIX in place of DRY_SUFFIX, so one name
            // covers both. The water appears when the trench draws level with
            // the pond's middle row, starts at START of full size and grows one
            // step per STEP_MS until it fills the bed.
            POND_FILL: {
                DRY_SUFFIX:   '_dry',
                WATER_SUFFIX: '_water',
                START:    0.1,     // size it appears at, as a fraction of full
                FILL_MS:  10000,   // centre to banks, one continuous spread
                // The water arrives at a steady rate, so the AREA grows evenly
                // and the shoreline is its square root — fast at first, slowing
                // as each further ring of bank takes longer to reach. That is
                // what makes it read as water rather than a growing picture, and
                // why there is no bounce here: an overshoot would be the pond
                // spilling past its banks and sucking back.
                // The inflow's shape. Thin water spreads across the bed easily,
                // so the area grows at a steady rate up to AREA_KNEE; past that
                // the banks are met and further water adds DEPTH rather than
                // ground, so the last of the area arrives slowly.
                AREA_KNEE:  0.8,      // area covered before it starts to slow
                TAIL_POWER: 2,        // how hard the tail slows (2 = quadratic).
                                      // The knee's moment in time is derived from
                                      // these two so the pace changes smoothly —
                                      // there is no third number to keep in sync

                // Shallow to deep. SHALLOW_COLOR is the colour the water ART is
                // painted at — a tint can only darken, so the art has to start
                // as the lightest state it will ever have. The code multiplies it
                // down toward DEEP_COLOR as the pond fills; red falls fastest,
                // which is what depth does to light.
                SHALLOW_COLOR: '#85C0B2',   // what pondN_water.png was exported at
                DEEP_COLOR:    '#2B8C9E',   // where it lands, full
                TINT_RATE:     3,     // how sharply it gets there. Absorption is
                                      // exponential, so the shift is quick early
                                      // and asymptotic late — higher = deep sooner

                // Thin water is see-through: the bed shows through the first
                // shallow spread and is buried as the pond deepens. Ease-out, so
                // most of the opacity arrives early and the last of it creeps —
                // the pond has settled visually before it stops spreading.
                ALPHA_FROM:  0.05,    // opacity when the water first appears
                ALPHA_POWER: 3,       // 1 = linear, 3 = ease-out cubic, higher =
                                      // opaque sooner
                DEPTH:    1.46,    // on the dry bed (1.45), under the canal

                // ── The flow over it ─────────────────────────────────────
                // <pond>_flow.png, run outward from the centre on a loop while
                // the pond is filling: water still arriving. Greyscale art, so
                // it takes the water's colour. It stops when the pond is full —
                // a still pond should be still.
                FLOW: {
                    ENABLED:  true,
                    SUFFIX:   '_flow',
                    RINGS:    2,       // copies, evenly spread around the cycle,
                                       // so one leaves the centre as another
                                       // reaches the bank
                    CYCLE_MS: 3200,    // centre to bank, one ring
                    START:    0.05,    // size it leaves the centre at
                    ALPHA:    0.5,     // at mid-journey; it swells from nothing
                                       // and is spent by the time it arrives
                                       // Once the pond is full, rings already on
                                       // their way finish the journey and are not
                                       // sent out again — their own alpha curve
                                       // takes them to nothing at the bank, so
                                       // nothing is ever cut off mid-water.
                    DEPTH_OFFSET: 0.005,   // just over the water
                },
            },
            SHEET:   'graphics/tilesheets/canals.webp',
            FRAME:   128,           // frame size in the sheet
            MAIN_TILES: 2,          // the main canal is this many tiles wide

            // ── Terrain sheet ───────────────────────────────────────────────
            // Everything that is NOT a canal piece: the plain ground, the flat
            // water the flow head is drawn from, and the two growth overlays.
            // The canal sheet now carries only canal tiles (gid ≤ 53); nothing
            // reads past that. 5 columns × 4 rows of 128px frames, so a frame
            // is (row-1) * 5 + (col-1).
            TERRAIN: 'graphics/tilesheets/terrain.webp',
            TERRAIN_GROUND: 0,      // row 1, col 1 — the field's base tile
            TERRAIN_WATER:  1,      // row 1, col 2 — flat water; the flow head
                                    // and its foam blobs are cut from this

            // ── Crops ───────────────────────────────────────────────────────
            // A crop grows on every field (grass) cell. Its seed shows from the
            // start; when the water reaches the cell's NEAREST canal cell it
            // grows through the stages, one every CROP_GROW_MS. Art is one
            // sheet per crop at graphics/crops/<name>.png: a single row of
            // CROP_STAGES frames, each 128x256, sliced at build.
            // The crop changes per level, cycling through CROP_CYCLE in order
            // and wrapping — level 1 tomato, 2 mango, 3 grape, 4 tomato again.
            // All levels share the one level_01 layout, so the crop is what
            // makes each field read as a different farm. Add a sheet to
            // graphics/crops/ and its name here to extend the rotation.
            // ── THE CROP ROTATION — edit this list, nothing else ──────────
            // File names in graphics/crops/, in PLAY ORDER: entry 1 is level 1,
            // entry 2 is level 2, and it wraps at the end. Any image type works;
            // a bare name with no extension is read as .png.
            //
            // Adding a crop:   drop the sheet in graphics/crops/, add its file
            //                  name here.
            // Testing a crop:  move it to the FRONT — it plays on level 1 instead
            //                  of waiting for the rotation to come round.
            // Every sheet is one row of CROP_STAGES frames of equal width.
            CROP_CYCLE: [
                'grass2.webp',
                'grass.webp',
                'tomato.png',
                'mango.png',
                'grape.png',
                
            ],
            CROP:         'tomato.png',  // fallback when CROP_CYCLE is empty
            CROP_STAGES:  5,
            CROP_GROW_MS: 2000,     // time between growth stages
            CROP_WET:     0.15,     // canal-cell fill fraction that counts as "watered"

            // A patch of worked soil under each plant (graphics/plant-base.png),
            // centred on the stem base and drawn UNDER the plant — and under
            // every other plant too, so a base can never cover the crop in front
            // of it.
            CROP_BASE: {
                ENABLED: true,
                SIZE:    0.8,       // width as a fraction of a tile
                ALPHA:   1,
                Y:       0,         // nudge down (+) or up (-), in tiles
            },

            // ── Per-plant variation ──────────────────────────────────────
            // One crop sheet stamped across a field reads as wallpaper. These
            // break that up WITHOUT moving anything: a plant stays dead centre
            // in its cell, so the rows stay ruler-straight. Every value is drawn
            // from a hash of the cell, not Math.random(), so the field looks
            // identical each time the scene is rebuilt (it rebuilds on every
            // window resize).
            CROP_VARY: {
                FLIP:      true,    // mirror half the plants. Safe for this art —
                                    // its shadow is centred under the stem, so a
                                    // flip does not light it from the wrong side.
                                    // Re-check that before swapping the art
                SCALE_VAR: 0.04,    // ± size spread. Applied to the plant's CACHED
                                    // scale, so the stage-change spring settles
                                    // back to this plant's size, not a shared one
                GROW_VAR:  0.18,    // ± spread on how long each stage takes. The
                                    // strongest of the three: a patch that hits
                                    // every stage in lockstep is what really
                                    // reads as stamped
                ROT_DEG:   0,       // ± tilt about the stem base. 2-3 is plenty
                                    // if the field still looks too regular
            },
            // Each new stage after the seed springs up instead of popping in:
            // the frame swaps, then y-scale eases from CROP_POP_FROM to full.
            // Sprites are bottom-anchored, so this reads as growing upward.
            CROP_POP_FROM: 0.9,     // starting y-scale fraction (1 = no animation)
            CROP_POP_MS:   260,     // spring duration
            // Where the plant's STEM meets the ground, as a fraction of the
            // frame height. Not 1: the art carries a blurred elliptical shadow
            // below the stem, so the stem base sits 230px down a 256px frame
            // with the shadow filling the rest. This is the sprite's origin, so
            // it is the stem — not the frame's bottom edge — that lands on the
            // cell centre, and the growth spring pins there too.
            CROP_STEM_Y: 230 / 256,
            // The ground under a plant changes as it matures. Each entry ADDS a
            // transparent perlin overlay on top of the map's own ground tile —
            // nothing is replaced and nothing is removed, so by the last stage a
            // cell is ground + damp + grass, all three visible. `frame` is a
            // tilesheet FRAME index (not a map gid); the key is the crop stage
            // that adds it. Cells with no crop are never touched.
            //
            // Blend modes differ on purpose:
            //   MULTIPLY for damp — wet soil is the SAME soil darkened, so
            //     multiplying keeps the ground's grain showing through and
            //     adapts to whatever ground tile sits below it
            //   NORMAL for grass — grass is new material lying on the soil,
            //     not a darkening of it, so it should cover rather than tint
            // Frames are on the TERRAIN sheet, not the canal one. `frame` is the
            // FIRST of six consecutive edge variants — see CROP_OVERLAY_EDGES.
            CROP_OVERLAY: {
                2: { frame: 12, blend: 'MULTIPLY', alpha: 1 },   // damp  — row 3
                4: { frame: 18, blend: 'NORMAL',   alpha: 1 },   // mossy — row 4
            },
            // Each overlay is drawn with a RAGGED edge where it borders bare
            // ground and a straight one where it meets another overlay cell, so
            // a patch gets an organic outline and a seamless interior. The six
            // variants run left to right from the base frame; this lists which
            // sides each draws ragged, as an N/E/S/W bitmask (N=1 E=2 S=4 W=8):
            //   inner=0  n=1  ne=3  ns=5  nes=7  nesw=15
            // All 16 possible situations are covered by ROTATING one of these.
            // No flipped versions are needed, and a flip would mirror the
            // organic noise into a visible reflection.
            CROP_OVERLAY_EDGES: [0, 1, 3, 5, 7, 15],
                                    // (the flow head's water now comes from
                                    // TERRAIN_WATER above, not the canal sheet)
            SPLIT_AT:     0.3,      // how far the water must get into a junction
                                    // tile before a side branch starts, as a
                                    // fraction of the tile. 0.5 = the tile's
                                    // centre; lower starts the branch sooner, so
                                    // the water is seen to divide while it is
                                    // still crossing rather than looking held
                                    // back until the tile is full
            // ── Bank shimmer ────────────────────────────────────────────────
            // Once a cell has finished filling, a few small light streaks sit
            // just inside the water at its edges and slowly fade up and down.
            // It is the settled water's only animation and it does most of the
            // work of making a still canal look alive — cheap, because the
            // streaks never move: only their brightness changes.
            MARK_ENABLED: true,
            // Two rows of streaks per bank. The outer row sits against the
            // water's edge and carries the effect; the inner row is a sparse
            // scatter a little further in, which stops the outer one reading as
            // a line ruled down the bank. Each entry: how far out as a fraction
            // of the channel's half width (1 = on the water's edge, 0 = the
            // centreline), the chance any one arm-side gets a streak, and the
            // streak's size as fractions of a tile.
            // Insets leave clear water on BOTH sides of each row: the outer row
            // stands off the bank rather than hugging it, and the inner row
            // stands off the outer one. Streaks touching the bank read as an
            // edging painted on the canal instead of light floating on it.
            // Insets are measured to the streak's CENTRE, so its own thickness
            // eats into the gaps either side of it. Budget across the channel's
            // half width (0.225 tile), from the bank inward:
            //   bank → 0.030 clear → row 1 (0.055 thick) → 0.040 clear →
            //   row 2 (0.045 thick) → the rest is open water to the centreline
            // Thin rows are what make room for the gaps to be visible at all —
            // there is only ~10px of half-channel on screen to work with.
            MARK_LAYERS: [
                { inset: 0.74, chance: 0.34, len: 0.60, thick: 0.055 },
                { inset: 0.34, chance: 0.13, len: 0.36, thick: 0.045 },
            ],
            // STEPPED, not smooth. Every value below snaps between a handful of
            // fixed states and holds, the way a hand-drawn pixel animation
            // cycles frames — no easing, no interpolation. Brightness, drift and
            // colour each run their own cycle at their own rate, so a streak
            // rarely changes two things at once and the field never falls into
            // a visible rhythm.
            MARK_MIN:     0.15,     // dimmest state — never fully off
            MARK_MAX:     0.70,     // brightest state
            MARK_LEVELS:  4,        // how many brightness states to snap between
            // Cycle times are for a WHOLE cycle, and a cycle is several steps —
            // brightness at 4 levels is 6 steps up and back, so a 5s cycle
            // holds each state for a bit over 800ms. That slowness is the
            // point: a stepped animation that changes quickly reads as flicker.
            MARK_MS_MIN:  4000,     // time for one full brightness cycle,
            MARK_MS_MAX:  7000,     // randomised per streak
            MARK_FADE_MS: 500,      // ease-in when a cell first settles (the one
                                    // deliberately smooth part — a streak that
                                    // popped into existence would read as a bug)
            MARK_DRIFT:   0.03,     // lateral travel ALONG the bank, fraction of
                                    // a tile — the extreme of the jump, not a
                                    // smooth slide
            MARK_DRIFT_STEPS: 3,    // discrete positions: back, centre, forward
            MARK_DRIFT_MS: 6000,    // one full drift cycle, per streak ±25%
            // Snaps between these in order and back again. Never pure white —
            // that reads as UI rather than as light on water.
            MARK_COLORS: [0xeaf6fb, 0xbfe8f7, 0x9fdcf2],
            MARK_COLOR_MS: 7500,    // colour cycle, deliberately out of step
                                    // with the brightness so they never align
            // Measured off the art, NOT the same as CHANNEL_FRAC below: the
            // painted water spans ~0.45 of a tile in a branch tile, and the
            // main canal's outer water edge sits ~0.19 tile from each of its
            // two columns' centres. Streaks are placed against these.
            MARK_CHAN:    0.45,     // painted branch water width, tile fraction
            MARK_MAIN:    0.19,     // main canal outer edge, from cell centre
            CHANNEL_FRAC: 0.5,      // water-channel width as a fraction of a tile
                                    // (the gap between the banks in the art). The
                                    // head is sized to this so it fits the walls;
                                    // the 2-wide main gets (mainW-1+frac) tiles,
                                    // since only its two OUTER walls eat in
            HEAD_FIT: 0.94,         // head width × this, so it sits just inside the
                                    // banks and the art's white waterline still
                                    // shows around it
            HEAD_LEN: 0,            // the head's WATER bulge (the body behind the
                                    // foam), measured ALONG the flow, as a fraction
                                    // of the channel width. Across the channel it
                                    // always spans the full width — this only
                                    // shortens how far it reaches forward, i.e. how
                                    // far the drawn front runs ahead of the water
                                    // that has actually been revealed
            // The front is TWO rounded clusters, both drawn BEHIND the revealed
            // water tile (depths 1.525 / 1.53 vs the tile's 1.55), so each is
            // clipped by the tile and only the part poking past its straight
            // crop edge is seen:
            //   • white blobs  — the foam crest, straddling the reveal edge so
            //     half sits on revealed water and half runs ahead of it
            //   • water blobs  — the same cluster copied FOAM_WATER_BACK behind
            //     the white one, so a curved water edge shows between the foam
            //     and the tile instead of the tile's straight cut
            // Opacity of the moving front. The trencher's belt sits just under
            // these (see TUNNEL.TRENCHER depths), so knocking them back lets
            // the machine read THROUGH the water rolling over it. Applied when
            // a pooled sprite is first created — like FOAM_ABOVE, a change
            // takes a reload, so the display list is never dirtied per frame.
            // Where the MAIN canal's water sits in the stack. Above the crops
            // (~3.02) so the trencher can be drawn over the whole field and
            // still run under its own water. Branch water is unaffected — it
            // stays down in the ground layers, where a leaf overhanging a ditch
            // is meant to cover it.
            MAIN_WATER_DEPTH: 3.10,

            HEAD_ALPHA:  0.75,      // the head — the water tongue at the front
            CREST_ALPHA: 0.75,      // the foam crest blobs (white + water copy)
            FOAM_ABOVE: false,      // draw the crest ABOVE the revealed tile
                                    // (1.56/1.565) instead of below it
                                    // (1.525/1.53). Above, the whole blob shows
                                    // and rides over the revealed water instead
                                    // of being cut by its straight edge
            FOAM_WATER: true,       // draw the trailing water-textured copy
            FOAM_WATER_BACK: 0.0625, // how far behind the white cluster it sits.
                                    // Smaller = the water copy rides further
                                    // forward over the white one, leaving a
                                    // thinner rim of foam showing at the crest
            // Crest shape, all in units of the channel width. The leading tip
            // sits FOAM_FWD + FOAM_ARC + FOAM_ACROSS*FOAM_LONG/2 ahead of the
            // revealed water edge.
            FOAM_LONG:   2.0,       // blob stretch ALONG the flow (NOT across —
                                    // that is FOAM_ACROSS). Long enough that the
                                    // blob's tail always runs back UNDER the
                                    // revealed tile: as the crest animates, a
                                    // short blob leaves a bare gap between itself
                                    // and the tile edge and the front breaks into
                                    // pieces. With the tail buried there is no
                                    // gap to see and the front reads as one mass
            FOAM_ARC:    0.30,      // depth of the forward bow at the channel
                                    // centre — this is the arc itself, keep it
            FOAM_FWD:   -0.40,      // whole cluster shifted ahead of the edge.
                                    // NEGATIVE pulls it back. Holds the leading
                                    // tip at 0.40*chW: the blob grew by 0.25 at
                                    // BOTH ends, so this cancels the forward half
                                    // and spends the whole gain on the buried tail
            FOAM_ACROSS: 0.5,       // blob diameter across the channel
            FOAM_EDGE_CALM: 1,      // how much the churn is damped toward the two
                                    // banks. 1 = the outermost blobs never move
                                    // or shrink, so the foam stays welded to both
                                    // walls while the middle still churns.
                                    // 0 = every blob animates equally (old look,
                                    // where the ends pull back off the wall and
                                    // the water looks briefly detached from it)
            FOAM_SPREAD: 0.35,      // how far out the outermost blob centres sit
                                    // from the channel centre. Raise it if the
                                    // foam still fails to reach the walls
            FLOW_OFFSET: 1,         // the water-FILLED version of a tile sits this
                                    // many frames after it in the sheet (dry then
                                    // wet, left→right, top→bottom)
            FLOW_SPEED: 0,          // branch-water speed (px/s @ platformScale).
                                    // 0 = match the main canal (WATER.MIN_SPEED)
            END_FILL: 0.8,          // a dead-end tile's channel closes inside it,
                                    // so water fills only this fraction of the
                                    // tile (up to the closing), not the full edge
            HEAD_END_STOP: 0.5,     // on a dead-end tile the head stops at this
                                    // fraction (its foam would otherwise bulge
                                    // over the rounded closing); the water still
                                    // fills quietly on to END_FILL

            // Layer order in the .tmj, bottom to top. Every level map carries
            // these four, named exactly this. GROUND and BRANCH are drawn as
            // soon as the band is built; MAIN is held back and revealed as the
            // auger digs. CROPS is a MARKER layer — never drawn, it only says
            // which cells grow a crop, one plant at each marked cell's centre.
            // Any gid works as the marker (only non-zero is tested).
            GROUND_LAYER: 'ground',        // plain land, under everything
            BRANCH_LAYER: 'branch',        // dry branch canals (always shown)
            MAIN_LAYER: 'main',            // main canal, revealed as it's dug
            CROPS_LAYER: 'crops',          // marker only — where crops spawn

            // gid → meaning. The gid is the number Tiled shows when you hover a
            // tile. conn = open edges (any of n/e/s/w). main = 'L'/'R' half of
            // the 2-wide main canal (main-canal tiles only). Tiles with no entry
            // (e.g. grass 55) are treated as non-canal.
            TILES: {
                // main canal (on the main_canal_dry layer)
                33: { conn: 'ns',  main: 'L' },   // main-left straight
                51: { conn: 'ns',  main: 'R' },   // main-right straight
                35: { conn: 'nsw', main: 'L' },   // main-left + west branch
                49: { conn: 'nse', main: 'R' },   // main-right + east branch
                // branches (on the base layer)
                3:  { conn: 'ews' },              // T, branch down
                5:  { conn: 'ew'  },              // horizontal
                13: { conn: 'enw' },              // T, branch up
                15: { conn: 'ns'  },              // vertical
                19: { conn: 'nw'  },              // corner
                23: { conn: 'e'   },              // west end (opens E)
                25: { conn: 'n'   },              // vertical end (opens N)
                27: { conn: 's'   },              // vertical end (opens S)
                29: { conn: 'w'   },              // east end (opens W)
            },
        },

        // ── The channel ───────────────────────────────────────────────────
        CANAL: {
            WIDTH:       40.8,     // channel width (px @ platformScale)
            HEAD_OFFSET: 108,      // the built canal's head — where the machine
                                   // parks and the dig starts — sits this far
                                   // above the band's centre line
        },

        TUNNEL: {
            ENABLED: true,

            // ── Digging ───────────────────────────────────────────────────
            PULSE_MS: 450,         // burst length: each 1s battery tick jolts the
                                   // machine — it spins and advances for this long,
                                   // then sits dead until the next tick
            ADVANCE_PER_CHARGE: 2, // px of digging banked per unit of battery charge
            MARGIN: 9,             // loose ground the bore takes beyond the channel
                                   // on each side (px @ platformScale)

            // ── The torn lip at the dig line ──────────────────────────────
            // graphics/cut-edge.png: flat along the bottom, broken along the top.
            // Its foot rides the reveal line and its ragged top overhangs the
            // ground still to be dug, so the cut never reads as a ruled edge —
            // while the reveal underneath stays a straight crop, which is what
            // the machine's whole position is measured from.
            CUT_EDGE: {
                ENABLED: true,
                SWAP_MS: 125,       // how often the lip changes shape WHILE the
                                    // machine is cutting. It freezes on its last
                                    // shape the moment the machine stops, so a
                                    // stalled dig has a still edge
                WIDTH_TILES: 2,     // the main canal's full 2-tile width
                HEIGHT_TILES: 0.52, // its OWN number, in tiles — otherwise
                                    // narrowing the lip flattens it to a line.
                                    // 0.52 is the thickness it had at full width.
                                    // Remove it to follow the art's aspect
                ALPHA:   1,
                Y_OFFSET: 0,       // nudge along the line, in tiles (+ = down)
                DEPTH:   2.16,     // over the ground and its cracks, under the rig
            },

            // ── The trencher ──────────────────────────────────────────────
            // A heavy trenching machine, drawn as TWO sprites that move as one
            // rig: the trenching unit (the spiked belt) straddles the reveal
            // line at the FRONT, the control unit trails behind it. They are
            // separate only so each part's AI-drawn frames stay coherent on
            // their own — never move one without the other.
            //
            // The machine works BACKWARDS: it drives up-screen with the control
            // unit LEADING, dragging the belt behind it — so along the canal the
            // belt is the part nearest the finished trench and the control unit
            // is the part farthest from it, out over untouched ground. Its
            // displacement is the reveal line's, nothing else — see
            // _updateTunnel.
            //
            // SIZING: one ratio does everything. The BELT's width maps onto
            // BELT_TILES tile widths; every other number below is source px of
            // the same art, scaled by that same ratio — so the two parts keep
            // their authored proportions and spacing at any tile size. At 1.5
            // the control unit comes out ≈2.28 tiles wide (396/260 × 1.5).
            TRENCHER: {
                FRAMES:     5,     // frames per part (belt1..5 / control_unit1..5)
                BELT_W:     260,   // trenching-unit art size (source px)
                BELT_H:     794,
                CTRL_W:     396,   // control-unit art size (source px)
                CTRL_H:     492,
                CTRL_GAP:   566,   // belt centre → control centre, AHEAD of the
                                   // belt (source px, same ratio as the sizes):
                                   // the control unit leads, the belt trails at
                                   // the trench it is cutting
                BELT_TILES: 1.9,   // belt width in tile widths — the scale anchor
                                   // (the trenching unit spans 1.5 tiles; every
                                   //  other dimension follows from this)
                AHEAD_FRAC: 0.4,   // fraction of the belt's height sitting AHEAD
                                   // of the reveal line (uncut side); the other
                                   // 0.6 trails over the open trench
                BELT_FPS:   50,    // belt cycle speed  (calibrate)
                CTRL_FPS:   12,    // control-unit (wheel) cycle speed. The rig
                                   // travels at whatever the batteries pay for,
                                   // so this is what sets how far the wheels
                                   // appear to turn per px of travel
                FLIP_Y:     false, // the dig runs UP the screen; flip both parts
                                   // if the art is drawn facing the other way
                                   // (flips the pair together — the offsets are
                                   //  measured from the reveal line either way)

                // ── Shadow ────────────────────────────────────────────────
                // graphics/trencher/shadow.png is ONE shadow for the whole rig
                // (454×1266 in the same source-px space as the two parts), so
                // it needs no size of its own — it rides the same ratio as
                // everything else. It never animates; it just travels with the
                // machine.
                // Placed in two steps, exactly as it was authored: put the
                // image's CENTRE on the dig line + SHADOW_Y, then slide it by
                // the offset. Both steps are source px on the same ratio.
                SHADOW_Y:     -80, // step 1: centre, +y from the dig line
                SHADOW_OFF_X: 40,  // step 2: the authored 46,31 offset
                SHADOW_OFF_Y: 15,
                SHADOW_ALPHA: 1,   // the art carries its own softness; this is
                                   // just a global knock-back if it reads heavy
                DEPTH_SHADOW: 3.05,   // under both parts, over the crops

                // ── Water vs. the machine ─────────────────────────────────
                // The canal water follows the trencher and washes OVER the
                // belt: the belt is down IN the trench it is cutting, so the
                // filling water covers its trailing end rather than the belt
                // sitting on top of a dry-looking canal.
                WATER_OVER: 0.35,  // how far up the belt the waterline is let
                                   // come, as a fraction of the belt's height
                                   // measured from its REAR edge. 0 = water
                                   // stops at the belt's back edge; (1 -
                                   // AHEAD_FRAC) = water right up to the
                                   // reveal line
                // Draw order: the machine sits ABOVE every ground element — the
                // canal tiles, the crops and their soil patches (which reach
                // ~3.02) — and BELOW the main canal's water, which was raised to
                // TILEMAP.MAIN_WATER_DEPTH to make both true at once. So the
                // whole rig travels over the field, and the water it lets in
                // still washes over the belt behind it. Both parts sit in the
                // same band; the belt stays just above the control unit.
                DEPTH_BELT: 3.07,
                DEPTH_CTRL: 3.06,
            },

            // (the last dry stretch is flooded by the water's own flow — see
            //  WATER.FLOW_TAU / MIN_SPEED, not a timed animation)

            // ── Colours ───────────────────────────────────────────────────
            // (machine look comes from graphics/trencher/)
            CUT_COLOR:     0x84694a,  // raw soil exposed in the cut under the
                                      // machine, before the water reaches it
            // ── Spoil thrown clear ────────────────────────────────────────
            // The belt carries what it digs up out of the hole and flings it to
            // both sides. Two flat fans from the belt's lower end, each grain
            // gone before it lands — no heap, because a growing ridge would
            // either bury the canal it frames or need authoring per tile.
            // ── Spoil thrown clear ────────────────────────────────────────
            // The belt carries what it digs out of the hole and flings it to both
            // sides. Two PARTICLE EMITTERS, one per side — not a sprite per grain:
            // at this density the emitter is the difference between a smooth frame
            // and a stuttering one on a budget phone.
            //
            // What makes it read as sand rather than smoke: it is thrown (speed +
            // gravity, so it arcs), it barely shrinks, it holds opacity until it
            // lands, and it never grows. Only DUST grows — see FACE below.
            SPRAY: {
                ENABLED:  true,
                QUANTITY: 3,       // grains per side, per emission
                EVERY_MS: 60,      // and how often — density is these two
                SPEED_MIN: 90,     // how hard it is thrown (px/s @ platformScale)
                SPEED_MAX: 260,
                GRAVITY:  420,     // the drop that turns a throw into an arc
                LIFE_MIN: 320,     // ms in the air
                LIFE_MAX: 620,
                OFFSET_Y: -12,     // from the CUT LINE, in the direction the rig
                                   // travels (negative = toward uncut ground)
                OFFSET_X: 0.22,    // out from centre, in rig widths
                SIZE:     2.0,     // grain scale against the debris texture
                SHRINK:   0.85,    // barely: sand does not shrink in flight
                DEPTH:    3.04,    // UNDER the machine (3.05–3.07), over the crops
            },

            // Grit and haze at the cutting face itself, falling back into the
            // trench rather than being thrown clear of it.
            FACE: {
                QUANTITY: 2,
                EVERY_MS: 45,
                SPEED_MIN: 20,
                SPEED_MAX: 90,
                GRAVITY:  260,
                SIZE:     1.1,
                DUST_EVERY_MS: 110,
                DUST_ALPHA: 0.45,
            },

            DEBRIS_COLORS: [0x6e4a21, 0xa97537],
                                      // spoil chip tints across the spray: the
                                      // first (dominant) fills the middle, the
                                      // last shades the chips at both ends
            CHIP_SIZE:     10,        // base size of a spoil chip (px). Chunky
                                      // squares — bumped up to read clearly
            DUST_COLOR:    0xa89878,  // soft dust cloud drifting off the cut

            // Cracks in the ground revealed just ahead of the blade. The pattern
            // is FIXED to the column; a short window near the face reveals it,
            // thick at the face and fading out over LEN.
            CRACK: {
                ENABLED: true,
                LEN:     52,          // reveal window ahead of the face (px @ platformScale)
                WIDTH:   0.5,         // crack spread as a fraction of the belt width
                LINES:   2,           // number of main cracks down the column
                COLOR:   0x3c2c1a,    // dark earth in the split
                ALPHA:   0.6,         // opacity at the face (fades to 0 over LEN)
                THICKNESS: 2,         // line thickness at the face (px @ platformScale)
            },
        },

        ENDLESS: {
            ENABLED: true,
            SETTLE_MS: 5000,       // how long the finished stretch stays on
                                   // screen before the camera moves on
            PAN_MS: 2500,          // camera travel time to the next dig site
        },

        WATER: {
            COLOR:      0x2f8fd0,  // the canal surface
            EDGE_COLOR: 0x7fd4f0,  // brighter shallows along each bank — a lit
                                   // rim that separates water from the earth wall
            EDGE_WIDTH: 2,         // width of that rim (px @ platformScale)
            LAG:        1.0,       // how much dry cut the blade keeps open ahead of
                                   // the water, in machine lengths. This is a LIMIT,
                                   // not a leash: 1 = the rig works on dry soil
            FLOW_TAU:   0.9,       // seconds for the level to close most of the gap
                                   // to that limit. This is what stops the water
                                   // reading as a strip towed by the auger — it
                                   // lingers behind a lurch and keeps creeping up
                                   // the cut after the machine has gone quiet.
                                   // Higher = lazier, more obviously flowing
            MIN_SPEED:  30,        // steady creep floor (px/s @ platformScale). The
                                   // exponential chase above would crawl to a halt
                                   // as it closes the last of the gap — this keeps
                                   // the final run to the mouth moving at the same
                                   // pace it had while chasing the blade
            FRONT:      12,        // length of the wavering leading edge
                                   // (px @ platformScale)
            FRONT_COLS: 7,         // fingers across that edge — each on its own
                                   // phase, so the front never repeats a shape
            FOAM_CAPS:  false,     // draw the blocky white caps on the finger tips.
                                   // Off: the main canal's front is left to the
                                   // rounded foam blobs of the tilemap head, so
                                   // there is no squared-off white tip
            FOAM:       4,         // white cap on the tip of each finger
                                   // (px @ platformScale) — blocky, following the
                                   // same columns as the front itself
            FOAM_COLOR: 0xdcf2fb,  // bluish white — white tinted toward the shallow
                                   // water (EDGE_COLOR), so the foam sits in the
                                   // water's palette rather than reading as pure white
            FOAM_ALPHA: 0.9,
        },

        // ── Lily pads ─────────────────────────────────────────────────────────
        // A few clusters of pads resting on the finished main canal. They never
        // travel — the water is a still channel, not a river — they only breathe:
        // a slow turn, a barely-there rock in place and an optional size pulse,
        // each pad on its own phase so the group never moves as one. That is what
        // sells "floating on water that is alive" without anything drifting.
        //
        // They appear only AFTER the water has passed, never on dry ground: a
        // main-canal cluster waits until the waterline is REVEAL_LAG past it, a
        // branch one until its own cell has filled.
        //
        // WHERE THE WATER IS. The main canal is two columns meeting at a shared
        // seam, and each of those tiles is MAIN_WATER water measured from that
        // seam outwards — the rest of the tile, on its OUTER side, is bank. So
        // the open water is one band straddling the seam, MAIN_WATER of a tile
        // to each side of it. A branch is a single tile with BRANCH_WATER of its
        // width running down its middle. Pads are pushed out toward a bank
        // (BANK_BIAS) rather than sitting on the centre line — pads gather at
        // the edges of real water, and the middle stays clear.
        LILY: {
            ENABLED: true,
            MAIN_WATER:   0.72,    // water share of ONE main tile, from the seam out
            BRANCH_WATER: 0.32,    // water share of a branch tile, centred
            BANK_BIAS:    0.85,    // how far toward the bank a cluster sits: 0 = on
                                   // the centre line, 1 = pad edge touching the bank
            CLUSTERS_MIN: 2,       // lilies on the MAIN canal per stretch
            CLUSTERS_MAX: 3,
            // The art comes in two kinds: lily1/lily2 are single pads, lily3/
            // lily4 are ready-made clumps. Nothing is assembled from singles —
            // each lily is ONE image. Singles are randomly rotated; clumps are
            // placed as drawn. A clump is COMBO_SCALE wider, being several
            // pads' worth of art in the one picture.
            COMBO_CHANCE: 0.45,    // odds a lily is a clump rather than a single
            COMBO_SCALE:  1.4,     // clump width vs. a single's
            SIZE:         0.67,    // single-pad width as a fraction of a tile
                                   // (height follows — the art keeps its aspect)
            SIZE_VAR:     0,       // ± random size spread per lily. 0 = every
                                   // lily of a kind is exactly this size
            MIN_GAP:      0.12,    // least spacing between lilies along the canal,
                                   // as a fraction of the stretch's length
            SPAN:        [0.08, 0.9],  // where clusters may sit along the stretch
            REVEAL_LAG:   1.2,     // how far past a cluster the waterline must be
                                   // before it appears, in tiles
            FADE_MS:      520,     // fade-in once revealed
            POP_FROM:     0.55,    // it pops in rather than appearing: starts this
            POP_MS:       620,     // size and springs up to full over POP_MS
            POP_EASE:     'Back.easeOut',   // the small overshoot at the end
            DEPTH:        1.57,    // above the water (1.55) and its head (1.56)

            // ── Branches ─────────────────────────────────────────────────────
            // One lily per branch, on a random cell of it. A branch channel is
            // barely a third of a tile wide, so it gets its own smaller size —
            // the main-canal size would not fit — and singles only: a clump is
            // wider than the whole branch channel.
            BRANCH:       false,   // OFF: a branch channel is a third of a tile
                                   // wide, so a pad in one is too small to read.
                                   // Set true to put them back — the placement
                                   // below still works
            BRANCH_SIZE:  0.24,    // single-pad width as a fraction of a tile
            BRANCH_COMBO: false,   // allow clumps in branches (they will overhang)

            // ── The breathing ────────────────────────────────────────────────
            // The whole point of the pads: still water reads as dead, so they
            // must never come to rest. All of these run forever, yoyoing, each
            // with its own duration and a random start delay so no two pads move
            // together. The lily stays where it was put — it wanders about that
            // spot, it does not travel.
            ROCK_DEG:     11,      // rock about the pad's own centre (degrees)
            ROCK_MS:     [1700, 2600],   // one way; randomised per pad
            DRIFT:        0.13,    // wander WITH and AGAINST the flow, as a
                                   // fraction of a tile — the give and take of
                                   // the current pushing at the pad
            DRIFT_CROSS:  0.05,    // the smaller sway across the channel. Kept
                                   // under DRIFT so the motion reads as being
                                   // along the water, not random jitter, and
                                   // capped at run time by the room the bank
                                   // leaves — a branch pad has almost none
            DRIFT_MS:    [1500, 2300],   // the two axes run at different rates on
                                   // purpose, so the path never repeats itself
            SCALE_AMP:    0.06,    // size pulse (0 = off) — the swell passing
                                   // under
            SCALE_MS:    [1300, 2100],
        },
    },
};

// -------------------------------------------------------------------
// Battery image helpers
// -------------------------------------------------------------------

var BATTERY_IMAGE_PATHS = {};

function checkFileExists(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload  = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
    });
}

// async function initBatteryImagePaths() {
//     if (typeof BATTERY_TYPES === 'undefined' || !BATTERY_TYPES) {
//         console.error('BATTERY_TYPES not found! Make sure batteryChargeData.js is loaded first.');
//         return;
//     }
    
//     // Get all battery levels from the new system
//     const highestLevel = getHighestBatteryLevel();
    
//     for (let level = 1; level <= highestLevel; level++) {
//         const batteryData = getBatteryData(level);
//         if (!batteryData) continue;
        
//         const path = `graphics/battery/${batteryData.fileName}`;
//         const ok = await checkFileExists(path);
        
//         if (ok) {
//             BATTERY_IMAGE_PATHS[level] = path;
//         } else {
//             console.warn(`Battery image not found: ${path} for level ${level} (${batteryData.displayName})`);
//         }
//     }
//     console.log(`Loaded ${Object.keys(BATTERY_IMAGE_PATHS).length} battery sprites`);
// }
async function initBatteryImagePaths() {
    if (typeof BATTERY_TYPES === 'undefined' || !BATTERY_TYPES) {
        console.error('BATTERY_TYPES not found! Make sure batteryChargeData.js is loaded first.');
        return;
    }
    
    // Build paths directly from BATTERY_TYPES - no network probing needed
    const highestLevel = getHighestBatteryLevel();
    
    for (let level = 1; level <= highestLevel; level++) {
        const batteryData = getBatteryData(level);
        if (!batteryData) continue;
        BATTERY_IMAGE_PATHS[level] = `graphics/battery/${batteryData.fileName}`;
    }
    
    console.log(`Registered ${Object.keys(BATTERY_IMAGE_PATHS).length} battery sprites`);
}

function loadBatteryImagesFromCache(scene) {
    for (const level in BATTERY_IMAGE_PATHS) {
        const path = BATTERY_IMAGE_PATHS[level];
        if (path) scene.load.image(`battery${level}`, path);
    }
}

function getBatteryIconLevel(level) {
    const highest = getHighestBatteryLevel();
    return Math.min(level, highest);
}

// ===================================================================
// SPRITE SIZE QUICK REFERENCE
// ===================================================================
// Grid & Batteries:
//   • Grid cell (empty/filled):        130 × 130 px  (CELL.SIZE)
//   • Battery sprite in grid cell:      64 × 64 px   (CELL.BATTERY_DISPLAY_SIZE)
//   • Battery level text offset:        -40 px Y     (CELL.LEVEL_TEXT_Y_OFFSET)
//
// Platform/Charger System:
//   • Charger slot (battery holder):   130 × 130 px  (PLATFORM.SLOT_SIZE) — same as grid cell
//   • Debug rect (max gadget area):    170 × 113 px  (PLATFORM.DEBUG_RECT_WIDTH × WIDTH/ASPECT_RATIO, 3:2)
//   • Tooth area (toothbrush level):   200 × 80 px   (PLATFORM.TOOTH_AREA_WIDTH × WIDTH/ASPECT_RATIO, 2.5:1)
//   • Gadget sprite (within debug):    auto-sized    (aspect ratio preserved, centered horizontally, touching bottom)
//   • Socket (on slot):                 40 × 40 px   (PLATFORM.SOCKET_SIZE)
//   • Plug (on wire):                   28 × 28 px   (PLATFORM.PLUG_SIZE)
//   • Platform stripe height:           18 px        (PLATFORM.STRIPE_HEIGHT)
//
// Meter (analog gauge):
//   • Meter radius:                     62 px        (PLATFORM.METER_RADIUS)
//   • Meter diameter (approx):         124 px        (2 × radius)
//
// UI Elements:
//   • Button battery icon:              64 × 64 px   (BUTTON.BATTERY_ICON_WIDTH/HEIGHT)
//   • Button coin icon:                 50 × 50 px   (BUTTON.COIN_ICON_WIDTH/HEIGHT)
//   • Coin counter icon:                40 × 40 px   (COIN_COUNTER.COIN_ICON_WIDTH/HEIGHT)
//   • Reward coin (animation):          32 × 32 px   (COIN_REWARD_ANIMATION.REWARD_COIN_SIZE)
//   • Crown icon (unlock display):      32 × 32 px   (BATTERY_UNLOCK_DISPLAY.CROWN_ICON_SIZE)
//   • Spawn button:                    250 × 90 px   (BUTTON.SPAWN_WIDTH/HEIGHT)
//   • Level-up button:                 180 × 70 px   (BUTTON.LEVELUP_WIDTH/HEIGHT)
// ===================================================================
