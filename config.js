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

    RESET_PROGRESS: false,
    BATTERY_START_LEVEL: 1,
    BATTERY_IMAGE_EXTENSIONS: ['svg', 'png', 'jpg', 'webp'],

    BACKGROUND: {
        GRADIENT_START_COLOR: "#79d288",
        GRADIENT_END_COLOR: "#79d288",
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
    },

    BATTERY_UNLOCK_DISPLAY: {
        DISPLAY_CROWN_PANEL: true,
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
        BATTERY_DISPLAY_SIZE: 64,
        BATTERY_SCALE: 1.0,
        BATTERY_Y_OFFSET: 5,
        LEVEL_TEXT_SIZE: '11px',
        LEVEL_TEXT_COLOR: '#000000',
        LEVEL_TEXT_Y_OFFSET: -40,
        DRAGGABLE_BG_COLOR: "#FFFFFF",
        DRAGGABLE_BG_ALPHA: 0,
        GRID_PANEL_PADDING: 40,
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
    CAR: {
        ENABLED: false,            // master switch — when true, partB shows the car/incline instead of a gadget

        // ── Body dimensions (forced display sizes, per car spec) ──────────
        CHASSIS_WIDTH:  120,
        CHASSIS_HEIGHT: 60,
        WHEEL_RADIUS:   15,        // physics circle radius (sprite = 30×30)
        // Wheel offsets from chassis centre (size-independent ratios baked in)
        REAR_WHEEL_OFFSET_X:  -38, // -0.317 × width
        FRONT_WHEEL_OFFSET_X:  38, // +0.317 × width
        WHEEL_OFFSET_Y:        25, // +0.417 × height

        // ── Physics properties ────────────────────────────────────────────
        CHASSIS_DENSITY: 0.002,
        WHEEL_DENSITY:   0.001,
        WHEEL_FRICTION:  0.9,
        GROUND_FRICTION: 0.9,
        CHASSIS_CHAMFER: 30,       // rounded ends (half of chassis height)
        AXLE_STIFFNESS:  0.2,      // constraint stiffness (rigid-ish axle)

        // ── Motor ─────────────────────────────────────────────────────────
        MOTOR_TORQUE: 40,          // constant torque applied to rear wheel while driving

        // ── Incline ───────────────────────────────────────────────────────
        INCLINE_ANGLE_DEG: 15,     // straight incline, rising to the right
        INCLINE_LENGTH:    8000,   // effectively endless for now (plateau added later)
        INCLINE_THICKNESS: 200,    // ground slab thickness (only the surface matters)

        // ── Charge → distance mapping ─────────────────────────────────────
        // "every 1 unit of charge delivered by the slots → travel 0.2 units up the incline"
        DISTANCE_PER_CHARGE: 0.2,  // distance-units earned per unit of charge
        PX_PER_UNIT:         8,    // pixels along the incline per distance-unit (tunable)
    },

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
    ROAD: {
        ENABLED: true,             // master switch — when true, partB shows the road

        // ── Geometry (laid out inside partB) ──────────────────────────────
        // One entry per road, left to right; LANE_DIRS gives each lane's travel
        // direction (-1 = down, +1 = up), so the list length is the lane count.
        // Divided 4-lane highway: each carriageway is one-way, split by the median.
        ROADS: [
            { LANE_DIRS: [ 1,  1] },   // the one carriageway: 2 lanes, both heading up.
                                       // A single road is centred in partB by
                                       // construction, so it sits symmetrically
                                       // about the half's centre line
        ],

        TRAFFIC_ENABLED: false,        // false: no vehicles at all — no pool, no
                                       // spawning, no queues. The road geometry
                                       // (and the lane widths derived from the car
                                       // art) is kept; only the traffic is gone.
                                       // With no queue to form, the boring machine
                                       // starts digging as soon as it has charge
        ROAD_GAP:     4,           // gap between adjacent roads (px @ platformScale).
                                   // Also sets how far apart the two tracks run
                                   // through the curve — the concentric spacing is
                                   // derived from road width + this gap, so they
                                   // stay separated (never touching) at any value > 0
        LANE_FACTOR:  1.6,         // lane width as a multiple of car width — drives the
                                   // road width (lanes × lane), so lanes always hug the
                                   // cars instead of leaving a phantom empty lane
        LANE_SQUEEZE: 0.72,        // pulls lanes toward their road's centre line (1 = sit
                                   // dead centre in the lane, 0 = all stacked on the centre
                                   // line). Keeps vehicles off the edge stripes without
                                   // narrowing the road itself
        BOTTOM_GAP:   40,          // gap above the batteries/junction where the road starts

        // ── Curve bottleneck: 2 lanes → 1 through the hug ─────────────────
        // Around the mountain each carriageway narrows to a single lane: the
        // two lanes taper onto the centre line, the asphalt narrows with them,
        // and cars yield across lanes at the merge point so they file through
        // one at a time. Congestion at the mouth of the curve is the point.
        CURVE_MERGE: {
            ENABLED: true,
            TAPER:   16,           // arc length over which the lanes converge and
                                   // the asphalt narrows (px @ platformScale). The
                                   // taper sits just inside the bend — lanes stay
                                   // parallel and vertical until the curve starts,
                                   // then snap together quickly
            WINDOW:  85,           // how far before the merge cars start yielding
                                   // to the other lane — the queue forms here
            ZONE_SPEED: 6,         // crawl speed through the single-lane stretch
                                   // (px/sec @ platformScale). This is the choke:
                                   // the curve discharges slower than the straights
                                   // deliver, so a standing queue builds at the
                                   // mouth — the congestion IS this mismatch
        },

        // ── Tunnel: the battery-powered boring machine ────────────────────
        // Merged batteries bank drilling distance; a blade pierces the mountain
        // bottom → top. The "rotation" is a barber-pole illusion: a helix
        // rotating about its long axis reads from above as its flights sliding
        // ALONG the axis, so the shaft is a TileSprite whose diagonal-stripe
        // texture scrolls, under a static cylinder-shade overlay (lighting
        // doesn't rotate with the drill).
        //
        // Each carriageway gets its OWN bore and machine: two tunnels drilled
        // side by side in lockstep, mountain left standing between them. On
        // breakthrough the roads simply continue straight through — two lanes
        // up in one tunnel, two lanes down in the other, no merge, no speed
        // limit — as if the obstacle had never been there.
        TUNNEL: {
            ENABLED: true,

            // ── Drilling ──────────────────────────────────────────────────
            QUEUE_WAIT_MS: 1500,   // the dig starts only after the lead upstream
                                   // vehicle has stood at the barrier this long
                                   // (a few more halt behind it meanwhile)
            PULSE_MS: 450,         // burst length: each 1s battery tick jolts the
                                   // machine — it spins and advances for this long,
                                   // then sits dead until the next tick
            ADVANCE_PER_CHARGE: 2, // px of drilling banked per unit of battery charge
            SCROLL: 90,            // UV scroll speed (screen px/s) on the auger's
                                   // spiral section — the perceived rotation speed
            BLADE_LEN: 48,         // FIXED machine length (px @ platformScale): the
                                   // auger is a vehicle-sized rig that climbs with
                                   // the face, paving road behind itself — not a
                                   // shaft stretching back to the entry
            BLADE_DIAM: 0.82,      // machine width (the auger art's flight is its
                                   // widest part) as a fraction of the bore
            OPPOSED_DRILL: false,  // false: both rigs park at the bottom mouth
                                   // and cut bottom→top (machines advance in the
                                   // traffic's direction). true: each road's rig
                                   // starts at its own queue's mouth — the down
                                   // road's cuts top→bottom instead
            MARGIN: 6,             // channel width beyond the roads' outer edges
                                   // (px @ platformScale) — the visible cut walls

            // ── Toll gantry (mid-tunnel) ──────────────────────────────────
            TOLL: {
                ENABLED: true,
                PER_VEHICLE: 1,    // coins per vehicle crossing mid-tunnel
                FLUSH_MS: 5000,    // every this often, the tolls collected on
                                   // the right half are banked into the main
                                   // coin account (the merge-spawn currency)
            },

            // ── Road tiling (after breakthrough) ──────────────────────────
            TILE_COUNT: 5,         // the tunnel road is laid as this many equal
                                   // sections after drilling completes
            TILE_MS: 300,          // delay between one section landing and the
                                   // next (entry → exit order)

            // ── Cut walls (open-cutting elevation) ────────────────────────
            WALL_W: 8,             // horizontal width of the carved wall face
                                   // beside each road edge (px @ platformScale)
            WALL_ALPHA: 0.4,       // how much the sand wall darkens at its foot
                                   // (road edge); eases to full sand at the
                                   // crest — 0 = flat sand, 1 = black foot
            WALL_FADE: 36,         // vertical fade length (px @ platformScale)
                                   // at each tunnel mouth, where the sand wall
                                   // melts into the surrounding green

            // ── Colours ───────────────────────────────────────────────────
            // (machine look comes from graphics/auger.png)
            CUT_COLOR:     0x84694a,  // raw sand exposed in the bore under the
                                      // machine, before the road is paved behind
            DEBRIS_COLORS: [0x8a7454, 0x9c8a66, 0x6b5d45, 0xa89066],
                                      // sandy spoil chip tints, picked at random
            DUST_COLOR:    0xa89878,  // soft dust cloud drifting off the cut
        },

        // ── Endless progression (requires TUNNEL.ENABLED) ─────────────────
        // After each breakthrough the next mountain is generated ABOVE the
        // current one; once the 5s toll cycle banks, the camera pans up the
        // highway to it — same cars, same lanes, literally continuous — and
        // the world rebases so the loop runs forever.
        ENDLESS: {
            ENABLED: true,
            PAN_MS: 2500,          // camera travel time to the next mountain
            SEED_STEP: 1,          // segment k's terrain seed = SEED + k*STEP
        },

        // ── Island (the mountain range that severs the roads) ─────────────
        // In tunnel mode the mountain is a continuous horizontal range across
        // the whole half: there is no way around it. Both roads dead-end into
        // its faces (up traffic queues at the bottom face, down traffic at the
        // top face) until the boring machines cut through and the missing road
        // segment is paved. WIDTH and the curve/detour settings below only
        // apply when TUNNEL is disabled (the old wrap-around layout).
        //
        // Legacy header (wrap-around mode):
        // A broad horizontal oblong straddling the road at its vertical centre —
        // a mountain the highway has to detour around. It's far wider than the
        // road, so each carriageway hugs its face: out along the near side,
        // around the end cap, and back along the far side. The up road wraps its
        // left end, the down road its right end, mirroring around it.
        //
        // The oblong is the shape the ROAD hugs. The mountain drawn inside it is
        // procedural and irregular, and always stays within the oblong — so the
        // art can change freely (per level, via SEED) without touching the road
        // geometry. Gaps between kerb and mountain vary, which is what makes it
        // read as terrain rather than a kerbed median.
        ISLAND: {
            ENABLED:    true,
            WIDTH:      480,       // px @ platformScale — much wider than the road,
                                   // which is what forces the detour around the end
            HEIGHT:     216,       // depth across the road; ends are semicircles of
                                   // HEIGHT/2, so this also sets how broad the wrap is.
                                   // Keep well under the road's length or the hill
                                   // crowds out the straights and the turns clamp
            CLEARANCE:  2,         // gap held between the oblong and the asphalt edge
                                   // for the whole hug — kerb-tight, the road presses
                                   // against the mountain foot
            TURN_RADIUS: 40,       // radius of the two turns where the straight road
                                   // swings into the hug. Larger = longer, lazier
                                   // sweep; clamped to whatever actually fits
            PASS_SIDE:  0,         // unused in tunnel mode (roads are severed, no
                                   // detour exists). Legacy: which end of the mountain
                                   // detour around: 1 = right, -1 = left. They run
                                   // concentric through the curve (the road nearer
                                   // the wrapped end takes the inner track). 0 =
                                   // each road wraps its own nearest end instead

            // ── Mountain art (Perlin height field, baked once at create) ──
            // A genuine Perlin-fBm height field shaped by a dome that falls to
            // zero at the oblong's edge, painted as FLAT TERRACES in the bright
            // palette — grass foot, rock, snow — with a light two-tone slope
            // shade and a bold outline. Perlin gives every contour its own
            // organic outline (no rings, no symmetry); the terracing keeps it
            // cartoon instead of photoreal.
            FLAT:       true,      // FLAT LAND MODE: skip the height field entirely —
                                   // no massif, no hills, no gorge, no terraces, just
                                   // the flat GROUND_COLOR the roads sit on. Only the
                                   // terrain ART is affected: the roads still dead-end
                                   // at the island's band and the augers still drill it
                                   // (the tunnels key off the island GEOMETRY, and the
                                   // soil-colour cut is painted by the bore itself).
                                   // Set false to bring the mountain back.
            SEED:       7,         // change per level — the only thing that varies
            DETAIL:     2.6,       // noise features per oblong-radius: lower = one
                                   // broad massif, higher = busier ridges

            // ── Terrain merge (mountain ↔ road environment) ───────────────
            // The terrain covers the WHOLE road area, and the roads carve flat
            // corridors through it — the road sits at zero elevation, which is
            // exactly why the road runs where it does. The oblong just holds
            // the tallest peak; lower hills continue outside the road curve so
            // mountain and road read as one environment, not an exhibit.
            HILLS:         0.5,    // height of the surrounding hills relative to
                                   // the main peak (0 = old isolated-oblong look)

            // ── Gorge (the outer side of the curve) ───────────────────────
            // Along the curved hug, the ground on the OUTSIDE of the roads
            // falls away into a steep gorge — the cliffhanger stretch: mountain
            // wall on one side of the road, a drop on the other. It exists only
            // through the curve span and fades back to normal terrain at both
            // ends and beyond WIDTH, where the hills resume as the far wall.
            GORGE: {
                ENABLED: false,    // gorge belonged to the cliffhanger curve —
                                   // no curve exists in tunnel (severed) mode
                DEPTH:  0.55,      // how deep the drop reads (same units as the
                                   // terrain height, 1 = the main peak's scale)
                WIDTH:  70,        // px @ platformScale the canyon floor extends
                                   // beyond the cliff edge before hills resume
                LEDGE:  1.5,       // flat lip kept between the asphalt and the
                                   // drop — a bare kerb, the road hangs on it
                TAPER:  34,        // fade of the gorge along the road at the two
                                   // ends of the curve span
                COLORS: [0x6da344, 0x49702f, 0x2f4d20, 0x1c3115], // shallow→deep
            },
            GROUND_COLOR: 0x8ed04f,// elevation-zero ground — the flat grassland the
                                   // roads run through and the terrain rises from.
                                   // Deliberately DISTINCT from the game background:
                                   // it has to read as land under the roads, not as
                                   // backdrop. The bake borders alpha-fade into the
                                   // backdrop instead
            SHOULDER:      10,     // flat verge beside the asphalt on the STRAIGHTS
                                   // (px @ platformScale)
            CURVE_SHOULDER: 1,     // verge through the curve — almost nothing, the
                                   // cliffhanger stretch has no spare ground
            CURVE_FALLOFF:  8,     // terrain rise distance through the curve: the
                                   // mountain wall climbs right at the kerb instead
                                   // of over MERGE_FALLOFF
            MERGE_FALLOFF: 44,     // distance over which terrain climbs from the
                                   // road verge to full height. Generous, so a band
                                   // of flat grassland travels with the roads
            EDGE_FADE:     26,     // terrain fade at the bake borders, so it meets
                                   // the background without a hard seam
            SMOOTHING:  2,         // blur radius (texture px) applied to the height
                                   // field before painting — rounds ragged terrace
                                   // boundaries into smooth contours. 0 = off
            WALL_H:     0.45,      // the mountain rim rises as a steep WALL to this
                                   // height within WALL_W of its edge — so the
                                   // silhouette starts beside the road, not after a
                                   // long green skirt of slowly-rising skirt terrain
            WALL_W:     0.10,      // rim wall thickness, fraction of the cap radius
            STEEPNESS:  1.5,       // dome exponent. >1 pulls the upper terraces in
                                   // toward the summit, so the peak reads TALL and
                                   // steep instead of a broad mound; 1 = the old
                                   // even slope
            OCTAVES:    4,         // fBm layers: detail per octave, halving in size
            THRESHOLD:  0.10,      // height where the mountain starts — the cut is
                                   // what makes the outline organic, and it always
                                   // falls inside the oblong, clear of the road
            SHADE:      0.73,      // shadow-tone multiplier for slopes facing away
                                   // from the light (up-left). Two tones only
            TERRACE_EDGE: 0.85,    // darkening on the lip of each terrace — with no
                                   // outline or drop shadow (the terrain is
                                   // continuous now, there's no silhouette to line
                                   // or to shadow), these lips and the slope shade
                                   // carry all the relief
            MAX_RES:    512,       // bake resolution cap (px, long side)
            // Colour ramp stops, base → summit: bright grass, deep grass, warm
            // rock, pale rock, snow. These are STOPS, not terraces — STEPS says
            // how many terraces to cut, and their colours are interpolated
            // along this ramp. More steps = finer elevation gradation.
            COLORS: [0x74c046, 0x5fae3c, 0xcf9d63, 0xe2b77f, 0xffffff],
            STEPS:  10,            // number of flat terraces cut from the ramp

            // ── Tree tops (flat green ground decoration) ──────────────────
            TREES: {
                ENABLED: true,
                SIZE:    32,       // tree-top sprite width (px @ platformScale);
                                   // height follows the art's aspect ratio
                SPACING: 26,       // jittered placement grid cell — larger =
                                   // sparser woods, smaller = denser
                DENSITY: 0.6,      // chance a grid cell plants a tree (0..1)
                TREELINE: 0.5,     // max terrain height (0..1) that grows trees —
                                   // ~the top of the grass terraces; above this
                                   // it's bare rock and snow
            },

            // ── Rocks (sparse boulders, any elevation) ────────────────────
            ROCKS: {
                ENABLED:  true,
                COUNT:    10,      // how many boulders to scatter
                MIN_SIZE: 12,      // smallest boulder width (px @ platformScale)
                MAX_SIZE: 64,      // largest boulder width
            },
        },

        // ── Colours ───────────────────────────────────────────────────────
        ASPHALT_COLOR: 0x494c52,   // road surface — worn asphalt: mid grey, faintly
                                   // blue so it reads as tarmac rather than shadow
        STRIPE_COLOR:  0xdcd8cc,   // edge stripes — off-white, warm and muted so
                                   // they read as paint rather than glowing lines

        // ── Edge stripes (dashed, drawn once) ─────────────────────────────
        STRIPE_WIDTH:  1.5,        // stripe thickness — held at a readability floor
                                   // rather than scaled with the framing; thinner
                                   // than this shimmers against the asphalt
        STRIPE_DASH:   6,          // dash length
        STRIPE_GAP:    5,          // gap between dashes
        STRIPE_INSET:  2,          // dash centre inset from the road edge

        // ── Vehicles ──────────────────────────────────────────────────────
        // The first entry is the reference: CAR_LENGTH sets its on-screen length,
        // and every other vehicle is drawn at that same art scale — so a bus comes
        // out longer and wider than a car purely from its source artwork, with no
        // per-vehicle sizes to keep in sync. WEIGHT is relative spawn frequency.
        VEHICLES: [
            { KEY: 'veh_car',   FILE: 'graphics/tunnel/car.png',   WEIGHT: 6 },
            { KEY: 'veh_van',   FILE: 'graphics/tunnel/van.png',   WEIGHT: 3 },
            { KEY: 'veh_truck', FILE: 'graphics/tunnel/truck.png', WEIGHT: 2 },
            { KEY: 'veh_bus',   FILE: 'graphics/tunnel/bus.png',   WEIGHT: 1 },
        ],
        CAR_LENGTH:    17,         // reference car display height (px @ platformScale)
        CAR_POOL:      180,        // max live vehicle sprites — the pool never grows past
                                   // this. The detour makes each lane's path longer than
                                   // the road is tall, so this sits well above what a
                                   // straight road would need. Run dry and lanes just thin
                                   // out at the entry — no error
        SPEED_MIN:     13,         // slowest desired cruising speed (px/sec @ platformScale)
        SPEED_MAX:     28,         // fastest desired cruising speed — well above the
                                   // curve's ZONE_SPEED, so traffic arrives at the
                                   // merge faster than it can get through
        MIN_GAP:       6,          // bumper-to-bumper gap a car refuses to close on the one ahead
        FOLLOW_GAIN:   1.8,        // how hard a car brakes as the gap shrinks (higher = twitchier)
        SPAWN_MS:      220,        // spawn attempt interval per lane (skipped if the
                                   // entry is blocked) — quick enough to keep the
                                   // road fed while the curve chokes the flow
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
