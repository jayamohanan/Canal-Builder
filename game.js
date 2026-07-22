// Overcharge! — main game scene
// No physics engine — pure drag/drop battery merge + gadget charging

class AssetManager {
    constructor(scene) {
        this.scene = scene;
        this.loading = new Map();
    }

    ensureImage(key, url) {
        if (this.scene.textures.exists(key)) {
            return Promise.resolve();
        }

        if (this.loading.has(key)) {
            return this.loading.get(key);
        }

        const promise = new Promise((resolve, reject) => {
            this.scene.load.image(key, url);
            this.scene.load.once(`filecomplete-image-${key}`, () => {
                this.loading.delete(key);
                resolve();
            });
            this.scene.load.once('loaderror', () => {
                this.loading.delete(key);
                reject();
            });
            this.scene.load.start();
        });

        this.loading.set(key, promise);
        return promise;
    }

    ensureBattery(level) {
        const key = `battery${level}`;
        const data = getBatteryData(level);
        if (!data) return Promise.resolve();
        return this.ensureImage(key, `graphics/battery/${data.fileName}`);
    }

    // Warm a battery level in the background (fire-and-forget).
    // ensureBattery already dedupes via textures.exists + the loading Map.
    prefetchBattery(level) {
        if (level < 1) return;
        this.ensureBattery(level).catch(() => {});
    }
}

