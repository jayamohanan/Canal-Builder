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

    GADGET_LOAD: {
        DELAY_BEFORE_CHARGING: 0,  // Delay in ms after all gadget popup animations complete before charging starts
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

    LEVEL_COMPLETION: {
        BUFFER_TIME: 500,              // ms buffer after all coins collected before next level loads
    },

        // Platform stripes (top half) with battery slot on left, gadget on right
    PLATFORM: {
        Y_POSITIONS: [200, 390, 580],  // vertical centre Y of each platform stripe
        STRIPE_X: 20,                  // left edge of stripe (px)
        STRIPE_WIDTH: 680,             // full stripe width (px)
        STRIPE_HEIGHT: 18,             // stripe height (px)
        STRIPE_COLOR: "#1e3a4a",
        STRIPE_ALPHA: 0.9,

        // ── Battery slot ──────────────────────────────────────────────────────
        SLOT_PADDING_FROM_LEFT: 40,    // padding from stripe left edge to slot left edge (px)
        SLOT_SIZE: 130,                // slot square size (px)

        // In LANDSCAPE the three slots sit in the UI half above the grid, packed
        // to the LEFT from the grid panel's edge and spaced by the grid's own
        // cell gap, with the trencher icon filling the space left on the right —
        // "these batteries drive that machine". Drop SLOT_SIZE_FRAC first if the
        // column ever overflows on a short window.
        // (Portrait keeps the slots in the farm half — see createSlots.)
        // The slot SIZE is derived, not set: the three slots take the row's full
        // width less the icon and the gaps, capped at ONE GRID CELL — a battery
        // in a slot should look like a battery in a cell. With the row running
        // edge to edge that cap is what binds, so the slots and the cells match.
        // The three slots are not three things: they are ONE BATTERY. A rounded
        // case holds all three, two dividers mark the cells inside it (stopping
        // short of the walls, so they read as divisions rather than bars), and a
        // small terminal node sits off the right end — the universal battery
        // glyph. The case is sized around three grid cells, so a battery dropped
        // in a division is exactly the size it was in the grid.
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
        SLOT_RADIUS: 15,               // corner radius (px)
        SLOT_ABOVE_STRIPE: 14,         // gap (px) between slot bottom and stripe top
        CHARGE_RATE_GAP: 10,           // gap (px) between charge-rate label bottom and slot top
        CHARGE_RATE_BOLT_SIZE: 18,     // bolt icon display size (px)

        // ── Wire connection (socket) ──────────────────────────────────────────
        SOCKET_GAP_FROM_SLOT: 25,      // gap (px) from slot right edge to socket centre
        SOCKET_SIZE: 40,               // socket sprite display size (px)
        PLUG_SIZE: 28,                 // plug sprite display size (px)
        WIRE_SAG_PERCENT: 130,         // wire length as % of straight-line distance (>100 = sag)
        WIRE_RIGID_LENGTH: 6,          // px of vertical rigid segment at plug/socket end before sag
        WIRE_THICKNESS: 5,             // wire line thickness (px)
        WIRE_COLOR: 0x46464a,          // wire color

        // ── Debug rect (max gadget area) ──────────────────────────────────────
        DEBUG_RECT_PADDING_FROM_SLOT: 110, // padding from slot right edge to debug rect left edge (px)
        DEBUG_RECT_PADDING_FROM_STRIPE: 14, // padding from stripe top to debug rect bottom (px)
        DEBUG_RECT_WIDTH: 170,         // max width for gadget display area (px)
        DEBUG_RECT_ASPECT_RATIO: 3/2,  // width:height ratio — height = WIDTH / RATIO (3:2 = 170×113)
        DEBUG_RECT_SHOW: false,        // show semi-transparent rect for max gadget area
        DEBUG_RECT_COLOR: 0xFF00FF,    // debug rect color (magenta)
        DEBUG_RECT_ALPHA: 0.1,         // debug rect transparency (0-1)

        // ── Tooth-cleaning display (toothbrush level only) ────────────────────
        // Shown to the right of the gadget; tooth_after wipes over tooth_before
        // left→right as the gadget charges 0 → capacity.
        TOOTH_GADGET_NAME: 'brush',    // which gadget name triggers the tooth display
        TOOTH_AREA_WIDTH: 200,         // max width for tooth display area (px)
        TOOTH_AREA_ASPECT_RATIO: 2.5,  // width:height ratio — height = WIDTH / RATIO
        TOOTH_PADDING_FROM_GADGET: 30, // gap from gadget right edge to tooth left edge (px)
        TOOTH_Y_OFFSET: 0,             // vertical nudge for tooth area centre (px)

        // ── Music notes (bluetooth speaker level only) ────────────────────────
        // Notes drift up-right from the speaker; both size and emission rate
        // scale with charge progress (small/few → big/many).
        SPEAKER_GADGET_NAME: 'bluetooth_speaker',
        SPEAKER_NOTE_INTERVAL: 300,    // ms between emission ticks
        SPEAKER_NOTE_BASE_SIZE: 16,    // px note size at full charge (before platform scale)
        SPEAKER_NOTE_MIN_RATE: 0.4,    // avg notes per tick at 0% charge
        SPEAKER_NOTE_MAX_RATE: 3.0,    // avg notes per tick at 100% charge

        // ── Chicken cooking (induction cooktop level only) ────────────────────
        // 8-frame sprite sheet shown centred over the cooktop; the frame steps
        // raw → cooked (frame 0 → 7) as the gadget charges 0 → capacity.
        COOKTOP_GADGET_NAME: 'cooktop',
        CHICKEN_FRAME_COUNT: 8,        // frames in chicken_cooking sheet
        CHICKEN_SIZE_SCALE: 0.7,       // chicken display width = cooktop width * this
        CHICKEN_Y_OFFSET: -25,         // vertical nudge from cooktop centre (px; negative = up, positive = down)

        // ── Sewing machine (animated gadget) ──────────────────────────────────
        // 8-frame sprite sheet (4x2, 176x192 each) used as the gadget itself.
        // Idle = first frame; loop speed ramps from MIN → MAX fps as it charges.
        SEWING_GADGET_NAME: 'sewing_machine',
        SEWING_FRAME_W: 143,
        SEWING_FRAME_H: 122,
        SEWING_FRAME_COUNT: 8,
        SEWING_BASE_FPS: 12,           // animation's base frame rate (timeScale multiplies this)
        SEWING_MIN_FPS: 3,             // loop speed just after charging begins (~0% → slow stitching)
        SEWING_MAX_FPS: 28,            // loop speed at full charge (fast stitching)

        // ── Washing machine (animated gadget) ─────────────────────────────────
        // 6-frame sprite sheet (2 rows x 3 cols, 279x336 each) used as the gadget.
        // Frame 0 = idle (clothes sitting still) shown before any rotation; once
        // charging starts the drum spins by looping frames 1..5, and the loop speed
        // ramps from MIN → MAX fps as it charges 0 → 1.
        WASHING_GADGET_NAME: 'washing_machine',
        WASHING_FRAME_W: 279,
        WASHING_FRAME_H: 336,
        WASHING_LOOP_START: 1,         // first spin frame (frame 0 is idle, excluded)
        WASHING_LOOP_END: 5,           // last spin frame
        WASHING_BASE_FPS: 12,          // base frame rate (timeScale multiplies this)
        WASHING_MIN_FPS: 4,            // loop speed just after charging begins (slow tumble)
        WASHING_MAX_FPS: 24,           // loop speed at full charge (fast spin)

        // Reciprocating saw: handle.png is the base gadget (fit into the standard
        // max-area rect like every other gadget). The blade (blade.png) is layered by
        // the "reciprocating_saw" charge effect and slides in/out of the handle as it
        // charges.
        RECIP_SAW_GADGET_NAME: 'reciprocating_saw',

        // T-shirt cloth shown to the LEFT of the machine; revealed with an organic
        // wavy stitching front as the gadget charges 0 → 1 (a needle glint + running
        // stitch trail ride the reveal front).
        TSHIRT_AREA_WIDTH: 120,        // max width for the cloth display area (px)
        TSHIRT_AREA_ASPECT_RATIO: 1.0, // width:height of the cloth area (height = WIDTH / RATIO)
        TSHIRT_PADDING_FROM_GADGET: 6, // gap (px) from machine left edge to cloth right edge
        TSHIRT_Y_OFFSET: 0,            // vertical nudge from machine centre (px, +down)

        // ── Single-gadget display area ─────────────────────────────────────────
        // The gadget is aspect-fit into a box bounded by these three values, so it
        // can never clip off-screen. Shrink WIDTH_FRAC or raise TOP_RESERVE to make
        // the gadget smaller / lower.
        GADGET_AREA_WIDTH_FRAC: 0.45,  // gadget max width as a fraction of partB width
        GADGET_AREA_TOP_RESERVE: 0.42, // top fraction of partB kept empty for the character
        GADGET_AREA_BOTTOM_GAP: 46,    // px (pre-scale) gap between gadget bottom and junction plug
        GADGET_AREA_SCALE: 0.71,       // overall scale of the max-area box (0.71 ≈ half area vs 1.0)

        // ── Capacity text (above gadget) ───────────────────────────────────────
        CAPACITY_TEXT_GAP: 8,          // gap (px) between capacity text bottom and gadget top
        CAPACITY_TEXT_SIZE: '20px',    // font size for capacity remaining text

        // ── Analog meter ──────────────────────────────────────────────────────
        SHOW_ANALOG_METER: false,       // toggle analog meter display on/off
        METER_PADDING_FROM_GADGET: 40,  // padding from gadget display right edge to meter arc (px)
        METER_Y_OFFSET: 0,             // meter pivot Y offset from gadget bottom (positive = down)
        METER_X: null,                 // override meter pivot X position (null = auto-calculate from gadget)
        METER_Y: null,                 // override meter pivot Y position (null = auto-calculate from gadget)
        METER_RADIUS: 62,              // arc radius (px) - drawn at full size, then scaled
        METER_SCALE: 0.7,              // scale of entire meter (1.0 = normal size, 0.5 = half size)
        METER_EXPLOSION_ANGLE: 170,    // needle angle (0-180) at full charge
        METER_RED_ZONE_ANGLE: 150,     // needle angle where red zone begins
        METER_OSCILLATION_OVERSHOOT: 12, // degrees of overshoot per tick

        // ── Operating-capacity mark ────────────────────────────────────────────
        // Progress (0-1) at which a gadget reaches its FULL operating capacity.
        // Per-gadget charge effects (glow, spin, ...) ramp to MAX by this point and
        // hold steady afterwards. The remaining range (mark → 1.0) is the "overload"
        // zone where the gadget struggles/vibrates before exploding.
        // Matches the meter's red-zone start (150/170 ≈ 0.882).
        OPERATING_CAPACITY_MARK: 150 / 170,

        // ── Smoke effect ──────────────────────────────────────────────────────
        SMOKE_START_PROGRESS: 0.80,    // 0-1 charge fraction at which smoke begins
        SMOKE_FREQUENCY_START_MS: 600,  // ms between puffs when smoke first appears (sparse)
        SMOKE_FREQUENCY_MAX_MS: 50,     // ms between puffs at peak / just after explosion (dense, faster)
        SMOKE_FREQUENCY_IDLE_MS: 450,   // ms between puffs after post-explosion burst (low idle)
        SMOKE_MAX_AFTER_EXPLOSION_MS: 5000, // ms to sustain max smoke after burnout (longer)
        SMOKE_LIFESPAN_MS: 1200,       // ms each puff lasts
        SMOKE_RADIUS_MIN: 3,           // min puff radius (px)
        SMOKE_RADIUS_MAX: 8,           // max puff radius (px)
        SMOKE_SPREAD_X: 20,            // horizontal spawn spread around gadget centre (px)
        SMOKE_DRIFT_Y: 55,             // how far upward each puff drifts (px)
        SMOKE_COLOR: 0x999999,         // puff color

        // ── Explosion ────────────────────────────────────────────────────────
        EXPLODE_SHAKE_DURATION: 350,   // ms of camera shake on gadget burnout
        EXPLODE_SHAKE_INTENSITY: 0.001, // shake magnitude (0–1 scale) - gentle shake at explosion
        USE_CODE_EXPLOSION: false,       // toggle code-based explosion (rings and radial lines)
        USE_SPRITE_EXPLOSION: true,    // toggle sprite-based explosion (animated frames)
        SPRITE_EXPLOSION_SCALE: 2.0,    // scale of sprite explosion animation
        SPRITE_EXPLOSION_DURATION: 400, // ms duration of sprite explosion animation
        BURNEDOUT_DISPLAY_DURATION: 500, // ms to show burned out sprite before fading/removing it (0 = keep forever)
        BURNEDOUT_FADE_DURATION: 500,  // ms for burned out sprite fade-out animation
        // ── Charging effects ──────────────────────────────────────────────────
        BATTERY_PULSE_SCALE: 0.6,     // scale multiplier when battery pulses during charging (1.04 = 4% larger)
        BATTERY_PULSE_DURATION: 80,   // ms for battery pulse animation
        
        CHARGE_PARTICLE_SIZE: 2,       // radius of energy particle traveling through wire (px)
        CHARGE_PARTICLE_SPEED: 450,    // ms for particle to travel from plug to gadget
        
        CHARGE_FLASH_INITIAL_SIZE: 16, // initial size of bolt flash at gadget (px)
        CHARGE_FLASH_FINAL_SIZE: 32,   // final size of bolt flash before fade (px)
        CHARGE_FLASH_DURATION: 250,    // ms for flash scale-up and fade animation
        
        // Energy beam effects
        ENERGY_BEAM_ENABLED: true,     // toggle energy beam effect along wire
        ENERGY_BEAM_THICKNESS: 8,      // thickness of energy beam along wire (px)
        ENERGY_BEAM_COLOR: 0xFFFF00,   // color of energy beam
        ENERGY_BEAM_ALPHA: 0.6,        // opacity of energy beam
        ENERGY_BEAM_DURATION: 300,     // ms for beam to appear and fade
        
        // Advanced Arcing Wire Effect (Lightning-style)
        USE_ARCING_WIRE: true,         // toggle advanced arcing wire effect (overrides simple beam)
        ARCING_WIRE_ROUGHNESS: 1.2,    // roughness of lightning arc (0.5-2.0 for spiky effect)
        ARCING_WIRE_SEGMENTS: 15,      // number of path segments (lower = more jagged)
        ARCING_WIRE_DISPLACEMENT_SCALE: 0.8, // how far arcs drift from wire (0.3-1.5)
        ARCING_WIRE_JITTER_PASSES: 2,  // number of displacement passes (1-3, more = spikier)
        ARCING_WIRE_RANDOM_OFFSET: 8,  // random perpendicular offset per segment (px)
        ARCING_WIRE_GLOW_THICKNESS: 6, // thick glow layer (px)
        ARCING_WIRE_MEDIUM_THICKNESS: 3, // medium bright layer (px)
        ARCING_WIRE_CORE_THICKNESS: 1, // thin white core (px)
        ARCING_WIRE_GLOW_COLOR: 0x00CCFF, // cyan/blue glow color
        ARCING_WIRE_BRIGHT_COLOR: 0x00EEFF, // bright blue color
        ARCING_WIRE_CORE_COLOR: 0xFFFFFF, // white core color
        ARCING_WIRE_PULSE_SPEED: 2.5,  // speed multiplier for animation (not used for travel, affects flicker rate)
        ARCING_WIRE_PULSE_DURATION: 200, // total duration of arc effect (ms) - how long arc stays visible
        
        GADGET_ENERGY_GLOW_ENABLED: false, // toggle energy glow around gadget during pulse
        GADGET_ENERGY_GLOW_SIZE: 20,   // size of glow halo around gadget (px)
        GADGET_ENERGY_GLOW_COLOR: 0xFFFF00, // color of energy glow
        GADGET_ENERGY_GLOW_ALPHA: 0.5, // opacity of energy glow
        GADGET_ENERGY_GLOW_DURATION: 300, // ms for glow to appear and fade
        
        // Advanced Gadget Aura Effect
        USE_GADGET_AURA: true,         // toggle advanced gadget aura effect (overrides simple glow)
        GADGET_AURA_LAYERS: 3,         // number of concentric glow layers
        GADGET_AURA_BASE_SIZE: 180,     // base size of innermost aura layer (px)
        GADGET_AURA_COLOR: 0x00DDFF,   // aura color
        GADGET_AURA_PULSE_SPEED: 2.0,  // breathing speed (cycles per second)
        GADGET_AURA_SPARK_COUNT: 8,    // number of spark particles per pulse
        GADGET_AURA_SPARK_DURATION_MIN: 100,  // min duration (ms) for sparks to reach gadget center
        GADGET_AURA_SPARK_DURATION_MAX: 400, // max duration (ms) for sparks to reach gadget center
        
        // Gadget visual feedback on charge
        GADGET_FLASH_ON_CHARGE_ENABLED: false, // toggle alpha flash effect when gadget receives charge
        //Gadget tension color change
        GADGET_TENSION_COLOR_CHANGE_ENABLED: false, // toggle color change effect based on tension level
        GADGET_SPRITE_SWITCH_ON_TENSION_ENABLED: false, // toggle switching to alternate "tense" sprite when tension is high
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
            FILE:    'level_maps/level_01.tmj',
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
            CROP_CYCLE:   ['tomato', 'mango', 'grape'],
            CROP:         'tomato',  // fallback when CROP_CYCLE is empty
            CROP_STAGES:  5,
            CROP_GROW_MS: 2000,     // time between growth stages
            CROP_WET:     0.15,     // canal-cell fill fraction that counts as "watered"

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
                DEPTH_SHADOW: 1.522,  // under both parts, over the trench tile

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
                // Draw order. Both parts sit above the dry trench tile (1.52)
                // and below EVERYTHING the water brings with it — the crest
                // foam that leads the waterline (1.525 / 1.53 when
                // TILEMAP.FOAM_ABOVE is off), the revealed water (1.55) and the
                // head (1.56). So the machine is down in the ditch and the
                // water rolls over it, crest first. The belt stays above the
                // control unit.
                DEPTH_BELT: 1.524,
                DEPTH_CTRL: 1.523,
            },

            // (the last dry stretch is flooded by the water's own flow — see
            //  WATER.FLOW_TAU / MIN_SPEED, not a timed animation)

            // ── Colours ───────────────────────────────────────────────────
            // (machine look comes from graphics/trencher/)
            CUT_COLOR:     0x84694a,  // raw soil exposed in the cut under the
                                      // machine, before the water reaches it
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
