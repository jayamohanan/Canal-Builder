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
        LANDSCAPE_SPLIT: 0.4,      // UI's share of the WIDTH; the farm gets the rest
        // The design reference is a 1440×778 MacBook. REF_W is the UI half AT THAT
        // SPLIT, so changing the split alone never resizes the grid: the scale works
        // out to screenWidth/1440 either way (0.5·W/720 === 0.4·W/576).

        PORTRAIT_SPLIT:  0,        // the FARM's share of the HEIGHT — the other way
                                   // round from LANDSCAPE_SPLIT, because in
                                   // portrait the farm is the part that takes the
                                   // named share.
                                   //
                                   // 0 means DERIVE it, which is the default and
                                   // almost certainly what you want. Standing the
                                   // battery on its end beside the grid took the
                                   // case out of the vertical column, leaving only
                                   // coin, panel and button — about 650 design px
                                   // where landscape needs 778. The UI half is then
                                   // sized to that shorter column, which leaves the
                                   // grid at EXACTLY the size it had before and
                                   // hands the whole difference to the farm.
                                   //
                                   // Setting a number overrides that, and then it
                                   // is a real trade. LANDSCAPE_SPLIT spends
                                   // horizontal slack the panel was not using;
                                   // portrait's column has none left, so going past
                                   // the derived value shrinks the merge grid in
                                   // proportion.
        REF_W_PORTRAIT: 720,
        REF_H: 778,
    },

    // Play / pause, top-right of the screen. The icon shows what pressing it
    // will DO — a pause bar while running, a play arrow while stopped — which is
    // the convention every media player uses.
    PAUSE: {
        ENABLED: true,
        SIZE:    44,        // px @ design scale
        MARGIN:  16,        // from the screen's top-right corner, px @ design
        ALPHA:   0.85,
        DEPTH:   100000,    // above everything, including the debug grid
    },

    RESET_PROGRESS: false,
    DEBUG_HALF_LINE: false,  // draw a line splitting partA / partB (vertical in
                             // landscape, horizontal in portrait)
    // White lattice over the farm half, on the TILE boundaries — so it shows
    // where tiles actually are, not just where 22x20 cells would fall. It is
    // world content, so it scrolls with the band and stays welded to the tiles.
    // Columns come from the map's own width; rows are anchored to the map's grid
    // and continued in both directions to fill the visible band.
    DEBUG_GRID: {
        ENABLED: true,
        COLOR:   0xffffff,
        ALPHA:   0.25,     // faint: this has to sit over the art without hiding it
        WIDTH:   1,        // px @ platformScale
        DEPTH:   9000,     // above everything the farm draws
    },
    DEBUG_POWER: true,       // log what the machine is actually delivering, once
                             // a second while it is cutting: hardness of the row
                             // it is in, power from the slots, the two speed
                             // limits, which one is binding, and the strain.
                             // This is the readout for tuning the whole feature
    DEBUG_MAP:  true,        // report, per band, exactly what reached the
                             // renderer from the level's .tmj: which layers were
                             // found and whether they carry anything, which
                             // tilesets resolved to art, which gids could not be
                             // drawn, and how much of the ground on screen is
                             // the MAP versus the filler strip. Errors and
                             // warnings below are logged whatever this is set to
    DEBUG_PERF: true,        // log object / tween / timer / texture counts each
                             // time the world rebases (once per level). Climbing
                             // numbers = something is outliving its band
    BATTERY_START_LEVEL: 5,
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

        // The three slots' rates added up, shown beside the battery case. The
        // per-slot numbers say what each cell contributes; this says what the
        // machine is actually being fed, which is the number that decides how
        // fast the ground gives way.
        TOTAL_CHARGE: {
            ENABLED: true,
            GAP:     14,        // out from the case's terminal (px @ design)
            SIZE:    30,        // font size @ design scale
            COLOR:      '#ffe07a',
            STROKE:     '#3a2a00',
            STROKE_W:   4,
            PULSE:   1.18,      // grows this much on each battery tick, in step
                                // with the individual battery icons — the whole
                                // supply chain flashing on the same beat
        },
        SLOT_LABEL_W: 46,              // width reserved for a charge-rate label
                                       // (px @ design). PORTRAIT ONLY: the
                                       // battery stands on end there, so the
                                       // labels cannot sit above their cells —
                                       // above is the next cell — and go beside
                                       // them instead, between the battery and
                                       // the grid panel. Raising this makes the
                                       // portrait slots smaller, not the margin
                                       // wider: the margin is fixed by the panel
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
                { FILE: 'level_maps/level_01.tmj' },
                { FILE: 'level_maps/level_02.tmj' },
                { FILE: 'level_maps/level_03.tmj' },
                { FILE: 'level_maps/level_04.tmj' },
                { FILE: 'level_maps/level_05.tmj' },
                // { FILE: 'level_maps/level_02.tmj' },
                //  {
                //     FILE: 'level_maps/level_03.tmj',
                //     // Which pond art this level's markers stand for. The KEY is
                //     // the marker's position in markers.tsx (see MARKERS), so the
                //     // same two markers mean different ponds in different levels
                //     // — paint pond A, decide here which pond it is.
                //     PONDS: { 1: 'pond1_dry', 2: 'pond2_dry' },
                // },
               
               
            ],
            FILE:    'level_maps/level_02.tmj',   // fallback when LEVELS is empty

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

            // ── Which Tiled tileset is which texture ──────────────────────
            // A map records its tilesets by FILE NAME and firstgid; the .tsx
            // itself is never loaded, so this table is how the game learns what
            // art a tileset stands for. Keyed by the .tsx's file name.
            //
            //   IMAGE — load this sheet under KEY. Omit it to reuse a sheet some
            //           other entry already loaded (two tilesets, same art).
            //   KEY   — the texture to draw that tileset's tiles from.
            //   CANAL — true if its tiles carry canal MEANINGS (see TILES).
            //
            // A tileset with NO entry here is never drawn: markers, decor sheets
            // used only in the editor, and anything left over. That is why a
            // redundant tileset costs nothing — it simply is not listed.
            //
            // Order does not matter, here or in Tiled: a gid is resolved against
            // whichever tileset's range contains it, in that map, by name.
            TILESETS: {
                'canal.tsx':   { IMAGE: 'graphics/tilesheets/canals.webp',
                                 KEY: 'canal_sheet', CANAL: true },
                // Same art as canal.tsx (byte-identical file), so it reuses that
                // texture rather than costing a second 6.8 MB upload. Give it its
                // own IMAGE the day the two sheets actually differ.
                'copy.tsx':    { KEY: 'canal_sheet', CANAL: true },
                'terrain.tsx': { IMAGE: 'graphics/tilesheets/terrain.webp',
                                 KEY: 'terrain' },
            },
            FRAME:   128,           // frame size in the sheet
            SHEET_PAD: 2,           // EXTRUSION, in px, added around every frame
                                    // of every tile sheet at load. 0 disables.
                                    //
                                    // Why it is needed: slicing tells the GPU
                                    // which texels a frame owns, but sampling
                                    // INTERPOLATES, so at a frame's outer edge it
                                    // reaches into whatever sits next to it in
                                    // the sheet. Where a transparent edge touches
                                    // a solid one — the "ne" variants do exactly
                                    // this — that shows as a line along an edge
                                    // that should be empty.
                                    //
                                    // A transparent gap is NOT the fix: then the
                                    // sampler pulls in transparency and every
                                    // tile gets a faint fading border instead.
                                    // The gutter is filled with a COPY of each
                                    // frame's own edge pixels, so whatever the
                                    // sampler reaches for is what was already
                                    // there and nothing changes.
                                    //
                                    // Frame NUMBERING is unaffected — Phaser is
                                    // told the margin and spacing — so every
                                    // frame index in this file stays correct.
                                    // 2 rather than 1: the tiles are rotated and
                                    // drawn at a non-integer scale, so one pixel
                                    // of headroom is not quite enough.
            MAIN_TILES: 2,          // the main canal is this many tiles wide

            // ── What the ground costs ───────────────────────────────────────
            // How much work a level's ground takes to cut through. This is the
            // difficulty curve, and every number in it is DERIVED, not chosen:
            // it is Blumgi Merge's combined monster HP per level, verbatim.
            //
            // A x1.18 "pooling correction" used to be applied here and has been
            // DISCARDED. The reasoning was that their level ends when the
            // slowest of three independent fights ends (a maximum) while ours
            // ends when one machine finishes the total (an average), so pooling
            // is more forgiving. True, but it made our numbers stop matching the
            // sheet, which is not worth 15% of duration. Levels now run at about
            // 0.85x Blumgi's, and COST_SCALE is the knob if that wants changing.
            //
            // Per-tile hardness is this divided by the map's row count. Nothing
            // authors it and nothing stores it.
            LEVEL_COST: [
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
            COST_SCALE: 1,          // multiplies the whole column. Dormant at 1.
                                    // Rescaling preserves every ratio, so the
                                    // numbers can be moved off Blumgi's literal
                                    // values at any point without re-testing
                                    // balance — it changes the display, nothing
                                    // else
            // How a level's cost divides ALONG the level: a soft opening, a
            // medium middle, a hard final third. Taken from the split between
            // Blumgi's three monsters, which is stable across their whole table
            // (level 1 is 20/30/50, level 65 is 30/33/37, average 28/33/39).
            // Keeps the texture of their three-monster structure inside our
            // one-machine model — the rig visibly labours as a level closes.
            STRETCHES: [0.28, 0.33, 0.39],

            // A temporary wall across the main canal — a water blocker.
            //
            // It appears when the CUT REACHES IT, not when the level is built:
            // until then there is nothing to block. One goes in at the level's
            // far edge the moment the dig finishes, immediately before the flood
            // is released, so the water arrives to find it standing.
            //
            // The point of it is the plan for LONG levels: two or three walls
            // part-way up, so each stretch fills as it is cut instead of the
            // whole canal waiting for the end. That turns one long wait into
            // several visible payoffs. Only the end wall exists today.
            //
            // Authored against a 256px (two tile) canal, so it takes the SAME
            // scale the 128px tiles take: whatever a tile is on screen, divided
            // by FRAME. At 449x226 that puts it 3.5 tiles wide — the two canal
            // columns plus about three quarters of a tile onto each bank.
            // ── The farmer ──────────────────────────────────────────────────
            // Somebody lives here. One per level, wandering the crops, so the
            // irrigation reads as being FOR someone rather than happening to an
            // empty field.
            //
            // graphics/farmers.webp is 768x128 — six 128px frames in one row:
            //   0,1  idle (a two-frame breathe)
            //   2-5  walk, drawn facing RIGHT
            // Every frame faces the camera. Direction is read from travel and
            // shown by mirroring, so walking up or down uses the same cycle —
            // there is no separate vertical pose and none is needed.
            FARMER: {
                ENABLED: true,
                FILE:  'graphics/farmers.webp',
                SIZE:  1.9,         // height as a fraction of a tile
                IDLE_FRAME: 0,      // standing still is a STILL POSE, not a
                                    // loop — this frame is held. Frame 1 unused
                WALK_FPS: 8,
                SPEED: 1.1,         // tiles/sec
                PAUSE_MS: [1800, 6500],   // he mostly stands still; this is the
                                          // wait between walks, weighted long
                TRIP_TILES: [1.5, 5],     // how far he goes when he does move
                EDGE_COLS: 1,       // columns kept clear at each side of the map
                MACHINE_COLS: 1,    // columns kept clear either side of the canal
                                    // for the trencher. With the canal's own two
                                    // that is the four middle columns
            },

            // The work left in this level, shown over the machine and counting
            // down as the batteries chew through it. It includes the overrun —
            // the 3.5 tiles into the level above — because that is genuinely
            // part of what this dig has to pay for.
            POWER_LABEL: {
                ENABLED: true,
                // Beside the DIG LINE, out to its left, rather than over the
                // machine. The cut line is where the work is actually happening
                // and where the eye already is; parked over the control unit the
                // number rode ahead of it, on the ground still to be cut.
                // Right-aligned, so it grows away from the rig instead of into it.
                X:       0.4,       // clear of the rig's left flank, in rig widths
                Y:       0,         // off the dig line, in tiles (+ is down)
                SIZE:    26,        // font size @ design scale
                COLOR:      '#ffffff',
                STROKE:     '#1d2b16',
                STROKE_W:   5,
                DEPTH:   3.2,       // over the machine and its spoil
            },

            BLOCK: {
                ENABLED: true,
                FILE:  'graphics/block.png',
                // Which point ON THE ART lands on the level boundary. Not the
                // centre: the wall's waterline sits high in the image, so this
                // is the pivot that puts the line where the water is actually
                // stopped. Measured from the top-left of the sprite, 0..1.
                ORIGIN_X: 0.5,
                ORIGIN_Y: 0.25,
                Y:     0,        // nudge off the boundary line, in tiles
                DEPTH: 3.09,     // UNDER the canal's water (3.10). The wall is
                                 // set into the channel, not laid across the top
                                 // of it, so the water rises against its face and
                                 // laps over it — which is what a dam holding
                                 // water looks like. Drawn above it instead, the
                                 // wall reads as a plank dropped on the surface.
                                 // Still above the machine (3.04-3.07), so the
                                 // rig passes behind it rather than through it
                // DROPPED INTO PLACE, not blinked into existence. It starts
                // slightly high and slightly LARGER, then settles down to its
                // resting position and to full size. Bigger reads as nearer the
                // camera, so shrinking as it descends is the whole illusion —
                // the wall comes down out of the air and into the channel.
                DROP_MS:    340,    // longer, because it now falls further
                DROP_RISE:  1.3,    // how far above its resting place it starts,
                                    // in tiles
                DROP_SCALE: 1.45,   // and how much larger — i.e. how far toward
                                    // the camera. Rise and scale have to climb
                                    // together: more height with the same size
                                    // reads as a slide down the screen, and more
                                    // size without the height reads as a zoom.
                                    // It is the two moving in step that makes it
                                    // a descent
                DROP_EASE:  'Back.easeIn',   // gathers speed downward and lands
                                    // with a slight overshoot into the floor,
                                    // which is what sells the weight

                // Pulling one out is what lets the water through. A wall is
                // removed the instant the level ABOVE it is about to flood — so
                // the water does not merely appear beyond the boundary, it goes
                // because the thing stopping it was taken away.
                REMOVE_MS:   300,   // the placement run BACKWARDS — it rises the
                                    // same distance it fell and swells by the
                                    // same amount, withdrawing toward the camera
                                    // exactly as it descended away from it.
                                    // Height and swell are taken from DROP_RISE
                                    // and DROP_SCALE above rather than repeated,
                                    // so the two halves can never drift apart
                REMOVE_EASE: 'Back.easeOut',   // the mirror of the drop's easeIn:
                                    // it leaves quickly and slows, where the drop
                                    // gathered speed on the way down
            },

            // ── Terrain sheet ───────────────────────────────────────────────
            // Everything that is NOT a canal piece: the plain ground, the flat
            // water the flow head is drawn from, and the two growth overlays.
            // The canal sheet now carries only canal tiles (gid <= 53); nothing
            // reads past that. The sheet is 768x640 = 6 columns x 5 rows of
            // 128px frames, so a frame index is (row-1) * 6 + (col-1) and each
            // ROW after the first is exactly the six edge variants one layer
            // needs, in the CROP_OVERLAY_EDGES order: inner, n, ne, ns, nes,
            // nesw — everything else reached by rotating those.
            //
            //   row 1  the plain ground, and the flat water
            //   row 2  TILLED soil, dry      — the worked patch a seed sits in
            //   row 3  TILLED soil, watered  — the same shapes, darker
            //   row 4  damp overlay
            //   row 5  mossy overlay
            //
            // Rows 3-5 each moved down by one when the tilled row was inserted;
            // every frame number below is measured from this list, so the list
            // is the thing to correct if the sheet changes again.
            TERRAIN: 'graphics/tilesheets/terrain.webp',
            TERRAIN_GROUND: 0,      // row 1, col 1 — the field's base tile, dry
            TERRAIN_WATER:  1,      // row 1, col 2 — flat water; the flow head
                                    // and its foam blobs are cut from this
            TERRAIN_TILLED:     6,  // row 2, col 1 — DRY tilled soil, and the
                                    // first of that row's six edge variants
            TERRAIN_GROUND_WET: 12, // row 3, col 1 — the SAME tilled shapes,
                                    // watered. Dry and wet share an edge variant
                                    // index, so wetting a patch is this row's
                                    // base plus the offset the dry tile already
                                    // chose — no second mask, no re-cut

            // ── Watered ground ──────────────────────────────────────────────
            // Irrigation should be VISIBLE in the soil, not only in the ditch:
            // as the canal fills, the land it feeds darkens tile by tile, so
            // the wet colour spreads outward from the water instead of the
            // field staying uniformly dry around a full canal.
            //
            // Only PLANTED cells wet — the ones marked on the CROPS layer. Bare
            // land is not being irrigated, so the wet colour ends up marking the
            // worked field exactly, and its outline is the crop patch's outline.
            //
            // Each planted tile is bound at build time to its NEAREST canal
            // cell(s) by Manhattan distance — all of them at that distance, not
            // just the first found — and turns the moment ANY of them wets, so
            // a tile lying between two ditches turns for whichever fills first
            // rather than waiting on one arbitrary winner.
            //
            // The wet tile is drawn with a RAGGED edge on every side facing land
            // that is still dry and a straight one where the wet region carries
            // on, and that mask is RE-CUT as neighbours catch up — an early tile
            // starts as a lone ragged patch and its sides straighten one by one.
            // Deciding the mask once at build would draw the finished patch's
            // outline from the first moment and the spread would read as a hard
            // square block growing.
            // The watering itself, played at the plant's base the moment its
            // canal arrives: a short splash that hands over to the damp soil
            // partway through, so the ground does not simply change colour on a
            // timer — you see the water land on it. One row of 128px frames.
            PLANT_WATER: {
                ENABLED: true,
                FILE:    'graphics/plant-water.png',
                FRAMES:  8,
                FPS:     6,     // halved from 12 — the whole splash now runs
                                // ~1.3s instead of ~0.67s
                SIZE:    1,     // width as a fraction of a tile
                Y:       0,     // offset from the cell centre, in tiles (+ is down)
                ANGLE_STEP: 0, // each splash is turned this many degrees further
                                // than the one before it — spawn 1 at 0, spawn 2
                                // at 45, and so on, wrapping at 360. Successive
                                // plants therefore never show the same splash
                                // twice in a row, from ONE 8-frame sheet.
                                //
                                // Free: a sprite's angle is one value in a
                                // transform that is computed either way, so this
                                // costs nothing per frame and does not break
                                // batching. The splash's content reaches 71px
                                // from the frame centre against a 90px corner,
                                // so it cannot clip or spill at any angle.
                                //
                                // 0 turns it off. Note the art is a splash at the
                                // stem, not a symmetrical burst — past about 20
                                // degrees the water starts to read as falling
                                // sideways, so judge it on screen.
                DAMP_AT: 4,     // 1-based frame the ground turns damp on. The
                                // splash has landed by here but is still playing,
                                // so the soil darkens UNDER the water rather than
                                // after it — the two read as one event
            },

            GROUND_WET: {
                ENABLED: true,
                AT:      0.15,      // canal fill fraction that counts as "the
                                    // water has arrived" — the same threshold
                                    // the crops start growing on (CROP_WET), so
                                    // soil and plant react to the same moment
                FADE_MS: 450,       // cross-fade into the wet tile. 0 = a hard
                                    // swap, which pops: a whole neighbourhood of
                                    // tiles can cross AT on the same frame
            },

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
            // Crop NAMES, in PLAY ORDER: entry 1 is level 1, entry 2 is level 2,
            // and it wraps at the end. Each name is a sheet in CROP_DIR with the
            // CROP_EXT extension — every crop is a webp, so the extension is not
            // repeated eight times here.
            //
            // Adding a crop:   drop <name>.webp in graphics/crops/, add <name>.
            // Testing a crop:  move it to the FRONT — it plays on level 1 instead
            //                  of waiting for the rotation to come round.
            // Every sheet is one row of CROP_STAGES frames of equal width
            // (640x256 = five 128x256 stages, as they all are today).
            CROP_CYCLE: [
                'tomato',
                'grass',
                'mango',
                
                'green_bean',
                'hops',
                'grape_vine',
                'grass2',
                
                
                
                'grape',
                
            ],
            CROP_DIR: 'graphics/crops/',
            CROP_EXT: '.webp',   // every crop sheet is a webp, so the list above
                                 // is plain NAMES. An entry may still spell out
                                 // its own extension if one ever differs.
            CROP:         'tomato.png',  // fallback when CROP_CYCLE is empty
            CROP_STAGES:  5,
            CROP_GROW_MS: 2000,     // time between growth stages
            CROP_WET:     0.15,     // canal-cell fill fraction that counts as "watered"

            // A patch of worked soil under each plant (graphics/plant-base.png),
            // centred on the stem base and drawn UNDER the plant — and under
            // every other plant too, so a base can never cover the crop in front
            // of it.
            // The worked patch a plant stands in. It is a FULL TILE from the
            // terrain sheet's tilled row, not a small stamp — so the patch is
            // cut to the shape of the planted area, ragged where it meets bare
            // ground and straight where the next planted cell carries it on.
            // The mask is fixed at build: tilling happens before any water, and
            // the patch's outline never changes afterwards — only its colour,
            // when the water arrives.
            CROP_BASE: {
                ENABLED: true,
                ALPHA:   1,
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
            CROP_OVERLAY_ENABLED: false,
                                    // TEMPORARILY OFF — the damp and mossy
                                    // patches are hidden while the watered
                                    // GROUND tile (GROUND_WET) is being judged
                                    // on its own; the two were stacking on the
                                    // same cells. The definitions below are kept
                                    // intact: flip this back to true to restore
                                    // them exactly as they were.
            CROP_OVERLAY: {
                2: { frame: 18, blend: 'MULTIPLY', alpha: 1 },   // damp  — row 4
                4: { frame: 24, blend: 'NORMAL',   alpha: 1 },   // mossy — row 5
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
            SPLIT_AT:     0.6,     // how far the water must get into a junction
                                    // tile before a side branch starts, as a
                                    // fraction of the tile.
                                    //
                                    // 0.5 is the tile's CENTRE, where every arm
                                    // of a canal piece meets — the floor for this
                                    // value, not a preference. Below it the next
                                    // cell starts while the arm feeding it is
                                    // still dry, leaving a gap of unwatered
                                    // channel between the two: most visible on a
                                    // bend, whose only exit counts as a side arm
                                    // and so always fires early.
                                    //
                                    // Above 0.5 the arm is already wet and the
                                    // branch simply waits, which reads as the
                                    // water taking a moment to turn. 0.75 is
                                    // three quarters across — arm well filled
                                    // before anything leaves it.
                                    //
                                    // It was 0.3 while the head existed: the head
                                    // bulged ahead of the revealed edge, so at 0.3
                                    // the VISIBLE front was already near the
                                    // centre. With the head gone the crop line is
                                    // the front, and the threshold has to match
                                    // the geometry.
            // ── Bank shimmer ────────────────────────────────────────────────
            // Once a cell has finished filling, a few small light streaks sit
            // just inside the water at its edges and slowly fade up and down.
            // It is the settled water's only animation and it does most of the
            // work of making a still canal look alive — cheap, because the
            // streaks never move: only their brightness changes.
            MARK_ENABLED: false,    // TEMPORARILY OFF — the streaks read as white
                                    // lines lying across the water rather than
                                    // as glints in it. Everything below is left
                                    // tuned as it was, so this is the only line
                                    // to change to bring them back.
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
            MAIN_DRY_DEPTH:   3.03, // the dug trench, before water. It used to sit
                                    // down at 1.52 with the ground and branches,
                                    // which was fine until South Lake: the lake's
                                    // basin covers everything below it, so the
                                    // trench cut through the lake's top row was
                                    // buried. It now sits just ABOVE the basin
                                    // (3.02) and just BELOW the torn lip (3.04)
                                    // and the machine — the trench is in the
                                    // ground, the machine rides over it.
                                    //
                                    // Safe above the crops for the same reason
                                    // MAIN_WATER_DEPTH already is: crop art is one
                                    // tile wide and a main cell's neighbours along
                                    // the canal are canal too, so no plant ever
                                    // overlaps one.
            MAIN_WATER_DEPTH: 3.10,

            // The moving front. OFF: the water is simply the tile art being
            // uncovered, which follows every bend in the channel because it IS
            // the channel. The head was a sprite laid across the front, so a
            // tile where the channel turns had it lying over a bank — the turn
            // happens inside the tile and the head has no way to know.
            HEAD_ENABLED: false,

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
            FLOW_SPEED: 30,         // branch-water speed (px/s @ platformScale).
                                    // 0 = match the main canal (WATER.MIN_SPEED).
                                    // Pinned to 30 — the old shared value — when the
                                    // main canal was slowed to 40%, so the branches
                                    // kept their pace. Set back to 0 to re-couple.
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
            CROPS_LAYER: ['crop', 'crops'],// marker only — where crops spawn.
                                           // A LIST because the maps disagree:
                                           // the Tiled project was rebuilt and
                                           // names it "crop", while the earlier
                                           // maps still in the rotation say
                                           // "crops". First match wins, so both
                                           // load. Any layer name here may be a
                                           // list; a plain string still works.

            // gid → meaning. The gid is the number Tiled shows when you hover a
            // tile. conn = open edges (any of n/e/s/w). main = 'L'/'R' half of
            // the 2-wide main canal (main-canal tiles only). Tiles with no entry
            // (e.g. grass 55) are treated as non-canal.
            TILES: {
                // gid → what that canal piece IS. The key is the tile's position
                // in the canal sheet counting from 1 — which is also the gid Tiled
                // shows when that sheet is first in a map — so the same entry
                // serves any sheet holding this art, wherever its gids start.
                //
                // conn = the edges the channel opens onto, so the flood knows
                // where water can leave. main = which half of the two-cell main
                // canal: L is the west half, R the east.
                //
                // Taken from the sheet's own tile names: the letters after the
                // last underscore ARE the openings, which is why every entry here
                // matches its comment. Only DRY tiles are listed — each one's
                // water twin is the very next frame (FLOW_OFFSET), so it needs no
                // entry of its own.
                //
                // Sizes: main is two cells across, branch one, minor one with a
                // half-width channel. The flood treats branch and minor alike;
                // only main is special, because the dig runs down it.
                // ── branch — one cell wide ──────────────────────────────
                1:  { conn: 'es' },              // branch_es
                3:  { conn: 'esw' },             // branch_esw
                5:  { conn: 'ew' },              // branch_ew
                7:  { conn: 'ne' },              // branch_ne
                9:  { conn: 'nes' },             // branch_nes
                11: { conn: 'nesw' },            // branch_nesw
                13: { conn: 'new' },             // branch_new
                15: { conn: 'ns' },              // branch_ns
                17: { conn: 'nsw' },             // branch_nsw
                19: { conn: 'nw' },              // branch_nw
                21: { conn: 'sw' },              // branch_sw
                23: { conn: 'e' },               // branch_e
                25: { conn: 'n' },               // branch_n
                27: { conn: 's' },               // branch_s
                29: { conn: 'w' },               // branch_w
                // ── main — two cells wide, L is the west half and R the east 
                31: { conn: 'n', main: 'L' },    // main_e_n
                33: { conn: 'ns', main: 'L' },   // main_e_ns
                35: { conn: 'nsw', main: 'L' },  // main_e_nsw
                37: { conn: 'nw', main: 'L' },   // main_e_nw
                39: { conn: 's', main: 'L' },    // main_e_s
                41: { conn: 'sw', main: 'L' },   // main_e_sw
                43: { conn: 'es', main: 'R' },   // main_w_es
                45: { conn: 'n', main: 'R' },    // main_w_n
                47: { conn: 'ne', main: 'R' },   // main_w_ne
                49: { conn: 'nes', main: 'R' },  // main_w_nes
                51: { conn: 'ns', main: 'R' },   // main_w_ns
                53: { conn: 's', main: 'R' },    // main_w_s
                // ── where two sizes meet ────────────────────────────────
                55: { conn: 'nsw', main: 'L' },  // MainV2MinorH_Dry_e_nsw
                57: { conn: 'nes', main: 'R' },  // MainV2MinorH_Dry_w_nes
                59: { conn: 'nsw' },             // BranchV2MinorH_Dry_nsw
                61: { conn: 'nes' },             // BranchV2MinorH_Dry_nes
                63: { conn: 'nesw' },            // BranchV2MinorH_Dry_nesw
                65: { conn: 'new' },             // BranchH2MinorV_Dry_new
                67: { conn: 'esw' },             // BranchH2MinorV_Dry_esw
                69: { conn: 'nesw' },            // BranchH2MinorV_Dry_nesw
                // ── minor — one cell, half-width channel ────────────────
                71: { conn: 'e' },               // minor_e
                73: { conn: 'w' },               // minor_w
                75: { conn: 's' },               // minor_s
                77: { conn: 'n' },               // minor_n
                79: { conn: 'es' },              // minor_es
                81: { conn: 'ew' },              // minor_ew
                83: { conn: 'esw' },             // minor_esw
                85: { conn: 'sw' },              // minor_sw
                87: { conn: 'ns' },              // minor_ns
                89: { conn: 'nes' },             // minor_nes
                91: { conn: 'nesw' },            // minor_nesw
                93: { conn: 'nsw' },             // minor_nsw
                95: { conn: 'ne' },              // minor_ne
                97: { conn: 'new' },             // minor_new
                99: { conn: 'nw' },              // minor_nw
            },
        },

        // ── South Lake ────────────────────────────────────────────────────
        // The world's one water source, at the very bottom of level 1. Only its
        // NORTH BANK is drawn — the water runs off the bottom and sides of the
        // frame, which is what says "this is big" without drawing any of it.
        //
        // Two images, same size, exactly overlaid: the dry basin (bank + floor)
        // and the water alone. The machine is sandwiched BETWEEN them, so its
        // belt sits in the basin with water drawn over it — dipped in the lake,
        // ready to cut inland.
        //
        // The dig starts START_ROW tiles below the lake's top edge, so the
        // machine begins on the bank and level 1's first canal tile lands on the
        // lake's top row — the canal is joined to the lake, not merely near it.
        LAKE: {
            ENABLED: true,
            DRY:   'graphics/pond.webp',      // basin: bank and floor
            WATER: 'graphics/pond-water.webp',// the water only, drawn over it
            ROWS:  0,          // height in tiles. 0 = DERIVE it from the art's
                               // own aspect against the grid's width, so a
                               // re-export at a different size just works and
                               // the lake can never come out stretched
            START_ROW: 1,      // the dig line sits this many tiles below the
                               // lake's top edge — 1 puts it on the line between
                               // the lake's top row and the one under it
            // Depths. The lake bed goes over everything the map draws (ground
            // 1.4, branches 1.5, crops 3.0) so the bottom rows of level 1 are
            // simply covered; the lake water goes over the machine (3.04–3.07)
            // AND over the main canal's water (3.10), so nothing surfaces
            // through the lake.
            DEPTH_DRY:   3.02,
            DEPTH_WATER: 3.11,
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
            // ── Power delivery ────────────────────────────────────────────
            // Charge is POWER now, not distance. It used to convert straight to
            // pixels at a flat rate, which meant nothing resisted it and dig
            // speed tracked the battery ladder up forever — 1.7 tiles/sec at
            // battery 3, 223 at battery 15, an 8-row level cut in 0.04s.
            //
            // Two limits now decide how fast the machine moves, and it obeys
            // whichever is tighter:
            //
            //   ENERGY      power / hardness  — you cannot cut faster than the
            //               batteries can pay for
            //   MECHANICAL  MAX_SPEED — the machine cannot travel
            //               faster than that, however much power you feed it
            //
            // They are blended smoothly rather than hard-clamped, so approaching
            // the machine's limit reads as bogging down rather than hitting a
            // wall. Travel is never set anywhere: the belt cuts, and the machine
            // advances into what it cleared.
            //
            // Because hardness and power BOTH grow x1.5 per level, the ratio
            // between them barely moves — so speed lives in a narrow band across
            // all 65 levels with no per-level tuning at all.
            POWER: {
                // TRAVEL CAP and BELT LOOK are separate numbers, because one
                // constant cannot serve both. Tie the belt's cycles-per-tile to
                // the cap and you must choose: a high cap (so the economy, not
                // the machine, decides speed) or a busy-looking belt. Making
                // each cycle carry half a tile gave the cap but left the belt
                // turning twice per tile — a crawl, so the ground looked as
                // though it were being cut by the rig reversing into it.
                MAX_SPEED:       6,     // travel ceiling, tiles/sec. Exists only
                                        // to stop the absurd (the old model
                                        // reached 223 t/s), so it sits well above
                                        // what power normally buys and almost
                                        // never binds
                BELT_CYCLES:     10,    // the belt runs at this, cycles/sec, and
                                        // nothing changes it. Ten cycles of five
                                        // frames is 50fps — the rate the art was
                                        // calibrated at.
                                        //
                                        // Deliberately CONSTANT. Ground hardness
                                        // is told entirely through how fast the
                                        // machine travels: soft ground and it
                                        // moves off, hard ground and it barely
                                        // creeps while the belt keeps chewing at
                                        // the same rate. One signal, unambiguous.
                                        // A belt that also slowed down said the
                                        // same thing twice and made neither
                                        // reading clean.
                                        //
                                        // Ceiling is 12 (60fps, the render rate);
                                        // past that it skips frames and can
                                        // appear to run backwards
                PULSE_DEPTH:     0,     // OFF. Speed used to swing +/-40% across
                                        // every second so the battery tick could
                                        // be felt. At the speeds the game is
                                        // actually played at that read as the
                                        // machine stuttering rather than surging,
                                        // and a trencher should grind steadily.
                                        // Raise it (0.1 is subtle) to bring the
                                        // pulse back; the machinery is intact and
                                        // distance per second is unaffected
                                        // either way
                SHAKE_MAX:       0,     // OFF. Horizontal shudder at full strain
                                        // (px @ platformScale). It oscillated at
                                        // 4-6Hz, which on a rig this size read as
                                        // the machine swinging side to side
                                        // rather than as effort — a trencher
                                        // tracks straight even when it is
                                        // fighting. Raise it to bring it back;
                                        // SPRITES ONLY either way, never the
                                        // reveal line, which the cut edge, the
                                        // spoil and the water all hang off
                EASY_SPEED:      1.2,   // the pace a machine with power to spare
                                        // settles at, in tiles/sec. Strain is
                                        // measured against THIS, not against
                                        // MAX_SPEED — that cap is deliberately
                                        // far above normal play, so measuring
                                        // against it pinned strain near 1 forever
                                        // and the rig shook at full amplitude the
                                        // entire game
                WHEEL_TILES_PER_TURN: 0.6,  // ground covered per full wheel
                                        // rotation. The wheels are driven by
                                        // DISTANCE, not by a clock, so they can
                                        // never appear to slide at any speed
                SPOIL_MIN:       0.25,  // spoil thrown at a standstill, as a
                                        // fraction of the configured rate — the
                                        // rest scales with how hard it is working
            },
            OVERRUN_TILES: 3.5,    // keep cutting this far PAST the level's last
                                   // row before the level counts as dug. The belt
                                   // straddles the cut line — 40% ahead of it,
                                   // 60% trailing — so stopping the line on the
                                   // boundary leaves most of the machine still
                                   // standing on the level it has just finished.
                                   // This carries it fully clear.
                                   //
                                   // DIG distance only. The canal, the water, the
                                   // lilies and the reveal all still measure to
                                   // the level's own edge, so the overrun floods
                                   // nothing and costs the player nothing — the
                                   // machine simply drives out.
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
                // graphics/trencher/shadow.png is ONE shadow for the whole rig,
                // authored in the same source-px space as the two parts, so it
                // needs no size of its own — it rides the same ratio as
                // everything else. It never animates; it just travels with the
                // machine.
                // The shadow is pinned by its TOP-LEFT corner to the control
                // unit's top-left corner. Its lean is drawn into the art, so no
                // offset is needed — these two are a correction to the art if it
                // ever sits a pixel out, not part of the placement.
                SHADOW_OFF_X: 0,
                SHADOW_OFF_Y: 0,
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
                CHIPS: false,      // OFF. Grit thrown straight up the middle at
                                   // the cut line, from the same debris texture
                                   // as the two side sprays — so it read as a
                                   // third spray fired at the camera rather than
                                   // as material coming off the face. The sides
                                   // already say the trench is being emptied.
                                   // The dust haze below is unaffected
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

        // ── The world scrolls; it no longer jumps ─────────────────────────
        // Levels are stacked FLUSH: each one's floor is the one below it's top,
        // and a band is exactly its own map — never a screen height. That is
        // what removes the strip of filler ground that used to sit between
        // levels, and what stops the machine being teleported to a fresh dig
        // site: the next level's canal begins exactly where the last one ended,
        // so the rig simply keeps cutting.
        //
        // Finished levels are NOT torn down when the next begins. They stay on
        // screen, watered and grown, and are only released once they have
        // scrolled clear below — so the player sees the stack of fields they
        // have already brought in.
        ENDLESS: {
            ENABLED: true,
            // The camera holds still until the machine leaves a band of the
            // view, then eases up to put it back. A camera welded to the rig
            // would always be looking at bare soil and never at the crops
            // coming in behind it.
            // What waits for a finished field to come in — the machine, the
            // camera, or neither.
            //
            // The machine stopping wastes time but keeps it on screen. The
            // camera stopping wastes nothing but lets the rig climb out of the
            // top: a level needs about 10s to flood and grow, and at 1.8 tiles
            // a second the machine covers 18 tiles in that time against 6.7
            // tiles of headroom. It leaves the view after under four seconds.
            HOLD_MACHINE_FOR_CROPS: false,  // the rig keeps digging regardless
            HOLD_CAMERA_FOR_CROPS:  true,   // but the view stays on the field
            HOLD_EDGE:   0.08,     // ...unless the machine is about to leave.
                                   // The hold is SOFT: the camera stays on the
                                   // finished field for as long as it can, then
                                   // gives way once the rig reaches this fraction
                                   // of the view from the top.
                                   //
                                   // Without this the camera falls behind by
                                   // however far the machine got — twelve tiles
                                   // is typical — and catching up afterwards
                                   // drags the whole world down the screen, which
                                   // reads as the MACHINE reversing. A camera
                                   // that never falls behind has nothing to catch
                                   // up on

            FOLLOW_TOP:  0.34,     // machine may climb to this fraction of the
                                   // view before the camera answers
            CATCHUP:     1.15,     // the camera may never travel faster than this
                                   // multiple of the MACHINE's own speed.
                                   //
                                   // This is what stops the rig appearing to
                                   // reverse. A camera moving up drags the world
                                   // down the screen, so any time it outruns the
                                   // machine the machine looks like it is going
                                   // backwards — most obviously after a hold,
                                   // when it had a quarter of a screen of framing
                                   // to reclaim and sprinted to get it. Capped
                                   // just above the machine's pace, it reclaims
                                   // the framing over several seconds and the rig
                                   // never visibly loses ground
            FOLLOW_LERP: 2.2,      // how fast it closes on that, per second.
                                   // Low: the answer should read as the camera
                                   // catching up, not as a snap
            FILL_AHEAD:  0.75,     // keep this many view-heights of world BUILT
                                   // above the camera. Levels are shorter than
                                   // the screen, so without this the viewport is
                                   // mostly empty: the next level used to appear
                                   // only when the last one finished. The world
                                   // is continuous, so it has to exist before
                                   // the player can see it
            KEEP_BELOW:  0.6,      // release a finished level once its top edge
                                   // is this many view-heights below the camera.
                                   // Generous — it is cheaper to hold a band a
                                   // moment longer than to have one vanish in
                                   // view
        },

        WATER: {
            AFTER_DIG:  true,      // hold the water until the dig is FINISHED,
                                   // then flood the whole level in one run from
                                   // the mouth. False = water chases the machine,
                                   // LAG behind the belt, as it used to
            COLOR:      0x2f8fd0,  // the canal surface
            EDGE_COLOR: 0x7fd4f0,  // brighter shallows along each bank — a lit
                                   // rim that separates water from the earth wall
            EDGE_WIDTH: 2,         // width of that rim (px @ platformScale)
            LAG:        1.0,       // how much dry cut the blade keeps open ahead of
                                   // the water, in machine lengths. This is a LIMIT,
                                   // not a leash: 1 = the rig works on dry soil
            FLOOD_SPEED: 140,      // the FINAL flood's speed (px/s @ platformScale),
                                   // flat from the mouth to the wall. Flat because
                                   // the target does not move: a gap-closing
                                   // chase would start fast and crawl the last
                                   // fifth, which reads as the water losing
                                   // interest. Also makes a long level flood at
                                   // the same speed as a short one, where the
                                   // chase made longer levels start faster
            FLOW_TAU:   2.25,      // seconds for the level to close most of the gap
                                   // to that limit. This is what stops the water
                                   // reading as a strip towed by the auger — it
                                   // lingers behind a lurch and keeps creeping up
                                   // the cut after the machine has gone quiet.
                                   // Higher = lazier, more obviously flowing.
                                   //
                                   // With AFTER_DIG the flood is released against
                                   // the WHOLE level at once, so the gap is a full
                                   // band and this constant alone sets the pace:
                                   // speed starts at roughly (band length / TAU).
                                   // That is why it read as a surge. 2.25 is 0.9
                                   // x2.5, i.e. 40% of the old speed.
            MIN_SPEED:  12,        // steady creep floor (px/s @ platformScale). The
                                   // exponential chase above would crawl to a halt
                                   // as it closes the last of the gap — this keeps
                                   // the final run to the mouth moving at the same
                                   // pace it had while chasing the blade.
                                   // Scaled with FLOW_TAU so the tail slows by the
                                   // same 40%, otherwise the run would decelerate
                                   // into the mouth and then speed back up.
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