class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    // ================================================================
    // INIT
    // ================================================================
    init() {
        this.platforms          = [];   // 3 battery slots (share this name so the
                                        // drag/drop code keeps working unchanged)
        this.gadget             = null; // single shared gadget powered by all slots
        this.gadgetsData        = null;
        this.currentGadgetIndex = 0;

        this.coins              = 1000;
        this.grid               = Array(3).fill(null).map(() => Array(3).fill(null));
        this.gridCells          = [];
        this.batteries          = [];
        this.draggingBattery    = null;
        this.hasStartedPlaying  = false;
        this.spawnButtonLevel   = CONFIG.BATTERY_START_LEVEL;
        this.spawnCost          = 10;
        this.highestBatteryLevel = CONFIG.BATTERY_START_LEVEL;
        this.levelUpTimer       = null;
        this.levelUpButtonVisible    = false;
        this.levelUpButtonShowTime   = null;
        this.firstLevelUpTimer  = true;
        this.mergeTutorialShown = false;
        this.mergePointer       = null;
        this.unlockDisplayContainer  = null;
        this.unlockDisplayText       = null;
        this.unlockDisplayBatteryIcon= null;
        this.highestUnlockedBatteryLevel = 0;
        this.gadgetAnimationsComplete = false;
        this.isWatchingAd = false;  // Flag to block interactions during ad

        this.CELL_SIZE  = CONFIG.CELL.SIZE;
        this.CELL_GAP   = CONFIG.CELL.GAP;
        this.CELL_RADIUS= CONFIG.CELL.RADIUS;
        this.GRID_COLS  = 3;
        this.GRID_ROWS  = 3;

        this.chargingSlots    = [null, null, null];
        this.chargingInterval = null;

        // ── Car / incline (right-half pivot) ─────────────────────────────
        this.car               = null;   // { chassis, rearWheel, frontWheel + sprites }
        this.carDriving        = false;   // true only while actively climbing; else frozen (static)
        this.carParkedPose     = null;    // snapshot of body transforms held while idle
        this.carEarnedDistPx   = 0;       // total distance (px) the car is allowed to climb
        this.carForward        = { x: 1, y: 0 }; // up-slope unit vector
        this.carStartPos       = { x: 0, y: 0 }; // reference for measuring travel

        // ── Road / traffic (right-half pivot) ────────────────────────────
        this.road              = null;   // shared geometry + vehicle table for all roads
        this.roadLanes         = [];     // flat list across all roads: { x, dir, cars }
        this.roadCarPool       = [];     // idle car sprites available for reuse
        this._roadLastTime     = 0;      // update() timestamp for dt-based motion

        // ── Tunnel boring machine (battery-powered) ──────────────────────
        this.tunnel            = null;   // { x, entryY, exitY, len, progressPx, ... }

        // Layout state for responsive design
        this.isPortrait         = true;  // Detected in create()
        this.layoutConfig       = {};    // Will store calculated layout values
        this.platformsContainer = null;
        this.gridContainer      = null;
        this.uiContainer        = null;
    }

    // ================================================================
    // LAYOUT HELPERS
    // ================================================================
    calculateLayout() {
        const W = this.scale.width;
        const H = this.scale.height;
        this.isPortrait = H > W;

        const COLS = this.GRID_COLS, ROWS = this.GRID_ROWS, GAP = this.CELL_GAP;
        const P    = CONFIG.PLATFORM;
        const isP  = this.isPortrait;

        // ── partA (grid/UI) and partB (platforms): strict 50/50 split ──────────
        // Portrait:  partA = bottom half, partB = top half
        // Landscape: partA = left half,   partB = right half
        let partA, partB;
        if (isP) {
            partA = { x: 0,     y: H * 0.5, width: W,       height: H * 0.5 };
            partB = { x: 0,     y: 0,       width: W,       height: H * 0.5 };
        } else {
            partA = { x: 0,     y: 0,       width: W * 0.5, height: H };
            partB = { x: W*0.5, y: 0,       width: W * 0.5, height: H };
        }

        // ── TWO-FACTOR RESPONSIVE SIZING ───────────────────────────────────────
        // Single design reference = my 1440×778 landscape MacBook, whose partA
        // (left half) is 720×778. partB has identical dimensions to partA in both
        // orientations, so the same factors apply to both halves.
        //   sW    = width  ratio  → HORIZONTAL gaps / margins / offsets
        //   sH    = height ratio  → VERTICAL   gaps / margins / positions
        //   scale = min(sW, sH)   → UNIFORM element SIZES (keeps the grid square)
        // No upper clamp — everything scales past the reference on bigger screens.
        const BASE        = this.CELL_SIZE;                           // 130
        const panPadRef   = CONFIG.CELL.GRID_PANEL_PADDING;          // 40
        const btnBotRef   = CONFIG.BUTTON.BOTTOM_PADDING;            // 70
        const btnGridRef  = CONFIG.MERGE_GRID.PADDING_FROM_BUTTON_TOP; // 50
        const coinGapRef  = 25;
        const spawnBtnLogHalfRef = CONFIG.BUTTON.SPAWN_HEIGHT / 2;   // 45

        const REF_W = 720, REF_H = 778;                 // design partA from my 1440×778 MacBook
        const sW    = partA.width  / REF_W;             // horizontal ratio
        const sH    = partA.height / REF_H;             // vertical ratio
        const scale = Math.min(sW, sH);                 // uniform size factor (square-preserving)
        const cellSize = BASE * scale;                  // no Math.min(BASE,…) clamp

        // SIZES — uniform `scale`
        const panPad           = Math.floor(panPadRef * scale);
        const spawnBtnLogHalf  = spawnBtnLogHalfRef * scale;        // button half-height is a SIZE
        const spawnBtnDisplayH = Math.floor((CONFIG.BUTTON.SPAWN_HEIGHT + 30) * scale);
        const panW             = COLS * cellSize + (COLS - 1) * GAP + 2 * panPad;
        const spawnBtnDisplayW = Math.min(
            Math.floor((CONFIG.BUTTON.SPAWN_WIDTH + 30) * scale),
            panW - 10                                                // relational cap — kept
        );

        // VERTICAL anchors — each block's centre sits at a fixed fraction of
        // partA.height (designY × sH). The topmost item therefore lands at its
        // design Y on any aspect (no empty top band), and because scale ≤ sH the
        // scale-sized elements never overflow the proportional spacing (no overlap).
        // Design anchor Ys are derived once from the gap refs at design scale.
        const designGridH       = ROWS * BASE + (ROWS - 1) * CONFIG.CELL.GAP;       // 398
        const designPanH        = designGridH + 2 * panPadRef;                      // 478
        const designButtonCY    = REF_H - btnBotRef;                                // 708
        const designGridBotEdge = designButtonCY - spawnBtnLogHalfRef - btnGridRef; // 613
        const designPanelCY     = designGridBotEdge + panPadRef - designPanH / 2;   // 414
        const designCoinCY      = designPanelCY - designPanH / 2 - coinGapRef;      // 150
        const buttonCenterY     = partA.y + designButtonCY * sH;
        const panelCenterY      = partA.y + designPanelCY  * sH;
        const coinCenterY       = partA.y + designCoinCY   * sH;

        // ── Platform scale: slot size matches cell size (partB == partA dims) ──
        const platformScale       = cellSize / P.SLOT_SIZE;   // === scale; no 1.0 clamp
        const platformStripeWidth = Math.min(P.STRIPE_WIDTH * platformScale, partB.width - 20); // relational cap kept

        // ── Platform Y positions: evenly spaced; vertical outer margin uses sH ──
        const topExtent1 = P.STRIPE_HEIGHT / 2 + P.SLOT_ABOVE_STRIPE + P.SLOT_SIZE + P.CHARGE_RATE_GAP + 11;
        const botExtent1 = P.STRIPE_HEIGHT / 2;
        const topExtentS = topExtent1 * platformScale;        // SIZE extents → scale
        const botExtentS = botExtent1 * platformScale;
        const outerPad   = Math.round(60 * sH);               // VERTICAL margin → sH
        const cy1        = partB.y + topExtentS + outerPad;
        const cy3        = partB.y + partB.height - botExtentS - outerPad;
        const cySpacing  = (cy3 - cy1) / 2;
        const platformYPositions = [cy1, cy1 + cySpacing, cy1 + cySpacing * 2];

        // ── All content sizes that must scale with cellSize ───────────────────
        // Cell gap
        const cellGap           = Math.max(2, Math.round(CONFIG.CELL.GAP * scale));

        // Battery icon + level text inside grid cells (and platform slots)
        const batteryDisplaySize = Math.round(CONFIG.CELL.BATTERY_DISPLAY_SIZE * scale);
        const batteryYOffset     = Math.round(CONFIG.CELL.BATTERY_Y_OFFSET     * scale);
        const levelTextYOffset   = Math.round(CONFIG.CELL.LEVEL_TEXT_Y_OFFSET  * scale);
        const levelTextSize      = Math.max(8, Math.round(11 * scale)) + 'px';

        // Spawn button interior (coin value text, coin icon, battery icon)
        const spawnCoinTextSize  = Math.max(14, Math.round(32 * scale)) + 'px';
        const spawnCoinTextX     = Math.round(CONFIG.BUTTON.COIN_TEXT_X          * scale);
        const spawnCoinIconX     = Math.round(CONFIG.BUTTON.COIN_ICON_X           * scale);
        const spawnCoinIconSize  = Math.round(CONFIG.BUTTON.COIN_ICON_WIDTH       * scale);
        const spawnBattIconX     = Math.round(CONFIG.BUTTON.BATTERY_ICON_X        * scale);
        const spawnBattIconSize  = Math.round(CONFIG.BUTTON.BATTERY_ICON_WIDTH    * scale);

        // Coin counter display (above grid panel)
        const coinIconSize       = Math.round(CONFIG.COIN_COUNTER.COIN_ICON_WIDTH * scale);
        const coinTextSize       = Math.max(20, Math.round(48 * scale)) + 'px';
        const coinTextIconGap    = Math.max(3,  Math.round(5 * scale));

        // Crown / battery-name unlock display
        const crownIconSize      = Math.round(CONFIG.BATTERY_UNLOCK_DISPLAY.CROWN_ICON_SIZE * scale);
        const unlockTextSize     = Math.max(12, Math.round(24 * scale)) + 'px';

        // Drawing geometry — cell and slot borders/radii
        const cellInset         = Math.max(1, Math.floor(CONFIG.CELL.INSET_BORDER_WIDTH * scale));
        const cellRadius        = Math.round(CONFIG.CELL.RADIUS * scale);

        // Drawing geometry — platform stripes and wire
        const stripeRadius      = Math.max(1, Math.round(6 * platformScale));
        const wireThickness     = Math.max(1, Math.round(CONFIG.PLATFORM.WIRE_THICKNESS   * platformScale));
        const wireRigidLen      = Math.max(1, Math.round(CONFIG.PLATFORM.WIRE_RIGID_LENGTH * platformScale));

        // VFX sizes
        const mergeEffectRadius = Math.round(50 * scale);
        const rewardCoinSize    = Math.round(CONFIG.COIN_REWARD_ANIMATION.REWARD_COIN_SIZE * scale);

        this.layoutConfig = {
            screenWidth: W, screenHeight: H, isPortrait: isP,
            cellSize, cellGap,
            panPad, spawnBtnDisplayH, spawnBtnDisplayW, spawnBtnLogicalHalf: spawnBtnLogHalf,
            partA, partB,
            platformScale, platformYPositions, platformStripeWidth,
            sW, sH, scale,
            panelCenterY, buttonCenterY, coinCenterY,
            // Battery / cell content
            batteryDisplaySize, batteryYOffset, levelTextYOffset, levelTextSize,
            // Spawn button contents
            spawnCoinTextSize, spawnCoinTextX, spawnCoinIconX, spawnCoinIconSize,
            spawnBattIconX, spawnBattIconSize,
            // Coin counter
            coinIconSize, coinTextSize, coinTextIconGap,
            // Crown display
            crownIconSize, unlockTextSize,
            // Drawing geometry
            cellInset, cellRadius, stripeRadius, wireThickness, wireRigidLen,
            // VFX
            mergeEffectRadius, rewardCoinSize,
            // Legacy compat fields
            gridLeft:         partA.x,
            gridWidth:        partA.width,
            gridCenterX:      partA.x + partA.width / 2,
            gridTop:          partA.y,
            gridHeight:       partA.height,
            platformsLeft:    partB.x,
            platformsWidth:   partB.width,
            platformsCenterX: partB.x + partB.width / 2,
            platformsTop:     partB.y,
            platformsHeight:  partB.height,
        };
    }

    // ================================================================
    // PRELOAD
    // ================================================================
    preload() {

        const startData = getBatteryData(CONFIG.BATTERY_START_LEVEL);
    if (startData) {
        this.load.image(
            `battery${CONFIG.BATTERY_START_LEVEL}`,
            `graphics/battery/${startData.fileName}`
        );
    }
        this.load.image('coin',          'graphics/coin.png');
        this.load.image('point',         'graphics/point.png');
        this.load.image('button',        'graphics/spawn_button3.png');
        this.load.image('grid_panel',    'graphics/grid_panel.png');
        this.load.image('battery_crown', 'graphics/battery_crown.png');
        this.load.image('bolt',          'graphics/bolt_64.png');
        this.load.image('gadget_socket',   'graphics/connection/socket.png');
        this.load.image('gadget_plug_in',  'graphics/connection/plug_in.png');
        this.load.image('gadget_plug_out', 'graphics/connection/plug_out.png');
        
        // Load explosion sprite frames
        for (let i = 1; i <= 8; i++) {
            this.load.image(`explosion_${String(i).padStart(2, '0')}`, `graphics/explosion/explosion_${String(i).padStart(2, '0')}.png`);
        }
        
        // Shared white glow texture used by charge effects (additive blend)
        this.load.image('glow', 'graphics/gadgets/glow.png');

        // Car (right-half pivot) — chassis body + single tire reused for both wheels
        if (CONFIG.ROAD && CONFIG.ROAD.ENABLED) {
            for (const v of CONFIG.ROAD.VEHICLES) this.load.image(v.KEY, v.FILE);
            this.load.image('auger_src', 'graphics/auger.png');
            for (let i = 1; i <= 4; i++) {
                this.load.image(`tree_top${i}`, `graphics/tree_tops/tree_top${i}.png`);
            }
            for (let i = 1; i <= 6; i++) {
                this.load.image(`rock${i}`, `graphics/rocks/rock${i}.png`);
            }
        }
        this.load.image('car_chassis', 'graphics/car/chassis.png');
        this.load.image('car_wheel',   'graphics/car/tire.png');

        // Load gadget sprites from gadgetData.js
        if (typeof GADGET_SPRITES !== 'undefined' && GADGET_SPRITES) {
            GADGET_SPRITES.forEach(g => {
                // The sewing machine has no single gadget sprite — it's driven by
                // the 'sewing_machine' spritesheet (idle = first frame), so skip
                // the static normal/burnedout image loads for it.
                if (g.name === CONFIG.PLATFORM.SEWING_GADGET_NAME) return;

                this.load.image(`gadget_${g.name}_normal`, `graphics/gadgets/${g.normal_sprite}`);
                this.load.image(`gadget_${g.name}_burnedout`, `graphics/gadgets/${g.burnedout_sprite}`);

                // Per-effect extra art (e.g. a fan's rotating leaf), if any
                const fx = getChargeEffect(g.charge_effect);
                const assets = fx.assets(g.charge_effect_params || {});
                for (const [logical, file] of Object.entries(assets)) {
                    this.load.image(`fx_${g.name}_${logical}`, `graphics/gadgets/${file}`);
                }
            });
        }

        // Tooth-cleaning art for the toothbrush level (not part of GADGET_SPRITES)
        this.load.image('tooth_before', 'graphics/gadgets/tooth_before.png');
        this.load.image('tooth_after',  'graphics/gadgets/tooth_after.png');

        // Chicken-cooking sprite sheet for the cooktop level (8 frames, 2x4 grid)
        this.load.spritesheet('chicken_cooking', 'graphics/gadgets/chicken_cooking.png', {
            frameWidth: 364, frameHeight: 360,
        });

        // Sewing-machine animated gadget sheet (8 frames, 4x2 grid, 143x122)
        this.load.spritesheet('sewing_machine', 'graphics/gadgets/sewing_machine.png', {
            frameWidth: 143, frameHeight: 122,
        });

        // Washing-machine animated gadget sheet (6 frames, 2x3 grid, 279x336;
        // frame 0 = idle, frames 1..5 = spin loop)
        this.load.spritesheet('washing_machine_anim', 'graphics/gadgets/washing_machine_279_336.png', {
            frameWidth: 279, frameHeight: 336,
        });

        // T-shirt cloth shown to the left of the sewing machine; revealed with an
        // organic wavy front as it charges. Feature self-skips until the file exists.
        this.load.image('tshirt', 'graphics/gadgets/t-shirt.png');
    }

    // ================================================================
    // CREATE
    // ================================================================
    create() {

        const c = this.game.canvas;
const dpr = window.devicePixelRatio || 1;
console.log(
  `[buffer] backingStore=${c.width}x${c.height} ` +          // actual render pixels (drawing buffer)
  `cssDisplay=${c.clientWidth}x${c.clientHeight} ` +          // size shown on page (CSS px)
  `DPR=${dpr} ` +
  `physicalScreen=${Math.round(c.clientWidth*dpr)}x${Math.round(c.clientHeight*dpr)}`  // what the screen really has
);




        this.assets = new AssetManager(this);
        const W = this.scale.width;
        const H = this.scale.height;

        // Calculate layout based on orientation
        this.calculateLayout();
        const L = this.layoutConfig;
        // One-time responsive-layout sanity log
        const _cx   = L.partA.x + L.partA.width / 2;
        const _panW = this.GRID_COLS * L.cellSize + (this.GRID_COLS - 1) * L.cellGap + 2 * L.panPad;
        const _panH = this.GRID_ROWS * L.cellSize + (this.GRID_ROWS - 1) * L.cellGap + 2 * L.panPad;
        console.log(`[layout] partA=${Math.round(L.partA.width)}x${Math.round(L.partA.height)} ` +
            `sW=${L.sW.toFixed(3)} sH=${L.sH.toFixed(3)} scale=${L.scale.toFixed(3)} cellSize=${L.cellSize.toFixed(1)} ` +
            `panel=${_panW.toFixed(0)}x${_panH.toFixed(0)} | ` +
            `coin=(${_cx.toFixed(0)},${L.coinCenterY.toFixed(0)}) ` +
            `grid=(${_cx.toFixed(0)},${L.panelCenterY.toFixed(0)}) ` +
            `button=(${_cx.toFixed(0)},${L.buttonCenterY.toFixed(0)})`);
        this.CELL_SIZE          = L.cellSize;
        this.CELL_GAP           = L.cellGap;
        this.batteryDisplaySize = L.batteryDisplaySize;
        this.batteryYOffset     = L.batteryYOffset;
        this.levelTextYOffset   = L.levelTextYOffset;
        this.levelTextSize      = L.levelTextSize;
        // Drawing geometry
        this.CELL_RADIUS        = L.cellRadius;
        this.cellInset          = L.cellInset;
        this.platformScale      = L.platformScale;
        this.stripeRadius       = L.stripeRadius;
        this.wireThickness      = L.wireThickness;
        this.wireRigidLen       = L.wireRigidLen;
        // VFX
        this.mergeEffectRadius  = L.mergeEffectRadius;
        this.rewardCoinSize     = L.rewardCoinSize;

        // Background
        const bgGfx = this.add.graphics();
        const sc = parseInt(CONFIG.BACKGROUND.GRADIENT_START_COLOR.substring(1), 16);
        const ec = parseInt(CONFIG.BACKGROUND.GRADIENT_END_COLOR.substring(1), 16);
        bgGfx.fillGradientStyle(sc, sc, ec, ec, 1);
        bgGfx.fillRect(0, 0, W, H);
        bgGfx.setDepth(0);

        // Create explosion animation
        this.anims.create({
            key: 'explode',
            frames: [
                { key: 'explosion_01' },
                { key: 'explosion_02' },
                { key: 'explosion_03' },
                { key: 'explosion_04' },
                { key: 'explosion_05' },
                { key: 'explosion_06' },
                { key: 'explosion_07' },
                { key: 'explosion_08' }
            ],
            frameRate: 20,
            repeat: 0
        });

        // Load gadget data from gadgetData.js — level order comes from
        // GADGET_LEVEL_ORDER (names only); each name resolves to its sprite data.
        if (typeof GADGET_LEVEL_ORDER !== 'undefined' && GADGET_LEVEL_ORDER) {
            this.gadgetsData = GADGET_LEVEL_ORDER.map((name, index) => {
                const level = index + 1;
                const sprite = getGadgetSpriteByName(name);
                if (!sprite) console.warn(`GADGET_LEVEL_ORDER: unknown gadget "${name}" at level ${level}`);
                const capacity = getGadgetCapacity(level) || [200, 250, 300];
                return {
                    ...sprite,
                    capacity: capacity
                };
            }).filter(g => g.name);
        } else {
            this.gadgetsData = [];
        }

        // partB (top half portrait / right half landscape) — 3 slots + (car | gadget)
        this.createSlots();
        if (CONFIG.ROAD && CONFIG.ROAD.ENABLED) {
            // Right-half pivot: a congested road runs above the battery slots.
            this.createRoad();
            this.gadgetAnimationsComplete = true;   // no gadget intro to wait on
        } else if (CONFIG.CAR && CONFIG.CAR.ENABLED) {
            // Right-half pivot: batteries charge a car that climbs an incline.
            this.createIncline();
            this.createCar();
            this.gadgetAnimationsComplete = true;   // no gadget intro to wait on
        } else if (this.gadgetsData.length > 0) {
            this.loadGadgets(this.gadgetsData[0]);
        }

        // Bottom half — merge grid
        this.createGrid();
        this.createCoinDisplay();
        this.createBatteryUnlockDisplay();
        this.spawnBatteryInGrid(0, 0, CONFIG.BATTERY_START_LEVEL);
        this.assets.prefetchBattery(CONFIG.BATTERY_START_LEVEL + 1);
        this.createButtons();
        this.createStartOverlay();

        // Input
        this.input.on('dragstart', this.onDragStart, this);
        this.input.on('drag',      this.onDrag,      this);
        this.input.on('dragend',   this.onDragEnd,   this);

        this.startCharging();

        // Endless-road mode: the landscape camera must ignore every UI/fixed
        // object created above — one-time snapshot now that create() is done.
        this._snapshotCamBIgnores();
    }

    // ================================================================
    // PLATFORM SYSTEM (TOP HALF)
    // ================================================================
    // ── 3 battery slots in a horizontal row at the BOTTOM of partB, all wired up
    //    to a single junction plug that feeds one shared gadget above them.
    //    Slots (and their converging wires + junction) are STATIC — they persist
    //    across levels; only the gadget is rebuilt per level in loadGadgets().
    createSlots() {
        const P     = CONFIG.PLATFORM;
        const L     = this.layoutConfig;
        const scale = L.platformScale;
        const s     = (v) => v * scale;
        const B     = L.partB;

        const ssz         = L.cellSize;                       // slot == grid cell size
        const chargeGap   = s(P.CHARGE_RATE_GAP);
        const boltSize    = s(P.CHARGE_RATE_BOLT_SIZE);
        const plugSize    = s(P.PLUG_SIZE);
        const fontSize    = Math.max(12, Math.round(22 * scale)) + 'px';

        // Row of 3 slots, horizontally centred, near the bottom of partB.
        const centerX      = B.x + B.width / 2;
        const slotGap      = Math.round(ssz * 0.5);
        const bottomMargin = Math.round(45 * L.sH);
        const slotY        = B.y + B.height - bottomMargin - ssz / 2;
        const spacing      = ssz + slotGap;
        const slotXs       = [centerX - spacing, centerX, centerX + spacing];

        // Junction plug (common hub) sits above the centre slot; the gadget's
        // output wire will run up from here in loadGadgets().
        const junctionX = centerX;
        const junctionY = slotY - ssz / 2 - Math.round(46 * scale);
        this.stationCenterX = centerX;
        this.junctionX = junctionX;
        this.junctionY = junctionY;
        this.slotY = slotY;
        this.slotSize = ssz;

        // Wires from each slot's top-centre converging on the junction (behind slots).
        // Manhattan routing: straight up, rounded 90° corner, then horizontal into the
        // socket (the centre slot is a plain vertical run).
        const slotWireGfx = this.add.graphics().setDepth(3.45);
        for (let i = 0; i < 3; i++) {
            this._drawManhattanWire(slotWireGfx, slotXs[i], slotY - ssz / 2, junctionX, junctionY);
        }
        this.slotWireGfx = slotWireGfx;

        // Common junction socket where the three wires meet.
        this.junctionPlug = (this.textures.exists('gadget_socket')
            ? this.add.image(junctionX, junctionY, 'gadget_socket').setDisplaySize(plugSize * 1.2, plugSize * 1.2)
            : this.add.circle(junctionX, junctionY, plugSize * 0.6, 0x778899))
            .setDepth(3.7);

        for (let i = 0; i < 3; i++) {
            const slotX = slotXs[i];

            // Slot backgrounds (empty + filled variants)
            const slotBg = this.add.graphics();
            this._drawSlot(slotBg, slotX, slotY, ssz, false);
            slotBg.setDepth(3);

            const slotBgFilled = this.add.graphics();
            this._drawSlot(slotBgFilled, slotX, slotY, ssz, true);
            slotBgFilled.setDepth(3);
            slotBgFilled.setVisible(false);

            // Charge-rate label above slot
            const rateTextY = slotY - ssz / 2 - chargeGap;
            const chargeRateText = this.add.text(slotX - 2, rateTextY, '', {
                fontSize, fontFamily: CONFIG.FONT_FAMILY,
                color: '#000000', fontStyle: 'bold',
                stroke: '#FFFFFF', strokeThickness: 3,
            }).setOrigin(1, 0.5).setDepth(5).setVisible(false);

            const chargeRateBolt = this.add.image(slotX + 2, rateTextY, 'bolt')
                .setDisplaySize(boltSize, boltSize)
                .setOrigin(0, 0.5).setDepth(5).setVisible(false)
                .setTint(0xFFFF00);

            this.platforms.push({
                index: i,
                slotX, slotY, slotSize: ssz,
                slotBg, slotBgFilled,
                chargeRateText, chargeRateBolt,
                batterySprite: null, batteryLevelText: null,
            });
        }
    }

    // Right-angle (Manhattan) cable: vertical from the slot, a rounded 90° corner,
    // then horizontal into the socket. A vertical run (x1 == x2) is drawn straight.
    _drawManhattanWire(gfx, x1, y1, x2, y2) {
        const P     = CONFIG.PLATFORM;
        const scale = this.platformScale || 1;
        gfx.lineStyle(this.wireThickness, P.WIRE_COLOR, 1);
        gfx.beginPath();
        gfx.moveTo(x1, y1);

        const dx = x2 - x1;
        if (Math.abs(dx) < 1) {                 // centre slot → straight vertical
            gfx.lineTo(x2, y2);
            gfx.strokePath();
            return;
        }

        const dir = Math.sign(dx);
        const r   = Math.min(14 * scale, Math.abs(dx) / 2, Math.abs(y1 - y2) / 2);
        const vy  = y2 + Math.sign(y1 - y2) * r;   // stop the vertical run r before the corner

        gfx.lineTo(x1, vy);                     // up to just before the corner

        // Rounded corner: quadratic from (x1,vy) via corner (x1,y2) to (x1+dir*r, y2)
        const sx = x1, sy = vy, cx = x1, cy = y2, ex = x1 + dir * r, ey = y2, N = 8;
        for (let i = 1; i <= N; i++) {
            const t = i / N, mt = 1 - t;
            gfx.lineTo(mt * mt * sx + 2 * mt * t * cx + t * t * ex,
                       mt * mt * sy + 2 * mt * t * cy + t * t * ey);
        }

        gfx.lineTo(x2, y2);                     // horizontal into the socket
        gfx.strokePath();
    }

    // Slightly-sagging cable between two points (droop grows with horizontal span;
    // a vertical run stays straight).
    _drawStationWire(gfx, x1, y1, x2, y2) {
        const P   = CONFIG.PLATFORM;
        const sag = Math.min(28, Math.abs(x2 - x1) * 0.35) * (this.platformScale || 1);
        const cx  = (x1 + x2) / 2;
        const cy  = (y1 + y2) / 2 + sag;
        gfx.lineStyle(this.wireThickness, P.WIRE_COLOR, 1);
        gfx.beginPath();
        gfx.moveTo(x1, y1);
        const N = 24;
        for (let i = 1; i <= N; i++) {
            const t = i / N, mt = 1 - t;
            gfx.lineTo(mt * mt * x1 + 2 * mt * t * cx + t * t * x2,
                       mt * mt * y1 + 2 * mt * t * cy + t * t * y2);
        }
        gfx.strokePath();
    }

    _drawSlot(gfx, x, y, size, filled) {
        const shadow = hexColor(CONFIG.CELL.INSET_SHADOW_COLOR);
        const fill   = filled ? hexColor(CONFIG.CELL.FILLED_BG_COLOR) : hexColor(CONFIG.CELL.EMPTY_BG_COLOR);
        const inset  = Math.max(1, Math.round(CONFIG.CELL.INSET_BORDER_WIDTH * size / CONFIG.PLATFORM.SLOT_SIZE));
        const r      = Math.round(CONFIG.PLATFORM.SLOT_RADIUS * size / CONFIG.PLATFORM.SLOT_SIZE);
        gfx.clear();
        gfx.fillStyle(shadow, 1);
        gfx.fillRoundedRect(x - size / 2, y - size / 2, size, size, r);
        gfx.fillStyle(fill, 1);
        gfx.fillRoundedRect(x - size / 2 + inset, y - size / 2 + inset,
            size - inset * 2, size - inset * 2, Math.max(1, r - inset));
    }

    // ================================================================
    // CAR + INCLINE (right-half pivot)
    // ================================================================
    // A straight 15° incline (rising to the right) built from one long static
    // Matter body. Only the top surface matters — the wheels ride on it. The
    // slab is thick so the car can't fall through. "Endless" for now; the
    // plateau/checkpoint system is layered on later.
    createIncline() {
        const C = CONFIG.CAR;
        const B = this.layoutConfig.partB;

        const theta = -C.INCLINE_ANGLE_DEG * Math.PI / 180;  // negative = rises to the right (+Y is down)
        const forward = { x: Math.cos(theta), y: Math.sin(theta) };      // up-slope unit vector
        const downNormal = { x: -forward.y, y: forward.x };              // into the ground (points down)
        this.carForward = forward;

        // Bottom of the ramp: left side of partB, just above the junction plug.
        const bottomX = B.x + B.width * 0.15;
        const bottomY = (this.junctionY || (B.y + B.height * 0.7)) - 30;
        this.carRampBottom = { x: bottomX, y: bottomY };

        const len = C.INCLINE_LENGTH;
        const T   = C.INCLINE_THICKNESS;
        // Slab centre: half a length up-slope from the bottom, then half its
        // thickness down-normal so the TOP face lies on the ramp line.
        const cx = bottomX + forward.x * (len / 2) + downNormal.x * (T / 2);
        const cy = bottomY + forward.y * (len / 2) + downNormal.y * (T / 2);

        this.inclineBody = this.matter.add.rectangle(cx, cy, len, T, {
            isStatic: true,
            angle: theta,
            friction: C.GROUND_FRICTION,
            restitution: 0,
        });

        // Simple visual for the ramp surface (a filled, rotated rectangle).
        const gfx = this.add.graphics().setDepth(2);
        gfx.fillStyle(0x6b7a52, 1);
        gfx.fillRect(-len / 2, -T / 2, len, T);
        gfx.lineStyle(Math.max(2, 3), 0x3f4a2e, 1);
        gfx.strokeRect(-len / 2, -T / 2, len, T);
        gfx.setPosition(cx, cy);
        gfx.setRotation(theta);
        this.inclineGfx = gfx;
    }

    // Build the physics-driven car: 3 Matter bodies (chassis + 2 wheels) joined
    // by rigid-ish axles, sharing one collision group so they never collide with
    // each other. Three separate display sprites are synced to the bodies every
    // frame in update() (physics bodies and sprites kept strictly separate).
    createCar() {
        const C = CONFIG.CAR;
        const forward = this.carForward;
        const theta   = Math.atan2(forward.y, forward.x);   // incline angle
        const upNormal = { x: forward.y, y: -forward.x };   // away from the ground (points up)

        // Spawn the chassis centre so the wheels rest exactly on the ramp surface:
        // chassis→wheel-centre (offsetY) + wheel-centre→ground (radius) above the line.
        const lift = C.WHEEL_OFFSET_Y + C.WHEEL_RADIUS;
        const b = this.carRampBottom;
        const x = b.x + forward.x * (C.CHASSIS_WIDTH * 0.6) + upNormal.x * lift;
        const y = b.y + forward.y * (C.CHASSIS_WIDTH * 0.6) + upNormal.y * lift;

        const group = this.matter.world.nextGroup(true);   // negative group: parts ignore each other

        const chassis = this.matter.add.rectangle(x, y, C.CHASSIS_WIDTH, C.CHASSIS_HEIGHT, {
            density: C.CHASSIS_DENSITY, friction: C.WHEEL_FRICTION,
            chamfer: { radius: C.CHASSIS_CHAMFER },
            collisionFilter: { group },
            angle: theta,
        });
        const rearWheel = this.matter.add.circle(
            x + C.REAR_WHEEL_OFFSET_X, y + C.WHEEL_OFFSET_Y, C.WHEEL_RADIUS, {
            density: C.WHEEL_DENSITY, friction: C.WHEEL_FRICTION, restitution: 0,
            collisionFilter: { group },
        });
        const frontWheel = this.matter.add.circle(
            x + C.FRONT_WHEEL_OFFSET_X, y + C.WHEEL_OFFSET_Y, C.WHEEL_RADIUS, {
            density: C.WHEEL_DENSITY, friction: C.WHEEL_FRICTION, restitution: 0,
            collisionFilter: { group },
        });

        // Rigid axles (length-0, low stiffness): wheel stays free to spin.
        this.matter.add.constraint(chassis, rearWheel, 0, C.AXLE_STIFFNESS, {
            pointA: { x: C.REAR_WHEEL_OFFSET_X, y: C.WHEEL_OFFSET_Y }, pointB: { x: 0, y: 0 },
        });
        this.matter.add.constraint(chassis, frontWheel, 0, C.AXLE_STIFFNESS, {
            pointA: { x: C.FRONT_WHEEL_OFFSET_X, y: C.WHEEL_OFFSET_Y }, pointB: { x: 0, y: 0 },
        });

        // Display sprites (visual layer only) — wheels behind, chassis in front.
        const rearWheelSprite  = this.add.image(0, 0, 'car_wheel').setDepth(5).setDisplaySize(C.WHEEL_RADIUS * 2, C.WHEEL_RADIUS * 2);
        const frontWheelSprite = this.add.image(0, 0, 'car_wheel').setDepth(5).setDisplaySize(C.WHEEL_RADIUS * 2, C.WHEEL_RADIUS * 2);
        const chassisSprite    = this.add.image(0, 0, 'car_chassis').setDepth(10).setDisplaySize(C.CHASSIS_WIDTH, C.CHASSIS_HEIGHT);

        this.car = { chassis, rearWheel, frontWheel, chassisSprite, rearWheelSprite, frontWheelSprite };
        this.carStartPos = { x: chassis.position.x, y: chassis.position.y };
        this.carEarnedDistPx = 0;

        // Park it: freeze all three bodies so it sits still on the slope (no
        // gravity roll-back, no idle wheel spin) until charge starts a run.
        this.carDriving = true;            // force the toggle to actually apply
        this._setCarDriving(false);

        this._syncCarSprites();
    }

    // Freeze (static) or release (dynamic) the whole car. Freezing acts like an
    // invisible support: the car holds its exact pose on the incline instead of
    // rolling back or spinning its wheels under gravity while idle.
    _setCarDriving(on) {
        if (!this.car || this.carDriving === on) return;
        this.carDriving = on;
        const bodies = [this.car.chassis, this.car.rearWheel, this.car.frontWheel];
        if (!on) {
            // Park: zero motion, freeze the bodies, and snapshot the exact pose so
            // the sprites can be pinned to it (physics effectively off while idle).
            bodies.forEach((body) => {
                this.matter.body.setVelocity(body, { x: 0, y: 0 });
                this.matter.body.setAngularVelocity(body, 0);
                this.matter.body.setStatic(body, true);
            });
            this.carParkedPose = bodies.map((b) => ({ x: b.position.x, y: b.position.y, angle: b.angle }));
        } else {
            // Release: hand control back to physics from the parked pose.
            bodies.forEach((body) => this.matter.body.setStatic(body, false));
        }
    }

    _syncCarSprites() {
        const car = this.car;
        if (!car) return;
        // While parked, pin the sprites to the frozen pose — no rolling / drift.
        if (!this.carDriving && this.carParkedPose) {
            const [c, r, f] = this.carParkedPose;
            car.chassisSprite.setPosition(c.x, c.y).setRotation(c.angle);
            car.rearWheelSprite.setPosition(r.x, r.y).setRotation(r.angle);
            car.frontWheelSprite.setPosition(f.x, f.y).setRotation(f.angle);
            return;
        }
        car.chassisSprite.setPosition(car.chassis.position.x, car.chassis.position.y);
        car.chassisSprite.setRotation(car.chassis.angle);
        car.rearWheelSprite.setPosition(car.rearWheel.position.x, car.rearWheel.position.y);
        car.rearWheelSprite.setRotation(car.rearWheel.angle);
        car.frontWheelSprite.setPosition(car.frontWheel.position.x, car.frontWheel.position.y);
        car.frontWheelSprite.setRotation(car.frontWheel.angle);
    }

    // Distance (px) the chassis has climbed along the incline from its start.
    _carTravelledPx() {
        const car = this.car;
        if (!car) return 0;
        const dx = car.chassis.position.x - this.carStartPos.x;
        const dy = car.chassis.position.y - this.carStartPos.y;
        return dx * this.carForward.x + dy * this.carForward.y;   // projection onto up-slope
    }

    // ================================================================
    // ROAD / TRAFFIC (right-half pivot)
    // ================================================================
    // Vertical roads above the battery slots, running off the top of the screen,
    // detouring around a broad oblong hill at their midpoint. Each lane carries
    // traffic one way (CONFIG.ROAD.ROADS sets the directions); every car paces
    // itself off the one ahead in its lane, so they bunch into stop-and-go
    // traffic without ever overlapping. Sprites come from one shared fixed-size
    // pool and are recycled once they leave the road — nothing is created or
    // destroyed after create().
    //
    // Geometry is a PATH, not a function of y: each carriageway's centre line is
    // a polyline that runs straight, turns, hugs the hill's face at a constant
    // standoff, wraps its end cap and comes back. Lanes are that spine offset
    // sideways; the asphalt and stripes are the same spine offset further. Cars
    // travel by arc length along their lane's polyline, so they hold their speed
    // through the detour no matter which way the road happens to be pointing.
    createRoad() {
        const RC    = CONFIG.ROAD;
        const L     = this.layoutConfig;
        const B     = L.partB;
        const scale = L.platformScale;
        const s     = (v) => v * scale;

        // One art scale for the whole fleet, pinned so the reference vehicle
        // (VEHICLES[0], the car) comes out CAR_LENGTH tall. Every other sprite is
        // measured at that same scale, so the vans/trucks/buses keep their real
        // proportions relative to the car straight from the artwork.
        const refImg   = this.textures.get(RC.VEHICLES[0].KEY).getSourceImage();
        const artScale = s(RC.CAR_LENGTH) / refImg.height;

        const types = RC.VEHICLES.map((v) => {
            const img = this.textures.get(v.KEY).getSourceImage();
            return {
                key:    v.KEY,
                w:      img.width  * artScale,
                len:    img.height * artScale,
                weight: v.WEIGHT,
            };
        });
        const totalWeight = types.reduce((sum, t) => sum + t.weight, 0);

        // Lanes hug the widest vehicle so even a bus clears the edge stripes;
        // road widths follow from that rather than being set independently.
        const laneW   = Math.max(...types.map((t) => t.w)) * RC.LANE_FACTOR;
        const roadGap = s(RC.ROAD_GAP);
        const widths  = RC.ROADS.map((r) => laneW * r.LANE_DIRS.length);
        const total   = widths.reduce((sum, w) => sum + w, 0) + roadGap * (RC.ROADS.length - 1);

        // Roads start just above the batteries/junction and run past the top of
        // the screen, so cars simply drive out of view. The whole set is centred
        // in partB as one block, left to right in ROADS order.
        const bottom = (this.junctionY || (B.y + B.height * 0.62)) - s(RC.BOTTOM_GAP);
        const top    = B.y;

        // The hill: an oblong on the centre line, halfway up the road. Its ends
        // are semicircles of radius `r`, joined by a flat section `w - 2r` long.
        const IS        = RC.ISLAND;
        const blockLeft = B.x + (B.width - total) / 2;
        const island    = (IS && IS.ENABLED) ? {
            cx:    blockLeft + total / 2,
            cy:    (top + bottom) / 2,
            w:     s(IS.WIDTH),
            h:     s(IS.HEIGHT),
            r:     Math.min(s(IS.WIDTH), s(IS.HEIGHT)) / 2,
            // Half-length of the ridge segment. In tunnel (severed-road) mode
            // the mountain is a continuous range spanning the whole half, so
            // the ridge runs wall to wall; otherwise it's the oblong from WIDTH.
            fl:    (RC.TUNNEL && RC.TUNNEL.ENABLED)
                       ? B.width
                       : s(IS.WIDTH) / 2 - Math.min(s(IS.WIDTH), s(IS.HEIGHT)) / 2,
            clear: s(IS.CLEARANCE),
            turn:  s(IS.TURN_RADIUS),
        } : null;

        this.road = {
            top, bottom, laneW, island,
            types, totalWeight,
            spines:   [],                     // centre lines of each carriageway —
                                              // the terrain flattens along these
            sample:   Math.max(2, s(3)),      // polyline resolution along curves
            minGap:   s(RC.MIN_GAP),
            speedMin: s(RC.SPEED_MIN),
            speedMax: s(RC.SPEED_MAX),
        };
        this.roadLanes     = [];
        this._roadLastTime = 0;

        const gfx   = this.add.graphics().setDepth(2);
        const dash  = s(RC.STRIPE_DASH);
        const gap   = s(RC.STRIPE_GAP);
        const inset = s(RC.STRIPE_INSET);
        const sw    = Math.max(1, s(RC.STRIPE_WIDTH));

        // One master centre line for the whole highway when both carriageways
        // pass the same end of the mountain. Each road is a parallel offset of
        // it, so through the detour they run concentric — outer and inner track
        // — and can never cross. (Independent same-side spines would intersect
        // each other's straights, with cars driving through each other there.)
        // Tunnel (severed) mode: there is NO way past the mountain. Both roads
        // run dead straight and simply STOP at its faces — up traffic halts at
        // the bottom face, down traffic at the top face — until the tunnels are
        // drilled and the missing middle is paved by _openTunnelLanes().
        const severed = !!(island && RC.TUNNEL && RC.TUNNEL.ENABLED);
        const gapTop  = island ? island.cy - island.r : 0;
        const gapBot  = island ? island.cy + island.r : 0;

        // ── Endless mode: a second camera owns the landscape ──────────────
        // The world extends upward one segment (mountain band) at a time; camB
        // pans up it while the main camera keeps the merge grid and platform
        // UI fixed. camB's viewport covers ONLY the road band, so the fixed
        // bottom strip (slots/junction) is never overdrawn by panning world.
        // With ENDLESS off, camB is never created and _addB degrades to a
        // plain registry push — behaviour is identical to before.
        this.segments  = [];
        this._worldBSet = new Set();
        this._camBSnapDone = false;   // fresh build (incl. scene.restart on resize) → the set must refill
        this.camB = null;
        const endless = severed && RC.ENDLESS && RC.ENDLESS.ENABLED;
        if (endless) {
            this.endless = {
                segH: bottom - top, segIndex: 0,
                panning: false, nextReady: false,
                baseScrollY: B.y,
            };
            this.camB = this.cameras.add(B.x, B.y, B.width, (bottom - B.y) + s(2));
            this.camB.setScroll(B.x, B.y);
        } else {
            this.endless = null;
        }

        const passSide = (IS && IS.PASS_SIDE) || 0;
        const blockCx  = blockLeft + total / 2;
        let master = null, masterMerge = null, sepStraight = 0, sepCurve = 0;
        if (island && passSide && !severed) {
            // Road-centre separation from the master: full width + gap on the
            // straights, but through the curve the roads are only one lane wide,
            // so the tracks pull together to laneW + gap — keeping the same
            // edge-to-edge gap around the bend as on the straights, instead of
            // the tracks drifting apart while the asphalt narrows.
            sepStraight = (widths[0] + roadGap) / 2;
            sepCurve    = (laneW + roadGap) / 2;
            // Standoff sized for the NARROWED curve width (laneW), not the full
            // road: through the hug the asphalt is single-lane, so this presses
            // it kerb-tight against the mountain foot instead of leaving the
            // full-width margin.
            master      = this._buildRoadSpine(blockCx, passSide, laneW / 2, sepCurve);
            masterMerge = this._mergeProfile(master, blockCx);
        }

        let x = blockLeft;
        RC.ROADS.forEach((road, ri) => {
            const width  = widths[ri];
            const halfW  = width / 2;
            const roadCx = x + width / 2;

            // This carriageway's centre line: an offset of the master when both
            // roads pass the same end, otherwise its own spine around the
            // nearest end (PASS_SIDE: 0, the old both-sides behaviour).
            const sgnRoad = Math.sign(roadCx - blockCx) || 1;
            const spine = severed
                ? [{ x: roadCx, y: bottom }, { x: roadCx, y: top }]
                : master
                    ? this._offsetPath(master, masterMerge
                        ? (i) => sgnRoad * (sepCurve + (sepStraight - sepCurve) * masterMerge[i])
                        : sgnRoad * sepStraight)
                    : this._buildRoadSpine(roadCx, (!island || roadCx < island.cx) ? -1 : 1, halfW);

            // Curve bottleneck profile: 1 on the straights, 0 through the hug.
            // Lanes, asphalt and stripes all taper by it, so the road narrows to
            // a single lane exactly where it bends.
            const merge = this._mergeProfile(spine, roadCx);
            const halfSingle = laneW / 2;
            const edgeHalf = (i) => merge
                ? halfSingle + (halfW - halfSingle) * merge[i]
                : halfW;

            // The terrain flattens along this spine using the road's LOCAL width
            // (halfAt), so the flat corridor hugs the narrowed curve instead of
            // being carved for the full two-lane width everywhere.
            this.road.spines.push({
                pts: spine, halfW,
                halfAt: merge ? spine.map((_, i) => edgeHalf(i)) : null,
            });

            // Asphalt: the spine offset to both edges, down one side and back up
            // the other. Offsets run along the spine's normal, so the road keeps
            // its intended width — full on the straights, one lane through the
            // curve — without being pinched wherever it leans.
            if (severed) {
                // Severed asphalt (two torn halves per band) is drawn by
                // _buildSegment — per segment, so endless mode can stamp a
                // fresh band above the current one for every new mountain.
            } else {
                gfx.fillStyle(RC.ASPHALT_COLOR, 1);
                const edgeL = this._offsetPath(spine, (i) => -edgeHalf(i));
                const edgeR = this._offsetPath(spine, (i) =>  edgeHalf(i));
                gfx.fillPoints(edgeL.concat(edgeR.reverse()), true);

                // Edge stripes: walk each edge by arc length, so dashes stay
                // evenly spaced and lean with the road through every turn.
                gfx.lineStyle(sw, RC.STRIPE_COLOR, 1);
                for (const sgn of [-1, 1]) {
                    const meta = this._pathMeta(
                        this._offsetPath(spine, (i) => sgn * (edgeHalf(i) - inset)));
                    for (let d = 0; d < meta.total; d += dash + gap) {
                        const a = this._pathPoint(meta, d);
                        const b = this._pathPoint(meta, Math.min(d + dash, meta.total));
                        gfx.beginPath();
                        gfx.moveTo(a.x, a.y);
                        gfx.lineTo(b.x, b.y);
                        gfx.strokePath();
                    }
                }
            }

            // Lanes: the spine offset sideways, pulled in by LANE_SQUEEZE so
            // vehicles don't crowd the edge stripes, and multiplied by the merge
            // profile so both lanes collapse onto the centre line through the
            // curve. The spine runs bottom→top; a down lane walks it in reverse.
            const laneRefs = [];
            road.LANE_DIRS.forEach((dir, li) => {
                const laneCx = x + laneW * (li + 0.5);
                const lane = this._makeLane(spine, merge, (laneCx - roadCx) * RC.LANE_SQUEEZE, dir);
                // Severed mode: cars halt a machine-length short of a mouth
                // ONLY where a rig is actually parked (its tail sticks out of
                // the mouth; the queue forms behind it, not under it). At a
                // mouth with no machine — the top face unless OPPOSED_DRILL —
                // vehicles pull all the way up to the road's broken edge.
                if (severed) {
                    const rigLen = s(RC.TUNNEL.BLADE_LEN);
                    const topRig = RC.TUNNEL.OPPOSED_DRILL ? rigLen : 0;
                    lane.blockAt = dir === 1
                        ? bottom - (gapBot + rigLen)
                        : (gapTop - topRig) - top;
                }
                laneRefs.push(lane);
                this.roadLanes.push(lane);
            });
            // Two lanes sharing a carriageway yield to each other at the merge,
            // and share a zipper turn: whoever enters the zone hands the next
            // slot to the other lane, so the file alternates instead of one
            // lane's platoon streaming through while the other starves.
            if (laneRefs.length === 2) {
                laneRefs[0].sib = laneRefs[1];
                laneRefs[1].sib = laneRefs[0];
                // next: whose turn to ENTER the merge; exitNext: which lane the
                // next car LEAVING the single file gets assigned to.
                const pairState = { next: laneRefs[0], exitNext: laneRefs[0] };
                laneRefs[0].pairState = pairState;
                laneRefs[1].pairState = pairState;
            }

            x += width + roadGap;
        });

        // The landscape. Severed/tunnel mode builds it as a SEGMENT (asphalt
        // band + mountain + scenery + machines + toll) so endless mode can
        // stack more segments above; the legacy curve layout keeps the old
        // single bake.
        if (island && severed) {
            this._buildSegment(top, bottom, IS.SEED);
        } else if (island) {
            this._createMountain(island);
        }

        // Pre-build the whole vehicle pool up front; it never grows past CAR_POOL.
        // Pooled sprites are type-agnostic — the texture and size are stamped on
        // at spawn, so one pool serves cars, vans, trucks and buses alike.
        this.roadCarPool = [];
        for (let i = 0; i < RC.CAR_POOL; i++) {
            // Cars are world objects (they pan with the landscape) but belong
            // to no segment — their positions are recomputed from lane paths
            // every frame, so rebasing the paths carries them along for free.
            const car = this._addB(this.add.image(0, 0, types[0].key)
                .setDepth(3)
                .setActive(false)
                .setVisible(false), null);
            car.speed = 0;
            car.desiredSpeed = 0;
            car.len = 0;                     // display length of its current type
            car.prog = 0;                    // distance travelled along its lane
            car.seg = 0;                     // cached path segment — see _pathPoint
            this.roadCarPool.push(car);
        }

        // Fill the roads with traffic immediately so they open already congested.
        this._seedRoadTraffic();

        this.time.addEvent({
            delay: RC.SPAWN_MS,
            loop: true,
            callback: this._trySpawnRoadCars,
            callbackScope: this,
        });
    }

    // Register a display object as pannable WORLD content: hidden from the
    // main (UI) camera, tracked in `seg`'s registry for rebase/teardown.
    // Pass seg=null for persistent world objects (the car pool). With endless
    // off there is no camB and this is just the registry push.
    _addB(obj, seg) {
        if (this.camB) {
            this.cameras.main.ignore(obj);
            // The set only feeds the one-time camB ignore snapshot at create;
            // afterwards it must not grow (it would pin transient objects).
            if (!this._camBSnapDone) this._worldBSet.add(obj);
        }
        if (seg) seg.objects.push(obj);
        return obj;
    }

    // After create() has built everything, camB must ignore every NON-world
    // object (platforms, wires, partA UI...) so only the landscape pans.
    // Objects created later: world spawns route through _addB; fixed spawns
    // that could fall inside camB's view call camB.ignore explicitly.
    _snapshotCamBIgnores() {
        if (!this.camB) return;
        const rest = this.children.list.filter((o) => !this._worldBSet.has(o));
        this.camB.ignore(rest);
        console.log(`[camB] world=${this._worldBSet.size} ignored=${rest.length} ` +
            `ids main=${this.cameras.main.id} camB=${this.camB.id} ` +
            `view=(${this.camB.x},${this.camB.y},${this.camB.width},${this.camB.height}) ` +
            `scroll=(${this.camB.scrollX},${this.camB.scrollY})`);
        this._camBSnapDone = true;
        this._worldBSet.clear();
    }

    // One landscape SEGMENT: the band [bandTop, bandBot] gets torn asphalt
    // halves, a seeded mountain with trees and rocks, parked boring machines
    // and a toll gantry. Returns the segment record ({objects, island,
    // tunnel, toll}) used for panning, rebasing and teardown.
    _buildSegment(bandTop, bandBot, seed) {
        const RC = CONFIG.ROAD, IS = RC.ISLAND;
        const s  = (v) => v * this.layoutConfig.platformScale;
        const B  = this.layoutConfig.partB;
        const r  = this.road;

        const seg = { objects: [], island: null, tunnel: null, toll: null,
                      texKeys: [] };
        this.segments.push(seg);

        const base = r.island;   // geometry template from createRoad
        const island = {
            cx: base.cx, cy: (bandTop + bandBot) / 2,
            w: base.w, h: base.h, r: base.r, fl: base.fl,
            clear: base.clear, turn: base.turn,
        };
        seg.island = island;
        const gapTop = island.cy - island.r;
        const gapBot = island.cy + island.r;

        // Torn asphalt halves for this band (see createRoad for the stub
        // trick: raggedness protrudes INTO the mountain, never into the road,
        // so the tunnel road later meets the slab with no gap).
        const dash  = s(RC.STRIPE_DASH);
        const gap   = s(RC.STRIPE_GAP);
        const inset = s(RC.STRIPE_INSET);
        const sw    = Math.max(1, s(RC.STRIPE_WIDTH));
        const ragD  = Math.max(2, s(3.5));
        const colW  = Math.max(1, s(1.2));
        const gfx = this._addB(this.add.graphics().setDepth(2), seg);
        for (const sp of r.spines) {
            const roadCx = sp.pts[0].x, halfW = sp.halfW;
            gfx.fillStyle(RC.ASPHALT_COLOR, 1);
            gfx.fillRect(roadCx - halfW, bandTop, halfW * 2, gapTop - bandTop);
            gfx.fillRect(roadCx - halfW, gapBot, halfW * 2, bandBot - gapBot);
            for (let cx2 = roadCx - halfW; cx2 < roadCx + halfW; cx2 += colW) {
                const w2 = Math.min(colW, roadCx + halfW - cx2);
                gfx.fillRect(cx2, gapTop, w2, Math.random() * ragD);
                const dB = Math.random() * ragD;
                gfx.fillRect(cx2, gapBot - dB, w2, dB);
            }
            gfx.fillStyle(RC.STRIPE_COLOR, 1);
            for (const edgeX of [roadCx - halfW + inset, roadCx + halfW - inset]) {
                for (const span of [[bandTop, gapTop], [gapBot, bandBot]]) {
                    for (let sy2 = span[0]; sy2 < span[1]; sy2 += dash + gap) {
                        gfx.fillRect(edgeX - sw / 2, sy2, sw, Math.min(dash, span[1] - sy2));
                    }
                }
            }
        }

        this._createMountain(island, bandTop, bandBot, seed, seg);
        this.createTunnel(island, seg);
        this._createTollCounter(seg.tunnel, seg);
        return seg;
    }

    // ── Procedural terrain (Perlin) ──────────────────────────────────────────
    // Baked once at create() into a texture, then it's one static image drawn
    // UNDER the roads. The bake is the only cost: ~100ms, once.
    //
    // The terrain covers the WHOLE road area, not just the oblong. Heights come
    // from Perlin fBm: a tall dome-shaped peak inside the oblong, and lower
    // rolling hills everywhere else. The roads then carve flat corridors through
    // it — every pixel's height is scaled by its distance to the nearest road
    // centre line, reaching zero at the verge. So the road sits at zero
    // elevation by construction (that's WHY the road runs there), terrain rises
    // on BOTH sides of it, and the mountain reads as part of the landscape the
    // road crosses instead of an exhibit inside the curve.
    //
    // The paint stays cartoon: flat terraces on a bright ramp, two-tone slope
    // shade, terrace lips, bold outline. Snow only ever reaches the main peak —
    // the surrounding hills top out in the grass/rock bands.
    _createMountain(isl, bandTop, bandBot, seed, seg) {
        const IS = CONFIG.ROAD.ISLAND;
        const L  = this.layoutConfig;
        const B  = L.partB;
        const s  = (v) => v * L.platformScale;
        const r  = this.road;
        if (bandTop === undefined) bandTop = r.top;
        if (bandBot === undefined) bandBot = r.bottom;
        if (seed === undefined) seed = IS.SEED;

        // Bake region: full partB width over this segment's band. k maps
        // screen px → texture px.
        const bx = B.x, by = bandTop;
        const bw = B.width, bh = bandBot - bandTop;
        const tw = Math.max(16, Math.min(Math.round(bw), IS.MAX_RES));
        const k  = tw / bw;
        const th = Math.max(16, Math.round(bh * k));

        // The main peak's dome, in texture coords.
        const radT = isl.r * k;
        const x0T  = (isl.cx - isl.fl - bx) * k;
        const x1T  = (isl.cx + isl.fl - bx) * k;
        const cyT  = (isl.cy - by) * k;
        const freq = IS.DETAIL / radT;

        // Corridor factor per pixel: 0 on the asphalt and its verge, rising to 1
        // where full terrain may stand. Stamped per sample using the road's
        // LOCAL width (halfAt) and a curve-tightened shoulder/falloff, so the
        // flat band hugs the narrowed single-lane stretch instead of being
        // carved at full two-lane width with spare green on both sides.
        // Severed-road mode: the roads dead-end into the mountain, so no flat
        // corridor may be carved through the band it occupies — the massif
        // stays continuous until the tunnels physically open.
        const severedM = !!(CONFIG.ROAD.TUNNEL && CONFIG.ROAD.TUNNEL.ENABLED);

        const shoulderS = s(IS.SHOULDER);
        const shoulderC = s(IS.CURVE_SHOULDER);
        const falloffS  = Math.max(1, s(IS.MERGE_FALLOFF) * k);
        const falloffC  = Math.max(1, s(IS.CURVE_FALLOFF) * k);
        const maxHalf   = Math.max(...r.spines.map((sp) => sp.halfW));
        const win       = Math.ceil((maxHalf + shoulderS) * k + falloffS + 2);
        const F = new Float32Array(tw * th).fill(1);
        for (const sp of r.spines) {
            const span = Math.max(1e-6, sp.halfW - r.laneW / 2);
            for (let si = 0; si < sp.pts.length - 1; si++) {
                const a = sp.pts[si], b = sp.pts[si + 1];
                const segLen = Math.hypot(b.x - a.x, b.y - a.y);
                const steps  = Math.max(1, Math.ceil(segLen * k / 2));
                for (let t = 0; t <= steps; t++) {
                    const f = t / steps;
                    const scrY = a.y + (b.y - a.y) * f;
                    if (severedM && scrY > isl.cy - isl.r && scrY < isl.cy + isl.r) continue;
                    // Local half-width → how "curved" the road is here (0 =
                    // straight, 1 = single lane), which tightens the verge.
                    const hLoc = sp.halfAt
                        ? sp.halfAt[si] + (sp.halfAt[Math.min(si + 1, sp.halfAt.length - 1)] - sp.halfAt[si]) * f
                        : sp.halfW;
                    const curv   = sp.halfAt ? Math.min(1, Math.max(0, (sp.halfW - hLoc) / span)) : 0;
                    const clearL = (hLoc + shoulderS + (shoulderC - shoulderS) * curv) * k;
                    const fallL  = falloffS + (falloffC - falloffS) * curv;
                    const sx = (a.x + (b.x - a.x) * f - bx) * k;
                    const sy = (a.y + (b.y - a.y) * f - by) * k;
                    const yA = Math.max(0, Math.floor(sy - win)), yB = Math.min(th - 1, Math.ceil(sy + win));
                    const xA = Math.max(0, Math.floor(sx - win)), xB = Math.min(tw - 1, Math.ceil(sx + win));
                    for (let yy = yA; yy <= yB; yy++) {
                        for (let xx = xA; xx <= xB; xx++) {
                            const cf  = (Math.hypot(xx - sx, yy - sy) - clearL) / fallL;
                            const idx = yy * tw + xx;
                            if (cf < F[idx]) F[idx] = cf > 0 ? cf : 0;
                        }
                    }
                }
            }
        }

        // Gorge fields: distance to the OUTER road's spine, plus a weight that is
        // >0 only where a pixel sits on the far side of that road from the
        // mountain, within the curved span. The gorge depth ramps off these.
        const GO = IS.GORGE;
        let G = null, GW = null, GE = null, rampT = 0;
        const gorgeOn = GO && GO.ENABLED && isl && IS.PASS_SIDE;
        if (gorgeOn) {
            // Outer road of the pass: left road when wrapping the left end,
            // right road when wrapping the right.
            const outer = IS.PASS_SIDE === -1 ? r.spines[0] : r.spines[r.spines.length - 1];
            rampT = Math.max(1, s(GO.WIDTH) * k);
            const winG = Math.ceil((outer.halfW + s(GO.LEDGE)) * k + rampT + 2);

            // Curve span of the outer spine (screen-space arc), for the fade at
            // both ends of the hug.
            const pts0 = outer.pts;
            const cum0 = [0];
            for (let i2 = 1; i2 < pts0.length; i2++) {
                cum0.push(cum0[i2 - 1] + Math.hypot(pts0[i2].x - pts0[i2 - 1].x,
                                                    pts0[i2].y - pts0[i2 - 1].y));
            }
            let g0 = -1, g1 = -1;
            for (let i2 = 0; i2 < pts0.length; i2++) {
                if (Math.abs(pts0[i2].x - pts0[0].x) > 0.5) {
                    if (g0 < 0) g0 = cum0[i2];
                    g1 = cum0[i2];
                }
            }
            const taperG = Math.max(1, s(GO.TAPER));

            G  = new Float32Array(tw * th).fill(1e9);
            GW = new Float32Array(tw * th);
            GE = new Float32Array(tw * th);
            if (g0 >= 0) {
                for (let si = 0; si < pts0.length - 1; si++) {
                    const a = pts0[si], b2 = pts0[si + 1];
                    const segLen = Math.hypot(b2.x - a.x, b2.y - a.y);
                    const steps  = Math.max(1, Math.ceil(segLen * k / 2));
                    const txv = (b2.x - a.x) / (segLen || 1), tyv = (b2.y - a.y) / (segLen || 1);
                    for (let t2 = 0; t2 <= steps; t2++) {
                        const fSeg = t2 / steps;
                        const scrX = a.x + (b2.x - a.x) * fSeg;
                        const scrY = a.y + (b2.y - a.y) * fSeg;
                        const sArc = cum0[si] + segLen * fSeg;
                        // Weight: full inside the span, fading at its two ends.
                        const w = Math.max(0, Math.min(1,
                            Math.min(sArc - g0, g1 - sArc) / taperG));
                        // The drop starts LEDGE beyond the road's LOCAL edge, so
                        // through the narrowed curve the cliff sits at the kerb
                        // of the single lane, not at two-lane distance.
                        const hLoc = outer.halfAt
                            ? outer.halfAt[si] + (outer.halfAt[Math.min(si + 1, outer.halfAt.length - 1)] - outer.halfAt[si]) * fSeg
                            : outer.halfW;
                        const ledgeL = (hLoc + s(GO.LEDGE)) * k;
                        // Which side of the road the mountain is on, here.
                        const sideIsl = txv * (isl.cy - scrY) - tyv * (isl.cx - scrX);
                        const sx = (scrX - bx) * k, sy = (scrY - by) * k;
                        const yA = Math.max(0, Math.floor(sy - winG)), yB = Math.min(th - 1, Math.ceil(sy + winG));
                        const xA = Math.max(0, Math.floor(sx - winG)), xB = Math.min(tw - 1, Math.ceil(sx + winG));
                        for (let yy = yA; yy <= yB; yy++) {
                            for (let xx = xA; xx <= xB; xx++) {
                                const d = Math.hypot(xx - sx, yy - sy);
                                const idx = yy * tw + xx;
                                if (d < G[idx]) {
                                    G[idx] = d;
                                    GE[idx] = d - ledgeL;
                                    // Outer side = opposite side from the mountain.
                                    const sidePx = txv * (yy - sy) - tyv * (xx - sx);
                                    GW[idx] = (sidePx * sideIsl < 0) ? w : 0;
                                }
                            }
                        }
                    }
                }
            }
        }

        const noise = this._perlin2(seed >>> 0);
        const fbm = (x, y) => {
            let sum = 0, amp = 0.5, f = 1, norm = 0;
            for (let o = 0; o < IS.OCTAVES; o++) {
                sum  += amp * noise(x * f, y * f);
                norm += amp;
                amp  *= 0.5;
                f    *= 2;
            }
            return sum / norm;                       // 0..1
        };

        // Pass 1: heights. Peak dome and rolling hills compete (max), then the
        // road corridor flattens whatever won, the gorge pulls the outer side of
        // the curve below zero, and the bake borders fade out so the terrain
        // meets the background without a hard seam.
        const fadeT    = Math.max(1, s(IS.EDGE_FADE) * k);
        const hfreq    = freq * 0.7;
        const GO_DEPTH = gorgeOn ? GO.DEPTH : 0;
        const H = new Float32Array(tw * th);
        for (let y = 0; y < th; y++) {
            for (let x = 0; x < tw; x++) {
                const i = y * tw + x;
                const border = Math.min(x, tw - 1 - x, y, th - 1 - y) / fadeT;
                if (border <= 0) continue;

                // Gorge: on the outer side of the curve the ground falls away
                // instead of rising — g blends from normal terrain (0) to full
                // drop (1) across the cliff edge. GE already measures past the
                // road's LOCAL edge + LEDGE, so the drop starts at the kerb.
                let g = 0;
                if (gorgeOn && GW[i] > 0 && GE[i] > 0) {
                    g = GW[i] * Math.min(1, GE[i] / rampT);
                }

                const corridor = F[i];
                if (corridor <= 0 && g <= 0) continue;

                // Main peak: the steep dome over the oblong. The noise floor is
                // high (0.5) so no dip inside the massif can fall below the
                // threshold — the mountain stays ONE piece; ground colour only
                // ever appears where the corridor or the fades force it to.
                // The WALL term lifts the rim steeply, so the visible silhouette
                // starts at the mountain's edge — beside the road — instead of
                // a long, slowly-rising green skirt.
                const px = Math.min(Math.max(x, x0T), x1T);
                const dn = Math.hypot(x - px, y - cyT) / radT;
                const dome = dn < 1
                    ? (0.5 + 0.5 * fbm(x * freq, y * freq)) * Math.max(
                          Math.pow(1 - dn, IS.STEEPNESS),
                          IS.WALL_H * Math.min(1, (1 - dn) / IS.WALL_W))
                    : 0;

                // Surrounding hills: same noise field, sampled elsewhere so it
                // doesn't correlate with the peak, capped at HILLS height. Same
                // idea — floored so the hill country is contiguous, and the flat
                // land lives along the roads (corridor) rather than as random
                // holes punched through the terrain.
                const hills = IS.HILLS * (0.3 + 0.7 * fbm((x + 523) * hfreq, (y + 911) * hfreq));
                const pos   = Math.max(dome, hills) * corridor;

                H[i] = (pos * (1 - g) - GO_DEPTH * g) * Math.min(1, border);
            }
        }

        // Smooth the field before painting: rounds every contour at once —
        // silhouette, terraces and shading all soften together.
        if (IS.SMOOTHING > 0) this._blurField(H, tw, th, Math.round(IS.SMOOTHING));

        // Pass 2: paint.
        // Key includes the band so two live segments never share a texture.
        const key = 'mountain_' + seed + '_' + Math.round(bandTop);
        if (seg) seg.texKeys.push(key);
        if (this.textures.exists(key)) this.textures.remove(key);
        const canvas = this.textures.createCanvas(key, tw, th);
        const image  = canvas.getContext().createImageData(tw, th);
        const data   = image.data;

        const thr   = IS.THRESHOLD;
        // Terrace colours: STEPS flat bands, interpolated along the COLORS ramp.
        // The palette stays a handful of stops; the gradation comes from here.
        const steps = Math.max(2, IS.STEPS);
        const bandColors = [];
        for (let b = 0; b < steps; b++) {
            const f = (b / (steps - 1)) * (IS.COLORS.length - 1);
            const i0 = Math.min(Math.floor(f), IS.COLORS.length - 2);
            const kk = f - i0;
            const a = IS.COLORS[i0], c = IS.COLORS[i0 + 1];
            bandColors.push(
                (Math.round(((a >> 16) & 255) + (((c >> 16) & 255) - ((a >> 16) & 255)) * kk) << 16) |
                (Math.round(((a >> 8)  & 255) + (((c >> 8)  & 255) - ((a >> 8)  & 255)) * kk) << 8)  |
                 Math.round((a & 255)         + ((c & 255)         - (a & 255))         * kk));
        }
        const tier  = (v) => Math.min(steps - 1, Math.floor(((v - thr) / (1 - thr)) * steps));
        const gr = (IS.GROUND_COLOR >> 16) & 255,
              gg = (IS.GROUND_COLOR >> 8)  & 255,
              gb =  IS.GROUND_COLOR        & 255;

        for (let y = 0; y < th; y++) {
            for (let x = 0; x < tw; x++) {
                const i = y * tw + x;
                const h = H[i];
                const p = i * 4;

                // Ground is distinct from the backdrop, so the bake's rectangle
                // would show — instead its borders fade to transparent and the
                // flat land melts into the game background. In severed/endless
                // mode the TOP and BOTTOM edges stay opaque: the heights still
                // flatten there, so each segment ends in flat green that butts
                // seamlessly against the next segment's flat green — a y-fade
                // would open a see-through band at every seam.
                const edge = (severedM
                    ? Math.min(x, tw - 1 - x)
                    : Math.min(x, tw - 1 - x, y, th - 1 - y)) / fadeT;
                const alpha = Math.round(255 * Math.min(1, Math.max(0, edge)));

                // Within ±threshold is ELEVATION ZERO, not "outside the art":
                // flat ground, painted opaque. This is the same ground the roads
                // sit on (they're drawn above it), so terrain, verge and road are
                // one continuous surface with no silhouette and no boundary.
                if (h <= thr && h >= -thr) {
                    data[p] = gr; data[p + 1] = gg; data[p + 2] = gb; data[p + 3] = alpha;
                    continue;
                }

                // Two-tone slope shade from the continuous field: does the
                // ground rise toward the light (up-left) or away from it?
                const hUL = H[(y > 0 ? y - 1 : y) * tw + (x > 0 ? x - 1 : x)];
                const hDR = H[(y < th - 1 ? y + 1 : y) * tw + (x < tw - 1 ? x + 1 : x)];
                let shade = (hUL - hDR) < -0.005 ? 1 : IS.SHADE;

                // Below zero: the gorge wall, banded shallow → deep down its own
                // ramp. The same slope shade applies, so the canyon walls get
                // lit and shadow faces just like the mountain does.
                if (h < -thr) {
                    const GC = GO.COLORS;
                    const gt = Math.min(1, (-h - thr) / Math.max(0.01, GO.DEPTH - thr));
                    const gi = Math.min(GC.length - 1, Math.floor(gt * GC.length));
                    const c2 = GC[gi];
                    data[p]     = Math.min(255, ((c2 >> 16) & 255) * shade);
                    data[p + 1] = Math.min(255, ((c2 >> 8)  & 255) * shade);
                    data[p + 2] = Math.min(255, ( c2        & 255) * shade);
                    data[p + 3] = alpha;
                    continue;
                }

                // Darken the lip where a terrace drops, so the steps read.
                const t = tier(h);
                if ((x < tw - 1 && tier(H[i + 1])  < t) ||
                    (y < th - 1 && tier(H[i + tw]) < t)) shade *= IS.TERRACE_EDGE;

                const c = bandColors[t];
                data[p]     = Math.min(255, ((c >> 16) & 255) * shade);
                data[p + 1] = Math.min(255, ((c >> 8)  & 255) * shade);
                data[p + 2] = Math.min(255, ( c        & 255) * shade);
                data[p + 3] = alpha;
            }
        }

        canvas.getContext().putImageData(image, 0, 0);
        canvas.refresh();

        // The terrain goes UNDER the roads: it's the ground, and the asphalt
        // (depth 2) sits on top of it exactly where the corridor is flat. No
        // drop shadow — a continuous landscape has no silhouette to cast one.
        this._addB(this.add.image(bx + bw / 2, by + bh / 2, key)
            .setDisplaySize(bw, bh)
            .setDepth(1.5), seg);

        this._spawnTreeTops(H, tw, th, bx, by, k, seed, seg);
        this._spawnRocks(H, tw, th, bx, by, k, seed, seg);
    }

    // Screen-space distance from a point to the nearest road EDGE (negative
    // when on the asphalt) — shared by the scenery spawners.
    _treeRoadDist(px, py) {
        let best = 1e9;
        for (const sp of this.road.spines) {
            for (let i = 0; i < sp.pts.length - 1; i++) {
                const a = sp.pts[i], b = sp.pts[i + 1];
                const dx = b.x - a.x, dy = b.y - a.y;
                const L2 = dx * dx + dy * dy || 1;
                const t  = Math.max(0, Math.min(1,
                    ((px - a.x) * dx + (py - a.y) * dy) / L2));
                const d  = Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t))
                         - sp.halfW;
                if (d < best) best = d;
            }
        }
        return best;
    }

    // A handful of boulders dotted anywhere on the landscape — any elevation,
    // wildly varied sizes — unlike the trees' grid woods, these are just a few
    // seeded random throws. Static images, placed once.
    _spawnRocks(H, tw, th, bx, by, k, seed, seg) {
        const IS = CONFIG.ROAD.ISLAND;
        const R  = IS.ROCKS;
        if (!R || !R.ENABLED) return;
        const s     = (v) => v * this.layoutConfig.platformScale;
        const rnd   = this._seededRandom(((seed === undefined ? IS.SEED : seed) ^ 0x40c5) >>> 0);
        const thr   = IS.THRESHOLD;
        const fadeT = Math.ceil(Math.max(1, s(IS.EDGE_FADE) * k)) + 1;
        const bw = tw / k, bh = th / k;

        let placed = 0;
        for (let tries = 0; tries < R.COUNT * 20 && placed < R.COUNT; tries++) {
            const px = bx + rnd() * bw;
            const py = by + rnd() * bh;
            const xT = Math.round((px - bx) * k), yT = Math.round((py - by) * k);
            if (xT < fadeT || yT < fadeT ||
                xT > tw - 1 - fadeT || yT > th - 1 - fadeT) continue;
            if (H[yT * tw + xT] < -thr) continue;   // not in the gorge

            const size = s(R.MIN_SIZE + rnd() * (R.MAX_SIZE - R.MIN_SIZE));
            if (this._treeRoadDist(px, py) < size * 0.7) continue;

            // Below the tree layer (1.8): a boulder under a crown stays
            // hidden beneath the foliage, never sitting on top of it.
            const img = this._addB(this.add.image(px, py, 'rock' + (1 + Math.floor(rnd() * 6)))
                .setDepth(1.7), seg);
            img.setScale(size / img.width)
               .setAngle(rnd() * 360)
               .setFlipX(rnd() < 0.5);
            placed++;
        }
    }

    // Scatter tree-top sprites over the flat green ground. Jittered grid +
    // seeded random: at most one tree per cell, deterministic per level seed.
    // A cell plants a tree only if the terrain there is flat ground (|h| ≤
    // THRESHOLD — the green the roads sit on) and it keeps clear of every
    // road. Static images, placed once — zero per-frame cost.
    _spawnTreeTops(H, tw, th, bx, by, k, seed, seg) {
        const IS = CONFIG.ROAD.ISLAND;
        const T  = IS.TREES;
        if (!T || !T.ENABLED) return;
        const s    = (v) => v * this.layoutConfig.platformScale;
        const rnd  = this._seededRandom(((seed === undefined ? IS.SEED : seed) ^ 0x7ee5) >>> 0);
        const size = s(T.SIZE);
        const cell = s(T.SPACING);
        const thr  = IS.THRESHOLD;
        const keep = size * 0.6;   // clearance beyond a road's edge
        // Stay inside the OPAQUE part of the bake: within EDGE_FADE of the
        // border the terrain fades to transparent (H is 0 there too, which
        // would read as "flat ground") — no trees on invisible ground.
        const fadeT = Math.ceil(Math.max(1, s(IS.EDGE_FADE) * k)) + 1;

        const bw = tw / k, bh = th / k;
        for (let gy = by + cell / 2; gy < by + bh - cell / 2; gy += cell) {
            for (let gx = bx + cell / 2; gx < bx + bw - cell / 2; gx += cell) {
                if (rnd() > T.DENSITY) continue;
                const px = gx + (rnd() - 0.5) * cell * 0.8;
                const py = gy + (rnd() - 0.5) * cell * 0.8;

                // Anywhere green: flat ground AND the mountain's grassy slopes,
                // up to the treeline (where rock takes over). Not the gorge,
                // not the faded bake border.
                const xT = Math.round((px - bx) * k), yT = Math.round((py - by) * k);
                if (xT < fadeT || yT < fadeT ||
                    xT > tw - 1 - fadeT || yT > th - 1 - fadeT) continue;
                const h = H[yT * tw + xT];
                if (h < -thr || h > T.TREELINE) continue;
                // Woods thin out with altitude: full density on the flats,
                // sparse stragglers just under the treeline.
                const alt = Math.max(0, (h - thr) / Math.max(0.01, T.TREELINE - thr));
                if (rnd() < alt * 0.6) continue;

                if (this._treeRoadDist(px, py) < keep) continue;

                const tex = 'tree_top' + (1 + Math.floor(rnd() * 4));
                const img = this._addB(this.add.image(px, py, tex).setDepth(1.8), seg);
                const sc  = (size * (0.85 + rnd() * 0.3)) / img.width;
                img.setScale(sc)
                   .setAngle(rnd() * 360)
                   .setFlipX(rnd() < 0.5);
            }
        }
    }

    // Separable box blur over a Float32 field, in place. Two passes ≈ a gaussian,
    // which is plenty for rounding contours.
    _blurField(H, w, h, r) {
        const tmp = new Float32Array(H.length);
        for (let pass = 0; pass < 2; pass++) {
            // Horizontal.
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    let sum = 0, n = 0;
                    for (let k = -r; k <= r; k++) {
                        const xx = x + k;
                        if (xx >= 0 && xx < w) { sum += H[y * w + xx]; n++; }
                    }
                    tmp[y * w + x] = sum / n;
                }
            }
            // Vertical, back into H.
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    let sum = 0, n = 0;
                    for (let k = -r; k <= r; k++) {
                        const yy = y + k;
                        if (yy >= 0 && yy < h) { sum += tmp[yy * w + x]; n++; }
                    }
                    H[y * w + x] = sum / n;
                }
            }
        }
    }

    // Classic 2-D Perlin gradient noise, seeded, returning ~0..1. Gradients live
    // on the integer lattice; the value is the interpolated dot product of each
    // corner's gradient with the offset from that corner — which is what makes
    // Perlin smooth and direction-rich where value noise looks blocky.
    _perlin2(seed) {
        const rand = this._seededRandom(seed);
        const p = Array.from({ length: 256 }, (_, i) => i);
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [p[i], p[j]] = [p[j], p[i]];
        }
        const perm = new Uint8Array(512);
        for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

        const grad = (h, x, y) => {
            switch (h & 7) {
                case 0: return  x + y;  case 1: return  x - y;
                case 2: return -x + y;  case 3: return -x - y;
                case 4: return  x;      case 5: return -x;
                case 6: return  y;      default: return -y;
            }
        };
        const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

        return (x, y) => {
            const X = Math.floor(x), Y = Math.floor(y);
            const xf = x - X, yf = y - Y;
            const xi = X & 255, yi = Y & 255;
            const u = fade(xf), v = fade(yf);
            const aa = perm[perm[xi] + yi],     ba = perm[perm[xi + 1] + yi];
            const ab = perm[perm[xi] + yi + 1], bb = perm[perm[xi + 1] + yi + 1];
            const top = grad(aa, xf, yf)     + u * (grad(ba, xf - 1, yf)     - grad(aa, xf, yf));
            const bot = grad(ab, xf, yf - 1) + u * (grad(bb, xf - 1, yf - 1) - grad(ab, xf, yf - 1));
            const n = top + v * (bot - top);         // ≈ -1..1
            return Math.min(1, Math.max(0, n * 0.7071 + 0.5));
        };
    }

    // Small deterministic PRNG (mulberry32). Same seed → same mountain, every
    // run, on every device — a level's terrain is a number, not an asset.
    _seededRandom(seed) {
        let a = seed;
        return function () {
            a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // Centre line of one carriageway, bottom → top, as a polyline.
    //
    // Straight up, a turn onto the hill, a hug around its near end, then the
    // mirror image back to straight. Every join is tangent-continuous, so the
    // road never kinks. The whole thing is built against the hill's LEFT end and
    // mirrored for a right-hand road.
    //
    // The turn arc is tangent to the straight road at one end and to the hill's
    // outline at the other. WHERE it lands on that outline depends on the hill's
    // proportions, and both cases have to work:
    //   · long, flat hill  → it lands on the flat face, then a straight run to
    //                        the cap.
    //   · stubby, round hill → the face is too short to reach, so it lands
    //                        directly on the cap and there's no run at all.
    // Assumes the oblong is wider than it is tall (a taller one would need this
    // rotated: its faces would be vertical, not horizontal).
    _buildRoadSpine(roadCx, side, halfW, extra = 0) {
        const r   = this.road;
        const isl = r.island;
        if (!isl) return [{ x: roadCx, y: r.bottom }, { x: roadCx, y: r.top }];

        // Standoff from the hill's surface to the road's centre line: enough for
        // the asphalt's half-width plus the clearance gap (plus any extra —
        // used when this spine is a master line that other roads offset from,
        // so the innermost offset still clears the hill). Tracing the hill's
        // outline at this distance = holding CLEARANCE along the whole hug.
        const D  = halfW + isl.clear + extra;
        const R  = isl.r + D;                 // radius of the wrap around the cap
        const FL = isl.fl;                    // half-length of the hill's flat part

        // Work on the left; mirror at the end if this road wraps the right end.
        const cxRoad = isl.cx - Math.abs(roadCx - isl.cx);
        const xEnd   = isl.cx - FL;           // where the flat face meets the cap
        const k      = cxRoad - xEnd;         // how far the straight sits along the face

        // Biggest turn that still leaves the straight road room to exist. The
        // turn's centre sits at height fy above the hill's centre, and fy grows
        // with the radius; solving fy(turn) <= bottom gives the cap-tangent case,
        // and the flat-tangent case is the simpler fy = cy + R + turn. The two
        // agree at turn == k, so picking by that keeps the clamp continuous.
        const room = r.bottom - isl.cy;
        const flat = room - R;                                   // if it lands on the face
        const turn = Math.max(1, Math.min(isl.turn, flat <= k
            ? flat
            : (room * room - R * R + k * k) / (2 * (R + k))));   // if it lands on the cap

        const fx    = cxRoad - turn;          // turn centre
        const onCap = turn > k;
        // Height of the turn's centre, and where its arc hands off to the hill.
        const fy    = onCap
            ? isl.cy + Math.sqrt(Math.max(0, R * R - k * k + 2 * turn * (R + k)))
            : isl.cy + R + turn;
        // Direction from the turn's centre to its tangency point: straight up onto
        // the flat face, or toward the cap's centre when it meets the cap.
        const handoff = onCap ? Math.atan2(isl.cy - fy, xEnd - fx) : -Math.PI / 2;
        // Where that lands on the cap, as an angle. The wrap runs from there,
        // around the far side, to the mirror of the same angle.
        const capA = onCap ? Math.atan2(fy - isl.cy, fx - xEnd) : Math.PI / 2;

        const pts = [{ x: cxRoad, y: r.bottom }, { x: cxRoad, y: fy }];
        // Turn off the straight onto the hill.
        this._arcTo(pts, fx, fy, turn, 0, handoff);
        // Run along the near face, if the turn didn't already reach the cap.
        if (!onCap) pts.push({ x: xEnd, y: isl.cy + R });
        // Around the end: enters heading away from the road, leaves heading back.
        this._arcTo(pts, xEnd, isl.cy, R, capA, 2 * Math.PI - capA);
        // Back along the far face, then back onto the straight.
        if (!onCap) pts.push({ x: fx, y: isl.cy - R });
        this._arcTo(pts, fx, 2 * isl.cy - fy, turn, -handoff, 0);
        pts.push({ x: cxRoad, y: r.top });

        if (side === 1) for (const p of pts) p.x = isl.cx + (isl.cx - p.x);
        return pts;
    }

    // Append an arc to a polyline. The caller's last point must already be the
    // arc's start, so only the points after it are added.
    _arcTo(pts, cx, cy, radius, a0, a1) {
        const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * radius / this.road.sample));
        for (let i = 1; i <= n; i++) {
            const a = a0 + (a1 - a0) * (i / n);
            pts.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
        }
    }

    // A polyline shifted sideways by `lat` — positive is to the right of travel.
    // `lat` may be a number or a per-index function (used to taper offsets, e.g.
    // lanes converging to the centre through the curve). Used for lanes, asphalt
    // edges and stripes alike, so they can't disagree about where the road goes.
    _offsetPath(pts, lat) {
        const latAt = typeof lat === 'function' ? lat : () => lat;
        const out = [];
        for (let i = 0; i < pts.length; i++) {
            // Central difference, so a point where two pieces join picks up the
            // shared tangent instead of favouring either side.
            const a = pts[Math.max(0, i - 1)];
            const b = pts[Math.min(pts.length - 1, i + 1)];
            const dx = b.x - a.x, dy = b.y - a.y;
            const m  = Math.hypot(dx, dy) || 1;
            const l  = latAt(i);
            out.push({ x: pts[i].x - (dy / m) * l, y: pts[i].y + (dx / m) * l });
        }
        return out;
    }

    // Merge profile along a spine: 1 where the road is straight, easing to 0
    // through the curved hug, with a TAPER-long ramp at each end. Multiplying a
    // lane's lateral offset by this collapses both lanes onto the centre line
    // exactly where the road bends — the 2-lanes-into-1 bottleneck. Returns
    // null when the spine never curves (no island) or merging is disabled.
    _mergeProfile(spine, roadCx) {
        const CM = CONFIG.ROAD.CURVE_MERGE;
        if (!CM || !CM.ENABLED) return null;
        const taper = Math.max(1, CM.TAPER * this.layoutConfig.platformScale);

        // Arc length at each point, and the span where the spine leaves the
        // straight (deviates from the carriageway's home x).
        const cum = [0];
        for (let i = 1; i < spine.length; i++) {
            cum.push(cum[i - 1] + Math.hypot(spine[i].x - spine[i - 1].x,
                                             spine[i].y - spine[i - 1].y));
        }
        let s0 = -1, s1 = -1;
        for (let i = 0; i < spine.length; i++) {
            if (Math.abs(spine[i].x - roadCx) > 0.5) {
                if (s0 < 0) s0 = cum[i];
                s1 = cum[i];
            }
        }
        if (s0 < 0) return null;                       // dead-straight road

        // The ramps live INSIDE the curved span, not ahead of it: the lanes run
        // parallel and vertical right up to where the road starts to bend, then
        // collapse quickly over TAPER. (Ramping before s0 made the convergence
        // start far up the straight, which read as the lanes drifting together.)
        const t = Math.min(taper, (s1 - s0) / 2);
        return spine.map((_, i) => {
            const s = cum[i];
            if (s <= s0 || s >= s1) return 1;
            if (s >= s0 + t && s <= s1 - t) return 0;
            return s < s0 + t ? 1 - (s - s0) / t : 1 - (s1 - s) / t;
        });
    }

    // Measure a polyline: distance-from-start and unit heading at every point, so
    // a position can be looked up by distance travelled. Zero-length segments are
    // dropped — they'd give a heading of NaN.
    _pathMeta(pts) {
        const out = [];
        let cum = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            const dx = pts[i + 1].x - pts[i].x, dy = pts[i + 1].y - pts[i].y;
            const m  = Math.hypot(dx, dy);
            if (m < 1e-6) continue;
            out.push({ x: pts[i].x, y: pts[i].y, cum, tx: dx / m, ty: dy / m });
            cum += m;
        }
        const last = out[out.length - 1];
        out.push({ x: last.x + last.tx * (cum - last.cum), y: last.y + last.ty * (cum - last.cum),
                   cum, tx: last.tx, ty: last.ty });
        return { pts: out, total: cum };
    }

    // Position and heading at a distance along a measured path. `hint` is the
    // caller's last segment index — cars only ever move forward, so this walks
    // one or two steps instead of searching. Distances outside the path
    // extrapolate along the end segments, which is what lets cars drive in from
    // off-road and out the far end.
    _pathPoint(meta, d, hint) {
        const pts = meta.pts;
        let i = Math.min(Math.max(hint | 0, 0), pts.length - 2);
        while (i < pts.length - 2 && d > pts[i + 1].cum) i++;
        while (i > 0 && d < pts[i].cum) i--;
        const p = pts[i];
        const k = d - p.cum;
        return { x: p.x + p.tx * k, y: p.y + p.ty * k, tx: p.tx, ty: p.ty, seg: i };
    }

    // Random desired cruising speed for a car (px/sec, already scaled).
    _roadDesiredSpeed() {
        const r = this.road;
        return Phaser.Math.FloatBetween(r.speedMin, r.speedMax);
    }

    // Weighted pick from the fleet — cars are common, buses rare.
    _pickRoadVehicle() {
        const r = this.road;
        let roll = Math.random() * r.totalWeight;
        for (const t of r.types) {
            roll -= t.weight;
            if (roll <= 0) return t;
        }
        return r.types[0];
    }

    // Put a car at a given distance along its lane. That distance is the source
    // of truth; the screen position and heading are derived from it.
    _placeRoadCar(lane, car, prog) {
        car.prog = prog;
        const p = this._pathPoint(lane.path, prog, car.seg);
        car.seg = p.seg;
        car.setPosition(p.x, p.y);
        car.rotation = Math.atan2(p.tx, -p.ty);   // sprites are drawn facing up
    }

    // Take a sprite from the pool, stamp a randomly-picked vehicle type onto it
    // and place it in a lane. Returns null when the pool is exhausted — the roads
    // just stay as full as the budget allows.
    _spawnRoadCar(lane, prog) {
        const car = this.roadCarPool.pop();
        if (!car) return null;
        const t = this._pickRoadVehicle();
        car.setTexture(t.key)
           .setDisplaySize(t.w, t.len)
           .setActive(true)
           .setVisible(true);
        car.len          = t.len;
        car.desiredSpeed = this._roadDesiredSpeed();
        car.speed        = car.desiredSpeed;
        car.seg          = 0;
        car.inMergeZone  = false;   // zipper bookkeeping — set when it enters
        car.exitAssigned = false;   // set once it's been dealt an exit lane
        car.tolled       = false;   // set when it pays at the mid-tunnel gantry
        this._placeRoadCar(lane, car, prog);
        return car;
    }

    // Stagger vehicles along each lane at create() so no road starts empty. Each
    // one is placed against the length of whatever type it turned out to be.
    // Through the merge zone the carriageway is single file, so only the FIRST
    // lane of a pair seeds cars there — its sibling skips the zone, or the two
    // lanes would open the level overlapped on the shared centre line.
    _seedRoadTraffic() {
        const r = this.road;
        const zoneSeeded = new Set();
        for (const lane of this.roadLanes) {
            const skipZone = lane.sib && lane.mergeEnd > 0 && zoneSeeded.has(lane.sib);
            zoneSeeded.add(lane);

            let edge = 0;                        // back edge of the last car placed
            while (edge < lane.path.total) {
                const car = this._spawnRoadCar(lane, 0);
                if (!car) return;
                let prog = edge + car.len / 2;   // now its length is known, place it
                // Blocked lane (severed road): seed only up to the mountain
                // face — the far half of the path is unreachable until the
                // tunnel opens.
                if (lane.blockAt !== undefined &&
                    prog + car.len / 2 > lane.blockAt - r.minGap) {
                    car.setActive(false).setVisible(false);
                    this.roadCarPool.push(car);
                    break;
                }
                if (skipZone && prog + car.len / 2 > lane.mergeStart - r.minGap
                             && prog - car.len / 2 < lane.mergeEnd + r.minGap) {
                    prog = lane.mergeEnd + r.minGap + car.len / 2;
                    if (prog + car.len / 2 > lane.path.total) {
                        // No room past the zone — return the car, lane is done.
                        car.setActive(false).setVisible(false);
                        this.roadCarPool.push(car);
                        break;
                    }
                }
                this._placeRoadCar(lane, car, prog);
                // Cars seeded past the single-file core are already "dealt" —
                // otherwise the whole downstream population would try to swap
                // lanes on the first frame.
                if (lane.exitSwitch > 0 && prog >= lane.exitSwitch) car.exitAssigned = true;
                lane.cars.unshift(car);          // lanes stay ordered front-first
                edge = prog + car.len / 2 + r.minGap + Phaser.Math.Between(0, Math.round(car.len));
            }
        }
    }

    // Timer tick: add a vehicle at the start of each lane whose entry is clear.
    _trySpawnRoadCars() {
        const r = this.road;
        if (!r) return;
        for (const lane of this.roadLanes) {
            // Draining lanes (replaced by a tunnel reroute) get no new cars.
            if (lane.spawnable === false) continue;
            const back = lane.cars[lane.cars.length - 1];
            // Only spawn once the previous vehicle's rear has cleared the entry.
            if (back && back.prog - back.len / 2 < r.minGap) continue;
            const car = this._spawnRoadCar(lane, 0);
            if (!car) continue;
            // Sit just off the end of the path, nose at the entry, driving in.
            this._placeRoadCar(lane, car, -car.len / 2);
            lane.cars.push(car);
        }
    }

    // Advance every car one frame. Each car wants its own cruising speed but is
    // capped by the gap to the car ahead, which produces the bunching/stop-and-go
    // look for free. Cars are ordered front-first per lane, so the "car ahead" is
    // always the previous entry.
    _updateRoad(time) {
        const r = this.road;
        if (!r) return;
        const dt = this._roadLastTime ? Math.min((time - this._roadLastTime) / 1000, 0.05) : 0;
        this._roadLastTime = time;
        if (dt <= 0) return;

        const gain = CONFIG.ROAD.FOLLOW_GAIN;
        const CM = CONFIG.ROAD.CURVE_MERGE;
        const mergeWin  = (CM && CM.ENABLED ? CM.WINDOW : 0) * this.layoutConfig.platformScale;
        const zoneSpeed = (CM && CM.ENABLED ? CM.ZONE_SPEED : Infinity) * this.layoutConfig.platformScale;
        const transfers = [];   // exit-lane handoffs, applied after the loop

        for (const lane of this.roadLanes) {
            const cars = lane.cars;

            for (let i = 0; i < cars.length; i++) {
                const car   = cars[i];
                const ahead = cars[i - 1];

                let v = car.desiredSpeed;
                if (ahead) {
                    // Bumper-to-bumper gap along the lane. Both lengths are
                    // per-vehicle — a bus takes up more road than a car.
                    const gap = (ahead.prog - ahead.len / 2) - (car.prog + car.len / 2);
                    // Close the gap no faster than it can safely be closed: at
                    // MIN_GAP the car matches the one ahead, below it, it brakes.
                    v = Math.min(v, Math.max(0, ahead.speed + (gap - r.minGap) * gain));
                }

                // Curve bottleneck: near the merge, the other lane's traffic
                // counts as traffic ahead too. Positions are compared in
                // zone-relative distance (the shared centre-line stretch is
                // geometrically identical in both lanes), so whichever car
                // reaches the merge first goes first and the other waits —
                // that alternating file IS the bottleneck.
                if (lane.sib && lane.mergeEnd > 0) {
                    // Crawl through the single-lane stretch itself. Discharging
                    // slower than the straights deliver is what backs the queue
                    // up at the mouth — without this cap the merge clears too
                    // fast to ever feel congested. Tunnel lanes carry their own
                    // (faster) zone speed — that difference is the time saved.
                    if (car.prog + car.len / 2 > lane.mergeStart &&
                        car.prog - car.len / 2 < lane.mergeEnd) {
                        v = Math.min(v, lane.zoneSpeed !== undefined ? lane.zoneSpeed : zoneSpeed);
                    }

                    const zp = car.prog - lane.mergeStart;
                    if (zp > -mergeWin && car.prog - car.len / 2 < lane.mergeEnd) {
                        const sib = lane.sib;
                        let best = null, bestZp = Infinity;
                        for (const c2 of sib.cars) {
                            const zp2 = c2.prog - sib.mergeStart;
                            // Ahead of us, still relevant to the zone (its tail
                            // hasn't cleared the far end), and the nearest such.
                            if (zp2 > zp && zp2 < bestZp &&
                                c2.prog - c2.len / 2 < sib.mergeEnd) {
                                best = c2; bestZp = zp2;
                            }
                        }
                        if (best) {
                            const gap2 = (bestZp - best.len / 2) - (zp + car.len / 2);
                            v = Math.min(v, Math.max(0, best.speed + (gap2 - r.minGap) * gain));
                        }

                        // Zipper gate at the mouth: if it isn't this lane's turn
                        // and the other lane has a car waiting to merge, hold at
                        // the mouth. Without this, a nose-to-tail platoon never
                        // leaves a gap and the other lane starves — one line of
                        // cars downstream, the other lane empty.
                        const front = zp + car.len / 2;
                        if (front < 0 && lane.pairState.next !== lane) {
                            const sibWaiting = sib.cars.some((c2) => {
                                const f2 = c2.prog - sib.mergeStart + c2.len / 2;
                                return f2 <= 0 && f2 > -mergeWin;
                            });
                            if (sibWaiting) {
                                v = Math.min(v, Math.max(0, (-front - r.minGap * 0.5) * gain));
                            }
                        }
                    }
                }

                // Severed road: brake to a stop at the mountain face. Lifted
                // (blockAt cleared) the moment the tunnels open. Only cars
                // still APPROACHING the wall obey it — in endless mode a new
                // mountain's wall is set while cars are already past that
                // point (below it), and they must ignore it.
                if (lane.blockAt !== undefined &&
                    car.prog + car.len / 2 < lane.blockAt) {
                    const wall = lane.blockAt - (car.prog + car.len / 2) - r.minGap * 0.5;
                    v = Math.min(v, Math.max(0, wall * gain));
                }

                car.speed = v;
                const prevY = car.y;
                this._placeRoadCar(lane, car, car.prog + v * dt);

                // Toll gantry at mid-tunnel: any vehicle crossing the LIVE
                // gantry's line (either direction) pays one coin. The live
                // gantry is the most recently opened cut's — a drilling
                // segment's gantry isn't collecting yet, a panned-away one
                // never collects again.
                const tg = this.toll;
                if (tg && tg.live && !car.tolled && prevY !== car.y &&
                    (prevY - tg.tollY) * (car.y - tg.tollY) <= 0) {
                    car.tolled = true;
                    this._collectToll(car);
                }

                // Crossing the merge mouth hands the next slot to the other lane.
                if (lane.sib && lane.mergeEnd > 0 && !car.inMergeZone &&
                    car.prog - lane.mergeStart + car.len / 2 >= 0) {
                    car.inMergeZone = true;
                    lane.pairState.next = lane.sib;
                }

                // Exit dealing: as a car clears the single-file core — where the
                // two lanes' paths are still one line, so its position carries
                // over unchanged — assign it the pair's next exit lane, A-B-A-B.
                // Entry lane and exit lane are decoupled on purpose: exits fill
                // BOTH downstream lanes evenly no matter which lane fed the car
                // in (or which lane it was seeded into).
                if (lane.sib && lane.exitSwitch > 0 && !car.exitAssigned &&
                    car.prog >= lane.exitSwitch) {
                    car.exitAssigned = true;
                    const target = lane.pairState.exitNext;
                    lane.pairState.exitNext = target === lane ? lane.sib : lane;
                    if (target !== lane) transfers.push({ car, from: lane, to: target });
                }
            }

            // Retire cars that have left the far end (front of the lane first).
            while (cars.length && cars[0].prog - cars[0].len / 2 > lane.path.total) {
                const done = cars.shift();
                done.setActive(false).setVisible(false);
                this.roadCarPool.push(done);
            }
        }

        // Apply the exit handoffs, after the loop so a moved car can't be
        // updated twice in one frame. Position carries over as-is (the paths
        // coincide at the switch point); the seg hint restarts from 0 and
        // re-catches on the next placement.
        for (const tr of transfers) {
            const idx = tr.from.cars.indexOf(tr.car);
            if (idx < 0) continue;
            tr.from.cars.splice(idx, 1);
            let ins = 0;
            while (ins < tr.to.cars.length && tr.to.cars[ins].prog > tr.car.prog) ins++;
            tr.to.cars.splice(ins, 0, tr.car);
            tr.car.seg = 0;
        }

        // Drop drained legacy lanes (left behind by a tunnel reroute) once
        // their last car has finished its trip.
        if (this.roadLanes.some((l) => l.spawnable === false && l.cars.length === 0)) {
            this.roadLanes = this.roadLanes.filter(
                (l) => l.spawnable !== false || l.cars.length > 0);
        }
    }

    // Build one traffic lane from a carriageway spine: offset sideways by `lat`
    // (scaled by the merge profile so lanes collapse to single file where the
    // spine deviates from straight), reversed for downward lanes, with the merge
    // zone measured out in the lane's own arc length. Used by the surface roads
    // at create() and by the tunnel routes at breakthrough — same machinery.
    //
    // mergeStart/mergeEnd span taper-to-taper (cross-lane yielding + seeding key
    // off these); exitSwitch is the end of the single-file CORE — the last point
    // where both lanes' paths still coincide, so a car can be handed to either
    // lane there with its position unchanged.
    _makeLane(spine, merge, lat, dir) {
        const pts   = this._offsetPath(spine, merge ? (i) => lat * merge[i] : lat);
        const flags = merge ? spine.map((_, i) => merge[i] < 0.999) : null;
        const core  = merge ? spine.map((_, i) => merge[i] <= 0.001) : null;
        if (dir === -1) {
            pts.reverse();
            if (flags) { flags.reverse(); core.reverse(); }
        }

        let mergeStart = -1, mergeEnd = -1, exitSwitch = -1;
        if (flags) {
            let cum = 0;
            for (let i = 0; i < pts.length; i++) {
                if (i) cum += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
                if (flags[i]) {
                    if (mergeStart < 0) mergeStart = cum;
                    mergeEnd = cum;
                }
                if (core[i]) exitSwitch = cum;
            }
        }

        return {
            dir, path: this._pathMeta(pts), cars: [],
            mergeStart, mergeEnd, exitSwitch, sib: null,
        };
    }

    // ================================================================
    // TUNNEL BORING MACHINE (battery-powered)
    // ================================================================
    // Merged batteries bank drilling distance; two augers (one per carriageway)
    // pierce the mountain bottom → top in lockstep. The apparent rotation is
    // the barber-pole illusion: a helix spinning about its long axis reads,
    // from above, as its flights sliding ALONG the axis — so each shaft is a
    // TileSprite whose helix texture scrolls, with the cylinder shading baked
    // in per-column (x-only, so scrolling never disturbs it). No cut is ever
    // drawn: while drilling only the machines show, and at breakthrough the
    // roads are painted straight through and traffic reroutes onto them.
    createTunnel(isl, seg) {
        const TN = CONFIG.ROAD.TUNNEL;
        const s  = (v) => v * this.layoutConfig.platformScale;
        const r  = this.road;

        const entryY = isl.cy + isl.r;
        const exitY  = isl.cy - isl.r;
        const len    = entryY - exitY;

        // One bore PER CARRIAGEWAY: upstream and downstream each get their own
        // tunnel, cut by their own machine, with mountain left standing between
        // them. Each bore is its road's full 2-lane width plus a visible cut
        // wall each side, so the road runs straight through afterwards.
        const margin = s(TN.MARGIN);
        const boreW  = r.spines[0].halfW * 2 + margin * 2;
        // The machine is the auger.png art, sliced into tip / spiral / cap by
        // _makeTunnelTextures. Its flight is the widest part, scaled to nearly
        // fill the bore.
        const mw = Math.max(8, Math.round(boreW * (TN.BLADE_DIAM || 0.82)));
        // The sand strip is ROAD-sized (not bore-sized): each carriageway gets
        // its own strip, and the divider gap between the two roads stays
        // standing — the strips must never touch.
        const cutW = Math.round(r.spines[0].halfW * 2);
        this._makeTunnelTextures(cutW);

        const bladeLen = s(TN.BLADE_LEN);
        // One uniform scale maps the art onto the machine width; tip and cap
        // keep the art's proportions, the spiral section fills the rest of
        // BLADE_LEN (measured behind the face, so queue offsets still match).
        const sc    = mw / this.textures.get('auger_mid').getSourceImage().width;
        const capH  = this.textures.get('auger_tail').getSourceImage().height * sc;
        const bodyH = Math.max(4, bladeLen - capH);

        // The tunnel ROAD is drawn complete at create — the missing middle of
        // each carriageway — and hidden behind one shared mask that grows
        // upward just behind the machines. So the road appears progressively
        // in the augers' wake, but cars stay held at the barrier until the
        // whole tunnel is through.
        const RC    = CONFIG.ROAD;
        const dash  = s(RC.STRIPE_DASH);
        const gap   = s(RC.STRIPE_GAP);
        const inset = s(RC.STRIPE_INSET);
        const sw    = Math.max(1, s(RC.STRIPE_WIDTH));
        const roadGfx = this._addB(this.add.graphics().setDepth(2), seg);
        for (const sp of r.spines) {
            const roadCx = sp.pts[0].x;
            const halfW  = sp.halfW;
            roadGfx.fillStyle(RC.ASPHALT_COLOR, 1);
            roadGfx.fillRect(roadCx - halfW, exitY, halfW * 2, len);
            roadGfx.fillStyle(RC.STRIPE_COLOR, 1);
            for (const edgeX of [roadCx - halfW + inset, roadCx + halfW - inset]) {
                for (let y = exitY; y < entryY; y += dash + gap) {
                    roadGfx.fillRect(edgeX - sw / 2, y, sw, Math.min(dash, entryY - y));
                }
            }
        }
        // CUT WALLS — this is not a covered tunnel but an open cutting: the
        // mountain is carved down to road level, so each road edge meets a
        // steep wall of freshly exposed EARTH (CUT_COLOR, same soil as the
        // bore floor). Baked ONCE as a canvas texture with true linear
        // gradients — no bands, no pixel steps: brightness eases from the
        // shadowed foot at the road edge to full sand, then alpha runs out so
        // the crest melts into the mountain; and a vertical alpha fade at
        // both ends melts the wall into the green flats at the mouths. The
        // median ridge is walled from both sides at a clamped width.
        const wallW   = s(TN.WALL_W);
        const gapHalf = Math.max(1, s(RC.ROAD_GAP) / 2);
        const fadeL   = Math.min(s(TN.WALL_FADE), len / 3);
        const centerX = (r.spines[0].pts[0].x +
                         r.spines[r.spines.length - 1].pts[0].x) / 2;
        const cutR = (TN.CUT_COLOR >> 16) & 255,
              cutG = (TN.CUT_COLOR >> 8)  & 255,
              cutB =  TN.CUT_COLOR        & 255;
        const mkWall = (wkey, wpx) => {
            // Segments share these (identical dimensions every time); never
            // remove a texture the previous segment's images still use.
            if (this.textures.exists(wkey)) return;
            const c   = this.textures.createCanvas(
                wkey, Math.max(1, Math.ceil(wpx)), Math.max(1, Math.ceil(len)));
            const ctx = c.getContext();
            const stop = (t, a2) => {
                const f = 1 - TN.WALL_ALPHA * (1 - t);
                return `rgba(${Math.round(cutR * f)},${Math.round(cutG * f)},` +
                       `${Math.round(cutB * f)},${a2})`;
            };
            const g = ctx.createLinearGradient(0, 0, c.width, 0);
            g.addColorStop(0, stop(0, 1));
            g.addColorStop(0.55, stop(0.55, 1));
            g.addColorStop(1, stop(1, 0));
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, c.width, c.height);
            // Erase smoothly toward each end (mouths → green).
            ctx.globalCompositeOperation = 'destination-out';
            let e = ctx.createLinearGradient(0, 0, 0, fadeL);
            e.addColorStop(0, 'rgba(0,0,0,1)');
            e.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = e;
            ctx.fillRect(0, 0, c.width, fadeL);
            e = ctx.createLinearGradient(0, c.height - fadeL, 0, c.height);
            e.addColorStop(0, 'rgba(0,0,0,0)');
            e.addColorStop(1, 'rgba(0,0,0,1)');
            ctx.fillStyle = e;
            ctx.fillRect(0, c.height - fadeL, c.width, fadeL);
            ctx.globalCompositeOperation = 'source-over';
            c.refresh();
        };
        mkWall('tunnel_wall_outer', wallW);
        mkWall('tunnel_wall_inner', Math.min(wallW, gapHalf));

        const wallImgs = [];
        for (const sp of r.spines) {
            const roadCx = sp.pts[0].x, halfW = sp.halfW;
            for (const side of [-1, 1]) {
                const inner = r.spines.length > 1 &&
                    ((roadCx < centerX && side === 1) ||
                     (roadCx > centerX && side === -1));
                const img = this._addB(this.add.image(roadCx + side * halfW, exitY,
                        inner ? 'tunnel_wall_inner' : 'tunnel_wall_outer')
                    .setOrigin(side === 1 ? 0 : 1, 0)
                    .setFlipX(side === -1)
                    .setDepth(2), seg);
                wallImgs.push(img);
            }
        }

        const maskShape = this._addB(this.add.graphics().setVisible(false), seg);
        // Future mask draws use post-rebase coordinates, so the graphics
        // object itself must never be shifted (see _rebaseWorld).
        maskShape._noRebase = true;
        const revealMask = maskShape.createGeometryMask();
        roadGfx.setMask(revealMask);
        for (const img of wallImgs) img.setMask(revealMask);

        // The machines: FIXED-length rigs that climb with the face — head at
        // the front, a machine-length of auger behind it. They work TOWARD
        // their own traffic's queue: the upstream road's rig parks at the
        // bottom mouth and drills up, the downstream road's rig parks at the
        // TOP mouth and drills down — each jam watches its machine approach.
        // Drawn ABOVE the road (they ride on it) and below the cars.
        const bores = r.spines.map((sp, idx) => {
            const x = sp.pts[0].x;   // spines start on the straight = road centre
            // Drill direction: normally BOTH rigs cut bottom→top, so players
            // see the machines advancing in the traffic's direction of
            // progression. With OPPOSED_DRILL on, each road's rig instead
            // works from its own queue's mouth (down road cuts top→bottom).
            const drill = TN.OPPOSED_DRILL
                ? ((RC.ROADS[idx] && RC.ROADS[idx].LANE_DIRS[0]) || 1)
                : 1;
            const mouthY = drill === 1 ? entryY : exitY;
            const flip   = drill === -1;

            // The raw cut: a strip of churned sand over the bored wake, face
            // back to this rig's own mouth. For the down-driller the strip is
            // pinned at the top mouth and only its height grows.
            const cut = this._addB(this.add.tileSprite(x, mouthY, cutW, 1, 'cut_sand')
                .setOrigin(0.5, 0).setDepth(2.05).setVisible(false), seg);
            // Three stacked slices of the art: pointed tip biting into the
            // face, the spiral section behind it (a TileSprite — scrolling
            // its UVs is the rotation), and the drive cap at the rear. The
            // slice edges all sit at bare-shaft rows, so they join cleanly.
            // The down-driller is the same rig mirrored vertically.
            const head = this._addB(this.add.image(x, mouthY, 'auger_tip')
                .setOrigin(0.5, flip ? 0 : 1).setScale(sc)
                .setFlipY(flip).setDepth(2.25), seg);
            const shaft = this._addB(this.add.tileSprite(x, mouthY, mw, bodyH, 'auger_mid')
                .setOrigin(0.5, flip ? 1 : 0).setTileScale(sc)
                .setFlipY(flip).setDepth(2.2), seg);
            const tail = this._addB(this.add.image(x, mouthY + drill * bodyH, 'auger_tail')
                .setOrigin(0.5, flip ? 1 : 0).setScale(sc)
                .setFlipY(flip).setDepth(2.2), seg);
            const wobble = this.tweens.add({ targets: head, x: x + Math.max(1, s(0.8)),
                              duration: 55, yoyo: true, repeat: -1, paused: true });

            return { x, bore: boreW, drill, cut, shaft, tail, head, wobble };
        });

        // Both machines advance in lockstep off one banked-charge account, so
        // a single progress value drives every shaft, mask and head.
        this.tunnel = {
            entryY, exitY, len, bladeLen, bodyH, texScale: sc,
            progressPx: 0, earnedPx: 0, open: false, lastTime: 0, pulseT: 0,
            bores, maskShape, chips: [], debrisAcc: 0,
            tollY: (entryY + exitY) / 2,
            seg: seg || null,
            // A tunnel built ahead (endless: the NEXT mountain, while the
            // camera is still down at the current one) stays dormant — no
            // charge banks, no drilling — until the camera has arrived and
            // settled (_rebaseWorld arms it). The first segment starts armed.
            ready: this.segments.length <= 1,
            // ...and even then the dig waits for the jam: the lead upstream
            // vehicle must be standing at the barrier for QUEUE_WAIT_MS
            // (letting a few more pile in) before the first grind burst.
            digOk: false, haltT: 0,
        };
        if (seg) seg.tunnel = this.tunnel;
    }

    // Toll gantry for one segment: a "TOLL ROAD" signboard on the left verge
    // at that segment's mid-tunnel, with the pending-coins counter perched on
    // top. The gantry goes `live` when its road opens; `this.toll` always
    // points at the live (collecting) gantry, while later segments' gantries
    // wait on their own segment records.
    _createTollCounter(tn, seg) {
        const TO = CONFIG.ROAD.TUNNEL.TOLL;
        if (!TO || !TO.ENABLED || !tn) return;
        const sc   = this.layoutConfig.platformScale;

        const TN     = CONFIG.ROAD.TUNNEL;
        const sp0    = this.road.spines[0];
        const signX  = sp0.pts[0].x - sp0.halfW - TN.WALL_W * sc
                     - Math.round(13 * sc);
        const signY  = tn.tollY;
        const boardH = Math.round(22 * sc);
        const board = this._addB(this.add.rectangle(signX, signY,
                Math.round(30 * sc), boardH, 0xf7d94c)
            .setStrokeStyle(Math.max(1, Math.round(2 * sc)), 0x3a2f14)
            .setDepth(2.6).setVisible(false), seg);
        const label = this._addB(this.add.text(signX, signY, 'TOLL\nROAD', {
            fontSize: Math.max(7, Math.round(8 * sc)) + 'px',
            fontStyle: 'bold',
            color: '#3a2f14',
            align: 'center',
        }).setOrigin(0.5).setDepth(2.61).setVisible(false), seg);

        // The counter perches right on top of the board — coins hop straight
        // from the gantry to the sign instead of flying across the screen.
        const size = Math.max(12, Math.round(16 * sc));
        const ix   = signX - size * 0.35;
        const iy   = signY - boardH / 2 - Math.round(9 * sc);
        const icon = this._addB(this.add.image(ix, iy, 'coin')
            .setDisplaySize(size, size).setDepth(9).setVisible(false), seg);
        const text = this._addB(this.add.text(ix + size * 0.75, iy, '0', {
            fontSize: Math.max(11, Math.round(15 * sc)) + 'px',
            fontStyle: 'bold',
            color: '#ffe9a8',
            stroke: '#5a4310', strokeThickness: 2,
        }).setOrigin(0, 0.5).setDepth(9).setVisible(false), seg);

        const toll = { pending: 0, icon, text, ix, iy, sign: [board, label],
                       counterUi: [icon, text], iconBase: icon.scaleX,
                       tollY: tn.tollY, live: false, seg: seg || null };
        if (seg) seg.toll = toll;
        if (!this.toll) this.toll = toll;

        if (!this._tollTimer) {
            this._tollTimer = this.time.addEvent({
                delay: TO.FLUSH_MS || 5000, loop: true,
                callback: this._flushTolls, callbackScope: this,
            });
        }
    }

    // One vehicle paid: fly a coin from its roof to the toll counter; the
    // count ticks up when the coin lands.
    _collectToll(car) {
        const t = this.toll;
        if (!t || !t.live) return;
        const TO   = CONFIG.ROAD.TUNNEL.TOLL;
        const size = Math.max(10, Math.round(13 * this.layoutConfig.platformScale));
        const coin = this._addB(this.add.image(car.x, car.y, 'coin')
            .setDisplaySize(size, size).setDepth(9.5), t.seg);
        this.tweens.add({
            targets: coin,
            x: t.ix, y: t.iy,
            duration: 300,
            ease: 'Cubic.easeIn',
            onComplete: () => {
                coin.destroy();
                t.pending += TO.PER_VEHICLE || 1;
                t.text.setText(`${t.pending}`);
                // Chime pulse — always from the icon's TRUE base scale, so
                // overlapping pulses can never compound and grow the icon.
                this.tweens.killTweensOf(t.icon);
                t.icon.setScale(t.iconBase);
                this.tweens.add({
                    targets: t.icon, scale: t.iconBase * 1.35,
                    duration: 90, yoyo: true,
                    onComplete: () => t.icon.setScale(t.iconBase),
                });
            },
        });
    }

    // Bank the pile: everything the gantry collected since the last flush
    // flies over to the main account (the coins that buy merge spawns).
    _flushTolls() {
        const t = this.toll;
        if (!t || t.pending <= 0) {
            // Nothing collected this cycle — but the flow window may still be
            // over: in endless mode the camera moves on regardless.
            this._maybePan();
            return;
        }
        const amount = t.pending;
        t.pending = 0;
        t.text.setText('0');

        // The bank-transfer coin crosses into partA, so it lives on the MAIN
        // camera (fixed space). Flushes only happen in steady state, where
        // world and screen coordinates coincide — spawn at the gantry as-is,
        // and keep it out of the landscape camera.
        const target = this.coinIcon;
        const size   = Math.max(12, Math.round(16 * this.layoutConfig.platformScale));
        const coin   = this.add.image(t.ix, t.iy, 'coin')
            .setDisplaySize(size, size).setDepth(9.5);
        if (this.camB) this.camB.ignore(coin);
        this.tweens.add({
            targets: coin,
            x: target ? target.x : t.ix,
            y: target ? target.y : t.iy,
            duration: 650,
            ease: 'Cubic.easeIn',
            onComplete: () => {
                coin.destroy();
                this.coins += amount;
                this.updateCoinDisplay();
                this._maybePan();
            },
        });
    }

    // Slice the auger.png art into the machine's three stacked parts.
    //
    // The art already points UP (drill tip at the top, drive cap at the
    // bottom) — the same way the machines drill — so the slices are straight
    // crops, no flip. The cut rows are fractions of the art height, measured
    // from the pixels: spiral section 0.209·H–0.828·H is exactly two flight
    // pitches with near-bare shaft at both edges, so it tiles seamlessly and
    // its UVs scroll forever. The static slices must contain NO ribbon (a
    // non-scrolling wrap reads as a stalled blade): the tip is only the
    // featureless cone point (above 0.118·H), the tail only bare shaft and
    // the drive cap (below 0.828·H).
    _makeTunnelTextures(cutW) {
        // Dimensions are identical for every segment, so bake once and reuse —
        // never remove textures a previous segment's sprites still display.
        if (this.textures.exists('auger_mid') && this.textures.exists('cut_sand')) return;
        const src = this.textures.get('auger_src').getSourceImage();
        const sw  = src.width, sh = src.height;
        const crop = (key, y0, y1) => {
            const cy = Math.round(sh * y0), ch = Math.round(sh * y1) - cy;
            if (this.textures.exists(key)) this.textures.remove(key);
            const canvas = this.textures.createCanvas(key, sw, ch);
            const ctx = canvas.getContext();
            ctx.drawImage(src, 0, cy, sw, ch, 0, 0, sw, ch);
            canvas.refresh();
        };
        crop('auger_tip',  0,     0.118);
        crop('auger_mid',  0.209, 0.828);
        crop('auger_tail', 0.828, 1);

        // The raw-cut floor: churned sand, not flat paint — per-pixel grain
        // noise, scattered darker pebbles, faint vertical drag streaks from
        // the flights, and WANDERING ragged edges: each side's edge is a slow
        // multi-frequency wave (whole cycles per tile, so it wraps seamlessly)
        // plus per-row jitter — a torn, dug-out line instead of a ruler edge.
        const TN = CONFIG.ROAD.TUNNEL;
        const cw = Math.max(8, cutW || 32), chh = 64;
        const base = [(TN.CUT_COLOR >> 16) & 255, (TN.CUT_COLOR >> 8) & 255, TN.CUT_COLOR & 255];
        if (this.textures.exists('cut_sand')) this.textures.remove('cut_sand');
        const sand = this.textures.createCanvas('cut_sand', cw, chh);
        const sctx = sand.getContext();
        const simg = sctx.createImageData(cw, chh);
        const streak = [];
        for (let x = 0; x < cw; x++) {
            streak[x] = 1 + Math.sin(x * 1.7) * 0.05 + (Math.random() - 0.5) * 0.06;
        }
        const maxRag = Math.max(3, cw * 0.16);
        const phases = [0, 0, 0, 0].map(() => Math.random() * Math.PI * 2);
        const edgeAt = (y, p1, p2) => {
            const t = (y / chh) * Math.PI * 2;
            return maxRag * (0.45 + 0.30 * Math.sin(t + p1)
                                  + 0.22 * Math.sin(3 * t + p2))
                 + Math.random() * 1.6;
        };
        for (let y = 0; y < chh; y++) {
            const ragL = edgeAt(y, phases[0], phases[1]);
            const ragR = edgeAt(y, phases[2], phases[3]);
            for (let x = 0; x < cw; x++) {
                let f = streak[x] * (0.86 + Math.random() * 0.26);
                if (Math.random() < 0.03) f *= 0.7;    // dark pebble grain
                if (Math.random() < 0.02) f *= 1.25;   // bright fleck
                const p = (y * cw + x) * 4;
                simg.data[p]     = Math.min(255, Math.round(base[0] * f));
                simg.data[p + 1] = Math.min(255, Math.round(base[1] * f));
                simg.data[p + 2] = Math.min(255, Math.round(base[2] * f));
                // Soft one-pixel fringe at the torn line, not a hard cliff.
                const d = Math.min(x - ragL, (cw - 1 - x) - ragR);
                simg.data[p + 3] = d < 0 ? 0 : d < 1 ? 150 : 255;
            }
        }
        sctx.putImageData(simg, 0, 0);
        sand.refresh();

        // Debris sprites are baked WHITE and tinted per spawn — one texture,
        // many sand shades. The puff is a soft radial gradient for dust.
        if (this.textures.exists('debris_chip')) this.textures.remove('debris_chip');
        const chip = this.textures.createCanvas('debris_chip', 3, 3);
        const cc = chip.getContext();
        cc.fillStyle = '#ffffff';
        cc.fillRect(0, 0, 3, 3);
        chip.refresh();

        if (this.textures.exists('dust_puff')) this.textures.remove('dust_puff');
        const puff = this.textures.createCanvas('dust_puff', 24, 24);
        const pc = puff.getContext();
        const grad = pc.createRadialGradient(12, 12, 2, 12, 12, 12);
        grad.addColorStop(0, 'rgba(255,255,255,0.9)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        pc.fillStyle = grad;
        pc.fillRect(0, 0, 24, 24);
        puff.refresh();
    }

    // One charge tick in road mode: slotted batteries bank drilling distance.
    // update() spends it — the blade only advances while it's owed distance, so
    // pulling the batteries out visibly stalls the machine.
    _tunnelChargeCycle() {
        const tn = this.tunnel;
        if (!tn || tn.open || !tn.ready) return;

        // The dig starts only once the upstream queue has visibly formed:
        // front vehicle stopped at the barrier, held for QUEUE_WAIT_MS so a
        // few more come to a rest behind it.
        if (!tn.digOk) {
            if (!this._upQueueHalted()) { tn.haltT = 0; return; }
            if (!tn.haltT) { tn.haltT = this.time.now; return; }
            if (this.time.now - tn.haltT <
                (CONFIG.ROAD.TUNNEL.QUEUE_WAIT_MS || 1500)) return;
            tn.digOk = true;
        }
        let total = 0;
        for (let i = 0; i < 3; i++) {
            const slot = this.chargingSlots[i];
            if (slot) total += slot.chargePerMinute;
        }
        if (total <= 0) return;

        tn.earnedPx += total * CONFIG.ROAD.TUNNEL.ADVANCE_PER_CHARGE
                     * this.layoutConfig.platformScale;
        // Trigger one work burst: the machine follows the same 1-second pulse
        // as the battery icons — a jolt of rotation and advance per tick.
        tn.pulseT = Math.max(0.05, (CONFIG.ROAD.TUNNEL.PULSE_MS || 450) / 1000);
        for (let i = 0; i < 3; i++) {
            if (this.chargingSlots[i]) this._pulseBatteryIcon(this.platforms[i]);
        }
    }

    // Advance the blade while it owes banked distance. Reveal = growing the
    // mask rect; rotation = scrolling the helix texture. Both stop dead the
    // moment the banked distance is spent — an idle drill doesn't spin.
    _updateTunnel(time) {
        const tn = this.tunnel;
        if (!tn || tn.open) return;
        const dt = tn.lastTime ? Math.min((time - tn.lastTime) / 1000, 0.05) : 0;
        tn.lastTime = time;
        if (dt <= 0) return;

        const remaining = Math.min(tn.earnedPx, tn.len) - tn.progressPx;

        // The machine runs on the battery's 1-second pulse: each charge tick
        // arms a short burst (pulseT). Outside a burst — or with nothing owed —
        // it sits completely dead: no spin, no wobble, no advance.
        if (remaining <= 0.01 || tn.pulseT <= 0) {
            for (const b of tn.bores) {
                if (!b.wobble.isPaused()) { b.wobble.pause(); b.head.x = b.x; }
            }
            return;
        }

        const TN = CONFIG.ROAD.TUNNEL;
        const pulseDur = Math.max(0.05, (TN.PULSE_MS || 450) / 1000);
        // Spend what's owed evenly across the rest of the burst, so each tick's
        // banked distance is fully consumed by the time the burst ends.
        const step = Math.min(remaining, remaining * dt / tn.pulseT);
        tn.pulseT = Math.max(0, tn.pulseT - dt);
        const wind = tn.pulseT / pulseDur;   // 1 → 0 over the burst
        tn.progressPx += step;

        // Each machine advances from its OWN mouth toward the opposite one —
        // the up bore's face climbs, the down bore's face descends — both off
        // the same shared progress.
        const cutH = tn.progressPx;
        for (const b of tn.bores) {
            const faceY = b.drill === 1 ? tn.entryY - tn.progressPx
                                        : tn.exitY  + tn.progressPx;
            if (b.wobble.isPaused()) b.wobble.resume();
            // UV scroll = rotation: the spiral marches along the shaft (spoil
            // being augered back out of the bore). tilePositionY is in SOURCE
            // texture pixels, so divide by the display scale to get SCROLL
            // px/s on screen. The flipped down-rig scrolls the opposite way so
            // spoil still visually feeds toward its rear. Winds down over the
            // burst: jolt, then coast.
            b.shaft.tilePositionY -= b.drill * TN.SCROLL * (0.35 + 0.65 * wind)
                                   * dt / tn.texScale;
            b.shaft.y = faceY;
            b.tail.y = faceY + b.drill * tn.bodyH;
            b.head.y = faceY;
            // Raw sand over this rig's bored wake, face back to its own
            // mouth. The up bore's strip hangs from the moving face (tile
            // offset pins the grain pattern to the WORLD); the down bore's is
            // pinned at the top mouth and just grows taller.
            b.cut.y = b.drill === 1 ? faceY : tn.exitY;
            b.cut.setSize(b.cut.width, Math.max(1, cutH)).setVisible(cutH > 0.5);
            b.cut.tilePositionY = b.drill === 1 ? faceY : 0;
        }
        // NO paving while drilling: the whole bored wake stays raw sand. The
        // road is laid in discrete tile sections after breakthrough — see
        // _breakthrough.

        // Rock chips off both faces while cutting.
        tn.debrisAcc += dt;
        if (tn.debrisAcc > 0.04) {
            tn.debrisAcc = 0;
            for (const b of tn.bores) {
                const faceY = b.drill === 1 ? tn.entryY - tn.progressPx
                                            : tn.exitY  + tn.progressPx;
                this._spawnTunnelChip(b, faceY);
            }
        }

        if (tn.progressPx >= tn.len - 0.5) this._breakthrough();
    }

    // Spoil at one bore's blade: sand augered off the face falls BEHIND the
    // machine, against its own drilling direction (down-screen for the up
    // bore, up-screen for the down bore) — it can't spread sideways, the cut
    // walls are right there. Chips rain from the blade onto the raw cut
    // behind it, plus soft dust puffs sinking the same way. Everything is
    // pooled — chips and puffs share one pool and just swap texture/tint.
    _spawnTunnelChip(b, faceY) {
        const tn   = this.tunnel;
        const TN   = CONFIG.ROAD.TUNNEL;
        const half = b.shaft.width / 2;
        const grab = (tex, depth) => {
            const o = tn.chips.pop() ||
                this._addB(this.add.image(0, 0, tex), tn.seg);
            return o.setTexture(tex).setDepth(depth).setVisible(true);
        };
        const done = (o) => () => { o.setVisible(false); tn.chips.push(o); };

        const cols = TN.DEBRIS_COLORS;
        const n = 10 + Math.floor(Math.random() * 7);
        for (let i = 0; i < n; i++) {
            const chip = grab('debris_chip', 2.3)
                .setTint(cols[Math.floor(Math.random() * cols.length)])
                .setPosition(b.x + (Math.random() - 0.5) * b.shaft.width * 0.9,
                             faceY + b.drill * Math.random() * tn.bodyH * 0.5)
                .setScale(1.0 + Math.random() * 1.2)
                .setAlpha(1);
            this.tweens.add({
                targets:  chip,
                x:        chip.x + (Math.random() - 0.5) * 4,
                y:        chip.y + b.drill * (14 + Math.random() * 26),
                scale:    chip.scale * 0.5,
                alpha:    0,
                duration: 450 + Math.random() * 350,
                ease:     'Quad.easeOut',
                onComplete: done(chip),
            });
        }

        if (Math.random() < 0.8) {
            const puff = grab('dust_puff', 2.35)
                .setTint(TN.DUST_COLOR)
                .setPosition(b.x + (Math.random() - 0.5) * b.shaft.width * 0.7,
                             faceY + b.drill * Math.random() * tn.bodyH * 0.4)
                .setScale(0.6 + Math.random() * 0.4)
                .setAlpha(0.55);
            this.tweens.add({
                targets:  puff,
                x:        puff.x + (Math.random() - 0.5) * 5,
                y:        puff.y + b.drill * (10 + Math.random() * 12),
                scale:    puff.scale * (2.2 + Math.random()),
                alpha:    0,
                duration: 450 + Math.random() * 300,
                ease:     'Quad.easeOut',
                onComplete: done(puff),
            });
        }
    }

    // The blade exits the mountain's top edge: retire the machines, then lay
    // the road as TILE_COUNT discrete sections, entry → exit, one per tick —
    // each section replaces its stretch of raw sand. Traffic is released only
    // once the last section has landed.
    _breakthrough() {
        const tn = this.tunnel;
        if (tn.open) return;
        tn.open = true;

        const parts = [];
        for (const b of tn.bores) {
            this.tweens.killTweensOf(b.head);
            parts.push(b.shaft, b.tail, b.head);
        }
        this.tweens.add({
            targets: parts,
            alpha: 0, duration: 700,
            onComplete: () => parts.forEach((o) => o.setVisible(false)),
        });

        const TN    = CONFIG.ROAD.TUNNEL;
        const count = Math.max(1, TN.TILE_COUNT || 5);
        const segH  = tn.len / count;
        let laid = 0;
        this.time.addEvent({
            delay: TN.TILE_MS || 300,
            repeat: count - 1,
            callback: () => {
                laid++;
                const yTop = tn.entryY - laid * segH;
                // Reveal this section of the pre-drawn road (+ its cut walls).
                tn.maskShape.fillStyle(0xffffff)
                    .fillRect(0, yTop - 0.5, this.scale.width, segH + 1);
                // The sand recedes to just above the freshly paved section.
                const hLeft = Math.max(0, yTop - tn.exitY);
                for (const b of tn.bores) {
                    b.cut.setSize(b.cut.width, Math.max(1, hLeft))
                         .setVisible(hLeft > 0.5);
                    // A quick flash so each tile visibly "lands".
                    const flash = this._addB(this.add
                        .rectangle(b.x, yTop + segH / 2, b.cut.width, segH, 0xffffff, 0.35)
                        .setDepth(2.1), tn.seg);
                    this.tweens.add({
                        targets: flash, alpha: 0, duration: 220,
                        onComplete: () => flash.destroy(),
                    });
                }
                if (laid === count) this._openTunnelLanes(tn);
            },
        });
    }

    // The tunnels are through: lift the barriers — the queued vehicles at
    // both faces accelerate through on the same lanes they were always in —
    // and put this cut's toll gantry in business. In endless mode this is
    // also the moment the NEXT mountain appears above: lanes extend up to it
    // and the machines start over there, while this cut enjoys its 5 seconds
    // of flowing (and paying) traffic before the camera moves on.
    _openTunnelLanes(tn) {
        for (const lane of this.roadLanes) lane.blockAt = undefined;

        // This segment's gantry becomes the live collector.
        const toll = (tn && tn.seg && tn.seg.toll) || this.toll;
        if (toll && toll.sign) {
            this.toll = toll;
            toll.live = true;
            for (const o of toll.sign) {
                o.setVisible(true).setScale(0.2);
                this.tweens.add({
                    targets: o, scale: 1,
                    duration: 260, ease: 'Back.easeOut',
                });
            }
            for (const o of toll.counterUi) o.setVisible(true);
        }
        // Restart the flush cycle so this cut gets a full 5s collection
        // window before the bank transfer (and, in endless mode, the pan).
        if (this._tollTimer) {
            const TO = CONFIG.ROAD.TUNNEL.TOLL;
            this._tollTimer.remove();
            this._tollTimer = this.time.addEvent({
                delay: (TO && TO.FLUSH_MS) || 5000, loop: true,
                callback: this._flushTolls, callbackScope: this,
            });
        }

        if (this.endless) {
            // A breakthrough during a pan (extreme charge rates) must wait
            // for the rebase — the band above is still occupied until then.
            if (this.endless.panning) this.endless.deferBuild = true;
            else this._buildNextSegment();
            // With tolls disabled there is no flush timer to trigger the
            // pan — give the flow window a plain timer instead.
            if (!this._tollTimer) {
                this.time.delayedCall(5000, () => this._maybePan());
            }
        }
    }

    // ── Endless progression ──────────────────────────────────────────────────
    // Stack the next segment above the world, stretch the (dead-straight)
    // lanes up through it, and aim the queues at the new mountain. Cars keep
    // their arc-length positions: up lanes' origin (the bottom) is untouched;
    // down lanes' origin moved up one segment, so their cars all advance by
    // segH. From here the batteries bank charge toward the NEW machines.
    _buildNextSegment() {
        const E  = this.endless;
        const RC = CONFIG.ROAD;
        const r  = this.road;
        const s  = (v) => v * this.layoutConfig.platformScale;

        E.segIndex++;
        const seed = RC.ISLAND.SEED + E.segIndex * (RC.ENDLESS.SEED_STEP || 1);

        // 1. Stretch the spines one segment up (2-point verticals — the top
        //    point IS the whole extension), then rebuild every lane path.
        for (const sp of r.spines) sp.pts[sp.pts.length - 1].y -= E.segH;
        for (const lane of this.roadLanes) {
            const pts = lane.path.pts.map((p) => ({ x: p.x, y: p.y }));
            if (lane.dir === 1) pts[pts.length - 1].y -= E.segH;
            else                pts[0].y             -= E.segH;
            lane.path = this._pathMeta(pts);
            if (lane.dir === -1) {
                for (const car of lane.cars) { car.prog += E.segH; car.seg = 0; }
            }
        }

        // 2. The new landscape band, with parked machines and a waiting
        //    gantry. this.tunnel switches here: charge now digs mountain k+1.
        const seg = this._buildSegment(r.top - E.segH, r.top, seed);

        // 3. Queues re-aim at the new mountain's faces.
        this._setLaneBlocks(seg.island);

        E.nextReady = true;
    }

    // True once the lead vehicle of an upstream (dir 1) lane is standing at
    // its barrier: close to the stop-line and essentially not moving.
    _upQueueHalted() {
        const r = this.road;
        for (const lane of this.roadLanes) {
            if (lane.dir !== 1 || lane.blockAt === undefined) continue;
            const front = lane.cars[0];
            if (front && front.speed < 0.8 &&
                lane.blockAt - (front.prog + front.len / 2) < r.minGap * 3) {
                return true;
            }
        }
        return false;
    }

    // Aim every lane's stop-line at the given mountain's faces, measured in
    // the lane's CURRENT arc length (origins move as the world extends and
    // rebases, so this must be recomputed whenever either side changes).
    _setLaneBlocks(isl) {
        const RC = CONFIG.ROAD;
        const s  = (v) => v * this.layoutConfig.platformScale;
        const gapTop = isl.cy - isl.r;
        const gapBot = isl.cy + isl.r;
        const rigLen = s(RC.TUNNEL.BLADE_LEN);
        const topRig = RC.TUNNEL.OPPOSED_DRILL ? rigLen : 0;
        for (const lane of this.roadLanes) {
            const originY = lane.path.pts[0].y;
            lane.blockAt = lane.dir === 1
                ? originY - (gapBot + rigLen)
                : (gapTop - topRig) - originY;
        }
    }

    // Called after each toll flush: if the next mountain is waiting, ride up.
    _maybePan() {
        const E = this.endless;
        if (!E || !E.nextReady || E.panning) return;
        E.panning  = true;
        E.nextReady = false;
        if (this.toll) this.toll.live = false;   // the old gantry retires
        this.tweens.add({
            targets:  this.camB,
            scrollY:  E.baseScrollY - E.segH,
            duration: CONFIG.ROAD.ENDLESS.PAN_MS || 2500,
            ease:     'Sine.easeInOut',
            onComplete: () => {
                // Small settle delay so transient tweens (debris, coins)
                // mostly drain before coordinates shift under them.
                this.time.delayedCall(400, () => this._rebaseWorld());
            },
        });
    }

    // The pan is over: teleport the world back into the home band so state
    // never drifts. Everything shifts down by segH — display objects, spine
    // points, tunnel/toll anchors — the old segment is destroyed, the camera
    // snaps back, and on screen NOTHING moves: world+camera shift cancel out.
    _rebaseWorld() {
        const E = this.endless, r = this.road;
        const segH = E.segH;

        // 1. Tear down every segment but the newest.
        const survivor = this.segments[this.segments.length - 1];
        for (const seg of this.segments) {
            if (seg === survivor) continue;
            for (const o of seg.objects) {
                this.tweens.killTweensOf(o);
                o.destroy();
            }
            // Per-segment baked textures (the mountain) go with it.
            for (const key of seg.texKeys || []) {
                if (this.textures.exists(key)) this.textures.remove(key);
            }
        }
        this.segments = [survivor];

        // 2. Shift the survivor's visuals and anchors down into the home band.
        for (const o of survivor.objects) {
            if (!o._noRebase) o.y += segH;
        }
        survivor.island.cy += segH;
        r.island = survivor.island;
        const tn = survivor.tunnel;
        if (tn) {
            tn.entryY += segH; tn.exitY += segH; tn.tollY += segH;
            // The reveal mask stays at y=0 (future draws use new coords); if
            // this tunnel somehow opened before the rebase, refill the whole
            // span in the new coordinate frame.
            if (tn.open) {
                tn.maskShape.clear().fillStyle(0xffffff)
                    .fillRect(0, tn.exitY - 2, this.scale.width, tn.len + 4);
            }
        }
        if (survivor.toll) {
            survivor.toll.iy    += segH;
            survivor.toll.tollY += segH;
            this.toll = survivor.toll;
        }

        // 3. Spines and lane paths come home; up-lane cars re-anchor to the
        //    new origin (bottom moved up one segment), stragglers below the
        //    world's bottom edge are recycled. A fresh toll cycle also means
        //    every car owes again at the next gantry.
        for (const sp of r.spines) for (const p of sp.pts) p.y += segH;
        for (const sp of r.spines) sp.pts[0].y = r.bottom;   // trim old tail
        for (const lane of this.roadLanes) {
            const pts = lane.path.pts.map((p) => ({ x: p.x, y: p.y + segH }));
            if (lane.dir === 1) pts[0].y = r.bottom;
            else                pts[pts.length - 1].y = r.bottom;
            lane.path = this._pathMeta(pts);
            if (lane.dir === 1) {
                for (const car of lane.cars) { car.prog -= segH; car.seg = 0; }
                while (lane.cars.length &&
                       lane.cars[lane.cars.length - 1].prog <
                       -lane.cars[lane.cars.length - 1].len) {
                    const gone = lane.cars.pop();
                    gone.setActive(false).setVisible(false);
                    this.roadCarPool.push(gone);
                }
            } else {
                for (const car of lane.cars) car.seg = 0;
            }
            for (const car of lane.cars) car.tolled = false;
        }

        // 3b. blockAt is an arc length from each lane's ORIGIN — the up
        // lanes' origin just moved a segment, so the stop-lines must be
        // re-measured against the (shifted) mountain, or upstream traffic
        // sails straight past the face onto the raw sand.
        const tnB = survivor.tunnel;
        if (tnB && !tnB.open) this._setLaneBlocks(survivor.island);

        // 4. Camera home and stationary — NOW the new site opens for work:
        // the parked machines accept charge from the next battery tick.
        this.camB.scrollY = E.baseScrollY;
        E.panning = false;
        if (E.deferBuild) {
            E.deferBuild = false;
            this._buildNextSegment();
        }
        if (this.tunnel) this.tunnel.ready = true;
    }

    // ── Analog meter face (static background drawn once per gadget load) ──────
    _drawMeterBg(gfx, px, py) {
        const P     = CONFIG.PLATFORM;
        const r     = P.METER_RADIUS;
        // meter angle m (0-180) → canvas arc angle in radians
        const arcOf = (m) => Math.PI + (m / 180) * Math.PI;
        const zr    = r - 4;
        const greenEnd = 100;

        // Single dark arc across full sweep
        gfx.lineStyle(6, 0x0d1f2d, 1.0);
        gfx.beginPath();
        gfx.arc(px, py, zr, arcOf(0), arcOf(180), false);
        gfx.strokePath();

        // Radial tick marks: short stripes stradding the arc, watch-style
        const drawTick = (m, color, w) => {
            const a   = arcOf(m);
            const cos = Math.cos(a);
            const sin = Math.sin(a);
            gfx.lineStyle(w, color, 1.0);
            gfx.beginPath();
            gfx.moveTo(px + (zr - 7) * cos, py + (zr - 7) * sin);
            gfx.lineTo(px + (zr + 5) * cos, py + (zr + 5) * sin);
            gfx.strokePath();
        };

        drawTick(greenEnd,             0xFFD600, 3);  // yellow warning mark
        drawTick(P.METER_RED_ZONE_ANGLE, 0xFF1744, 3);  // red danger mark
    }

    // ── Animate needle with analog overshoot/undershoot swing ────────────────
    _animateMeterNeedle(p, meterTargetAngle) {
        if (!p.meterNeedle) return;
        const P        = CONFIG.PLATFORM;
        const overshoot = P.METER_OSCILLATION_OVERSHOOT;
        const needle   = p.meterNeedle;
        this.tweens.killTweensOf(needle);

        // meterAngle (0-180) → Phaser setAngle degrees
        // needle origin is (0.5, 1) pointing UP at angle 0
        // so: 0 → -90 (left), 90 → 0 (up), 180 → +90 (right)
        const ph = (m) => m - 90;

        const tA     = ph(meterTargetAngle);
        const overA  = ph(Math.min(meterTargetAngle + overshoot,       180));
        const underA = ph(Math.max(meterTargetAngle - overshoot * 0.45,  0));

        this.tweens.add({
            targets: needle, angle: overA, duration: 175, ease: 'Quad.easeOut',
            onComplete: () => this.tweens.add({
                targets: needle, angle: underA, duration: 130, ease: 'Quad.easeOut',
                onComplete: () => this.tweens.add({
                    targets: needle, angle: tA, duration: 85, ease: 'Sine.easeOut',
                })
            })
        });

        // Needle colour tracks zone
        const inRed    = meterTargetAngle >= P.METER_RED_ZONE_ANGLE;
        const inYellow = !inRed && meterTargetAngle >= 100;
        needle.setFillStyle(inRed ? 0xFF3333 : inYellow ? 0xFFD600 : 0xF0F0F0);
    }

    // ── Color lerp helper ────────────────────────────────────────────────────
    _lerpColor(c1, c2, t) {
        const r1 = (c1 >> 16) & 0xFF, g1 = (c1 >> 8) & 0xFF, b1 = c1 & 0xFF;
        const r2 = (c2 >> 16) & 0xFF, g2 = (c2 >> 8) & 0xFF, b2 = c2 & 0xFF;
        return (Math.round(r1 + (r2 - r1) * t) << 16) |
               (Math.round(g1 + (g2 - g1) * t) << 8)  |
                Math.round(b1 + (b2 - b1) * t);
    }

    // ── Draw charge fill bar on the platform stripe ──────────────────────────
    _drawChargeFill(p, progress) {
        if (!p.chargeFill) return;
        const P         = CONFIG.PLATFORM;
        const yellowT   = 100 / P.METER_EXPLOSION_ANGLE;
        const redT      = P.METER_RED_ZONE_ANGLE / P.METER_EXPLOSION_ANGLE;
        let fillColor;
        if (progress < yellowT) {
            fillColor = 0x00C853;
        } else if (progress < redT) {
            fillColor = this._lerpColor(0xFFD600, 0xFF6B00, (progress - yellowT) / (redT - yellowT));
        } else {
            fillColor = this._lerpColor(0xFF6B00, 0xFF1744, Math.min((progress - redT) / (1 - redT), 1));
        }
        const fillW = p.stripeWidth * progress;
        p.chargeFill.clear();
        p.chargeFill.fillStyle(fillColor, 0.55);
        p.chargeFill.fillRoundedRect(p.stripeLeftEdge, p.centerY - p.stripeHeight / 2, fillW, p.stripeHeight, this.stripeRadius);
    }

    // ── Tension effects: shake / tint / pulse / camera shake ─────────────────
    _applyTensionEffects(p) {
        if (!p.gadgetSprite || p.isDefeated) return;
        const P            = CONFIG.PLATFORM;
        const progress     = p.gadgetCapacity > 0 ? p.gadgetCurrentCharge / p.gadgetCapacity : 0;
        const yellowThresh = 100 / P.METER_EXPLOSION_ANGLE;

        if (progress < yellowThresh) {
            // Normal range — clear any leftover tint, soft pulse on each charge tick
            p.gadgetSprite.setTint(0xffffff);
            if (P.GADGET_FLASH_ON_CHARGE_ENABLED) {
                this.tweens.add({ targets: p.gadgetSprite, alpha: 0.35, duration: 80, yoyo: true });
            }
            return;
        }

        // Smooth tension progression from yellowThresh to 100%
        const tensionProgress = (progress - yellowThresh) / (1 - yellowThresh);

         if(P.GADGET_TENSION_COLOR_CHANGE_ENABLED){
        // ── Tint: smooth interpolation from white → subtle yellow → light orange ───
        // Start: 0xFFFFFF (white), Mid: 0xFFDD99 (subtle warm), End: 0xFFBB77 (light orange)
        const startR = 0xFF, startG = 0xFF, startB = 0xFF;
        const endR   = 0xFF, endG   = 0xBB, endB   = 0x77;
        
        const r = Math.round(startR + (endR - startR) * tensionProgress);
        const g = Math.round(startG + (endG - startG) * tensionProgress);
        const b = Math.round(startB + (endB - startB) * tensionProgress);
        p.gadgetSprite.setTint((r << 16) | (g << 8) | b);
        }

        // ── Flash (subtle, increases with tension) ──────────────────────────────
        if (P.GADGET_FLASH_ON_CHARGE_ENABLED) {
            const flashAlpha = 0.4 - tensionProgress * 0.25; // 0.4 → 0.15
            const flashDur   = 80 - Math.round(tensionProgress * 35); // 80ms → 45ms
            this.tweens.add({ targets: p.gadgetSprite, alpha: flashAlpha, duration: flashDur, yoyo: true });
        }

        // ── Shake (increases gradually, maximum at end) ─────────────────────────
        // Skipped for the sewing machine — a machine shouldn't slide side-to-side;
        // its frame animation already conveys the rising tension.
        if (!p._shakeActive && p._gadgetName !== P.SEWING_GADGET_NAME) {
            p._shakeActive = true;
            // Shake intensity: 0.75 at start → 5 at end (reduced by half)
            const shakeAmt = 0.75 + tensionProgress * 4.25;
            // Shake speed: slower at start, faster at end
            const shakeDur = Math.round(75 - tensionProgress * 40); // 75ms → 35ms
            const numSteps = 4 + Math.round(tensionProgress * 4); // 4 → 8 steps
            const ox = p._gadgetOriginX;
            const oy = p._gadgetOriginY;

            const doShake = (n) => {
                if (!p.gadgetSprite || p.isDefeated) { p._shakeActive = false; return; }
                if (n <= 0) {
                    this.tweens.add({
                        targets: p.gadgetSprite, x: ox, y: oy,
                        duration: shakeDur, ease: 'Sine.easeOut',
                        onComplete: () => { p._shakeActive = false; },
                    });
                    return;
                }
                const dx = (Math.random() - 0.5) * shakeAmt * 2;
                const dy = (Math.random() - 0.5) * shakeAmt;
                this.tweens.add({
                    targets: p.gadgetSprite, x: ox + dx, y: oy + dy,
                    duration: shakeDur, ease: 'Sine.easeInOut',
                    onComplete: () => doShake(n - 1),
                });
            };
            doShake(numSteps);
        }

        // ── Scale bulge in red zone ───────────────────────────────────────────
        // Removed: scaling animation not needed since we now have burnedout sprite
        // if (inRed && !p._pulseActive) {
        //     p._pulseActive = true;
        //     const sz    = P.GADGET_SIZE;
        //     const bulge = sz * (1.05 + 0.04 * redIntensity);
        //     this.tweens.add({
        //         targets: p.gadgetSprite, displayWidth: bulge, displayHeight: bulge,
        //         duration: 110, ease: 'Quad.easeOut', yoyo: true,
        //         onComplete: () => {
        //             p._pulseActive = false;
        //             if (p.gadgetSprite && !p.isDefeated) p.gadgetSprite.setDisplaySize(sz, sz);
        //         },
        //     });
        // }

        // ── Camera shake removed - only happens at final explosion ──────────────

        // ── Smoke (ramps up with progress toward explosion) ─────────────────
        if (progress >= CONFIG.PLATFORM.SMOKE_START_PROGRESS) {
            this._updateSmokeIntensity(p, progress);
        }
    }

    // ── Smoke helpers ────────────────────────────────────────────────────────
    // ── Wire drawing ──────────────────────────────────────────────────────────
    _drawWire(gfx, x1, y1, x2, y2) {
        const P   = CONFIG.PLATFORM;
        const d   = Math.hypot(x2 - x1, y2 - y1);
        if (d < 1) return;

        // Rigid vertical drop from plug bottom before the sag begins
        const rigidLen = this.wireRigidLen;
        const rx = x1;               // rigid segment ends directly below plug
        const ry = y1 + rigidLen;

        // Sag curve from end-of-rigid to gadget connection point
        const excess   = Math.max(0, d * P.WIRE_SAG_PERCENT / 100 - d);
        const sagDepth = Math.sqrt(0.75 * d * excess);
        const cx = (rx + x2) / 2;
        const cy = (ry + y2) / 2 + sagDepth;
        const N  = 28;

        gfx.clear();
        gfx.lineStyle(this.wireThickness, P.WIRE_COLOR, 1);

        // Rigid segment
        gfx.beginPath();
        gfx.moveTo(x1, y1);
        gfx.lineTo(rx, ry);
        gfx.strokePath();

        // Sag curve
        gfx.beginPath();
        gfx.moveTo(rx, ry);
        for (let i = 1; i <= N; i++) {
            const t  = i / N;
            const mt = 1 - t;
            gfx.lineTo(
                mt * mt * rx + 2 * mt * t * cx + t * t * x2,
                mt * mt * ry + 2 * mt * t * cy + t * t * y2,
            );
        }
        gfx.strokePath();
    }

    _startSmoke(p) {
        if (p.smokeTimer) return;
        const P = CONFIG.PLATFORM;
        p._smokeDelay = P.SMOKE_FREQUENCY_START_MS;
        p.smokeTimer = this.time.addEvent({
            delay: P.SMOKE_FREQUENCY_START_MS,
            callback: () => this._spawnSmokePuff(p),
            loop: true,
        });
    }

    // Ramp smoke frequency up as charge approaches explosion
    _updateSmokeIntensity(p, progress) {
        const P = CONFIG.PLATFORM;
        if (!p.smokeTimer) {
            this._startSmoke(p);
            return;
        }
        const smokeT   = Math.max(0,
            (progress - P.SMOKE_START_PROGRESS) / (1 - P.SMOKE_START_PROGRESS));
        const newDelay = Math.round(
            P.SMOKE_FREQUENCY_START_MS +
            (P.SMOKE_FREQUENCY_MAX_MS - P.SMOKE_FREQUENCY_START_MS) * smokeT
        );
        if (Math.abs((p._smokeDelay ?? P.SMOKE_FREQUENCY_START_MS) - newDelay) > 20) {
            this._stopSmoke(p);
            p._smokeDelay = newDelay;
            p.smokeTimer  = this.time.addEvent({
                delay: newDelay, callback: () => this._spawnSmokePuff(p), loop: true,
            });
        }
    }

    // Max-rate burst for SMOKE_MAX_AFTER_EXPLOSION_MS, then settle to idle rate
    _setSmokeBurst(p) {
        const P = CONFIG.PLATFORM;
        this._stopSmoke(p);
        p._smokeDelay = P.SMOKE_FREQUENCY_MAX_MS;
        p.smokeTimer  = this.time.addEvent({
            delay: P.SMOKE_FREQUENCY_MAX_MS, callback: () => this._spawnSmokePuff(p), loop: true,
        });
        this.time.delayedCall(P.SMOKE_MAX_AFTER_EXPLOSION_MS, () => {
            if (!p.smokeTimer) return;  // clearGadgets already ran
            this._stopSmoke(p);
            p._smokeDelay = P.SMOKE_FREQUENCY_IDLE_MS;
            p.smokeTimer  = this.time.addEvent({
                delay: P.SMOKE_FREQUENCY_IDLE_MS, callback: () => this._spawnSmokePuff(p), loop: true,
            });
        });
    }

    _stopSmoke(p) {
        if (p.smokeTimer) {
            this.time.removeEvent(p.smokeTimer);
            p.smokeTimer = null;
        }
    }

    _spawnSmokePuff(p) {
        const P  = CONFIG.PLATFORM;
        const ox = p._gadgetOriginX;
        const oy = p._gadgetOriginY;  // center of gadget
        
        // Check if we're in post-explosion burst mode (stronger smoke)
        const isPostExplosion = p.isDefeated && p._smokeDelay === P.SMOKE_FREQUENCY_MAX_MS;
        
        const r  = isPostExplosion 
            ? 6 + Math.random() * 8  // Much larger: 6-14px after explosion
            : P.SMOKE_RADIUS_MIN + Math.random() * (P.SMOKE_RADIUS_MAX - P.SMOKE_RADIUS_MIN);
        
        const alpha = isPostExplosion ? 0.7 : 0.45;  // More opaque after explosion
        const sx = ox + (Math.random() - 0.5) * P.SMOKE_SPREAD_X;
        const puff = this.add.circle(sx, oy, r, P.SMOKE_COLOR, alpha).setDepth(25);
        
        // Track this smoke puff for cleanup
        if (p.smokePuffs) p.smokePuffs.push(puff);
        
        const lifespan = isPostExplosion ? 1800 : P.SMOKE_LIFESPAN_MS;  // Longer lasting after explosion
        
        this.tweens.add({
            targets: puff,
            y: oy - P.SMOKE_DRIFT_Y - Math.random() * 20,
            x: sx + (Math.random() - 0.5) * 16,
            alpha: 0,
            scaleX: isPostExplosion ? 2.8 : 2.2,
            scaleY: isPostExplosion ? 2.8 : 2.2,
            duration: lifespan,
            ease: 'Sine.easeOut',
            onComplete: () => {
                // Remove from tracking array
                if (p.smokePuffs) {
                    const idx = p.smokePuffs.indexOf(puff);
                    if (idx > -1) p.smokePuffs.splice(idx, 1);
                }
                puff.destroy();
            },
        });
    }

    /**
     * Calculate display dimensions to fit sprite to target rectangle while preserving aspect ratio.
     * Automatically constrains by width or height to maximize area within the target rect.
     * 
     * @param {Phaser.Textures.Texture} texture - The sprite texture
     * @param {number} targetWidth - The target width
     * @param {number} targetHeight - The target height (optional, defaults to targetWidth for square)
     * @returns {{width: number, height: number}} - Display width and height
     */
    _getAspectFitSize(texture, targetWidth, targetHeight) {
        const frame = texture.get();
        const srcWidth = frame.width;
        const srcHeight = frame.height;
        
        // If only one parameter provided, assume square target (backward compatibility)
        if (targetHeight === undefined) {
            targetHeight = targetWidth;
        }
        
        // Calculate scale factors for both dimensions
        const scaleX = targetWidth / srcWidth;
        const scaleY = targetHeight / srcHeight;
        
        // Use the smaller scale to fit within the rectangle while preserving aspect ratio
        const scale = Math.min(scaleX, scaleY);
        
        // Apply scale to both dimensions to preserve aspect ratio
        return {
            width: srcWidth * scale,
            height: srcHeight * scale
        };
    }

    // Immediately redraw the reveal rect for a given progress (0..1).
    // Build a stable, organic wavy edge profile (px offsets along the height),
    // so the cleaned/dirty boundary isn't a perfect vertical line. Generated
    // once per platform; the same shape just translates rightward as we clean.
    _makeToothEdgeProfile(dispW) {
        const N    = 14;
        const amp  = dispW * 0.06;
        const a1   = amp * (0.55 + Math.random() * 0.45);
        const a2   = amp * 0.4;
        const f1   = 1.5 + Math.random();
        const f2   = 3 + Math.random() * 2;
        const ph1  = Math.random() * Math.PI * 2;
        const ph2  = Math.random() * Math.PI * 2;
        const prof = [];
        for (let i = 0; i <= N; i++) {
            const t = i / N;
            let dx = Math.sin(t * Math.PI * 2 * f1 + ph1) * a1
                   + Math.sin(t * Math.PI * 2 * f2 + ph2) * a2
                   + (Math.random() - 0.5) * amp * 0.5; // fixed per-platform jitter
            prof.push(dx);
        }
        return prof;
    }

    _drawToothMask(p, progress) {
        if (!p._toothMaskGfx) return;
        const g  = p._toothMaskGfx;
        const pr = Math.max(0, Math.min(1, progress));
        const w  = pr * p._toothDispW;
        const left = p._toothLeft, top = p._toothTop, h = p._toothDispH;
        g.clear();
        if (w <= 0) return;

        // Once essentially complete, fill solid so no dirty slivers remain.
        const prof = p._toothEdgeProfile;
        if (pr >= 0.999 || !prof) {
            g.fillStyle(0xffffff).fillRect(left, top, p._toothDispW, h);
            return;
        }

        const N = prof.length - 1;
        g.fillStyle(0xffffff);
        g.beginPath();
        g.moveTo(left, top);
        for (let i = 0; i <= N; i++) {
            const y = top + (h * i) / N;
            let x = left + w + prof[i];
            x = Math.max(left, Math.min(left + p._toothDispW, x));
            g.lineTo(x, y);
        }
        g.lineTo(left, top + h);
        g.closePath();
        g.fillPath();
    }

    // Smoothly animate the left→right reveal toward a target progress (0..1).
    // A "scrubber" glow rides the cleaning front (left→right only, no bounce),
    // concentrated on the stretch being cleaned. Sparkles begin once fully clean.
    _updateToothMask(p, target) {
        if (!p._toothMaskGfx) return;
        target = Math.max(0, Math.min(1, target));
        if (p._toothTween) { p._toothTween.remove(); p._toothTween = null; }

        const startV = p._toothProgress ?? 0;
        const y0     = p._toothTop + p._toothDispH * 0.34;

        // Scrubber glow sitting on the cleaning front, riding it rightward.
        let sweep = null;
        if (target > startV) {
            const sweepSize = p._toothDispH * 0.55;
            sweep = this.textures.exists('glow')
                ? this.add.image(0, y0, 'glow').setDisplaySize(sweepSize, sweepSize)
                : this.add.circle(0, y0, sweepSize / 2, 0xffffff);
            sweep.setDepth(4.55).setBlendMode(Phaser.BlendModes.ADD)
                 .setTint(0xcce8ff).setAlpha(0);
            p._toothSweep = sweep;
            p._toothBrushFx.push(sweep);
            this._spawnToothFoam(p, startV, target, y0);
        }

        const state = { v: startV };
        p._toothTween = this.tweens.add({
            targets: state,
            v: target,
            duration: 850,
            ease: 'Sine.easeOut',
            onUpdate: () => {
                p._toothProgress = state.v;
                this._drawToothMask(p, state.v);
                if (sweep) {
                    sweep.x = p._toothLeft + state.v * p._toothDispW;
                    const k = (state.v - startV) / Math.max(1e-4, target - startV);
                    sweep.alpha = 0.8 * Math.sin(Math.min(1, k) * Math.PI); // fade in→out
                }
            },
            onComplete: () => {
                p._toothProgress = target;
                p._toothTween = null;
                if (sweep) {
                    const idx = p._toothBrushFx.indexOf(sweep);
                    if (idx >= 0) p._toothBrushFx.splice(idx, 1);
                    p._toothSweep = null;
                    sweep.destroy();
                }
                if (target >= 1) this._startToothSparkles(p);
            },
        });
    }

    // Foam bubbles rising along the freshly-cleaned stretch [fromV, toV].
    _spawnToothFoam(p, fromV, toV, y0) {
        const n = 3;
        for (let i = 0; i < n; i++) {
            const fv = fromV + (toV - fromV) * ((i + 0.5) / n);
            const bx = p._toothLeft + fv * p._toothDispW + (Math.random() - 0.5) * 14;
            const br = (2.5 + Math.random() * 3.5) * (this.platformScale || 1);
            const bubble = this.add.circle(bx, y0 + 4, br, 0xffffff, 0.85)
                .setDepth(4.55).setBlendMode(Phaser.BlendModes.ADD);
            p._toothBrushFx.push(bubble);
            this.tweens.add({
                targets: bubble,
                y: y0 - p._toothDispH * 0.16,
                alpha: 0,
                scale: { from: 0.5, to: 1.2 },
                duration: 650 + Math.random() * 300,
                ease: 'Sine.easeOut',
                delay: 260 * i + Math.random() * 120,
                onComplete: () => {
                    const idx = p._toothBrushFx.indexOf(bubble);
                    if (idx >= 0) p._toothBrushFx.splice(idx, 1);
                    bubble.destroy();
                },
            });
        }
    }

    // Generate a reusable white diamond (rotated-square gem) texture once.
    _ensureSparkleTexture() {
        if (this.textures.exists('tooth_sparkle')) return;
        const R = 32;                 // half-extent
        const g = this.make.graphics({ add: false });
        g.fillStyle(0xffffff, 1);
        g.beginPath();
        g.moveTo(R, 0);               // top
        g.lineTo(2 * R, R);           // right
        g.lineTo(R, 2 * R);           // bottom
        g.lineTo(0, R);               // left
        g.closePath();
        g.fillPath();
        // brighter inner core for a gem-like glint
        g.fillStyle(0xffffff, 1);
        g.fillCircle(R, R, R * 0.18);
        g.generateTexture('tooth_sparkle', R * 2, R * 2);
        g.destroy();
    }

    // 4–5 diamonds of varying size that persist on the clean teeth, twinkling
    // by scale + alpha. The central band keeps them on teeth, not gums.
    _startToothSparkles(p) {
        if (!p._toothAfter || p._toothSparkles?.length) return;
        this._ensureSparkleTexture();
        p._toothSparkles = [];

        const count = 5;
        const bandTop = p._toothTop + p._toothDispH * 0.28;
        const bandH   = p._toothDispH * 0.44;
        const padX    = p._toothDispW * 0.10;
        for (let i = 0; i < count; i++) {
            const sx   = p._toothLeft + padX + Math.random() * (p._toothDispW - padX * 2);
            const sy   = bandTop + Math.random() * bandH;
            const size = (9 + Math.random() * 12) * (this.platformScale || 1);
            const gem = this.add.image(sx, sy, 'tooth_sparkle')
                .setDisplaySize(size, size)   // sets scale = size / 64 (texture is 64px)
                .setDepth(4.6)
                .setBlendMode(Phaser.BlendModes.ADD)
                .setAlpha(0);
            const fullScale = gem.scale;      // full twinkle size
            gem.setScale(fullScale * 0.2);    // start tiny; scaling up is the twinkle
            p._toothSparkles.push(gem);

            this.tweens.add({
                targets: gem,
                alpha: { from: 0, to: 0.95 },
                scale: { from: fullScale * 0.2, to: fullScale },
                duration: 480 + Math.random() * 360,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1,
                repeatDelay: 250 + Math.random() * 800,
                delay: Math.random() * 700,
            });
        }
    }

    // Generate reusable white music-note glyph textures once (tinted at spawn).
    _ensureMusicNoteTextures() {
        if (this.textures.exists('music_note')) return;

        // Single eighth note
        let g = this.make.graphics({ add: false });
        g.fillStyle(0xffffff, 1);
        g.fillCircle(16, 50, 12);             // head
        g.fillRect(25, 12, 5, 40);            // stem
        g.fillTriangle(30, 12, 30, 32, 46, 22); // flag
        g.generateTexture('music_note', 52, 64);
        g.destroy();

        // Double (beamed) note
        g = this.make.graphics({ add: false });
        g.fillStyle(0xffffff, 1);
        g.fillCircle(14, 50, 11);             // head 1
        g.fillCircle(46, 44, 11);             // head 2
        g.fillRect(22, 16, 5, 36);            // stem 1
        g.fillRect(54, 10, 5, 36);            // stem 2
        g.fillTriangle(22, 10, 59, 4, 59, 13);   // beam (top)
        g.fillTriangle(22, 10, 22, 19, 59, 13);  // beam (bottom)
        g.generateTexture('music_note2', 64, 64);
        g.destroy();
    }

    // Begin continuous music-note emission for the bluetooth-speaker gadget.
    _startSpeakerNotes(p) {
        const P = CONFIG.PLATFORM;
        this._ensureMusicNoteTextures();
        p._speakerNotes = [];
        p._noteTimer = this.time.addEvent({
            delay: P.SPEAKER_NOTE_INTERVAL,
            loop: true,
            callback: () => this._emitSpeakerNotes(p),
        });
    }

    // One emission tick: spawn a charge-scaled number/size of drifting notes.
    _emitSpeakerNotes(p) {
        if (!p.gadgetSprite || p.isDefeated || p.reachedZeroCapacity) return;
        const P    = CONFIG.PLATFORM;
        const prog = Math.min(p.gadgetCurrentCharge / Math.max(1, p.gadgetCapacity), 1);

        // Average notes/tick grows from MIN_RATE → MAX_RATE with charge;
        // the fractional part becomes a probabilistic extra note.
        const rate = P.SPEAKER_NOTE_MIN_RATE + (P.SPEAKER_NOTE_MAX_RATE - P.SPEAKER_NOTE_MIN_RATE) * prog;
        let n = Math.floor(rate);
        if (Math.random() < rate - n) n++;
        for (let k = 0; k < n; k++) this._spawnSpeakerNote(p, prog);
    }

    _spawnSpeakerNote(p, prog) {
        const P     = CONFIG.PLATFORM;
        const scale = this.platformScale || 1;
        const w = p._gadgetDisplayWidth, h = p._gadgetDisplayHeight;

        // Emit from around the speaker centre, slight random offset.
        const x0 = p._gadgetOriginX + w * (Math.random() - 0.5) * 0.4;
        const y0 = p._gadgetOriginY + h * (Math.random() - 0.5) * 0.4;

        // Size: small at low charge, doubled at full (0.65× → 2.70×), with a
        // wide per-note radius variation for a more scattered, lively look.
        const size = P.SPEAKER_NOTE_BASE_SIZE * (0.65 + 2.05 * prog)
                   * (0.7 + Math.random() * 0.7) * scale;

        // Randomised peak opacity for more transparency variation.
        const peakAlpha = 0.45 + Math.random() * 0.55;   // 0.45 → 1.0

        const key   = Math.random() < 0.5 ? 'music_note' : 'music_note2';
        const tints = [0xfff2a8, 0xa8e0ff, 0xffc2e0, 0xc6ffd0, 0xd9c2ff];
        const note  = this.add.image(x0, y0, key)
            .setDisplaySize(size, size * 1.05)
            .setDepth(3.7)                       // below the gadget (depth 4)
            .setTint(tints[(Math.random() * tints.length) | 0])
            .setAlpha(0)
            .setAngle((Math.random() - 0.5) * 30);
        p._speakerNotes.push(note);

        // Drift outward in a random direction; distance grows a little with charge.
        const dir  = Math.random() * Math.PI * 2;
        const dist = (50 + Math.random() * 50 + prog * 45) * scale;
        const dur  = 1300 + Math.random() * 700;

        // Quick fade-in to a randomised peak, slow fade-out over the drift.
        this.tweens.add({ targets: note, alpha: peakAlpha, duration: dur * 0.2 });
        this.tweens.add({
            targets: note,
            x: x0 + Math.cos(dir) * dist,
            y: y0 + Math.sin(dir) * dist,
            angle: note.angle + (Math.random() - 0.5) * 50,
            duration: dur,
            ease: 'Sine.easeOut',
            onComplete: () => {
                const idx = p._speakerNotes.indexOf(note);
                if (idx >= 0) p._speakerNotes.splice(idx, 1);
                note.destroy();
            },
        });
        // Fade out over the second half of the drift.
        this.tweens.add({
            targets: note, alpha: 0, duration: dur * 0.5, delay: dur * 0.5,
        });
    }

    // Cross-fade the chicken between cooking stages to match charge progress 0..1.
    // Maps progress across the (n-1) gaps between frames and dissolves the base
    // frame into the next one by its fractional part, for smooth cooking.
    _updateChickenFrame(p, progress) {
        if (!p._chicken) return;
        const n = p._chickenFrames;
        const t = Math.max(0, Math.min(1, progress)) * (n - 1); // 0 .. n-1 continuous
        const base = Math.min(n - 1, Math.floor(t));
        const next = Math.min(n - 1, base + 1);
        const frac = t - base;                  // 0 → just-entered base, 1 → fully next

        if (base !== p._chickenFrame) {
            p._chickenFrame = base;
            p._chicken.setFrame(base);
        }
        if (next !== p._chickenNextFrame) {
            p._chickenNextFrame = next;
            p._chickenNext.setFrame(next);
        }
        p._chickenNext.setAlpha(frac);          // dissolve base → next
    }

    // Drive the sewing-machine loop speed from charge progress 0..1.
    // At ~0 it sits idle on the first frame; above that it loops, speeding
    // up from MIN_FPS → MAX_FPS as the gadget fills.
    _updateSewingSpeed(p, progress) {
        if (!p._sewing) return;
        const P    = CONFIG.PLATFORM;
        const prog = Math.max(0, Math.min(1, progress));

        if (prog <= 0.001) {
            if (p._sewingPlaying) { p._sewing.anims.stop(); p._sewingPlaying = false; }
            p._sewing.setFrame(0);
            return;
        }
        if (!p._sewingPlaying) {
            p._sewing.play('sewing_loop');
            p._sewingPlaying = true;
        }
        const fps = P.SEWING_MIN_FPS + (P.SEWING_MAX_FPS - P.SEWING_MIN_FPS) * prog;
        p._sewing.anims.timeScale = fps / P.SEWING_BASE_FPS;
    }

    // Drive the washing-machine drum-spin speed from charge progress 0..1.
    // At ~0 it sits on the idle frame (frame 0, clothes still); above that it
    // loops the spin frames, speeding up from MIN_FPS → MAX_FPS as it fills.
    _updateWashingSpeed(p, progress) {
        if (!p._washing) return;
        const P    = CONFIG.PLATFORM;
        const prog = Math.max(0, Math.min(1, progress));

        if (prog <= 0.001) {
            if (p._washingPlaying) { p._washing.anims.stop(); p._washingPlaying = false; }
            p._washing.setFrame(0);   // idle pose, no rotation yet
            return;
        }
        if (!p._washingPlaying) {
            p._washing.play('washing_loop');
            p._washingPlaying = true;
        }
        const fps = P.WASHING_MIN_FPS + (P.WASHING_MAX_FPS - P.WASHING_MIN_FPS) * prog;
        p._washing.anims.timeScale = fps / P.WASHING_BASE_FPS;
    }

    // Reveal the t-shirt up to `progress` with an organic wavy front (left→right).
    // Mirrors the tooth mask but for the cloth — the edge profile gives the wave.
    _drawTshirtMask(p, progress) {
        if (!p._tshirtMaskGfx) return;
        const g    = p._tshirtMaskGfx;
        const pr   = Math.max(0, Math.min(1, progress));
        const left = p._tshirtLeft, top = p._tshirtTop, h = p._tshirtDispH, W = p._tshirtDispW;
        g.clear();
        if (pr <= 0) return;

        const prof = p._tshirtEdgeProfile;
        if (pr >= 0.999 || !prof) {             // fully sewn — solid fill, no slivers
            g.fillStyle(0xffffff).fillRect(left, top, W, h);
            return;
        }
        const w = pr * W;
        const N = prof.length - 1;
        g.fillStyle(0xffffff);
        g.beginPath();
        g.moveTo(left, top);
        for (let i = 0; i <= N; i++) {
            const y = top + (h * i) / N;
            let x = left + w + prof[i];
            x = Math.max(left, Math.min(left + W, x));
            g.lineTo(x, y);
        }
        g.lineTo(left, top + h);
        g.closePath();
        g.fillPath();
    }

    // Running-stitch dashes laid down along a seam line up to the reveal front.
    _drawTshirtSeam(p, progress) {
        const g = p._tshirtSeamGfx;
        if (!g) return;
        g.clear();
        const pr = Math.max(0, Math.min(1, progress));
        if (pr <= 0) return;
        const scale  = this.platformScale || 1;
        const left   = p._tshirtLeft, W = p._tshirtDispW, H = p._tshirtDispH;
        const seamY  = p._tshirtTop + H * 0.62;
        const frontX = left + pr * W;
        const dash   = Math.max(3, 6 * scale);
        g.lineStyle(Math.max(1, 2 * scale), 0x37414d, 0.95);
        for (let x = left + dash; x < frontX; x += dash * 2) {
            g.beginPath();
            g.moveTo(x, seamY);
            g.lineTo(Math.min(x + dash, frontX), seamY);
            g.strokePath();
        }
    }

    _positionTshirtNeedle(p, progress) {
        const n = p._tshirtNeedle;
        if (!n) return;
        const pr = Math.max(0, Math.min(1, progress));
        if (pr <= 0 || pr >= 1) { n.setAlpha(0); return; }   // hide when idle or finished
        n.x = p._tshirtLeft + pr * p._tshirtDispW;
        n.y = p._tshirtTop + p._tshirtDispH * 0.62;
        n.setAlpha(0.85);
    }

    // Smoothly animate the cloth reveal toward `target` progress (0..1).
    _updateTshirt(p, target) {
        if (!p._tshirtMaskGfx) return;
        target = Math.max(0, Math.min(1, target));
        if (p._tshirtTween) { p._tshirtTween.remove(); p._tshirtTween = null; }

        const state = { v: p._tshirtProgress ?? 0 };
        const apply = (v) => {
            p._tshirtProgress = v;
            this._drawTshirtMask(p, v);
            this._drawTshirtSeam(p, v);
            this._positionTshirtNeedle(p, v);
        };
        p._tshirtTween = this.tweens.add({
            targets: state, v: target, duration: 700, ease: 'Sine.easeOut',
            onUpdate: () => apply(state.v),
            onComplete: () => { apply(target); p._tshirtTween = null; },
        });
    }

    loadGadgets(gadgetData) {
        this.clearGadgets();
        this.gadgetAnimationsComplete = false; // Reset flag for new level
        
        // Stop charging interval while gadgets are loading/animating
        if (this.chargingInterval) {
            this.chargingInterval.remove();
            this.chargingInterval = null;
        }
        
        // Restart the charging polling for the new level
        this.startCharging();
        
        const P = CONFIG.PLATFORM;
        const L = this.layoutConfig;
        const scale = this.platformScale;
        const B = L.partB;
        {
            const p = {};

            // Total capacity = sum of the level's three tiers, since one gadget is
            // now charged by up to three batteries at once (cumulative input).
            const caps     = gadgetData.capacity || [200, 250, 300];
            const capacity = caps.reduce((a, b) => a + (b || 0), 0);

            // Gadget display box: a bounded band inside partB. Its BOTTOM sits a
            // small gap above the junction plug; its TOP leaves the reserved upper
            // slice of partB free for the character. Because the box never extends
            // past these limits, the fitted gadget can't clip off-screen.
            const centerX       = this.stationCenterX;
            const outputWireLen = Math.round(P.GADGET_AREA_BOTTOM_GAP * scale);
            const boxBottom     = this.junctionY - outputWireLen;
            const boxTop        = B.y + B.height * P.GADGET_AREA_TOP_RESERVE;
            const areaScale     = P.GADGET_AREA_SCALE;   // linear scale; area scales by its square
            const boxW          = B.width * P.GADGET_AREA_WIDTH_FRAC * areaScale;
            const boxH          = Math.max(60 * scale, (boxBottom - boxTop) * areaScale);

            p.capTextGap  = P.CAPACITY_TEXT_GAP * scale;
            p.capFontSize = Math.max(12, Math.round(parseInt(P.CAPACITY_TEXT_SIZE) * scale)) + 'px';
            p.plugSize    = P.PLUG_SIZE * scale;
            p.debugRectWidth  = boxW;
            p.debugRectHeight = boxH;
            p.debugRectX      = centerX;
            p.debugRectY      = boxBottom - boxH / 2;

            // Tooth-cleaning area (toothbrush level) to the right of the gadget
            p.toothAreaWidth  = P.TOOTH_AREA_WIDTH * scale;
            p.toothAreaHeight = p.toothAreaWidth / P.TOOTH_AREA_ASPECT_RATIO;
            p.toothAreaX      = centerX + boxW / 2 + P.TOOTH_PADDING_FROM_GADGET * scale + p.toothAreaWidth / 2;
            p.toothAreaY      = p.debugRectY + P.TOOTH_Y_OFFSET * scale;

            // Debug rect - shows the maximum area for gadget display
            let debugRect = null;
            if (P.DEBUG_RECT_SHOW) {
                debugRect = this.add.rectangle(
                    p.debugRectX, p.debugRectY,
                    p.debugRectWidth, p.debugRectHeight,
                    P.DEBUG_RECT_COLOR, P.DEBUG_RECT_ALPHA
                );
                debugRect.setDepth(3.9);
            }

            // Calculate actual gadget display size within (scaled) debug rect bounds
            const normalKey = `gadget_${gadgetData.name}_normal`;
            const isSewing = gadgetData.name === P.SEWING_GADGET_NAME
                && this.textures.exists('sewing_machine');
            const isWashing = gadgetData.name === P.WASHING_GADGET_NAME
                && this.textures.exists('washing_machine_anim');
            let gadgetDisplayWidth, gadgetDisplayHeight;

            if (isSewing) {
                // Size by a single frame (176x192), not the whole sheet.
                const sc = Math.min(p.debugRectWidth / P.SEWING_FRAME_W,
                                    p.debugRectHeight / P.SEWING_FRAME_H);
                gadgetDisplayWidth  = P.SEWING_FRAME_W * sc;
                gadgetDisplayHeight = P.SEWING_FRAME_H * sc;
            } else if (isWashing) {
                // Size by a single frame (279x336), not the whole sheet.
                const sc = Math.min(p.debugRectWidth / P.WASHING_FRAME_W,
                                    p.debugRectHeight / P.WASHING_FRAME_H);
                gadgetDisplayWidth  = P.WASHING_FRAME_W * sc;
                gadgetDisplayHeight = P.WASHING_FRAME_H * sc;
            } else if (this.textures.exists(normalKey)) {
                const size = this._getAspectFitSize(
                    this.textures.get(normalKey),
                    p.debugRectWidth,
                    p.debugRectHeight
                );
                gadgetDisplayWidth = size.width;
                gadgetDisplayHeight = size.height;
            } else {
                gadgetDisplayWidth = p.debugRectWidth;
                gadgetDisplayHeight = p.debugRectHeight;
            }

            // Gadget position: horizontally centered in debug rect, vertically touching bottom
            const gadgetX = p.debugRectX;
            const gadgetY = p.debugRectY + p.debugRectHeight / 2 - gadgetDisplayHeight / 2;

            // Capacity text above gadget
            const capText = this.add.text(
                gadgetX,
                gadgetY - gadgetDisplayHeight / 2 - p.capTextGap,
                `${capacity}`,
                {
                    fontSize: p.capFontSize,
                    fontFamily: CONFIG.FONT_FAMILY,
                    color: '#000000',
                    fontStyle: 'bold',
                    stroke: '#FFFFFF',
                    strokeThickness: 3,
                }
            ).setOrigin(0.5, 1).setDepth(5);

            // Create gadget sprite — animated Sprite for the sewing machine,
            // otherwise the usual static image (or a grey rect fallback).
            const gadgetSprite = isSewing
                ? this.add.sprite(gadgetX, gadgetY, 'sewing_machine', 0)
                : isWashing
                    ? this.add.sprite(gadgetX, gadgetY, 'washing_machine_anim', 0)
                    : this.textures.exists(normalKey)
                        ? this.add.image(gadgetX, gadgetY, normalKey)
                        : this.add.rectangle(gadgetX, gadgetY, gadgetDisplayWidth, gadgetDisplayHeight, 0x888888);

            gadgetSprite.setDisplaySize(gadgetDisplayWidth, gadgetDisplayHeight);
            gadgetSprite.setDepth(4);

            p.gadgetSprite        = gadgetSprite;
            p.gadgetCapacity      = capacity;
            p.gadgetCurrentCharge = 0;
            p.gadgetCapacityText  = capText;
            p.gadgetChargeText    = null;
            p.gadgetNameText      = null;

            // Gadget name shown above the charge-remaining value.
            {
                const nameLabel = gadgetData.name
                    .split('_')
                    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(' ');
                p.gadgetNameText = this.add.text(
                    gadgetX,
                    capText.y - capText.height - p.capTextGap * 0.5,
                    nameLabel,
                    {
                        fontSize: p.capFontSize,
                        fontFamily: CONFIG.FONT_FAMILY,
                        color: '#000000',
                        fontStyle: 'bold',
                        stroke: '#FFFFFF',
                        strokeThickness: 3,
                    }
                ).setOrigin(0.5, 1).setDepth(5);
            }
            p.isDefeated          = false;
            p.reachedZeroCapacity = false;
            p._gadgetName         = gadgetData.name;
            p._gadgetOriginX      = gadgetX;
            p._gadgetOriginY      = gadgetY;
            p._gadgetDisplayWidth = gadgetDisplayWidth;
            p._gadgetDisplayHeight= gadgetDisplayHeight;

            // ── Tooth-cleaning display (toothbrush level only) ─────────────────
            if (gadgetData.name === P.TOOTH_GADGET_NAME
                && this.textures.exists('tooth_before')
                && this.textures.exists('tooth_after')) {
                const tSize = this._getAspectFitSize(
                    this.textures.get('tooth_after'),
                    p.toothAreaWidth, p.toothAreaHeight
                );
                const tDispW = tSize.width;
                const tDispH = tSize.height;
                const tx = p.toothAreaX;
                const ty = p.toothAreaY;

                const toothBefore = this.add.image(tx, ty, 'tooth_before')
                    .setDisplaySize(tDispW, tDispH).setDepth(4);
                const toothAfter  = this.add.image(tx, ty, 'tooth_after')
                    .setDisplaySize(tDispW, tDispH).setDepth(4);

                // Off-screen graphics drives the left→right reveal of the clean teeth
                const maskGfx = this.make.graphics({ add: false });
                toothAfter.setMask(maskGfx.createGeometryMask());

                p._toothBefore  = toothBefore;
                p._toothAfter   = toothAfter;
                p._toothMaskGfx = maskGfx;
                p._toothLeft    = tx - tDispW / 2;
                p._toothTop     = ty - tDispH / 2;
                p._toothDispW   = tDispW;
                p._toothDispH   = tDispH;
                p._toothProgress = 0;
                p._toothTween    = null;
                p._toothSweep    = null;
                p._toothSparkles = [];
                p._toothBrushFx  = [];
                p._toothEdgeProfile = this._makeToothEdgeProfile(tDispW);

                this._drawToothMask(p, 0);   // start fully stained, no tween
            }

            // ── Music notes (bluetooth speaker level only) ─────────────────────
            if (gadgetData.name === P.SPEAKER_GADGET_NAME) {
                this._startSpeakerNotes(p);
            }

            // ── Sewing machine (animated gadget) ───────────────────────────────
            // Idle on frame 0; charge ramps the loop speed (see _updateSewingSpeed).
            p._sewing = null;
            if (isSewing) {
                if (!this.anims.exists('sewing_loop')) {
                    this.anims.create({
                        key: 'sewing_loop',
                        frames: this.anims.generateFrameNumbers('sewing_machine',
                            { start: 0, end: P.SEWING_FRAME_COUNT - 1 }),
                        frameRate: P.SEWING_BASE_FPS,
                        repeat: -1,
                    });
                }
                gadgetSprite.setFrame(0);   // idle pose until charging starts
                p._sewing = gadgetSprite;
                p._sewingPlaying = false;
            }

            // ── Washing machine (animated gadget) ──────────────────────────────
            // Idle on frame 0; once charging starts the drum spins by looping
            // frames 1..5, speeding up with charge (see _updateWashingSpeed).
            p._washing = null;
            if (isWashing) {
                if (!this.anims.exists('washing_loop')) {
                    this.anims.create({
                        key: 'washing_loop',
                        frames: this.anims.generateFrameNumbers('washing_machine_anim',
                            { start: P.WASHING_LOOP_START, end: P.WASHING_LOOP_END }),
                        frameRate: P.WASHING_BASE_FPS,
                        repeat: -1,
                    });
                }
                gadgetSprite.setFrame(0);   // idle pose (clothes still) until charging starts
                p._washing = gadgetSprite;
                p._washingPlaying = false;
            }

            // ── T-shirt cloth (sewing machine) ─────────────────────────────────
            // Sits to the left of the machine and is revealed by an organic wavy
            // front as it charges, with a needle glint + running-stitch trail.
            p._tshirt = null;
            if (isSewing && this.textures.exists('tshirt')) {
                const scale  = this.platformScale || 1;
                const areaW  = P.TSHIRT_AREA_WIDTH * scale;
                const areaH  = areaW / P.TSHIRT_AREA_ASPECT_RATIO;
                const fit    = this._getAspectFitSize(this.textures.get('tshirt'), areaW, areaH);
                const tw = fit.width, th = fit.height;
                const pad = P.TSHIRT_PADDING_FROM_GADGET * scale;
                const cx  = gadgetX - gadgetDisplayWidth / 2 - pad - tw / 2;
                const cy  = gadgetY + P.TSHIRT_Y_OFFSET * scale;

                const shirt   = this.add.image(cx, cy, 'tshirt').setDisplaySize(tw, th).setDepth(4.0);
                const maskGfx = this.make.graphics({ add: false });
                shirt.setMask(maskGfx.createGeometryMask());

                // Running-stitch trail + needle glint that ride the reveal front.
                const seamGfx = this.add.graphics().setDepth(4.02);
                const needle  = (this.textures.exists('glow')
                        ? this.add.image(cx, cy, 'glow').setDisplaySize(th * 0.45, th * 0.45)
                        : this.add.circle(cx, cy, th * 0.22, 0xffffff))
                    .setDepth(4.03).setBlendMode(Phaser.BlendModes.ADD)
                    .setTint(0xfff0b0).setAlpha(0);

                p._tshirt          = shirt;
                p._tshirtMaskGfx   = maskGfx;
                p._tshirtSeamGfx   = seamGfx;
                p._tshirtNeedle    = needle;
                p._tshirtLeft      = cx - tw / 2;
                p._tshirtTop       = cy - th / 2;
                p._tshirtDispW     = tw;
                p._tshirtDispH     = th;
                p._tshirtProgress  = 0;
                p._tshirtTween     = null;
                p._tshirtEdgeProfile = this._makeToothEdgeProfile(tw); // reuse organic wave generator
                this._drawTshirtMask(p, 0);
            }

            // ── Chicken cooking (induction cooktop level only) ─────────────────
            // Centred over the cooktop; frame steps raw → cooked as it charges.
            p._chicken = null;
            if (gadgetData.name === P.COOKTOP_GADGET_NAME
                && this.textures.exists('chicken_cooking')) {
                const cw = gadgetDisplayWidth * P.CHICKEN_SIZE_SCALE;
                const ch = cw * (360 / 364);            // preserve frame aspect (364x360)
                const yOff = (this.platformScale || 1) * P.CHICKEN_Y_OFFSET;
                // Two stacked sprites: base shows the current frame, overlay shows
                // the next frame and is alpha-blended in to cross-fade between stages.
                const chicken = this.add.sprite(gadgetX, gadgetY + yOff, 'chicken_cooking', 0)
                    .setDisplaySize(cw, ch)
                    .setDepth(4.2);                     // above the cooktop sprite (depth 4)
                const chickenNext = this.add.sprite(gadgetX, gadgetY + yOff, 'chicken_cooking', 0)
                    .setDisplaySize(cw, ch)
                    .setDepth(4.21)
                    .setAlpha(0);
                p._chicken      = chicken;
                p._chickenNext  = chickenNext;
                p._chickenFrames = P.CHICKEN_FRAME_COUNT;
                p._chickenFrame  = -1;                  // force first update to apply
                p._chickenNextFrame = -1;
            }

            p._shakeActive        = false;
            p._pulseActive        = false;
            p.smokeTimer          = null;
            p.smokePuffs          = [];
            p.explosionEffects    = [];
            p._debugRect          = debugRect;

            // Per-gadget charge effect (glow / spin / ...), layered on top
            p._fx                 = {};
            p._chargeEffectParams = gadgetData.charge_effect_params || {};
            p._chargeEffect       = getChargeEffect(gadgetData.charge_effect);
            p._chargeEffect.init(this, p, p._chargeEffectParams);

            // ── Output wire: junction socket → gadget ──────────────────────────
            // The three slot wires already converge on the junction (built once in
            // createSlots); this single wire carries the combined power up to the
            // gadget's vertical CENTRE. It runs behind the gadget (depth < 4), so the
            // upper stretch is hidden under the gadget sprite and its overlays.
            const plugEndX = gadgetX;
            const plugEndY = gadgetY;                             // gadget vertical centre

            const wireGfx = this.add.graphics().setDepth(3.55);
            this._drawStationWire(wireGfx, this.junctionX, this.junctionY, plugEndX, plugEndY);

            p.socketSprite = null;   // no per-gadget socket; the junction socket is shared/static
            p.plugSprite   = null;   // gadget connects via the bare wire (no plughead icon)
            p.wireGraphics = wireGfx;
            p._wireStartX  = this.junctionX;
            p._wireStartY  = this.junctionY - p.plugSize / 2;
            p._wireEndX    = plugEndX;
            p._wireEndY    = plugEndY;

            // ── Analog meter ──────────────────────────────────────────────────
            if (P.SHOW_ANALOG_METER) {
                // Calculate meter pivot position based on actual gadget display size
                const mpx = gadgetX + gadgetDisplayWidth / 2 + P.METER_PADDING_FROM_GADGET + P.METER_RADIUS;
                const mpy = gadgetY + gadgetDisplayHeight / 2 + P.METER_Y_OFFSET;

                const meterBg = this.add.graphics().setDepth(4.2);
                // Draw at full size (unscaled), then scale the entire graphics object
                this._drawMeterBg(meterBg, 0, 0);  // Draw at origin
                meterBg.setPosition(mpx, mpy);      // Position the pivot point
                meterBg.setScale(P.METER_SCALE);    // Scale around the pivot

                // Needle: thin rect, origin at pivot (bottom-centre), initial angle -90 = far-left
                const meterNeedle = this.add.rectangle(
                    0, 0, 3, P.METER_RADIUS - 10, 0xF0F0F0)
                    .setOrigin(0.5, 1).setAngle(-90).setDepth(4.6);
                meterNeedle.setPosition(mpx, mpy);
                meterNeedle.setScale(P.METER_SCALE);

                // Pivot dot on top of everything
                const meterPivot = this.add.circle(0, 0, 5, 0x223344).setDepth(4.8);
                meterPivot.setPosition(mpx, mpy);
                meterPivot.setScale(P.METER_SCALE);

                p.meterBg     = meterBg;
                p.meterNeedle = meterNeedle;
                p.meterPivot  = meterPivot;
            } else {
                p.meterBg     = null;
                p.meterNeedle = null;
                p.meterPivot  = null;
            }

            p._debugRect = debugRect;
            p.coinAnimationComplete = true;
            this.gadget  = p;
        }

        // Animate the gadget appearing
        this.animateGadgetsAppearance();
    }

    animateGadgetsAppearance() {
        const P = CONFIG.PLATFORM;
        const ANIMATION_DURATION = 400;  // Duration of popup animation

        // Set flag when the animation completes (with optional delay).
        // The startCharging() polling mechanism creates the charging interval.
        this.time.delayedCall(ANIMATION_DURATION, () => {
            const chargingDelay = CONFIG.GADGET_LOAD.DELAY_BEFORE_CHARGING;
            this.time.delayedCall(chargingDelay, () => {
                this.gadgetAnimationsComplete = true;
            });
        });

        const p = this.gadget;
        if (!p) return;

        // Elements to reveal after the gadget pops in: output wire + plughead
        const delayedElements = [p.wireGraphics, p.plugSprite].filter(Boolean);

        const targetWidth  = p._gadgetDisplayWidth;
        const targetHeight = p._gadgetDisplayHeight;

        if (p.gadgetSprite) {
            p.gadgetSprite.setAlpha(0);
            p.gadgetSprite.displayWidth  = targetWidth  * 0.5;
            p.gadgetSprite.displayHeight = targetHeight * 0.5;
        }
        if (p.gadgetCapacityText) { p.gadgetCapacityText.setAlpha(0); p.gadgetCapacityText.setScale(0.5); }
        if (p.gadgetNameText)     { p.gadgetNameText.setAlpha(0);     p.gadgetNameText.setScale(0.5); }

        const meterOriginalScale = P.SHOW_ANALOG_METER ? P.METER_SCALE : 1;
        [p.meterBg, p.meterNeedle, p.meterPivot].filter(Boolean).forEach(el => {
            el.setAlpha(0); el.setScale(meterOriginalScale * 0.5);
        });

        delayedElements.forEach(el => el.setAlpha(0));

        if (p.gadgetSprite) {
            this.tweens.add({
                targets: p.gadgetSprite, alpha: 1,
                displayWidth: targetWidth, displayHeight: targetHeight,
                duration: ANIMATION_DURATION, ease: 'Back.easeOut'
            });
        }
        [p.gadgetCapacityText, p.gadgetNameText].filter(Boolean).forEach(el => {
            this.tweens.add({
                targets: el, alpha: 1, scaleX: 1, scaleY: 1,
                duration: ANIMATION_DURATION, ease: 'Back.easeOut'
            });
        });
        [p.meterBg, p.meterNeedle, p.meterPivot].filter(Boolean).forEach(el => {
            this.tweens.add({
                targets: el, alpha: 1, scaleX: meterOriginalScale, scaleY: meterOriginalScale,
                duration: ANIMATION_DURATION, ease: 'Back.easeOut'
            });
        });

        this.time.delayedCall(ANIMATION_DURATION, () => {
            delayedElements.forEach(el => {
                this.tweens.add({ targets: el, alpha: 1, duration: 200, ease: 'Linear' });
            });
        });
    }

    clearGadgets() {
        const p = this.gadget;
        if (p) {
            this._stopSmoke(p);
            this._stopEnergyEffects(p);
            
            // Clean up all smoke puffs and their tweens
            if (p.smokePuffs) {
                for (const puff of p.smokePuffs) {
                    if (puff && puff.scene) {
                        this.tweens.killTweensOf(puff);
                        puff.destroy();
                    }
                }
                p.smokePuffs = [];
            }
            
            // Clean up all explosion effects and their tweens
            if (p.explosionEffects) {
                for (const effect of p.explosionEffects) {
                    if (effect && effect.scene) {
                        this.tweens.killTweensOf(effect);
                        effect.destroy();
                    }
                }
                p.explosionEffects = [];
            }
            
            // Tear down per-gadget charge effect
            if (p._chargeEffect) p._chargeEffect.cleanup(this, p);
            p._chargeEffect = null;
            p._chargeEffectParams = null;
            p._fx = null;

            if (p.gadgetSprite) this.tweens.killTweensOf(p.gadgetSprite);
            if (p.meterNeedle) this.tweens.killTweensOf(p.meterNeedle);
            if (p._toothTween) { p._toothTween.remove(); p._toothTween = null; }
            for (const o of (p._toothSparkles || []).concat(p._toothBrushFx || [])) {
                if (o && o.scene) { this.tweens.killTweensOf(o); o.destroy(); }
            }
            p._toothSparkles = [];
            p._toothBrushFx  = [];
            p._toothSweep    = null;
            p._toothEdgeProfile = null;
            p._toothProgress = 0;
            if (p._toothAfter) p._toothAfter.clearMask();

            // Music notes (speaker gadget)
            if (p._noteTimer) { p._noteTimer.remove(false); p._noteTimer = null; }
            for (const o of (p._speakerNotes || [])) {
                if (o && o.scene) { this.tweens.killTweensOf(o); o.destroy(); }
            }
            p._speakerNotes = [];
            [p.gadgetSprite, p.gadgetCapacityText, p.gadgetChargeText, p.gadgetNameText,
             p.meterBg, p.meterNeedle, p.meterPivot,
             p.wireGraphics, p.socketSprite, p.plugSprite, p._debugRect,
             p._toothBefore, p._toothAfter, p._toothMaskGfx, p._chicken, p._chickenNext,
             p._tshirt, p._tshirtMaskGfx, p._tshirtSeamGfx, p._tshirtNeedle]
                .forEach(o => { if (o) o.destroy(); });
            p.gadgetSprite = p.gadgetCapacityText = p.gadgetChargeText = p.gadgetNameText =
            p.meterBg = p.meterNeedle = p.meterPivot = null;
            p.wireGraphics = p.socketSprite = p.plugSprite = p._debugRect = null;
            p._toothBefore = p._toothAfter = p._toothMaskGfx = null;
            p._chicken = p._chickenNext = null;
            p._sewing = null;          // same object as gadgetSprite (already destroyed); anim auto-stops
            p._sewingPlaying = false;
            p._washing = null;         // same object as gadgetSprite (already destroyed); anim auto-stops
            p._washingPlaying = false;
            if (p._tshirtTween) { p._tshirtTween.remove(); p._tshirtTween = null; }
            p._tshirt = p._tshirtMaskGfx = p._tshirtSeamGfx = p._tshirtNeedle = null;
            p._tshirtEdgeProfile = null;
            p._tshirtProgress = 0;
            p.gadgetCurrentCharge = 0;
            p.isDefeated = false;
            p._shakeActive = false;
            p._pulseActive = false;
            p.smokeTimer = null;
            p._smokeDelay = null;
            p.coinAnimationComplete = true;  // Reset coin animation state
            p.reachedZeroCapacity = false;  // Reset charging stop flag
        }
    }

    async addBatteryToSlot(slotIndex, level) {
        await this.assets.ensureBattery(level); // ADD THIS
        if (slotIndex < 0 || slotIndex >= 3) return;
        if (this.chargingSlots[slotIndex] !== null) return;
        const p   = this.platforms[slotIndex];
        const chargePerMinute  = getBatteryChargeValue(level);
        const batteryIconLevel = getBatteryIconLevel(level);
        const yOff  = this.batteryYOffset;
        const tOff  = this.levelTextYOffset;

        // Transparent draggable overlay that covers the whole slot cell —
        // gives a reliable pick-up region independent of sprite texture.
        const draggableBg = this.add.rectangle(
            p.slotX, p.slotY, p.slotSize, p.slotSize, 0xFFFFFF, 0)
            .setDepth(10)
            .setInteractive({ draggable: true, useHandCursor: true });

        const batterySprite = this.add.image(p.slotX, p.slotY + yOff, `battery${batteryIconLevel}`);
        batterySprite.setDisplaySize(this.batteryDisplaySize, this.batteryDisplaySize);
        batterySprite.setDepth(11);

        const levelText = this.add.text(p.slotX, p.slotY + yOff + tOff, `LVL ${level}`, {
            fontSize: this.levelTextSize, fontFamily: CONFIG.FONT_FAMILY,
            color: CONFIG.CELL.LEVEL_TEXT_COLOR, fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(12);

        p.slotBg.setVisible(false);
        p.slotBgFilled.setVisible(true);
        p.batterySprite    = batterySprite;
        p.batteryLevelText = levelText;

        // Show charge-rate label above the slot
        p.chargeRateText.setText(`${chargePerMinute}`).setVisible(true);
        p.chargeRateBolt.setVisible(true);

        const batteryData = {
            sprite: batterySprite, levelText,
            draggableBg, level,
            slotIndex,
            originalX: p.slotX,
            originalY: p.slotY + yOff,
            inGrid: false, inChargingSlot: true,
        };
        draggableBg.setData('batteryData', batteryData);
        this.chargingSlots[slotIndex] = { level, chargePerMinute, batteryData };
    }

    removeBatteryFromSlot(slotIndex) {
        if (slotIndex < 0 || slotIndex >= 3) return;
        if (!this.chargingSlots[slotIndex]) return;
        const slot = this.chargingSlots[slotIndex];
        const bd   = slot.batteryData;
        const p    = this.platforms[slotIndex];
        if (bd && bd.draggableBg) { bd.draggableBg.destroy(); bd.draggableBg = null; }
        if (p.batterySprite)    p.batterySprite.destroy();
        if (p.batteryLevelText) p.batteryLevelText.destroy();
        p.batterySprite = p.batteryLevelText = null;
        p.slotBg.setVisible(true);
        p.slotBgFilled.setVisible(false);
        p.chargeRateText.setVisible(false);
        p.chargeRateBolt.setVisible(false);
        this.chargingSlots[slotIndex] = null;
    }

    // ================================================================
    // CHARGING / GADGET SYSTEM
    // ================================================================
    startCharging() {
        // Wait for gadget animations to complete before starting charge cycle
        const checkAnimationsComplete = () => {
            if (this.gadgetAnimationsComplete) {
                // Only create interval if one doesn't already exist
                if (!this.chargingInterval) {
                    this.chargingInterval = this.time.addEvent({
                        delay: 1000, callback: this.chargeCycle, callbackScope: this, loop: true,
                    });
                }
            } else {
                // Check again in 100ms
                this.time.delayedCall(100, checkAnimationsComplete);
            }
        };
        checkAnimationsComplete();
    }

    // One charge tick in car mode: sum the charge from every slotted battery and
    // convert it to earned climbing distance (1 charge → DISTANCE_PER_CHARGE units,
    // 1 unit → PX_PER_UNIT px). update() drives the car until it has climbed that far.
    _carChargeCycle() {
        if (!this.car) return;
        let total = 0;
        for (let i = 0; i < 3; i++) {
            const slot = this.chargingSlots[i];
            if (slot) total += slot.chargePerMinute;
        }
        if (total <= 0) return;   // no batteries powering the car this tick

        const C = CONFIG.CAR;
        this.carEarnedDistPx += total * C.DISTANCE_PER_CHARGE * C.PX_PER_UNIT;

        // Pulse every battery that's feeding the car (reuse existing feedback).
        for (let i = 0; i < 3; i++) {
            if (this.chargingSlots[i]) this._pulseBatteryIcon(this.platforms[i]);
        }
    }

    chargeCycle() {
        // Road pivot: charge powers the tunnel boring machine.
        if (CONFIG.ROAD && CONFIG.ROAD.ENABLED) {
            this._tunnelChargeCycle();
            return;
        }

        // Car pivot: charge no longer fills a gadget — it buys climbing distance.
        if (CONFIG.CAR && CONFIG.CAR.ENABLED) {
            this._carChargeCycle();
            return;
        }

        // Don't charge if gadget animations are not complete yet
        if (!this.gadgetAnimationsComplete) return;

        const p = this.gadget;
        if (!p || p.isDefeated || !p.gadgetSprite || p.reachedZeroCapacity) return;

        // Cumulative input: sum the charge/sec of every battery currently slotted.
        let total = 0;
        for (let i = 0; i < 3; i++) {
            const slot = this.chargingSlots[i];
            if (slot) total += slot.chargePerMinute;
        }
        if (total <= 0) return;   // no batteries powering the gadget this tick

        p.gadgetCurrentCharge = Math.min(p.gadgetCurrentCharge + total, p.gadgetCapacity);
        this.updateGadgetChargeBar(p);
        this._applyTensionEffects(p);

        // Per-gadget charge effect (e.g. bulb glow), driven by progress 0..1
        const fxProgress = Math.min(p.gadgetCurrentCharge / p.gadgetCapacity, 1);
        p._chargeEffect.onProgress(this, p, fxProgress, p._chargeEffectParams);
        this._updateToothMask(p, fxProgress);
        this._updateChickenFrame(p, fxProgress);
        this._updateSewingSpeed(p, fxProgress);
        this._updateWashingSpeed(p, fxProgress);
        this._updateTshirt(p, fxProgress);

        // Pulse every battery that's feeding the gadget
        for (let i = 0; i < 3; i++) {
            if (this.chargingSlots[i]) this._pulseBatteryIcon(this.platforms[i]);
        }

        // Shared wire / gadget visual feedback
        this._animateEnergyFlow(p);
        this._animateEnergyBeam(p);
        this._animateGadgetGlow(p);

        // Check if we've reached or exceeded capacity
        if (p.gadgetCurrentCharge >= p.gadgetCapacity) {
            p.reachedZeroCapacity = true;   // stop all future charging
            p._chargeEffect.onOvercharge(this, p, p._chargeEffectParams);

            // Wait for all charging animations to complete before explosion
            this._waitForChargingAnimations(p, () => {
                this.explodeGadget(p);
            });
        }
    }

    updateGadgetChargeBar(p) {
        const P = CONFIG.PLATFORM;
        const progress = Math.min(p.gadgetCurrentCharge / p.gadgetCapacity, 1);
        if (p.gadgetCapacityText) {
            const remaining = Math.max(0, Math.ceil(p.gadgetCapacity - p.gadgetCurrentCharge));
            // Hide text when at 0 instead of showing empty or '0'
            if (remaining === 0) {
                p.gadgetCapacityText.setVisible(false);
            } else {
                p.gadgetCapacityText.setText(`${remaining}`);
                p.gadgetCapacityText.setVisible(true);
                p.gadgetCapacityText.setAlpha(0.35 + 0.65 * (1 - progress));
            }
        }
        this._animateMeterNeedle(p, progress * CONFIG.PLATFORM.METER_EXPLOSION_ANGLE);
    }

    _waitForChargingAnimations(p, callback) {
        // Wait for all active charging animations to complete before triggering explosion
        const P = CONFIG.PLATFORM;
        
        // Calculate total time for charging animations
        const energyParticleTime = P.CHARGE_PARTICLE_SPEED + P.CHARGE_FLASH_DURATION;
        const glowTime = P.USE_GADGET_AURA ? 1500 : (P.GADGET_ENERGY_GLOW_ENABLED ? P.GADGET_ENERGY_GLOW_DURATION : 0);
        const maxAnimationTime = Math.max(energyParticleTime, glowTime);
        
        // Wait for animations to complete
        this.time.delayedCall(maxAnimationTime, callback);
    }

    _stopEnergyEffects(p) {
        // Stop all active aura animations and effects
        if (p.activeAuraEvents) {
            p.activeAuraEvents.forEach(({ event, layers }) => {
                if (event) event.remove();
                layers.forEach(layer => { if (layer && layer.scene) layer.destroy(); });
            });
            p.activeAuraEvents = [];
        }
        
        // Stop all active sparks
        if (p.activeSparks) {
            p.activeSparks.forEach(spark => {
                if (spark && spark.scene) {
                    this.tweens.killTweensOf(spark);
                    spark.destroy();
                }
            });
            p.activeSparks = [];
        }
    }

    _pulseBatteryIcon(p) {
        // Subtle pulse effect on the battery sprite when it charges the gadget
        if (!p.batterySprite) return;
        
        const P = CONFIG.PLATFORM;
        this.tweens.add({
            targets: p.batterySprite,
            scale: P.BATTERY_PULSE_SCALE,
            duration: P.BATTERY_PULSE_DURATION,
            yoyo: true,
            ease: 'Sine.easeInOut'
        });
    }

    // ================================================================
    // ADVANCED VFX: ARCING WIRE EFFECT (Lightning-style)
    // ================================================================
    _animateEnergyBeam(p) {
        if (!p._wireStartX || !p._wireEndX) return;
        const P = CONFIG.PLATFORM;
        
        if (P.USE_ARCING_WIRE) {
            this._createArcingWire(p);
        } else if (P.ENERGY_BEAM_ENABLED) {
            this._createSimpleBeam(p);
        }
    }
    
    _createArcingWire(p) {
        const P = CONFIG.PLATFORM;
        const x1 = p._wireStartX;
        const y1 = p._wireStartY;
        const x2 = p._wireEndX;
        const y2 = p._wireEndY;
        
        // Build wire path array
        const wirePath = this._buildWirePath(x1, y1, x2, y2, P.ARCING_WIRE_SEGMENTS);
        
        // Create graphics object
        const arcGfx = this.add.graphics().setDepth(3.6);
        
        // Animation state - arc vibrates in place, doesn't travel
        const duration = P.ARCING_WIRE_PULSE_DURATION / 1000;
        const state = {
            time: 0,
            duration: duration
        };
        
        // Store cleanup reference
        const updateEvent = this.time.addEvent({
            delay: 16, // ~60fps
            callback: () => {
                state.time += 0.016;
                
                // Regenerate jagged path every frame for flickering effect
                // Always show full wire (progress = 1.0) with vibrating spikes
                const jaggedPath = this._applyAdvancedDisplacement(wirePath, P);
                
                // Clear and redraw full arc
                arcGfx.clear();
                this._drawLayeredArc(arcGfx, jaggedPath, 1.0); // Always full wire visible
                
                // Cleanup when duration complete
                if (state.time >= state.duration) {
                    updateEvent.remove();
                    this.tweens.add({
                        targets: arcGfx,
                        alpha: 0,
                        duration: 150,
                        onComplete: () => arcGfx.destroy()
                    });
                }
            },
            loop: true
        });
        
        // Auto-cleanup after duration
        this.time.delayedCall(P.ARCING_WIRE_PULSE_DURATION + 200, () => {
            if (updateEvent) updateEvent.remove();
            if (arcGfx.scene) arcGfx.destroy();
        });
    }
    
    _buildWirePath(x1, y1, x2, y2, segments) {
        const P = CONFIG.PLATFORM;
        const d = Math.hypot(x2 - x1, y2 - y1);
        if (d < 1) return [[x1, y1], [x2, y2]];
        
        // Rigid vertical segment
        const rigidLen = this.wireRigidLen;
        const rx = x1;
        const ry = y1 + rigidLen;
        
        // Quadratic bezier control point for sag
        const excess = Math.max(0, d * P.WIRE_SAG_PERCENT / 100 - d);
        const sagDepth = Math.sqrt(0.75 * d * excess);
        const cx = (rx + x2) / 2;
        const cy = (ry + y2) / 2 + sagDepth;
        
        // Build path array
        const path = [[x1, y1], [rx, ry]];
        
        // Sample curved section
        for (let i = 1; i <= segments; i++) {
            const t = i / segments;
            const mt = 1 - t;
            const bx = mt * mt * rx + 2 * mt * t * cx + t * t * x2;
            const by = mt * mt * ry + 2 * mt * t * cy + t * t * y2;
            path.push([bx, by]);
        }
        
        return path;
    }
    
    _applyAdvancedDisplacement(path, P) {
        // Apply aggressive displacement for spiky lightning effect
        let jaggedPath = [...path];
        
        // Multiple passes for more jaggedness
        for (let pass = 0; pass < P.ARCING_WIRE_JITTER_PASSES; pass++) {
            const newPath = [jaggedPath[0]];
            
            for (let i = 0; i < jaggedPath.length - 1; i++) {
                const [x1, y1] = jaggedPath[i];
                const [x2, y2] = jaggedPath[i + 1];
                
                // Midpoint with aggressive random displacement
                const mx = (x1 + x2) / 2;
                const my = (y1 + y2) / 2;
                const dist = Math.hypot(x2 - x1, y2 - y1);
                const displacement = (Math.random() - 0.5) * dist * P.ARCING_WIRE_ROUGHNESS * P.ARCING_WIRE_DISPLACEMENT_SCALE;
                
                // Perpendicular offset for spike
                const dx = x2 - x1;
                const dy = y2 - y1;
                const length = Math.sqrt(dx * dx + dy * dy);
                if (length > 0) {
                    const offsetX = -dy / length * displacement;
                    const offsetY = dx / length * displacement;
                    
                    // Add random jitter to make it less smooth
                    const jitterX = (Math.random() - 0.5) * P.ARCING_WIRE_RANDOM_OFFSET;
                    const jitterY = (Math.random() - 0.5) * P.ARCING_WIRE_RANDOM_OFFSET;
                    
                    newPath.push([mx + offsetX + jitterX, my + offsetY + jitterY]);
                }
                newPath.push([x2, y2]);
            }
            
            jaggedPath = newPath;
        }
        
        return jaggedPath;
    }
    
    _drawLayeredArc(gfx, path, progress) {
        const P = CONFIG.PLATFORM;
        
        // Calculate visible segment based on progress
        const visiblePoints = Math.floor(progress * path.length);
        if (visiblePoints < 2) return;
        
        const visiblePath = path.slice(0, visiblePoints);
        
        // Layer 1: Thick semi-transparent glow (Cyan/Blue)
        gfx.lineStyle(P.ARCING_WIRE_GLOW_THICKNESS, P.ARCING_WIRE_GLOW_COLOR, 0.3);
        gfx.beginPath();
        gfx.moveTo(visiblePath[0][0], visiblePath[0][1]);
        for (let i = 1; i < visiblePath.length; i++) {
            gfx.lineTo(visiblePath[i][0], visiblePath[i][1]);
        }
        gfx.strokePath();
        
        // Layer 2: Medium bright blue stroke
        gfx.lineStyle(P.ARCING_WIRE_MEDIUM_THICKNESS, P.ARCING_WIRE_BRIGHT_COLOR, 0.8);
        gfx.beginPath();
        gfx.moveTo(visiblePath[0][0], visiblePath[0][1]);
        for (let i = 1; i < visiblePath.length; i++) {
            gfx.lineTo(visiblePath[i][0], visiblePath[i][1]);
        }
        gfx.strokePath();
        
        // Layer 3: Thin white core
        gfx.lineStyle(P.ARCING_WIRE_CORE_THICKNESS, P.ARCING_WIRE_CORE_COLOR, 1.0);
        gfx.beginPath();
        gfx.moveTo(visiblePath[0][0], visiblePath[0][1]);
        for (let i = 1; i < visiblePath.length; i++) {
            gfx.lineTo(visiblePath[i][0], visiblePath[i][1]);
        }
        gfx.strokePath();
    }
    
    _createSimpleBeam(p) {
        // Fallback simple beam (original implementation)
        const P = CONFIG.PLATFORM;
        const x1 = p._wireStartX;
        const y1 = p._wireStartY;
        const x2 = p._wireEndX;
        const y2 = p._wireEndY;
        
        const d = Math.hypot(x2 - x1, y2 - y1);
        if (d < 1) return;
        
        const rigidLen = this.wireRigidLen;
        const rx = x1;
        const ry = y1 + rigidLen;
        
        const excess = Math.max(0, d * P.WIRE_SAG_PERCENT / 100 - d);
        const sagDepth = Math.sqrt(0.75 * d * excess);
        const cx = (rx + x2) / 2;
        const cy = (ry + y2) / 2 + sagDepth;
        
        const beam = this.add.graphics().setDepth(3.5).setAlpha(0);
        beam.lineStyle(P.ENERGY_BEAM_THICKNESS, P.ENERGY_BEAM_COLOR, P.ENERGY_BEAM_ALPHA);
        
        beam.beginPath();
        beam.moveTo(x1, y1);
        beam.lineTo(rx, ry);
        
        const segments = 20;
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const mt = 1 - t;
            const bx = mt * mt * rx + 2 * mt * t * cx + t * t * x2;
            const by = mt * mt * ry + 2 * mt * t * cy + t * t * y2;
            beam.lineTo(bx, by);
        }
        beam.strokePath();
        
        this.tweens.add({
            targets: beam,
            alpha: P.ENERGY_BEAM_ALPHA,
            duration: P.ENERGY_BEAM_DURATION / 2,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: beam,
                    alpha: 0,
                    duration: P.ENERGY_BEAM_DURATION / 2,
                    ease: 'Cubic.easeIn',
                    onComplete: () => beam.destroy()
                });
            }
        });
    }
    
    // ================================================================
    // ADVANCED VFX: GADGET AURA EFFECT
    // ================================================================
    _animateGadgetGlow(p) {
        if (!p.gadgetSprite) return;
        const P = CONFIG.PLATFORM;
        
        if (P.USE_GADGET_AURA) {
            this._createGadgetAura(p);
        } else if (P.GADGET_ENERGY_GLOW_ENABLED) {
            this._createSimpleGlow(p);
        }
    }
    
    _createGadgetAura(p) {
        const P = CONFIG.PLATFORM;
        const gx = p._gadgetOriginX;
        const gy = p._gadgetOriginY;
        
        // Create container for aura layers
        const auraLayers = [];
        const maxDim = Math.max(p._gadgetDisplayWidth, p._gadgetDisplayHeight);
        const baseSize = maxDim / 2 + P.GADGET_AURA_BASE_SIZE;
        
        // Create concentric glow layers
        for (let i = 0; i < P.GADGET_AURA_LAYERS; i++) {
            const layerSize = baseSize + (i * 15);
            const layer = this.add.circle(gx, gy, layerSize, P.GADGET_AURA_COLOR, 0).setDepth(4.0 + i * 0.1);
            auraLayers.push(layer);
        }
        
        // Animation state
        const state = {
            time: 0,
            duration: 1.5 // Total effect duration
        };
        
        // Breathing animation with sine wave
        const updateEvent = this.time.addEvent({
            delay: 16,
            callback: () => {
                if (p.isDefeated) {
                    // Stop animation if gadget is defeated
                    updateEvent.remove();
                    auraLayers.forEach(layer => { if (layer.scene) layer.destroy(); });
                    return;
                }
                
                state.time += 0.016;
                const progress = state.time / state.duration;
                const pulsePhase = state.time * P.GADGET_AURA_PULSE_SPEED * Math.PI * 2;
                const pulseValue = (Math.sin(pulsePhase) + 1) / 2; // 0 to 1
                
                // Update each layer
                auraLayers.forEach((layer, i) => {
                    if (!layer.scene) return;
                    const phaseOffset = i * 0.3;
                    const layerPulse = (Math.sin(pulsePhase + phaseOffset) + 1) / 2;
                    const baseAlpha = 0.4 - (i * 0.1);
                    layer.setAlpha(baseAlpha * layerPulse * (1 - progress));
                    
                    const baseSize = maxDim / 2 + P.GADGET_AURA_BASE_SIZE + (i * 15);
                    layer.setRadius(baseSize * (1 + layerPulse * 0.2));
                });
                
                // Cleanup when complete
                if (progress >= 1) {
                    updateEvent.remove();
                    auraLayers.forEach(layer => { if (layer.scene) layer.destroy(); });
                }
            },
            loop: true
        });
        
        // Store reference for cleanup
        if (!p.activeAuraEvents) p.activeAuraEvents = [];
        p.activeAuraEvents.push({ event: updateEvent, layers: auraLayers });
        
        // Spawn electric sparks (reuse maxDim from function scope)
        this._spawnElectricSparks(p, gx, gy, maxDim / 2);
        
        // Auto-cleanup
        this.time.delayedCall(state.duration * 1000, () => {
            if (updateEvent) updateEvent.remove();
            auraLayers.forEach(layer => { if (layer.scene) layer.destroy(); });
            // Remove from active events
            if (p.activeAuraEvents) {
                const idx = p.activeAuraEvents.findIndex(e => e.event === updateEvent);
                if (idx > -1) p.activeAuraEvents.splice(idx, 1);
            }
        });
    }
    
    _spawnElectricSparks(p, cx, cy, radius) {
        const P = CONFIG.PLATFORM;
        const sparkCount = P.GADGET_AURA_SPARK_COUNT;
        
        if (!p.activeSparks) p.activeSparks = [];
        
        for (let i = 0; i < sparkCount; i++) {
            const angle = (i / sparkCount) * Math.PI * 2 + Math.random() * 0.5;
            const startRadius = radius + 40;
            const sx = cx + Math.cos(angle) * startRadius;
            const sy = cy + Math.sin(angle) * startRadius;
            
            // Create spark
            const spark = this.add.circle(sx, sy, 2, 0xFFFFFF, 0.9).setDepth(4.5);
            p.activeSparks.push(spark);
            
            // Animate toward center
            const durationRange = P.GADGET_AURA_SPARK_DURATION_MAX - P.GADGET_AURA_SPARK_DURATION_MIN;
            const duration = P.GADGET_AURA_SPARK_DURATION_MIN + Math.random() * durationRange;
            this.tweens.add({
                targets: spark,
                x: cx + Math.cos(angle) * (radius * 0.5),
                y: cy + Math.sin(angle) * (radius * 0.5),
                radius: 0.5,
                alpha: 0,
                duration: duration,
                ease: 'Cubic.easeIn',
                onComplete: () => {
                    spark.destroy();
                    // Remove from active sparks
                    if (p.activeSparks) {
                        const idx = p.activeSparks.indexOf(spark);
                        if (idx > -1) p.activeSparks.splice(idx, 1);
                    }
                }
            });
        }
    }
    
    _createSimpleGlow(p) {
        // Add glowing halo around gadget during charge pulse
        if (!p.gadgetSprite) return;
        const P = CONFIG.PLATFORM;
        if (!P.GADGET_ENERGY_GLOW_ENABLED) return;
        
        const gx = p._gadgetOriginX;
        const gy = p._gadgetOriginY;
        
        // Create glow circle around gadget
        const maxDim = Math.max(p._gadgetDisplayWidth, p._gadgetDisplayHeight);
        const glowSize = maxDim / 2 + P.GADGET_ENERGY_GLOW_SIZE;
        const glow = this.add.circle(gx, gy, glowSize, P.GADGET_ENERGY_GLOW_COLOR, 0).setDepth(4.1);
        
        // Fade in and out with slight scale pulse
        this.tweens.add({
            targets: glow,
            alpha: P.GADGET_ENERGY_GLOW_ALPHA,
            radius: glowSize * 1.1,
            duration: P.GADGET_ENERGY_GLOW_DURATION / 2,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: glow,
                    alpha: 0,
                    radius: glowSize * 1.3,
                    duration: P.GADGET_ENERGY_GLOW_DURATION / 2,
                    ease: 'Cubic.easeIn',
                    onComplete: () => glow.destroy()
                });
            }
        });
    }

    _animateEnergyFlow(p) {
        // Animate a glowing particle from the socket/plug through the wire to the gadget
        if (!p._wireStartX || !p._wireEndX) return;
        
        const P = CONFIG.PLATFORM;
        const x1 = p._wireStartX;
        const y1 = p._wireStartY;
        const x2 = p._wireEndX;
        const y2 = p._wireEndY;
        
        // Calculate wire path (same as _drawWire)
        const d = Math.hypot(x2 - x1, y2 - y1);
        if (d < 1) return;
        
        // Rigid vertical segment
        const rigidLen = this.wireRigidLen;
        const rx = x1;
        const ry = y1 + rigidLen;
        
        // Quadratic bezier control point for sag
        const excess = Math.max(0, d * P.WIRE_SAG_PERCENT / 100 - d);
        const sagDepth = Math.sqrt(0.75 * d * excess);
        const cx = (rx + x2) / 2;
        const cy = (ry + y2) / 2 + sagDepth;
        
        // Calculate total path length (approximate)
        const rigidDist = rigidLen;
        const curveDist = d * P.WIRE_SAG_PERCENT / 100;
        const totalDist = rigidDist + curveDist;
        const rigidFraction = rigidDist / totalDist;
        
        // Create glowing energy particle
        const particle = this.add.circle(x1, y1, P.CHARGE_PARTICLE_SIZE, 0xFFFF00, 0.9).setDepth(3.8);
        
        // Animate along the wire path using progress from 0 to 1
        this.tweens.add({
            targets: { progress: 0 },
            progress: 1,
            duration: P.CHARGE_PARTICLE_SPEED,
            ease: 'Linear',
            onUpdate: (tween) => {
                const progress = tween.getValue();
                
                if (progress <= rigidFraction) {
                    // Moving down rigid segment
                    const t = progress / rigidFraction;
                    particle.x = x1;
                    particle.y = y1 + t * rigidLen;
                } else {
                    // Moving along curved segment
                    const t = (progress - rigidFraction) / (1 - rigidFraction);
                    const mt = 1 - t;
                    particle.x = mt * mt * rx + 2 * mt * t * cx + t * t * x2;
                    particle.y = mt * mt * ry + 2 * mt * t * cy + t * t * y2;
                }
            },
            onComplete: () => {
                // Flash effect at gadget when energy arrives - bolt icon
                const flash = this.add.image(x2, y2, 'bolt')
                    .setDisplaySize(P.CHARGE_FLASH_INITIAL_SIZE, P.CHARGE_FLASH_INITIAL_SIZE)
                    .setAlpha(0.9)
                    .setDepth(5);
                    
                this.tweens.add({
                    targets: flash,
                    displayWidth: P.CHARGE_FLASH_FINAL_SIZE,
                    displayHeight: P.CHARGE_FLASH_FINAL_SIZE,
                    alpha: 0,
                    duration: P.CHARGE_FLASH_DURATION,
                    ease: 'Cubic.easeOut',
                    onComplete: () => flash.destroy()
                });
                particle.destroy();
            }
        });
    }

    explodeGadget(p) {
        if (p.isDefeated) return;
        const P  = CONFIG.PLATFORM;
        const ex = p._gadgetOriginX;
        const ey = p._gadgetOriginY;

        // Start a final intense shake sequence, swap sprite in the middle
        if (p.gadgetSprite) {
            this.tweens.killTweensOf(p.gadgetSprite);
            const burnedKey = `gadget_${p._gadgetName}_burnedout`;
            
            if (this.textures.exists(burnedKey)) {
                // Final tension shake sequence: progressive buildup, peak at sprite swap, then decay
                const finalShakeDur = 30; // Fast, violent
                let shakeCount = 0;
                const totalShakes = 6; // Extended: 2 buildup, 1 peak (swap), 3 decay
                
                const doFinalShake = () => {
                    if (!p.gadgetSprite) return;
                    
                    shakeCount++;
                    
                    // Calculate shake intensity: builds to peak at shake 3 (sprite swap)
                    let currentAmt;
                    if (shakeCount === 1) currentAmt = 8;   // Build up
                    else if (shakeCount === 2) currentAmt = 14;  // Stronger build up
                    else if (shakeCount === 3) currentAmt = 20;  // MAXIMUM at sprite swap
                    else if (shakeCount === 4) currentAmt = 12;  // Decay
                    else if (shakeCount === 5) currentAmt = 7;   // Further decay
                    else currentAmt = 3;                          // Final settle shake
                    
                    // Swap sprite at peak shake (shake 3)
                    if (shakeCount === 3) {
                        // Stop all energy flow effects (sparks, auras) when sprite switches
                        this._stopEnergyEffects(p);

                        // Fade out the per-gadget glow as the gadget burns out
                        if (p._fx && p._fx.glow) {
                            this.tweens.killTweensOf(p._fx.glow);
                            this.tweens.add({ targets: p._fx.glow, alpha: 0, duration: 150, ease: 'Quad.easeOut' });
                        }
                        
                        // Spawn coins behind the gadget sprite
                        if (p.gadgetCapacity && p.gadgetCapacity > 0) {
                            p.coinAnimationComplete = false;
                            const totalDelay = P.BURNEDOUT_DISPLAY_DURATION + P.BURNEDOUT_FADE_DURATION + CONFIG.COIN_REWARD_ANIMATION.DELAY_BEFORE_FLY;
                            this.animateCoinReward(ex, ey, p.gadgetCapacity, totalDelay, p);
                        } else {
                            // No coins to spawn, mark as complete
                            p.coinAnimationComplete = true;
                        }
                        
                        if(P.GADGET_SPRITE_SWITCH_ON_TENSION_ENABLED){
                            // Switch texture mid-shake for continuity
                        // Stop any animated-gadget loop so it doesn't override the burned texture
                        if (p._washing && p._washing.anims) p._washing.anims.stop();
                        p.gadgetSprite.setTexture(burnedKey);
                        p.gadgetSprite.setTint(0xffffff);
                        p.gadgetSprite.setScale(1);
                        // Apply aspect-ratio-preserving scaling for burned out sprite
                        if (this.textures.exists(burnedKey)) {
                            const size = this._getAspectFitSize(this.textures.get(burnedKey), p._gadgetDisplayWidth, p._gadgetDisplayHeight);
                            p.gadgetSprite.setDisplaySize(size.width, size.height);
                        } else {
                            p.gadgetSprite.setDisplaySize(p._gadgetDisplayWidth, p._gadgetDisplayHeight);
                        }
                        p.gadgetSprite.setAlpha(1);

                        }
                        else{
                            p.gadgetSprite.setVisible(false);

                        }
                        
                        p.isDefeated = true;
                        p._shakeActive = false;
                        p._pulseActive = false;
                        
                        // Schedule removal of burnedout sprite after configured duration
                        if (P.BURNEDOUT_DISPLAY_DURATION > 0) {
                            this.time.delayedCall(P.BURNEDOUT_DISPLAY_DURATION, () => {
                                if (p.gadgetSprite && p.gadgetSprite.scene) {
                                    // Stop smoke generation
                                    this._stopSmoke(p);
                                    
                                    // Clean up all smoke puffs
                                    if (p.smokePuffs) {
                                        for (const puff of p.smokePuffs) {
                                            if (puff && puff.scene) {
                                                this.tweens.killTweensOf(puff);
                                                puff.destroy();
                                            }
                                        }
                                        p.smokePuffs = [];
                                    }
                                    
                                // Clean up wire, plug, meter if still present (socket stays on charging slot)
                                const cleanupItems = [
                                    p.wireGraphics, p.plugSprite,
                                    p.meterBg, p.meterNeedle, p.meterPivot
                                ].filter(Boolean);
                                cleanupItems.forEach(item => {
                                    if (item.scene) {
                                        this.tweens.killTweensOf(item);
                                        item.destroy();
                                    }
                                });
                                p.wireGraphics = p.plugSprite = null;
                                    this.tweens.add({
                                        targets: p.gadgetSprite,
                                        alpha: 0,
                                        duration: P.BURNEDOUT_FADE_DURATION,
                                        ease: 'Cubic.easeOut',
                                        onComplete: () => {
                                            if (p.gadgetSprite && p.gadgetSprite.scene) {
                                                p.gadgetSprite.destroy();
                                                p.gadgetSprite = null;
                                            }
                                        }
                                    });
                                }
                            });
                        }
                        
                        // CODE EXPLOSION - Radial rings and burst lines
                        if (P.USE_CODE_EXPLOSION) {
                            const maxDim = Math.max(p._gadgetDisplayWidth, p._gadgetDisplayHeight);
                            const spriteRadius = maxDim / 2;
                            const maxRadius = spriteRadius * 1.5; // 150% of sprite radius
                            const numRings = 4;
                            const colors = [0xFFFFAA, 0xFFDD77, 0xFFAA44, 0xFF8822];
                            
                            for (let i = 0; i < numRings; i++) {
                                const ring = this.add.circle(ex, ey, 8, colors[i], 0.95).setDepth(100); // Much higher depth
                                // Track this explosion effect for cleanup
                                if (p.explosionEffects) p.explosionEffects.push(ring);
                                const delay = i * 15; // Stagger the rings
                                
                                this.time.delayedCall(delay, () => {
                                    if (!ring.scene) return; // Already destroyed
                                    this.tweens.add({
                                        targets: ring,
                                        radius: maxRadius,
                                        alpha: 0,
                                        duration: 350,
                                        ease: 'Cubic.easeOut',
                                        onComplete: () => {
                                            // Remove from tracking array
                                            if (p.explosionEffects) {
                                                const idx = p.explosionEffects.indexOf(ring);
                                                if (idx > -1) p.explosionEffects.splice(idx, 1);
                                            }
                                            ring.destroy();
                                        }
                                    });
                                });
                            }
                            
                            // Add radial burst lines for extra impact
                            const numLines = 12;
                            for (let i = 0; i < numLines; i++) {
                                const angle = (i / numLines) * Math.PI * 2;
                                const line = this.add.graphics().setDepth(99);
                                const startLen = 10;
                                const targetLen = maxRadius * 1.3;
                                
                                this.tweens.add({
                                    targets: line,
                                    alpha: 0,
                                    duration: 250,
                                    ease: 'Cubic.easeOut',
                                    onUpdate: (tween) => {
                                        const progress = tween.progress;
                                        const currentLen = startLen + (targetLen - startLen) * progress;
                                        const thickness = 5 * (1 - progress * 0.7); // Start thicker
                                        line.clear();
                                        line.lineStyle(thickness, 0xFFDD66, 1.0 * (1 - progress));
                                        line.beginPath();
                                        line.moveTo(ex, ey);
                                        line.lineTo(ex + Math.cos(angle) * currentLen, ey + Math.sin(angle) * currentLen);
                                        line.strokePath();
                                    },
                                    onComplete: () => line.destroy()
                                });
                            }
                            
                            // Add bright flash circle at center
                            const flash = this.add.circle(ex, ey, spriteRadius * 0.6, 0xFFFFFF, 1).setDepth(101);
                            this.tweens.add({
                                targets: flash,
                                radius: spriteRadius * 1.8,
                                alpha: 0,
                                duration: 200,
                                ease: 'Power3',
                                onComplete: () => flash.destroy()
                            });
                        }
                        
                        // SPRITE EXPLOSION - Animated sprite frames
                        if (P.USE_SPRITE_EXPLOSION) {
                            const explosionSprite = this.add.sprite(ex, ey, 'explosion_01')
                                .setOrigin(0.5, 0.5)
                                .setScale(P.SPRITE_EXPLOSION_SCALE)
                                .setDepth(100);
                            
                            // Track this explosion effect for cleanup
                            if (p.explosionEffects) p.explosionEffects.push(explosionSprite);
                            
                            // Play the explosion animation
                            explosionSprite.play('explode');
                            
                            // Remove sprite after animation completes
                            this.time.delayedCall(P.SPRITE_EXPLOSION_DURATION, () => {
                                if (explosionSprite && explosionSprite.scene) {
                                    // Remove from tracking array
                                    if (p.explosionEffects) {
                                        const idx = p.explosionEffects.indexOf(explosionSprite);
                                        if (idx > -1) p.explosionEffects.splice(idx, 1);
                                    }
                                    explosionSprite.destroy();
                                }
                            });
                        }
                    }
                    
                    if (shakeCount >= totalShakes) {
                        // Final settle
                        this.tweens.add({
                            targets: p.gadgetSprite, x: ex, y: ey,
                            duration: 100, ease: 'Sine.easeOut'
                        });
                        return;
                    }
                    
                    // Apply shake
                    const dx = (Math.random() - 0.5) * currentAmt * 2;
                    const dy = (Math.random() - 0.5) * currentAmt;
                    
                    this.tweens.add({
                        targets: p.gadgetSprite, x: ex + dx, y: ey + dy,
                        duration: finalShakeDur, ease: 'Sine.easeInOut',
                        onComplete: doFinalShake
                    });
                };
                
                doFinalShake();
                
            } else {
                // Fallback: darken in place
                // Stop all energy flow effects (sparks, auras) when sprite switches
                this._stopEnergyEffects(p);
                
                // Spawn coins behind the gadget sprite
                if (p.gadgetCapacity && p.gadgetCapacity > 0) {
                    p.coinAnimationComplete = false;
                    const totalDelay = P.BURNEDOUT_DISPLAY_DURATION + P.BURNEDOUT_FADE_DURATION + CONFIG.COIN_REWARD_ANIMATION.DELAY_BEFORE_FLY;
                    this.animateCoinReward(ex, ey, p.gadgetCapacity, totalDelay, p);
                } else {
                    // No coins to spawn, mark as complete
                    p.coinAnimationComplete = true;
                }
                
                // Stop any animated-gadget loop so it freezes instead of spinning while burned
                if (p._washing && p._washing.anims) p._washing.anims.stop();
                p.gadgetSprite.setTint(0x444444);
                p.gadgetSprite.setAlpha(1);
                // Apply aspect-ratio-preserving scaling
                if (this.textures.exists(burnedKey)) {
                    const size = this._getAspectFitSize(this.textures.get(burnedKey), p._gadgetDisplayWidth, p._gadgetDisplayHeight);
                    p.gadgetSprite.setDisplaySize(size.width, size.height);
                } else {
                    p.gadgetSprite.setDisplaySize(p._gadgetDisplayWidth, p._gadgetDisplayHeight);
                }
                p.gadgetSprite.setPosition(ex, ey);
                p.isDefeated = true;
                p._shakeActive = false;
                p._pulseActive = false;
                
                // Schedule removal of burnedout sprite after configured duration
                if (P.BURNEDOUT_DISPLAY_DURATION > 0) {
                    this.time.delayedCall(P.BURNEDOUT_DISPLAY_DURATION, () => {
                        if (p.gadgetSprite && p.gadgetSprite.scene) {
                            // Stop smoke generation
                            this._stopSmoke(p);
                            
                            // Clean up all smoke puffs
                            if (p.smokePuffs) {
                                for (const puff of p.smokePuffs) {
                                    if (puff && puff.scene) {
                                        this.tweens.killTweensOf(puff);
                                        puff.destroy();
                                    }
                                }
                                p.smokePuffs = [];
                            }
                            
                            // Clean up wire, plug, meter if still present (socket stays on charging slot)
                            const cleanupItems = [
                                p.wireGraphics, p.plugSprite,
                                p.meterBg, p.meterNeedle, p.meterPivot
                            ].filter(Boolean);
                            cleanupItems.forEach(item => {
                                if (item.scene) {
                                    this.tweens.killTweensOf(item);
                                    item.destroy();
                                }
                            });
                            p.wireGraphics = p.plugSprite = null;
                            p.meterBg = p.meterNeedle = p.meterPivot = null;
                            
                            // Fade out the burnedout sprite
                            this.tweens.add({
                                targets: p.gadgetSprite,
                                alpha: 0,
                                duration: P.BURNEDOUT_FADE_DURATION,
                                ease: 'Cubic.easeOut',
                                onComplete: () => {
                                    if (p.gadgetSprite && p.gadgetSprite.scene) {
                                        p.gadgetSprite.destroy();
                                        p.gadgetSprite = null;
                                    }
                                }
                            });
                        }
                    });
                }
            }
        } else {
            // No gadget sprite - spawn coins immediately with short delay
            if (p.gadgetCapacity && p.gadgetCapacity > 0) {
                p.coinAnimationComplete = false;
                const totalDelay = CONFIG.COIN_REWARD_ANIMATION.DELAY_BEFORE_FLY;
                this.animateCoinReward(ex, ey, p.gadgetCapacity, totalDelay, p);
            } else {
                // No coins to spawn, mark as complete
                p.coinAnimationComplete = true;
            }
            
            p.isDefeated = true;
            p._shakeActive = false;
            p._pulseActive = false;
        }

        // Screen shake on burnout
        this.cameras.main.shake(P.EXPLODE_SHAKE_DURATION, P.EXPLODE_SHAKE_INTENSITY);

        // Max smoke burst then settle to idle
        this._setSmokeBurst(p);

        // Disconnect wire + plug on burnout (socket stays on battery)
        const connFade = [p.wireGraphics, p.plugSprite].filter(Boolean);
        if (connFade.length) {
            this.tweens.add({
                targets: connFade, alpha: 0, duration: 220, ease: 'Power2',
                onComplete: () => {
                    connFade.forEach(o => o.destroy());
                    p.wireGraphics = p.plugSprite = null;
                },
            });
        }

        // Fade capacity text and meter (smoke keeps running after burnout)
        if (p.meterNeedle) this.tweens.killTweensOf(p.meterNeedle);
        const toFade = [p.gadgetCapacityText, p.gadgetChargeText, p.gadgetNameText,
                        p.meterBg, p.meterNeedle, p.meterPivot].filter(Boolean);
        if (toFade.length) {
            this.tweens.add({
                targets: toFade, alpha: 0, duration: 350,
                onComplete: () => {
                    toFade.forEach(o => o.destroy());
                    p.gadgetCapacityText = p.gadgetChargeText = p.gadgetNameText =
                    p.meterBg = p.meterNeedle = p.meterPivot = null;
                },
            });
        }

        this.time.delayedCall(350, () => this.checkAllDefeated());
    }

    checkAllDefeated() {
        if (this.gadget && this.gadget.isDefeated) {
            // Wait for all coin animations to complete
            this._waitForCoinAnimations(() => {
                // Add buffer time after all coins collected before next level
                const bufferTime = CONFIG.LEVEL_COMPLETION.BUFFER_TIME;
                this.time.delayedCall(bufferTime, () => {
                    this.advanceToNextGadget();
                });
            });
        }
    }

    _waitForCoinAnimations(callback) {
        // Check if the gadget's coin animation is complete
        const allComplete = !this.gadget || this.gadget.coinAnimationComplete;

        if (allComplete) {
            callback();
        } else {
            // Check again in 100ms
            this.time.delayedCall(100, () => {
                this._waitForCoinAnimations(callback);
            });
        }
    }

    advanceToNextGadget() {
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;
        const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xFFFFFF)
            .setDepth(1000).setAlpha(0);
        this.tweens.add({
            targets: flash, alpha: 1, duration: 140, ease: 'Linear', yoyo: true,
            onYoyoComplete: () => {
                flash.destroy();
                this.currentGadgetIndex = (this.currentGadgetIndex + 1) % this.gadgetsData.length;
                this.loadGadgets(this.gadgetsData[this.currentGadgetIndex]);
            },
        });
    }

    // ================================================================
    // BATTERY MERGE GRID (BOTTOM HALF)
    // ================================================================
    createGrid() {
        const W = this.scale.width;
        const H = this.scale.height;
        const L = this.layoutConfig;
        
        const gridW = this.GRID_COLS * this.CELL_SIZE + (this.GRID_COLS - 1) * this.CELL_GAP;
        const gridH = this.GRID_ROWS * this.CELL_SIZE + (this.GRID_ROWS - 1) * this.CELL_GAP;
        
        // Grid panel centre is anchored to a fixed fraction of partA.height
        // (L.panelCenterY); cells are laid around it using the actual scale-sized
        // gridH. Horizontally centred in the half (works in both orientations).
        const gridStartY = L.panelCenterY - gridH / 2 + this.CELL_SIZE / 2;
        const gridStartX = L.partA.x + (L.partA.width - gridW) / 2 + this.CELL_SIZE / 2;
        const gridCenterX = L.partA.x + L.partA.width / 2;

        this.gridStartX = gridStartX;
        this.gridStartY = gridStartY;

        const pad  = L.panPad;
        const panW = gridW + 2 * pad;
        const panH = gridH + 2 * pad;
        const cx   = gridStartX - this.CELL_SIZE / 2 + gridW / 2;
        const cy   = gridStartY - this.CELL_SIZE / 2 + gridH / 2;

        const panel = this.add.image(cx, cy, 'grid_panel');
        panel.setDisplaySize(panW, panH).setDepth(1.5);

        const inset = this.cellInset;
        for (let row = 0; row < this.GRID_ROWS; row++) {
            this.gridCells[row] = [];
            for (let col = 0; col < this.GRID_COLS; col++) {
                const x = gridStartX + col * (this.CELL_SIZE + this.CELL_GAP);
                const y = gridStartY + row * (this.CELL_SIZE + this.CELL_GAP);

                const emptyCell = this.add.graphics().setDepth(2);
                emptyCell.fillStyle(hexColor(CONFIG.CELL.INSET_SHADOW_COLOR), 1);
                emptyCell.fillRoundedRect(x - this.CELL_SIZE / 2, y - this.CELL_SIZE / 2,
                    this.CELL_SIZE, this.CELL_SIZE, this.CELL_RADIUS);
                emptyCell.fillStyle(hexColor(CONFIG.CELL.EMPTY_BG_COLOR), 1);
                emptyCell.fillRoundedRect(x - this.CELL_SIZE / 2 + inset, y - this.CELL_SIZE / 2 + inset,
                    this.CELL_SIZE - inset * 2, this.CELL_SIZE - inset * 2, this.CELL_RADIUS - inset);

                const filledBg = this.add.graphics().setDepth(2);
                filledBg.fillStyle(hexColor(CONFIG.CELL.INSET_SHADOW_COLOR), 1);
                filledBg.fillRoundedRect(x - this.CELL_SIZE / 2, y - this.CELL_SIZE / 2,
                    this.CELL_SIZE, this.CELL_SIZE, this.CELL_RADIUS);
                filledBg.fillStyle(hexColor(CONFIG.CELL.FILLED_BG_COLOR), 1);
                filledBg.fillRoundedRect(x - this.CELL_SIZE / 2 + inset, y - this.CELL_SIZE / 2 + inset,
                    this.CELL_SIZE - inset * 2, this.CELL_SIZE - inset * 2, this.CELL_RADIUS - inset);
                filledBg.setVisible(false);

                this.gridCells[row][col] = { x, y, row, col, isEmpty: true, cell: emptyCell, filledBg };
            }
        }
    }

    createCoinDisplay() {
        const W = this.scale.width;
        const H = this.scale.height;
        const L = this.layoutConfig;
        
        const gridW  = this.GRID_COLS * this.CELL_SIZE + (this.GRID_COLS - 1) * this.CELL_GAP;
        const gridH  = this.GRID_ROWS * this.CELL_SIZE + (this.GRID_ROWS - 1) * this.CELL_GAP;
        const pad    = L.panPad;
        const panW   = gridW + 2 * pad;
        const panH   = gridH + 2 * pad;
        
        // Unified: derive panel centre from gridStartX/Y (set by createGrid)
        const panCX   = this.gridStartX - this.CELL_SIZE / 2 + gridW / 2;
        const panCY   = this.gridStartY - this.CELL_SIZE / 2 + gridH / 2;
        const coinY     = L.coinCenterY;            // fixed fraction of partA.height (× sH)
        const rightEdge = panCX + panW / 2;         // right-aligned to grid panel (relational)

        // Icon right edge aligns with grid panel right edge; scaled gap to text
        const iconX = rightEdge - L.coinIconSize / 2;
        this.coinIcon = this.add.image(iconX, coinY, 'coin')
            .setDisplaySize(L.coinIconSize, L.coinIconSize)
            .setDepth(10);

        const textX = iconX - L.coinIconSize / 2 - L.coinTextIconGap;
        this.coinText = this.add.text(textX, coinY, `${this.coins}`, {
            fontSize: L.coinTextSize,
            fontFamily: CONFIG.FONT_FAMILY,
            color: CONFIG.COIN_COUNTER.TEXT_COLOR,
            fontStyle: 'bold',
            stroke: CONFIG.COIN_COUNTER.TEXT_STROKE_COLOR,
            strokeThickness: CONFIG.COIN_COUNTER.TEXT_STROKE_THICKNESS,
        }).setOrigin(1, 0.5).setDepth(10);
    }

    // createBatteryUnlockDisplay() {
    //     if (!CONFIG.BATTERY_UNLOCK_DISPLAY.DISPLAY_CROWN_PANEL) {
    //         this.unlockDisplayContainer = this.unlockDisplayText = this.unlockDisplayBatteryIcon = null;
    //         return;
    //     }
        
    //     const L = this.layoutConfig;
    //     const gridW  = this.GRID_COLS * this.CELL_SIZE + (this.GRID_COLS - 1) * this.CELL_GAP;
    //     const gridH  = this.GRID_ROWS * this.CELL_SIZE + (this.GRID_ROWS - 1) * this.CELL_GAP;
    //     const pad    = CONFIG.CELL.GRID_PANEL_PADDING;
    //     const panH   = gridH + 2 * pad;
    //     const panW   = gridW + 2 * pad;
        
    //     let displayY, leftEdge;
        
    //     if (L.isPortrait) {
    //         // Portrait: below grid panel
    //         const panCX  = this.gridStartX - this.CELL_SIZE / 2 + gridW / 2;
    //         const panCY  = this.gridStartY - this.CELL_SIZE / 2 + gridH / 2;
    //         displayY  = panCY - panH / 2 - CONFIG.BATTERY_UNLOCK_DISPLAY.VERTICAL_OFFSET;
    //         leftEdge  = panCX - panW / 2;
    //     } else {
    //         // Landscape: position above grid in left half
    //         const availHeight = L.gridHeight;
    //         const gridTopMargin = (availHeight - gridH) / 2;
    //         const panCY = L.gridTop + gridTopMargin + gridH / 2;
    //         displayY = panCY - panH / 2 - CONFIG.BATTERY_UNLOCK_DISPLAY.VERTICAL_OFFSET;
    //         leftEdge = L.gridLeft + 20;
    //     }

    //     this.unlockDisplayContainer = this.add.container(0, displayY).setDepth(10);
    //     const elems = [];
    //     let curX = leftEdge + CONFIG.BATTERY_UNLOCK_DISPLAY.PADDING_FROM_LEFT;
    //     const U = CONFIG.BATTERY_UNLOCK_DISPLAY;

    //     if (U.SHOW_CROWN_ICON) {
    //         const crown = this.add.image(curX + U.CROWN_ICON_SIZE / 2, 0, 'battery_crown')
    //             .setDisplaySize(U.CROWN_ICON_SIZE, U.CROWN_ICON_SIZE);
    //         elems.push(crown);
    //         curX += U.CROWN_ICON_SIZE + U.CROWN_BATTERY_SPACING;
    //     }
    //     if (U.SHOW_BATTERY_ICON) {
    //         this.unlockDisplayBatteryIcon = this.add.image(
    //             curX + U.BATTERY_ICON_SIZE / 2, 0,
    //             `battery${getBatteryIconLevel(CONFIG.BATTERY_START_LEVEL)}`)
    //             .setDisplaySize(U.BATTERY_ICON_SIZE, U.BATTERY_ICON_SIZE);
    //         elems.push(this.unlockDisplayBatteryIcon);
    //         curX += U.BATTERY_ICON_SIZE + U.BATTERY_TEXT_SPACING;
    //     } else {
    //         this.unlockDisplayBatteryIcon = null;
    //     }
    //     this.unlockDisplayText = this.add.text(curX, 0, '', {
    //         fontFamily: CONFIG.FONT_FAMILY, fontSize: U.TEXT_SIZE,
    //         // color: U.TEXT_COLOR, stroke: U.TEXT_STROKE_COLOR,
    //         color: U.TEXT_COLOR, stroke: U.TEXT_STROKE_COLOR,
    //         strokeThickness: U.TEXT_STROKE_THICKNESS,
    //     }).setOrigin(0, 0.5);
    //     elems.push(this.unlockDisplayText);
    //     this.unlockDisplayContainer.add(elems);
    //     this.updateBatteryUnlockDisplay(CONFIG.BATTERY_START_LEVEL);
    // }


    createBatteryUnlockDisplay() {
        if (!CONFIG.BATTERY_UNLOCK_DISPLAY.DISPLAY_CROWN_PANEL) {
            this.unlockDisplayContainer = this.unlockDisplayText = this.unlockDisplayBatteryIcon = null;
            return;
        }
        
        const L = this.layoutConfig;
        const gridW  = this.GRID_COLS * this.CELL_SIZE + (this.GRID_COLS - 1) * this.CELL_GAP;
        const gridH  = this.GRID_ROWS * this.CELL_SIZE + (this.GRID_ROWS - 1) * this.CELL_GAP;
        const pad    = L.panPad;
        const panH   = gridH + 2 * pad;
        const panW   = gridW + 2 * pad;
        
        let displayY, leftEdge;

         leftEdge = this.gridStartX - this.CELL_SIZE / 2 - pad;
        const panCY = this.gridStartY - this.CELL_SIZE / 2 + gridH / 2;
        displayY = panCY - panH / 2 - CONFIG.BATTERY_UNLOCK_DISPLAY.VERTICAL_OFFSET;
        
        // this.add.circle(leftEdge, displayY, 5, 0xFF0000).setDepth(9999);

        // Container anchored to grid panel left edge
        this.unlockDisplayContainer = this.add.container(leftEdge, displayY).setDepth(10);
        
        const U  = CONFIG.BATTERY_UNLOCK_DISPLAY;
        const Lc = this.layoutConfig;
        const elems = [];
        const scaledCrownSize = Lc.crownIconSize;
        const scaledCrownSpacing = Math.max(4, Math.round(U.CROWN_BATTERY_SPACING * (Lc.cellSize / CONFIG.CELL.SIZE)));
        let curX = Math.max(4, Math.round(U.PADDING_FROM_LEFT * (Lc.cellSize / CONFIG.CELL.SIZE)));

        if (U.SHOW_CROWN_ICON) {
            const crown = this.add.image(curX + scaledCrownSize / 2, 0, 'battery_crown')
                .setDisplaySize(scaledCrownSize, scaledCrownSize);
            elems.push(crown);
            curX += scaledCrownSize + scaledCrownSpacing;
        }
        if (U.SHOW_BATTERY_ICON) {
            const scaledBattSize = Math.round(U.BATTERY_ICON_SIZE * (Lc.cellSize / CONFIG.CELL.SIZE));
            this.unlockDisplayBatteryIcon = this.add.image(
                curX + scaledBattSize / 2, 0,
                `battery${getBatteryIconLevel(CONFIG.BATTERY_START_LEVEL)}`)
                .setDisplaySize(scaledBattSize, scaledBattSize);
            elems.push(this.unlockDisplayBatteryIcon);
            curX += scaledBattSize + Math.max(3, Math.round(U.BATTERY_TEXT_SPACING * (Lc.cellSize / CONFIG.CELL.SIZE)));
        } else {
            this.unlockDisplayBatteryIcon = null;
        }

        // Text starts from right edge of last icon
        this.unlockDisplayText = this.add.text(curX, 0, '', {
            fontFamily: CONFIG.FONT_FAMILY, fontSize: Lc.unlockTextSize,
            color: U.TEXT_COLOR, stroke: U.TEXT_STROKE_COLOR,
            strokeThickness: U.TEXT_STROKE_THICKNESS,
        }).setOrigin(0, 0.5);
        elems.push(this.unlockDisplayText);

        this.unlockDisplayContainer.add(elems);
        this.updateBatteryUnlockDisplay(CONFIG.BATTERY_START_LEVEL);
    }

    updateBatteryUnlockDisplay(batteryLevel) {
        if (!this.unlockDisplayContainer || !this.unlockDisplayText) return;
        const bd = getBatteryData(batteryLevel);
        if (!bd || !bd.displayName) return;
        this.unlockDisplayText.setText(`${bd.displayName} Battery`);
        if (CONFIG.BATTERY_UNLOCK_DISPLAY.SHOW_BATTERY_ICON && this.unlockDisplayBatteryIcon) {
            this.unlockDisplayBatteryIcon.setTexture(`battery${getBatteryIconLevel(batteryLevel)}`);
        }
        this.highestUnlockedBatteryLevel = batteryLevel;
    }

    showBatteryUnlockDisplay(batteryLevel) {
        if (!this.unlockDisplayContainer) return;
        if (batteryLevel > this.highestUnlockedBatteryLevel) {
            this.updateBatteryUnlockDisplay(batteryLevel);
        }
    }

    async spawnBatteryInGrid(row, col, level) {
        await this.assets.ensureBattery(level); // ADD THIS
        const cell = this.gridCells[row][col];
        const iconLvl = getBatteryIconLevel(level);


        const draggableBg = this.add.rectangle(
            cell.x, cell.y, this.CELL_SIZE, this.CELL_SIZE,
            hexColor(CONFIG.CELL.DRAGGABLE_BG_COLOR), CONFIG.CELL.DRAGGABLE_BG_ALPHA)
            .setDepth(10)
            .setInteractive({ draggable: true, useHandCursor: true });

        const battery = this.add.image(cell.x, cell.y + this.batteryYOffset, `battery${iconLvl}`)
            .setDisplaySize(this.batteryDisplaySize, this.batteryDisplaySize)
            .setDepth(11);

        const levelText = this.add.text(
            cell.x, cell.y + this.batteryYOffset + this.levelTextYOffset,
            `LVL ${level}`,
            { fontSize: this.levelTextSize, fontFamily: CONFIG.FONT_FAMILY,
              color: CONFIG.CELL.LEVEL_TEXT_COLOR, fontStyle: 'bold' })
            .setOrigin(0.5).setDepth(12);

        const batteryData = {
            draggableBg, sprite: battery, levelText, level, row, col,
            originalX: cell.x,
            originalY: cell.y + this.batteryYOffset,
            inGrid: true, inChargingSlot: false,
        };
        draggableBg.setData('batteryData', batteryData);
        this.batteries.push(batteryData);
        this.grid[row][col] = batteryData;
        cell.filledBg.setVisible(true);
        cell.isEmpty = false;
        this.playSpawnAnimation(batteryData);
        return batteryData;
    
    }

    playSpawnAnimation(bd) {
        const base = this.batteryDisplaySize;
        const a    = CONFIG.SPAWN_ANIMATION;
        bd.sprite.setDisplaySize(base * a.INITIAL_SCALE_X, base * a.INITIAL_SCALE_Y);
        bd.levelText.setScale(a.INITIAL_SCALE_X, a.INITIAL_SCALE_Y);
        const seq = [
            [a.STRETCH_SCALE_X, a.STRETCH_SCALE_Y, a.STRETCH_DURATION],
            [a.BOUNCE_SCALE_X,  a.BOUNCE_SCALE_Y,  a.BOUNCE_DURATION],
            [1, 1, a.SETTLE_DURATION],
        ];
        let chain = Promise.resolve();
        seq.forEach(([sx, sy, dur]) => {
            chain = chain.then(() => new Promise(res => {
                this.tweens.add({
                    targets: bd.sprite,
                    displayWidth: base * sx, displayHeight: base * sy,
                    duration: dur, ease: 'Cubic.easeOut', onComplete: res,
                });
                this.tweens.add({
                    targets: bd.levelText, scaleX: sx, scaleY: sy,
                    duration: dur, ease: 'Cubic.easeOut',
                });
            }));
        });
    }

    // createButtons() {
    //     const W = window.innerWidth || this.cameras.main.width;
    //     const H = window.innerHeight || this.cameras.main.height;
    //     const L = this.layoutConfig;
        
    //     let spawnButtonX, spawnButtonY, levelUpButtonX, levelUpButtonY;
        
    //     if (L.isPortrait) {
    //         // Portrait: buttons at bottom, spawn and level-up side-by-side
    //         spawnButtonX = W / 2;
    //         spawnButtonY = H - CONFIG.BUTTON.BOTTOM_PADDING;
    //         levelUpButtonX = W / 2 - CONFIG.BUTTON.BUTTON_SPACING;
    //         levelUpButtonY = spawnButtonY;
    //     } else {
    //         // Landscape: buttons in left half, stacked vertically
    //         const gridW = this.GRID_COLS * this.CELL_SIZE + (this.GRID_COLS - 1) * this.CELL_GAP;
    //         const gridH = this.GRID_ROWS * this.CELL_SIZE + (this.GRID_ROWS - 1) * this.CELL_GAP;
    //         const availHeight = L.gridHeight;
    //         const gridTopMargin = (availHeight - gridH) / 2;
    //         const gridBottomY = L.gridTop + gridTopMargin + gridH + this.CELL_SIZE / 2;
            
    //         spawnButtonX = L.gridLeft + L.gridWidth / 2;
    //         spawnButtonY = gridBottomY + 30;  // Spacing below grid
            
    //         levelUpButtonX = spawnButtonX;
    //         levelUpButtonY = spawnButtonY + CONFIG.BUTTON.SPAWN_HEIGHT + 30;  // Below spawn button
    //     }

    //     // Spawn button
    //     const spawnBtn = this.add.container(spawnButtonX, spawnButtonY).setDepth(100);
    //     const spawnBg  = this.add.image(0, 0, 'button')
    //         .setDisplaySize(CONFIG.BUTTON.SPAWN_WIDTH + 30, CONFIG.BUTTON.SPAWN_HEIGHT + 30)
    //         .setInteractive({ useHandCursor: true });
    //     const iconLvl  = getBatteryIconLevel(this.spawnButtonLevel);
    //     const spawnIcon = this.add.image(CONFIG.BUTTON.BATTERY_ICON_X, CONFIG.BUTTON.BATTERY_ICON_Y,
    //         `battery${iconLvl}`)
    //         .setDisplaySize(CONFIG.BUTTON.BATTERY_ICON_WIDTH, CONFIG.BUTTON.BATTERY_ICON_HEIGHT);
    //     this.spawnButtonText = this.add.text(
    //         CONFIG.BUTTON.COIN_TEXT_X, CONFIG.BUTTON.COIN_TEXT_Y, `${this.spawnCost}`, {
    //             fontSize: CONFIG.BUTTON.COIN_TEXT_SIZE, fontFamily: CONFIG.FONT_FAMILY,
    //             color: '#FFFFFF', fontStyle: 'bold',
    //         }).setOrigin(0.5);
    //     const spawnCoinIcon = this.add.image(CONFIG.BUTTON.COIN_ICON_X, CONFIG.BUTTON.COIN_ICON_Y, 'coin')
    //         .setDisplaySize(CONFIG.BUTTON.COIN_ICON_WIDTH, CONFIG.BUTTON.COIN_ICON_HEIGHT);
    //     spawnBtn.add([spawnBg, spawnIcon, this.spawnButtonText, spawnCoinIcon]);
    //     spawnBg.on('pointerdown', () => this.spawnBattery());
    //     this.spawnButton   = spawnBtn;
    //     this.spawnButtonBg = spawnBg;
    //     this.spawnButtonIcon = spawnIcon;

    //     // Level-up button
    //     const lvlBtn = this.add.container(levelUpButtonX, levelUpButtonY).setDepth(100);
    //     const lvlBg  = this.add.rectangle(0, 0,
    //         CONFIG.BUTTON.LEVELUP_WIDTH, CONFIG.BUTTON.LEVELUP_HEIGHT,
    //         hexColor(CONFIG.BUTTON.LEVELUP_COLOR))
    //         .setStrokeStyle(CONFIG.BUTTON.LEVELUP_BORDER_WIDTH,
    //             hexColor(CONFIG.BUTTON.LEVELUP_BORDER_COLOR))
    //         .setInteractive({ useHandCursor: true });
    //     const lvlTxt = this.add.text(0, 0, 'LVL UP\nALL', {
    //         fontSize: '20px', fontFamily: CONFIG.FONT_FAMILY,
    //         align: 'center', color: '#FFFFFF', fontStyle: 'bold',
    //     }).setOrigin(0.5);
    //     lvlBtn.add([lvlBg, lvlTxt]);
    //     lvlBg.on('pointerdown', () => { if (this.levelUpButtonVisible) this.levelUpAll(); });
    //     this.levelUpButton   = lvlBtn;
    //     this.levelUpButtonBg = lvlBg;
    //     this.levelUpButton.setVisible(false);
    //     this.levelUpButtonVisible = false;
    //     this.levelUpButtonShowTime = null;

    //     this.time.addEvent({
    //         delay: 1000, callback: this.checkLevelUpTimer, callbackScope: this, loop: true,
    //     });
    // }



    async createButtons() {
        const W = this.scale.width;
        const H = this.scale.height;
        const L = this.layoutConfig;
        
        // Spawn button: horizontally centred, vertically at a fixed fraction of partA.height
        const spawnButtonX = L.partA.x + L.partA.width / 2;
        const spawnButtonY = L.buttonCenterY;
        // Level-up sits to the left of spawn at the same Y (horizontal gap × sW)
        const levelUpButtonX = spawnButtonX - L.spawnBtnDisplayW / 2 - 20 * L.sW - L.spawnBtnDisplayH * 0.4;
        const levelUpButtonY = spawnButtonY;

        // Spawn button
        const spawnBtn = this.add.container(spawnButtonX, spawnButtonY).setDepth(100);
        const spawnBg  = this.add.image(0, 0, 'button')
            .setDisplaySize(L.spawnBtnDisplayW, L.spawnBtnDisplayH)
            .setInteractive({ useHandCursor: true });
        this.spawnButtonText = this.add.text(
            L.spawnCoinTextX, 0, `${this.spawnCost}`, {
                fontSize: L.spawnCoinTextSize, fontFamily: CONFIG.FONT_FAMILY,
                color: '#FFFFFF', fontStyle: 'bold',
            }).setOrigin(0.5);
        const spawnCoinIcon = this.add.image(L.spawnCoinIconX, 0, 'coin')
            .setDisplaySize(L.spawnCoinIconSize, L.spawnCoinIconSize);

        spawnBtn.add([spawnBg, this.spawnButtonText, spawnCoinIcon]);
        spawnBg.on('pointerdown', () => this.spawnBattery());
        this.spawnButton   = spawnBtn;
        this.spawnButtonBg = spawnBg;
        this.spawnButtonIcon = null;

        // Wait for battery texture then add icon
        const iconLvl = getBatteryIconLevel(this.spawnButtonLevel);
        await this.assets.ensureBattery(iconLvl);
        const spawnIcon = this.add.image(L.spawnBattIconX, 0, `battery${iconLvl}`)
            .setDisplaySize(L.spawnBattIconSize, L.spawnBattIconSize);
        spawnBtn.add(spawnIcon);
        this.spawnButtonIcon = spawnIcon;

        // Level-up button
        const lvlBtn = this.add.container(levelUpButtonX, levelUpButtonY).setDepth(100);
        const lvlBg  = this.add.rectangle(0, 0,
            L.spawnBtnDisplayH * 0.8, L.spawnBtnDisplayH * 0.8,
            hexColor(CONFIG.BUTTON.LEVELUP_COLOR))
            .setStrokeStyle(CONFIG.BUTTON.LEVELUP_BORDER_WIDTH,
                hexColor(CONFIG.BUTTON.LEVELUP_BORDER_COLOR))
            .setInteractive({ useHandCursor: true });
        const lvlUpFontSize = Math.max(12, Math.round(20 * (L.cellSize / CONFIG.CELL.SIZE))) + 'px';
        const lvlTxt = this.add.text(0, 0, 'LVL UP\nALL', {
            fontSize: lvlUpFontSize, fontFamily: CONFIG.FONT_FAMILY,
            align: 'center', color: '#FFFFFF', fontStyle: 'bold',
        }).setOrigin(0.5);
        lvlBtn.add([lvlBg, lvlTxt]);
        lvlBg.on('pointerdown', () => { if (this.levelUpButtonVisible) this.levelUpAll(); });
        this.levelUpButton   = lvlBtn;
        this.levelUpButtonBg = lvlBg;
        this.levelUpButton.setVisible(false);
        this.levelUpButtonVisible = false;
        this.levelUpButtonShowTime = null;

        this.time.addEvent({
            delay: 1000, callback: this.checkLevelUpTimer, callbackScope: this, loop: true,
        });
    }

    createStartOverlay() {
        const W = this.scale.width;
        const H = this.scale.height;
        const L = this.layoutConfig;
        
        // Use actual camera/game dimensions for the overlay rect to ensure full coverage
        const gameW = this.cameras.main.width;
        const gameH = this.cameras.main.height;
        
        const maskColor = parseInt(CONFIG.POINTER.TUTORIAL_MASK_COLOR.substring(1), 16);
        this.startOverlay = this.add.rectangle(gameW / 2, gameH / 2, gameW, gameH, maskColor,
            CONFIG.POINTER.TUTORIAL_MASK_OPACITY).setAlpha(0).setDepth(99);

        // Position pointer based on spawn button location
        let pointerX = this.spawnButton.x;
        const pY = this.spawnButton.y + CONFIG.POINTER.OFFSET_Y;
        
        const strokeColor = parseInt(CONFIG.POINTER.STROKE_COLOR.substring(1), 16);
        const fillColor   = parseInt(CONFIG.POINTER.FILL_COLOR.substring(1), 16);
        const pCont = this.add.container(pointerX, pY).setAlpha(0).setDepth(102);
        for (let a = 0; a < 360; a += 45) {
            const rad = a * Math.PI / 180;
            const sc  = this.add.image(
                Math.cos(rad) * CONFIG.POINTER.STROKE_WIDTH,
                Math.sin(rad) * CONFIG.POINTER.STROKE_WIDTH, 'point')
                .setScale(CONFIG.POINTER.SCALE).setTint(strokeColor).setOrigin(0.5, 0);
            pCont.add(sc);
        }
        const fp = this.add.image(0, 0, 'point')
            .setScale(CONFIG.POINTER.SCALE).setTint(fillColor).setOrigin(0.5, 0);
        pCont.add(fp);
        this.startPointer = pCont;

        this.time.delayedCall(CONFIG.POINTER.TUTORIAL_START_DELAY, () => {
            if (!this.startOverlay || !pCont.active) return;
            this.tweens.add({
                targets: this.startOverlay, alpha: 1,
                duration: CONFIG.POINTER.TUTORIAL_FADE_DURATION, ease: 'Linear',
                onComplete: () => {
                    if (!pCont.active) return;
                    pCont.setAlpha(1);
                    this.tweens.add({
                        targets: pCont,
                        y: pY - CONFIG.POINTER.ANIMATION_MOVE_UP,
                        scaleX: CONFIG.POINTER.SCALE * CONFIG.POINTER.ANIMATION_SCALE_DOWN,
                        scaleY: CONFIG.POINTER.SCALE * CONFIG.POINTER.ANIMATION_SCALE_DOWN,
                        duration: CONFIG.POINTER.ANIMATION_DURATION,
                        yoyo: CONFIG.POINTER.ANIMATION_YOYO,
                        repeat: CONFIG.POINTER.ANIMATION_REPEAT,
                    });
                },
            });
        });
    }

    removeStartOverlay() {
        if (!this.startOverlay) return;
        this.startOverlay.destroy();
        if (this.startPointer) this.startPointer.destroy();
        this.startOverlay = null;
        this.hasStartedPlaying = true;
        this.levelUpTimer = this.time.now;
        this.firstLevelUpTimer = true;
    }

    checkAndShowMergeTutorial() {
        if (!CONFIG.MERGE_TUTORIAL.ENABLED) return;   // disabled during development
        if (!this.mergeTutorialShown && this.batteries.length === 2 && !this.mergePointer) {
            this.createMergeTutorial();
        }
    }

    createMergeTutorial() {
        const x1 = this.gridStartX;
        const y1 = this.gridStartY;
        const x2 = this.gridStartX + (this.CELL_SIZE + this.CELL_GAP);
        const strokeColor = parseInt(CONFIG.POINTER.STROKE_COLOR.substring(1), 16);
        const fillColor   = parseInt(CONFIG.POINTER.FILL_COLOR.substring(1), 16);
        const pc = this.add.container(x1, y1).setDepth(102);
        for (let a = 0; a < 360; a += 45) {
            const rad = a * Math.PI / 180;
            const sc  = this.add.image(
                Math.cos(rad) * CONFIG.POINTER.STROKE_WIDTH,
                Math.sin(rad) * CONFIG.POINTER.STROKE_WIDTH, 'point')
                .setScale(CONFIG.POINTER.SCALE).setTint(strokeColor).setOrigin(0.5, 0);
            pc.add(sc);
        }
        const fp = this.add.image(0, 0, 'point')
            .setScale(CONFIG.POINTER.SCALE).setTint(fillColor).setOrigin(0.5, 0);
        pc.add(fp);
        this.tweens.add({
            targets: pc, x: x2,
            duration: CONFIG.MERGE_TUTORIAL.ANIMATION_DURATION,
            ease: CONFIG.MERGE_TUTORIAL.ANIMATION_EASE,
            yoyo: false, repeat: -1, repeatDelay: 200,
        });
        this.mergePointer = pc;
    }

    removeMergeTutorial() {
        if (this.mergePointer) {
            this.mergePointer.destroy();
            this.mergePointer = null;
            this.mergeTutorialShown = true;
        }
    }

    spawnBattery() {
        if (this.isWatchingAd) return;  // Block spawning during ad
        if (this.coins < this.spawnCost) return;
        let emptyCell = null;
        outer: for (let row = 0; row < this.GRID_ROWS; row++) {
            for (let col = 0; col < this.GRID_COLS; col++) {
                if (!this.grid[row][col]) { emptyCell = { row, col }; break outer; }
            }
        }
        if (!emptyCell) return;
        this.coins -= this.spawnCost;
        this.updateCoinDisplay();
        this.spawnBatteryInGrid(emptyCell.row, emptyCell.col, this.spawnButtonLevel);
        if (this.startOverlay) this.removeStartOverlay();
        this.checkAndShowMergeTutorial();
        this.updateSpawnButton();
    }

    // updateSpawnButton() {
    //     if (this.highestBatteryLevel >= 9) {
    //         const nl = this.highestBatteryLevel - 7;
    //         if (nl > this.spawnButtonLevel) {
    //             this.spawnButtonLevel = nl;
    //             this.spawnCost = nl * 10;
    //             this.spawnButtonText.setText(`${this.spawnCost}`);
    //             this.spawnButtonIcon.setTexture(`battery${getBatteryIconLevel(nl)}`);
    //         }
    //     }
    //     if (this.coins < this.spawnCost) {
    //         this.spawnButtonBg.setTint(0x888888).disableInteractive();
    //     } else {
    //         this.spawnButtonBg.setTint(0xffffff).setInteractive({ useHandCursor: true });
    //     }
    // }


    async updateSpawnButton() {
        if (this.highestBatteryLevel >= 9) {
            const nl = this.highestBatteryLevel - 7;
            if (nl > this.spawnButtonLevel) {
                this.spawnButtonLevel = nl;
                this.spawnCost = nl * 10;
                this.spawnButtonText.setText(`${this.spawnCost}`);
                const iconLvl = getBatteryIconLevel(nl);
                await this.assets.ensureBattery(iconLvl);
                if (this.spawnButtonIcon) {
                    this.spawnButtonIcon.setTexture(`battery${iconLvl}`);
                }
            }
        }
        if (this.coins < this.spawnCost) {
            this.spawnButtonBg.setTint(0x888888).disableInteractive();
        } else {
            this.spawnButtonBg.setTint(0xffffff).setInteractive({ useHandCursor: true });
        }
    }

    // ================================================================
    // DRAG / DROP
    // ================================================================
    onDragStart(pointer, gameObject) {
        if (this.isWatchingAd) return;  // Block dragging during ad
        const bd = gameObject.getData('batteryData');
        if (!bd) return;
        this.draggingBattery = bd;

        if (bd.inChargingSlot) {
            const p = this.platforms[bd.slotIndex];
            this.chargingSlots[bd.slotIndex] = null;
            p.slotBg.setVisible(true);
            p.slotBgFilled.setVisible(false);
            p.chargeRateText.setVisible(false);
            p.chargeRateBolt.setVisible(false);
            p.batterySprite = p.batteryLevelText = null;
        }
        if (bd.draggableBg) bd.draggableBg.setDepth(10000);
        bd.sprite.setDepth(10001);
        bd.levelText.setDepth(10002);
        if (this.startOverlay) this.removeStartOverlay();
    }

    onDrag(pointer, gameObject, dragX, dragY) {
        const bd = gameObject.getData('batteryData');
        if (!bd) return;
        if (bd.draggableBg) { bd.draggableBg.x = dragX; bd.draggableBg.y = dragY; }
        bd.sprite.setPosition(dragX, dragY);
        bd.levelText.setPosition(dragX, dragY + this.levelTextYOffset);
        if (bd.inGrid) {
            const cd = this.gridCells[bd.row][bd.col];
            const b  = new Phaser.Geom.Rectangle(
                cd.x - this.CELL_SIZE / 2, cd.y - this.CELL_SIZE / 2,
                this.CELL_SIZE, this.CELL_SIZE);
            cd.filledBg.setVisible(Phaser.Geom.Rectangle.Contains(b, dragX, dragY));
        }
    }

    onDragEnd(pointer, gameObject) {
        const bd = gameObject.getData('batteryData');
        if (!bd) return;
        const dx = bd.sprite.x;
        const dy = bd.sprite.y;

        // Check platform slots first
        for (let i = 0; i < this.platforms.length; i++) {
            const p    = this.platforms[i];
            const half = p.slotSize / 2;
            if (Math.abs(dx - p.slotX) <= half && Math.abs(dy - p.slotY) <= half) {
                this.handleDropOnPlatformSlot(i, bd);
                this.draggingBattery = null;
                return;
            }
        }

        // Check grid cells
        for (let row = 0; row < this.GRID_ROWS; row++) {
            for (let col = 0; col < this.GRID_COLS; col++) {
                const cd = this.gridCells[row][col];
                if (Math.abs(dx - cd.x) <= this.CELL_SIZE / 2 &&
                    Math.abs(dy - cd.y) <= this.CELL_SIZE / 2) {
                    this.handleDrop(bd, { row, col, cellData: cd });
                    this.draggingBattery = null;
                    return;
                }
            }
        }
        this.returnBatteryToPosition(bd);
        this.draggingBattery = null;
    }

    handleDropOnPlatformSlot(slotIndex, bd) {
        const slot = this.chargingSlots[slotIndex];
        if (slot === null) {
            this.moveBatteryToSlot(bd, slotIndex);
        } else if (bd.inChargingSlot && bd.slotIndex === slotIndex) {
            this.returnBatteryToPosition(bd);
        } else if (slot.batteryData.level === bd.level) {
            this.mergeBatteriesInSlot(bd, slot.batteryData, slotIndex);
        } else {
            this.swapBatteryWithSlot(bd, slot.batteryData, slotIndex);
        }
    }

    handleDrop(bd, target) {
        const tBat = this.grid[target.row][target.col];
        if (!tBat)              this.moveBattery(bd, target.row, target.col);
        else if (tBat === bd)   this.returnBatteryToPosition(bd);
        else if (tBat.level === bd.level) this.mergeBatteries(bd, tBat, target.row, target.col);
        else                    this.swapBatteries(bd, tBat);
    }

    // ================================================================
    // BATTERY OPERATIONS
    // ================================================================
    _clearBatterySource(bd) {
        if (bd.inGrid) {
            this.grid[bd.row][bd.col] = null;
            this.gridCells[bd.row][bd.col].filledBg.setVisible(false);
            this.gridCells[bd.row][bd.col].isEmpty = true;
        } else if (bd.inChargingSlot) {
            const p = this.platforms[bd.slotIndex];
            this.chargingSlots[bd.slotIndex] = null;
            p.slotBg.setVisible(true);
            p.slotBgFilled.setVisible(false);
            p.batterySprite = p.batteryLevelText = null;
        }
    }

    moveBattery(bd, newRow, newCol) {
        this._clearBatterySource(bd);
        bd.row  = newRow; bd.col = newCol;
        bd.inGrid = true; bd.inChargingSlot = false;
        this.grid[newRow][newCol] = bd;
        if (!this.batteries.includes(bd)) this.batteries.push(bd);
        const cd = this.gridCells[newRow][newCol];
        bd.originalX = cd.x;
        bd.originalY = cd.y + this.batteryYOffset;
        this.returnBatteryToPosition(bd);
        cd.filledBg.setVisible(true);
        cd.isEmpty = false;
    }

    mergeBatteries(dragged, target, tRow, tCol) {
        if (this.mergePointer) this.removeMergeTutorial();
        this.removeBattery(dragged);
        this.removeBattery(target);
        const newLevel = target.level + 1;
        this.spawnBatteryInGrid(tRow, tCol, newLevel);
        if (newLevel > this.highestBatteryLevel) {
            this.highestBatteryLevel = newLevel; this.updateSpawnButton();
            this.assets.prefetchBattery(newLevel + 1);
        }
        this.showBatteryUnlockDisplay(newLevel);
        this.createMergeEffect(this.gridCells[tRow][tCol].x, this.gridCells[tRow][tCol].y);
    }

    swapBatteries(b1, b2) {
        const r1 = b1.row, c1 = b1.col, r2 = b2.row, c2 = b2.col;
        this.grid[r1][c1] = b2; this.grid[r2][c2] = b1;
        b1.row = r2; b1.col = c2;
        b1.originalX = this.gridCells[r2][c2].x;
        b1.originalY = this.gridCells[r2][c2].y + this.batteryYOffset;
        b2.row = r1; b2.col = c1;
        b2.originalX = this.gridCells[r1][c1].x;
        b2.originalY = this.gridCells[r1][c1].y + this.batteryYOffset;
        this.returnBatteryToPosition(b1);
        this.returnBatteryToPosition(b2);
    }

    moveBatteryToSlot(bd, slotIndex) {
        if (bd.inGrid) {
            this.removeBattery(bd);
        } else if (bd.inChargingSlot) {
            const oldSI = bd.slotIndex;
            const oldP  = this.platforms[oldSI];
            this.chargingSlots[oldSI] = null;
            oldP.slotBg.setVisible(true);
            oldP.slotBgFilled.setVisible(false);
            oldP.chargeRateText.setVisible(false);
            oldP.chargeRateBolt.setVisible(false);
            oldP.batterySprite = oldP.batteryLevelText = null;
            if (bd.draggableBg) { bd.draggableBg.destroy(); bd.draggableBg = null; }
            if (bd.sprite)    bd.sprite.destroy();
            if (bd.levelText) bd.levelText.destroy();
        }
        this.addBatteryToSlot(slotIndex, bd.level);
    }

    swapBatteryWithSlot(b1, b2, slotIndex) {
        if (b1.inGrid) {
            const r1 = b1.row, c1 = b1.col;
            const lv2 = b2.level;
            this.removeBattery(b1);
            const p2 = this.platforms[slotIndex];
            this.chargingSlots[slotIndex] = null;
            p2.slotBg.setVisible(true);
            p2.slotBgFilled.setVisible(false);
            p2.chargeRateText.setVisible(false);
            p2.chargeRateBolt.setVisible(false);
            if (b2.draggableBg) { b2.draggableBg.destroy(); b2.draggableBg = null; }
            if (b2.sprite)    b2.sprite.destroy();
            if (b2.levelText) b2.levelText.destroy();
            p2.batterySprite = p2.batteryLevelText = null;
            this.spawnBatteryInGrid(r1, c1, lv2);
            this.addBatteryToSlot(slotIndex, b1.level);
        } else if (b1.inChargingSlot) {
            const si1 = b1.slotIndex, si2 = slotIndex;
            const lv1 = b1.level, lv2 = b2.level;
            [b1, b2].forEach(b => {
                if (b.draggableBg) { b.draggableBg.destroy(); b.draggableBg = null; }
                if (b.sprite)    b.sprite.destroy();
                if (b.levelText) b.levelText.destroy();
            });
            const p1 = this.platforms[si1], p2 = this.platforms[si2];
            this.chargingSlots[si1] = this.chargingSlots[si2] = null;
            p1.batterySprite = p1.batteryLevelText = null;
            p2.batterySprite = p2.batteryLevelText = null;
            p1.slotBg.setVisible(true); p1.slotBgFilled.setVisible(false);
            p2.slotBg.setVisible(true); p2.slotBgFilled.setVisible(false);
            p1.chargeRateText.setVisible(false); p1.chargeRateBolt.setVisible(false);
            p2.chargeRateText.setVisible(false); p2.chargeRateBolt.setVisible(false);
            this.addBatteryToSlot(si1, lv2);
            this.addBatteryToSlot(si2, lv1);
        }
    }

    mergeBatteriesInSlot(dragged, target, targetSlotIndex) {
        if (this.mergePointer) this.removeMergeTutorial();
        if (dragged.inGrid) {
            this.removeBattery(dragged);
        } else if (dragged.inChargingSlot) {
            const si = dragged.slotIndex;
            const op = this.platforms[si];
            this.chargingSlots[si] = null;
            if (dragged.draggableBg) { dragged.draggableBg.destroy(); dragged.draggableBg = null; }
            if (dragged.sprite)    dragged.sprite.destroy();
            if (dragged.levelText) dragged.levelText.destroy();
            op.batterySprite = op.batteryLevelText = null;
            op.slotBg.setVisible(true); op.slotBgFilled.setVisible(false);
            op.chargeRateText.setVisible(false); op.chargeRateBolt.setVisible(false);
        }
        const tp = this.platforms[targetSlotIndex];
        this.chargingSlots[targetSlotIndex] = null;
        if (target.draggableBg) { target.draggableBg.destroy(); target.draggableBg = null; }
        if (target.sprite)    target.sprite.destroy();
        if (target.levelText) target.levelText.destroy();
        tp.batterySprite = tp.batteryLevelText = null;
        tp.slotBg.setVisible(true); tp.slotBgFilled.setVisible(false);
        tp.chargeRateText.setVisible(false); tp.chargeRateBolt.setVisible(false);

        const newLevel = target.level + 1;
        this.addBatteryToSlot(targetSlotIndex, newLevel);
        if (newLevel > this.highestBatteryLevel) {
            this.highestBatteryLevel = newLevel; this.updateSpawnButton();
            this.assets.prefetchBattery(newLevel + 1);
        }
        this.showBatteryUnlockDisplay(newLevel);
        this.createMergeEffect(tp.slotX, tp.slotY);
    }

    removeBattery(bd) {
        this._clearBatterySource(bd);
        const idx = this.batteries.indexOf(bd);
        if (idx > -1) this.batteries.splice(idx, 1);
        if (bd.draggableBg) bd.draggableBg.destroy();
        bd.sprite.destroy();
        bd.levelText.destroy();
    }

    returnBatteryToPosition(bd) {
        if (bd.draggableBg) bd.draggableBg.setDepth(10);
        bd.sprite.setDepth(11);
        bd.levelText.setDepth(12);

        if (bd.inChargingSlot) {
            const p  = this.platforms[bd.slotIndex];
            const cpm = getBatteryChargeValue(bd.level);
            this.chargingSlots[bd.slotIndex] = { level: bd.level, chargePerMinute: cpm, batteryData: bd };
            p.slotBg.setVisible(false);
            p.slotBgFilled.setVisible(true);
            p.batterySprite    = bd.sprite;
            p.batteryLevelText = bd.levelText;
            p.chargeRateText.setText(`${cpm}`).setVisible(true);
            p.chargeRateBolt.setVisible(true);
        }

        if (bd.inGrid) {
            const cd = this.gridCells[bd.row][bd.col];
            cd.filledBg.setVisible(true);
            cd.isEmpty = false;
        }

        const tY = bd.originalY + this.levelTextYOffset;
        if (bd.draggableBg) {
            this.tweens.add({
                targets: bd.draggableBg,
                x: bd.originalX,
                y: bd.originalY - this.batteryYOffset,
                duration: 200, ease: 'Back.easeOut',
            });
        }
        this.tweens.add({ targets: bd.sprite,    x: bd.originalX, y: bd.originalY, duration: 200, ease: 'Back.easeOut' });
        this.tweens.add({ targets: bd.levelText, x: bd.originalX, y: tY,           duration: 200, ease: 'Back.easeOut' });
    }

    createMergeEffect(x, y) {
        const c = this.add.circle(x, y, this.mergeEffectRadius, 0xFFFFFF, 0.8).setDepth(20);
        this.tweens.add({ targets: c, scaleX: 2, scaleY: 2, alpha: 0, duration: 300, onComplete: () => c.destroy() });
    }

    // ================================================================
    // LEVEL-UP TIMER
    // ================================================================
    checkLevelUpTimer() {
        if (!this.hasStartedPlaying) return;
        const now = this.time.now;
        if (this.levelUpButtonVisible && this.levelUpButtonShowTime) {
            if (now - this.levelUpButtonShowTime >= 30000) {
                this.tweens.killTweensOf(this.levelUpButton);
                this.levelUpButton.setScale(1).setVisible(false);
                this.levelUpButtonVisible = false;
                this.levelUpButtonBg.setAlpha(0.5);
                this.levelUpTimer = now;
            }
        } else if (!this.levelUpButtonVisible && this.levelUpTimer) {
            const wait = this.firstLevelUpTimer ? 20000 : 30000;
            if (now - this.levelUpTimer >= wait) {
                this.levelUpButton.setVisible(true);
                this.levelUpButtonVisible = true;
                this.levelUpButtonBg.setAlpha(1);
                this.levelUpButtonShowTime = now;
                this.firstLevelUpTimer = false;
                this.tweens.add({
                    targets: this.levelUpButton,
                    scaleX: 1.05, scaleY: 1.05, duration: 300,
                    yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                });
            }
        }
    }

    levelUpAll() {
        if (this.isWatchingAd) return;  // Prevent multiple ad triggers
        // Show mock ad before upgrading
        this.showMockAd(() => {
            this.performLevelUpAll();
        });
    }

    showMockAd(onComplete) {
        this.isWatchingAd = true;  // Block all interactions during ad
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;
        const A = CONFIG.AD;
        
        // Create overlay
        const overlay = this.add.rectangle(W / 2, H / 2, W, H, 
            parseInt(A.OVERLAY_COLOR.substring(1), 16), A.OVERLAY_ALPHA)
            .setDepth(10000)
            .setInteractive();  // Block clicks from passing through overlay
        
        // Create countdown timer text in center
        const timerText = this.add.text(W / 2, H / 2, `${A.DURATION}`, {
            fontSize: A.TIMER_TEXT_SIZE,
            fontFamily: CONFIG.FONT_FAMILY,
            color: A.TIMER_TEXT_COLOR,
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(10001);
        
        // Countdown from AD.DURATION to 0
        let timeLeft = A.DURATION;
        const countdownEvent = this.time.addEvent({
            delay: 1000,
            repeat: A.DURATION,
            callback: () => {
                timeLeft--;
                if (timeLeft > 0) {
                    timerText.setText(`${timeLeft}`);
                } else {
                    // Ad complete - destroy immediately and upgrade
                    countdownEvent.remove();  // Stop the countdown to prevent multiple calls
                    overlay.destroy();
                    timerText.destroy();
                    this.isWatchingAd = false;  // Re-enable interactions
                    onComplete();  // Instant upgrade after ad
                }
            }
        });
    }

    performLevelUpAll() {
        for (const bd of this.batteries) {
            if (bd.inGrid) {
                bd.level += 1;
                bd.levelText.setText(`LVL ${bd.level}`);
                bd.sprite.setTexture(`battery${getBatteryIconLevel(bd.level)}`);
                if (bd.level > this.highestBatteryLevel) this.highestBatteryLevel = bd.level;
            }
        }
        for (let i = 0; i < 3; i++) {
            const slot = this.chargingSlots[i];
            if (slot) {
                const p = this.platforms[i];
                slot.level += 1;
                slot.chargePerMinute = getBatteryChargeValue(slot.level);
                if (slot.batteryData) slot.batteryData.level = slot.level;
                if (p.batterySprite)    p.batterySprite.setTexture(`battery${getBatteryIconLevel(slot.level)}`);
                if (p.batteryLevelText) p.batteryLevelText.setText(`LVL ${slot.level}`);
                p.chargeRateText.setText(`${slot.chargePerMinute}`);
            }
        }
        this.updateSpawnButton();
        this.assets.prefetchBattery(this.highestBatteryLevel + 1);
        if (this.highestBatteryLevel > this.highestUnlockedBatteryLevel) {
            this.showBatteryUnlockDisplay(this.highestBatteryLevel);
        }
        this.tweens.killTweensOf(this.levelUpButton);
        this.levelUpButton.setScale(1).setVisible(false);
        this.levelUpButtonVisible = false;
        this.levelUpButtonBg.setAlpha(0.5);
        this.levelUpTimer = this.time.now;
    }

    // ================================================================
    // COIN DISPLAY
    // ================================================================
    updateCoinDisplay() {
        // Text is right-aligned (origin 1, 0.5), so its right edge stays fixed
        // at coinText.x and the icon never needs to move.
        this.coinText.setText(`${this.coins}`);
        this.updateSpawnButton();
    }

    animateCoinReward(startX, startY, amount, delayBeforeFly = 0, platform = null) {
        const C   = CONFIG.COIN_REWARD_ANIMATION;
        const tX  = this.coinIcon.x, tY = this.coinIcon.y;
        let done  = 0;
        
        // Spawn all coins immediately at the gadget position, on the top layer
        // (above gadget + secondary sprites like the chicken) — treated as UI.
        const coins = [];
        for (let i = 0; i < C.COIN_COUNT; i++) {
            const coin = this.add.image(startX, startY - i * C.INITIAL_STACK_OFFSET, 'coin')
                .setDisplaySize(this.rewardCoinSize, this.rewardCoinSize)
                .setDepth(100 + i);  // Top layer, above all gadget art
            coins.push(coin);
        }

        // Wait for sprite to disappear + additional delay, then animate coins to icon
        this.time.delayedCall(delayBeforeFly, () => {
            coins.forEach((coin, i) => {
                const dur = C.TOP_SPEED_DURATION * (1 + i * C.SPEED_VARIATION / (C.COIN_COUNT - 1));
                this.time.delayedCall(i * C.STAGGER_DELAY, () => {
                    if (!coin.scene) return; // Already destroyed
                    this.tweens.add({
                        targets: coin, x: tX, y: tY,
                        displayWidth: C.REWARD_COIN_SIZE * 0.6, displayHeight: C.REWARD_COIN_SIZE * 0.6,
                        duration: dur, ease: C.EASE,
                        onComplete: () => {
                            coin.destroy();
                            if (++done === C.COIN_COUNT) { 
                                this.coins += amount; 
                                this.updateCoinDisplay();
                                // Mark coin animation complete for this platform
                                if (platform) platform.coinAnimationComplete = true;
                            }
                        },
                    });
                });
            });
        });
    }

    // ================================================================
    // UPDATE
    // ================================================================
    update(time) {
        // Road pivot: drive the traffic, and the boring machine if charged.
        if (this.road) {
            if (this.tunnel) this._updateTunnel(time);
            this._updateRoad(time);
            return;
        }

        // Car pivot: sync display sprites to bodies and run the motor.
        if (this.car) {
            const C = CONFIG.CAR;
            const rearWheel = this.car.rearWheel;

            // Drive only while the car still owes climbing distance from the charge
            // it has banked; otherwise it stays frozen (parked) on the slope so it
            // neither rolls back nor spins its wheels while idle.
            const shouldDrive = this._carTravelledPx() < this.carEarnedDistPx;
            this._setCarDriving(shouldDrive);

            if (shouldDrive) {
                const angularAccel = C.MOTOR_TORQUE / rearWheel.inertia;   // α = τ / I
                this.matter.body.setAngularVelocity(rearWheel, rearWheel.angularSpeed + angularAccel);
            }

            this._syncCarSprites();
        }
    }
}

// ================================================================
// PHASER CONFIG + BOOT
// ================================================================
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const GAME_WIDTH = isMobile ? 720 : 1280;
const GAME_HEIGHT = isMobile ? 1280 : 720;

// ── HiDPI rendering ────────────────────────────────────────────────────────
// Draw the canvas at device pixels (CSS × DPR) so sprites are crisp on retina /
// high-DPI screens. The backing store matches the physical screen → no browser
// upscale; the canvas still DISPLAYS at logical CSS size. Scale.NONE lets us own
// the sizing (Scale.RESIZE would force the buffer back to CSS px every resize).
// Raw DPR for maximum clarity — this is a light 2D game. If a weak phone ever
// drops frames, change `dpr` to `Math.min(window.devicePixelRatio || 1, 2)`.
function resizeToHiDPI(game) {
    const dpr = window.devicePixelRatio || 1;
    game.scale.resize(window.innerWidth * dpr, window.innerHeight * dpr); // backing store = device pixels
    game.scale.setZoom(1 / dpr);   // display the device-px buffer at logical CSS size
    // (zoom lets Phaser manage canvas CSS size AND pointer→game coord mapping correctly)
}

// Resizing the buffer alone makes the canvas cover the viewport, but the scene's
// layout was computed once for the old size — so content stays in the old (top-left)
// region and the rest shows the canvas background. To make the game FILL any new
// viewport, re-run the scene layout on resize. The cheapest reliable way (given the
// scene rebuilds everything from layoutConfig in create()) is to restart the scene.
// Debounced so a drag-resize doesn't thrash. NOTE: there's no save system yet, so a
// restart resets in-memory state (coins/grid) — same as a page refresh. When you add
// persistence, this will preserve progress automatically.
let _reflowTimer = null;
function reflowOnResize(game) {
    resizeToHiDPI(game);                       // keep the canvas covering the viewport immediately
    clearTimeout(_reflowTimer);
    _reflowTimer = setTimeout(() => {
        resizeToHiDPI(game);                   // capture the final settled size
        const scene = game.scene.getScene('GameScene');
        if (scene) scene.scene.restart();      // re-run create() → layout fills the new viewport
    }, 150);
}

const _DPR = window.devicePixelRatio || 1;
const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    backgroundColor: '#7B68EE',
    scene: [GameScene],
    physics: {
        default: 'matter',
        matter: {
            gravity: { y: 1 },
            enableSleeping: false,
            positionIterations: 10,
            velocityIterations: 10,
            constraintIterations: 10,
        },
    },
    scale: {
        mode: Phaser.Scale.NONE,            // we own sizing via resizeToHiDPI()
        autoCenter: Phaser.Scale.NO_CENTER, // canvas fills the viewport; centering would offset it by ~half (device-px margins)
        width:  (window.innerWidth  || GAME_WIDTH)  * _DPR,   // start at device pixels
        height: (window.innerHeight || GAME_HEIGHT) * _DPR,
        zoom:   1 / _DPR,                                     // display device-px buffer at logical CSS size
        expandParent: true,
    },
    render: { antialias: true, pixelArt: false, roundPixels: false },
    callbacks: {
        // Runs after the canvas exists, before the first render: lock in exact
        // device-pixel sizing and keep it in sync on window resize / rotation.
        postBoot: (game) => {
            resizeToHiDPI(game);
            window.addEventListener('resize', () => reflowOnResize(game));
        },
    },
};

if (typeof window !== 'undefined' && !window.__LEVEL_VIEWER__) {
    initBatteryImagePaths().then(() => {
        const indicator = document.getElementById('loading-indicator');
        if (indicator) indicator.style.display = 'none';
        new Phaser.Game(config);
    });
}
