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

        // ── Land / canal (right-half pivot) ──────────────────────────────
        this.road              = null;   // band geometry: where the channel runs

        // ── Boring machine (battery-powered) ─────────────────────────────
        this.tunnel            = null;   // { entryY, exitY, len, progressPx, ... }

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

        // The boring machine's art (sliced into tip/spiral/cap at create).
        if (CONFIG.ROAD && CONFIG.ROAD.ENABLED) {
            this.load.image('auger_src', 'graphics/auger.png');
        }

        // Tile map: the level layout (.tmj) plus one image per tile type.
        // The .tmj only carries the grid + tile names; the PNGs live here.
        const TM = CONFIG.ROAD && CONFIG.ROAD.TILEMAP;
        if (TM && TM.ENABLED) {
            this.load.json('level_map', TM.FILE);
            // One spritesheet of 128px frames — dry AND water-filled tiles are
            // all frames in it; TILES maps gids to meaning + filled frame.
            this.load.spritesheet('canal_sheet', TM.SHEET,
                { frameWidth: TM.FRAME, frameHeight: TM.FRAME });
            // Crop growth stages: one sheet per crop, a single row of
            // CROP_STAGES uniform frames. Loaded as plain images; the frame
            // size is derived from each at build (width / stages, full
            // height). Every crop in the level rotation is loaded up front —
            // they are a few hundred KB each and a level can start at any
            // point in the cycle after a rebase.
            for (const c of this._cropCycle()) {
                this.load.image(`${c}_src`, `graphics/crops/${c}.png`);
            }
        }

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

        // partB (top half portrait / right half landscape) — 3 slots + (land | gadget)
        this.createSlots();
        if (CONFIG.ROAD && CONFIG.ROAD.ENABLED) {
            // Right-half pivot: the land and the canal being dug through it.
            this.createRoad();
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

        // Debug: a line marking the partA / partB split — vertical in landscape
        // (left | right), horizontal in portrait (top / bottom). Drawn on the
        // fixed main camera (created before the snapshot so camB ignores it).
        if (CONFIG.DEBUG_HALF_LINE) {
            const W = this.scale.width, H = this.scale.height;
            const dl = this.add.graphics().setDepth(99999);
            dl.lineStyle(Math.max(1, 2 * L.platformScale), 0xff00ff, 0.9);
            if (L.isPortrait) {
                const y = L.partB.y + L.partB.height;   // split between top/bottom halves
                dl.lineBetween(0, y, W, y);
            } else {
                const x = L.partB.x;                     // split between left/right halves
                dl.lineBetween(x, 0, x, H);
            }
        }

        // Endless mode: the landscape camera must ignore every UI/fixed
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
    // LAND / CANAL (right-half pivot)
    // ================================================================
    // The land in partB, and the canal cut up the middle of it. The geometry
    // is just two things: where the channel runs (a centred vertical strip,
    // CANAL.WIDTH wide) and how tall a band one level covers — from the top of
    // the half down to just above the battery slots.
    createRoad() {
        const RC    = CONFIG.ROAD;
        const L     = this.layoutConfig;
        const B     = L.partB;
        const scale = L.platformScale;
        const s     = (v) => v * scale;

        const bottom = (this.junctionY || (B.y + B.height * 0.62)) - s(RC.BOTTOM_GAP);
        const top    = B.y;
        const canalW = s(RC.CANAL.WIDTH);

        this.road = {
            top, bottom, canalW,
            canalCx: B.x + B.width / 2,       // the channel is centred in the half
            band:    null,                    // the live segment's band record
        };

        // ── Tile map: fit the authored grid into the landscape band ────────
        // Rows are fixed by the level; the tile SIZE is derived so the grid is
        // square and fills the band (height-limited on this aspect, otherwise
        // width-limited). The grid is anchored to the BOTTOM of the band (just
        // above the battery slots) and centred horizontally.
        this.tileGrid = null;
        const TM = RC.TILEMAP;
        if (TM && TM.ENABLED) {
            const map  = this.cache.json.get('level_map');
            const cols = map.width, rows = map.height;
            const tile = Math.min((bottom - top) / rows, B.width / cols);
            const gw   = cols * tile, gh = rows * tile;
            // The two centre columns are the 2-wide main canal.
            const mainW = TM.MAIN_TILES || 2;
            const mainRightCol = Math.floor(cols / 2);
            const mainLeftCol  = mainRightCol - (mainW - 1);
            const layer = (name) => {
                const L = map.layers.find((l) => l.name === name);
                return L ? L.data : null;
            };
            this.tileGrid = {
                cols, rows, tile,
                left: B.x + (B.width - gw) / 2,   // centred horizontally
                w: gw, h: gh,
                groundData: layer(TM.GROUND_LAYER) || [],   // plain land
                branchData: layer(TM.BRANCH_LAYER) || [],   // dry branches
                mainData: layer(TM.MAIN_LAYER) || [],       // dug main canal
                cropsData: layer(TM.CROPS_LAYER) || [],     // crop markers (not drawn)
                mainLeftCol, mainRightCol, mainW,
            };
            // The spritesheet frame for a gid is (gid - firstgid); TILES gives
            // each gid its meaning. The water-filled twin is FLOW_OFFSET later.
            this.tileFirstGid = map.tilesets[0].firstgid;
            this.tileMeta = TM.TILES || {};
        }

        // ── Endless mode: a second camera owns the landscape ──────────────
        // The world extends upward one band at a time; camB pans up it while
        // the main camera keeps the merge grid and platform UI fixed. camB's
        // viewport covers ONLY the land band, so the fixed bottom strip
        // (slots/junction) is never overdrawn by panning world. With ENDLESS
        // off, camB is never created and _addB degrades to a plain registry
        // push — behaviour is identical to before.
        this.segments  = [];
        this._worldBSet = new Set();
        this._camBSnapDone = false;   // fresh build (incl. scene.restart on resize) → the set must refill
        this.camB = null;
        if (RC.ENDLESS && RC.ENDLESS.ENABLED) {
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

        this._buildSegment(top, bottom);
    }

    // Register a display object as pannable WORLD content: hidden from the
    // main (UI) camera, tracked in `seg`'s registry for rebase/teardown.
    // Pass seg=null for a world object that belongs to no segment. With
    // endless off there is no camB and this is just the registry push.
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

    // One landscape SEGMENT: the band [bandTop, bandBot] gets its green land
    // and the stretch of canal already built at its foot, plus the machine
    // parked at the head ready to dig the rest. Returns the segment record
    // ({objects, band, tunnel}) used for panning, rebasing and teardown.
    _buildSegment(bandTop, bandBot) {
        const RC = CONFIG.ROAD;
        const s  = (v) => v * this.layoutConfig.platformScale;
        const B  = this.layoutConfig.partB;
        const r  = this.road;

        const seg = { objects: [], band: null, tunnel: null };
        this.segments.push(seg);

        // Tile-map mode: draw the authored grid and stop. No procedural land,
        // no dug canal, no auger — just the level's tiles filling the band.
        if (this.tileGrid) {
            this._buildTileBand(bandTop, bandBot, seg);
            return seg;
        }

        // The band this segment spans, and the head of the canal already built
        // at its foot. The dig runs from that head all the way to bandTop, so a
        // finished segment hands a continuous channel to the next one.
        const band = {
            cx: r.canalCx,
            headY: (bandTop + bandBot) / 2 + s(RC.CANAL.HEAD_OFFSET),
            bandTop, bandBot,
        };
        seg.band = band;
        r.band   = band;

        // The land: flat green, the full width of the half. It is what the
        // auger cuts through — the channel and its soil are drawn over it.
        this._addB(this.add.rectangle(B.x + B.width / 2, (bandTop + bandBot) / 2,
                B.width, bandBot - bandTop, RC.LAND_COLOR)
            .setDepth(1.5), seg);

        // The canal ALREADY built: one stretch, at the BOTTOM of the band,
        // ending in a torn head where the digging takes over. Nothing is
        // pre-built above it — everything from here to the top of the band is
        // untouched ground the machine has to cut. (The raggedness protrudes
        // INTO that ground, never back into the channel, so the newly cut
        // stretch meets this one with no gap.)
        const WA    = RC.WATER;
        const rimW  = Math.max(1, s(WA.EDGE_WIDTH));
        const ragD  = Math.max(2, s(3.5));
        const colW  = Math.max(1, s(1.2));
        const halfW = r.canalW / 2;
        const headY = band.headY;
        const gfx = this._addB(this.add.graphics().setDepth(2), seg);
        gfx.fillStyle(WA.COLOR, 1);
        gfx.fillRect(band.cx - halfW, headY, r.canalW, bandBot - headY);
        for (let cx2 = band.cx - halfW; cx2 < band.cx + halfW; cx2 += colW) {
            const w2 = Math.min(colW, band.cx + halfW - cx2);
            const dB = Math.random() * ragD;
            gfx.fillRect(cx2, headY - dB, w2, dB);
        }
        // Lit shallows hugging both banks — continuous: this is a waterline.
        gfx.fillStyle(WA.EDGE_COLOR, 1);
        for (const edgeX of [band.cx - halfW, band.cx + halfW - rimW]) {
            gfx.fillRect(edgeX, headY, rimW, bandBot - headY);
        }

        this.createTunnel(band, seg);
        return seg;
    }

    // Render one band from the Tiled grid: a green backdrop (shows through any
    // tile transparency) plus one sprite per non-empty cell. The grid is
    // anchored to the BOTTOM of the band so it sits just above the slots; on a
    // taller band any slack falls at the top. Cell (0,0) is the top-left; the
    // data array is row-major (row * cols + col), 0 = empty.
    _buildTileBand(bandTop, bandBot, seg) {
        const g    = this.tileGrid;
        const gTop = bandBot - g.h;            // anchor grid to the band's bottom

        // GROUND (plain land) then BRANCH (the pre-built dry branches on top
        // of it) are drawn statically and always visible, each cell one
        // spritesheet frame. Both come from the same sheet, so they batch as
        // one. The main canal (main_canal_dry layer) is NOT drawn here; the
        // flood system reveals it as the auger digs.
        for (const [data, depth] of [[g.groundData, 1.4], [g.branchData, 1.5]]) {
            for (let row = 0; row < g.rows; row++) {
                for (let col = 0; col < g.cols; col++) {
                    const gid = data[row * g.cols + col];
                    if (!gid) continue;
                    this._addB(this.add.image(
                            g.left + (col + 0.5) * g.tile,
                            gTop   + (row + 0.5) * g.tile,
                            'canal_sheet', gid - this.tileFirstGid)
                        // +1px so neighbours overlap and no sub-pixel gap shows.
                        .setDisplaySize(g.tile + 1, g.tile + 1)
                        .setDepth(depth), seg);
                }
            }
        }

        // The auger digs the 2-wide main canal (the two centre columns),
        // bottom → top, filling it with water in its wake.
        const band = {
            cx:      g.left + (g.mainRightCol) * g.tile,  // boundary between the two
            headY:   gTop + g.h,           // dig starts at the grid's bottom edge
            bandTop: gTop,                 // …and climbs to its top edge
            bandBot: gTop + g.h,
        };
        seg.band = band;
        this.road.band = band;
        // The dug channel is the full width of the main-canal columns.
        this.road.canalW = g.mainW * g.tile;
        this.createTunnel(band, seg);
        this._buildCrops(seg, band);
    }

    // The crop art rotation, in level order. Falls back to the single CROP so
    // a config with no cycle still behaves exactly as before.
    _cropCycle() {
        const TM = CONFIG.ROAD && CONFIG.ROAD.TILEMAP;
        if (!TM) return [];
        const cy = TM.CROP_CYCLE;
        if (Array.isArray(cy) && cy.length) return cy;
        return TM.CROP ? [TM.CROP] : [];
    }

    // Which crop the level being built right now grows. segIndex is the
    // 0-based level counter, so it wraps: 0 tomato, 1 mango, 2 grape, 3 tomato…
    _cropForLevel() {
        const cy = this._cropCycle();
        if (!cy.length) return null;
        const i = this.endless ? this.endless.segIndex : 0;
        return cy[i % cy.length];
    }

    // Plant a crop seed at the centre of every cell marked on the CROPS
    // layer, cache its nearest canal cell, and hold it at stage 1 until the
    // water reaches that cell (see _updateCrops). Sprites keep a bottom-centre
    // origin so taller stages grow upward out of that centre point.
    _buildCrops(seg, band) {
        const TM = CONFIG.ROAD.TILEMAP;
        if (!TM || !this.tileGrid) return;
        const crop = this._cropForLevel();
        if (!crop) return;
        const g = this.tileGrid, gTop = band.bandTop;
        const F = seg.tunnel && seg.tunnel.flood;
        if (!F || !F.cells.size) return;
        const canal = [...F.cells.values()];            // canal cells to search
        // Build a spritesheet texture from this crop's sheet once (keyed per
        // crop, so a revisited crop reuses it), deriving the frame size from
        // the image: a row of CROP_STAGES equal frames, so
        // frameWidth = width / stages and frameHeight = full height. No
        // per-sheet dimensions are hardcoded — drop in a differently sized
        // sheet and it still slices correctly.
        const stages = TM.CROP_STAGES || 5;
        const key    = `${crop}_stages`;
        if (!this.textures.exists(key)) {
            const img = this.textures.get(`${crop}_src`).getSourceImage();
            this.textures.addSpriteSheet(key, img,
                { frameWidth: img.width / stages, frameHeight: img.height });
        }
        const sc    = g.tile / this.textures.getFrame(key, 0).width;   // 128 → one cell
        const crops = seg.crops = [];
        // The CROPS layer is the single source of truth: one plant per marked
        // cell, at that cell's centre. Which gid was used doesn't matter — the
        // layer is never drawn, only tested for a tile. Cells left blank stay
        // bare, which is how canals, the field edges and anything decorated
        // (trees, rocks, buildings) are kept clear.
        for (let r = 0; r < g.rows; r++) {
            for (let c = 0; c < g.cols; c++) {
                if (!g.cropsData[r * g.cols + c]) continue;      // not a crop cell
                // nearest canal cell (Manhattan) — decided once, cached.
                let best = null, bd = Infinity;
                for (const cc of canal) {
                    const d = Math.abs(cc.col - c) + Math.abs(cc.row - r);
                    if (d < bd) { bd = d; best = cc; }
                }
                if (!best) continue;
                const spr = this._addB(this.add.image(
                        g.left + (c + 0.5) * g.tile, gTop + (r + 0.5) * g.tile, key, 0)
                    .setOrigin(0.5, 1).setScale(sc).setDepth(3 + r * 0.001), seg);
                // `sc` is cached per crop so the stage-change spring knows the
                // full y-scale to settle back to. Stage 1 spawns hard, unscaled.
                crops.push({ watch: best, stage: 1, timer: 0, sprite: spr, sc, crop, done: false });
            }
        }
    }

    // Grow crops whose nearest canal cell has been watered: advance one stage
    // every CROP_GROW_MS, swapping the sprite, until the last stage.
    _updateCrops(time) {
        const TM = CONFIG.ROAD.TILEMAP;
        if (!TM || !this._cropCycle().length) return;
        const dt = this._cropT ? Math.min((time - this._cropT) / 1000, 0.1) : 0;
        this._cropT = time;
        if (dt <= 0) return;
        const growS  = (TM.CROP_GROW_MS || 2000) / 1000;
        const stages = TM.CROP_STAGES || 5;
        const wet    = TM.CROP_WET !== undefined ? TM.CROP_WET : 0.15;
        const popFr  = TM.CROP_POP_FROM !== undefined ? TM.CROP_POP_FROM : 0.8;
        const popMs  = TM.CROP_POP_MS   !== undefined ? TM.CROP_POP_MS   : 260;
        for (const seg of this.segments) {
            if (!seg.crops) continue;
            for (const cr of seg.crops) {
                if (cr.done || !cr.watch || cr.watch.progress <= wet) continue;
                cr.timer += dt;
                const st = Math.min(stages, 1 + Math.floor(cr.timer / growS));
                if (st !== cr.stage) {
                    cr.stage = st;
                    cr.sprite.setFrame(st - 1);         // frame 0 = stage 1
                    // Spring the new frame up from a squashed y-scale. Only
                    // reachable for stage 2+, so the seed never animates.
                    if (popFr < 1 && popMs > 0) {
                        if (cr.tw) cr.tw.stop();        // stage skipped mid-spring
                        cr.sprite.scaleY = cr.sc * popFr;
                        cr.tw = this.tweens.add({
                            targets:  cr.sprite,
                            scaleY:   cr.sc,
                            duration: popMs,
                            ease:     'Back.easeOut',
                            onComplete: () => { cr.tw = null; }
                        });
                    }
                    if (st >= stages) cr.done = true;
                }
            }
        }
    }

    // ── Branch-canal water (flood fill) ──────────────────────────────────────
    // The pre-built side canals fill from the main canal outward. As the main
    // waterline rises past a junction row, that junction's side branch is
    // seeded; water then creeps cell-by-cell along the ditches, splitting at
    // every 3-/4-way. One graphics object redraws the whole wet network each
    // frame from a simple per-cell fill model, so nothing pops in whole.

    // Open edges of a gid, from the TILES metadata (conn string, e.g. 'nsw').
    _connOfGid(gid) {
        const c = { n: false, e: false, s: false, w: false };
        const m = this.tileMeta && this.tileMeta[gid];
        if (m && m.conn) for (const ch of m.conn) if (ch in c) c[ch] = true;
        return c;
    }

    // Build the flood model for a band. Returns null when not in tile-map mode.
    //  • MAIN cells (main_canal_dry layer, centre columns): the dug canal — a
    //    hidden DRY sprite revealed as the auger digs, plus a hidden FILLED
    //    sprite revealed as the waterline rises.
    //  • BRANCH cells (base layer canal tiles): already drawn dry and visible;
    //    only a hidden FILLED sprite, revealed by the flood cascade.
    // Filled sprite = the tile FLOW_OFFSET frames on in the sheet.
    _buildFlood(seg, band) {
        if (!this.tileGrid) return null;
        const g = this.tileGrid;
        const gTop = band.bandTop;
        const off  = CONFIG.ROAD.TILEMAP.FLOW_OFFSET || 1;
        const cells = new Map();
        const sprite = (gid, c, r, depth) => this._addB(this.add.image(
                g.left + c * g.tile, gTop + r * g.tile,
                'canal_sheet', gid - this.tileFirstGid)
            .setOrigin(0, 0).setDisplaySize(g.tile + 1, g.tile + 1)   // +1px overlap
            .setDepth(depth).setVisible(false), seg);

        for (let r = 0; r < g.rows; r++) {
            for (let c = 0; c < g.cols; c++) {
                const mainGid = g.mainData[r * g.cols + c] || 0;
                const mConn   = this._connOfGid(mainGid);
                if (mConn.n || mConn.e || mConn.s || mConn.w) {
                    // Main canal cell — dug then watered.
                    cells.set(c + ',' + r, {
                        col: c, row: r, conn: mConn, progress: 0, dryP: 0,
                        entryDir: 's', filling: false, filled: false, isMain: true,
                        dry:  sprite(mainGid,       c, r, 1.52),  // above ground + branch
                        flow: sprite(mainGid + off, c, r, 1.55),
                    });
                    continue;
                }
                const branchGid = g.branchData[r * g.cols + c] || 0;
                const bConn     = this._connOfGid(branchGid);
                if (bConn.n || bConn.e || bConn.s || bConn.w) {
                    // Branch cell — dry tile already static; filled twin only.
                    // A single-connection tile is a dead end (its channel closes
                    // inside), so its water stops short of the far edge.
                    const nConn = (bConn.n ? 1 : 0) + (bConn.e ? 1 : 0)
                                + (bConn.s ? 1 : 0) + (bConn.w ? 1 : 0);
                    cells.set(c + ',' + r, {
                        col: c, row: r, conn: bConn, progress: 0, isEnd: nConn === 1,
                        entryDir: null, filling: false, filled: false, isMain: false,
                        dry: null, flow: sprite(branchGid + off, c, r, 1.55),
                    });
                }
            }
        }
        // Foam is drawn as textured sprites (water frame + 30% white, soft
        // ellipse — baked once). They sit BELOW the revealed water (1.55) so the
        // filling water covers the foam behind its edge and only the leading
        // churn shows. A per-head strip mask keeps them inside the banks.
        this._ensureFoamBlobTexture();
        const foamMask = this._addB(this.add.graphics().setVisible(false), seg);
        foamMask._noRebase = true;
        return { g, cells, active: [], triggered: new Set(),
                 mainLeftCol: g.mainLeftCol, mainRightCol: g.mainRightCol,
                 foamMask, blobMask: foamMask.createGeometryMask(),
                 channelW: this.road.canalW, seg,
                 heads: [], foamBlobs: [], foamWhite: [],
                 headFrame: CONFIG.ROAD.TILEMAP.HEAD_FRAME };
    }

    // Bake the foam textures: a water-texture soft ellipse ('foam_blob') and a
    // matching WHITE soft ellipse ('foam_white') used as a larger backing so
    // each blob gets a white rim.
    _ensureFoamBlobTexture() {
        if (this.textures.exists('foam_blob')) return;
        const S = 64;
        const softEllipse = (ctx) => {              // erase to a soft ellipse
            ctx.globalCompositeOperation = 'destination-in';
            const grad = ctx.createRadialGradient(S / 2, S / 2, S * 0.12, S / 2, S / 2, S * 0.5);
            grad.addColorStop(0, 'rgba(0,0,0,1)');
            grad.addColorStop(0.72, 'rgba(0,0,0,1)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad; ctx.fillRect(0, 0, S, S);
            ctx.globalCompositeOperation = 'source-over';
        };
        // Water blob.
        const tex   = this.textures.get('canal_sheet');
        const frame = tex.get(CONFIG.ROAD.TILEMAP.HEAD_FRAME);
        const blob  = this.textures.createCanvas('foam_blob', S, S);
        const bctx  = blob.getContext();
        bctx.drawImage(tex.getSourceImage(), frame.cutX, frame.cutY,
                       frame.cutWidth, frame.cutHeight, 0, 0, S, S);
        softEllipse(bctx); blob.refresh();
        // White backing.
        const white = this.textures.createCanvas('foam_white', S, S);
        const wctx  = white.getContext();
        wctx.fillStyle = '#ffffff'; wctx.fillRect(0, 0, S, S);
        softEllipse(wctx); white.refresh();
    }

    // Advance EVERY band's branch water — not just the active tunnel's. Once
    // the auger finishes a level `this.tunnel` moves on to the next band, but
    // the band it left behind must keep filling until all its ditches are full.
    _updateFlood(time) {
        const dt = this._floodT ? Math.min((time - this._floodT) / 1000, 0.05) : 0;
        this._floodT = time;
        for (const seg of this.segments) {
            if (seg.tunnel && seg.tunnel.flood) this._updateFloodOne(seg.tunnel, dt, time);
        }
    }

    // True once every branch the water actually reached is full (unreachable
    // ditches, if any, don't count — they'd never fill).
    _floodDone(tn) {
        if (!tn || !tn.flood) return true;
        for (const cell of tn.flood.active) if (!cell.filled) return false;
        return true;
    }

    // Has every crop in this segment reached its last growth stage? `done` is
    // set by _updateCrops the frame a crop hits the final stage. Only meaningful
    // once the flood is finished — a crop whose watched canal cell never fills
    // never starts growing, so this is checked alongside _floodDone, not alone.
    _cropsDone(seg) {
        if (!seg.crops) return true;
        for (const cr of seg.crops) if (!cr.done) return false;
        return true;
    }

    _updateFloodOne(tn, dt, time) {
        const F  = tn.flood, g = F.g;
        // Smooth continuous speed — the branches flow at the main canal's pace.
        const speed = (CONFIG.ROAD.TILEMAP.FLOW_SPEED || CONFIG.ROAD.WATER.MIN_SPEED || 30)
                    * this.layoutConfig.platformScale;
        // [dCol, dRow, oppositeEdge] per direction.
        const DIR  = { n: [0, -1, 's'], e: [1, 0, 'w'], s: [0, 1, 'n'], w: [-1, 0, 'e'] };

        const activate = (col, row, entryDir) => {
            const cell = F.cells.get(col + ',' + row);
            if (!cell || cell.filling || cell.filled || cell.isMain) return;
            cell.entryDir = entryDir; cell.filling = true; cell.progress = 0;
            F.active.push(cell);
        };
        const spawn = (cell, d) => {          // send water into the neighbour in dir d
            const [dc, dr, opp] = DIR[d];
            const nb = F.cells.get((cell.col + dc) + ',' + (cell.row + dr));
            if (nb && nb.conn[opp]) activate(cell.col + dc, cell.row + dr, opp);
        };

        // 0. Main canal: bottom→up, TWO reveals per cell. The DRY tile follows
        //    the auger's dig (progressPx, px dug from the bottom); the FILLED
        //    tile follows the waterline (tn.wet), which lags the blade. Row r's
        //    bottom edge sits (rows-r-1) tiles up from the bottom.
        const cellUp = (row) => (g.rows - row - 1) * g.tile;
        for (const cell of F.cells.values()) {
            if (!cell.isMain) continue;
            cell.entryDir = 's';
            cell.dryP     = Math.max(0, Math.min(1, (tn.progressPx - cellUp(cell.row)) / g.tile));
            cell.progress = Math.max(0, Math.min(1, (tn.wet        - cellUp(cell.row)) / g.tile));
            cell.filled   = cell.progress >= 1;
        }

        // 1. Seed branches as the waterline passes each junction row (its
        //    centre, (rows-r-0.5) tiles up). The 2-wide main canal's LEFT column
        //    can open west (from the main_canal_dry layer), its RIGHT east.
        for (let r = 0; r < g.rows; r++) {
            if (F.triggered.has(r)) continue;
            if (tn.wet >= (g.rows - r - 0.5) * g.tile) {
                F.triggered.add(r);
                const cL = this._connOfGid(g.mainData[r * g.cols + F.mainLeftCol]);
                const cR = this._connOfGid(g.mainData[r * g.cols + F.mainRightCol]);
                if (cL.w) activate(F.mainLeftCol  - 1, r, 'e');
                if (cR.e) activate(F.mainRightCol + 1, r, 'w');
            }
        }

        // 2. Advance every filling cell smoothly. A TURN (a branch perpendicular
        //    to the flow) starts the moment the front passes the cell centre, so
        //    water rounds the corner instead of waiting for the tile to fill;
        //    the straight-through continuation carries on at the far edge.
        if (dt > 0) {
            const endFill = CONFIG.ROAD.TILEMAP.END_FILL || 0.8;
            const endStop = CONFIG.ROAD.TILEMAP.HEAD_END_STOP || 0.5;
            for (const cell of F.active) {
                if (cell.filled) continue;
                const cap = cell.isEnd ? endFill : 1;   // dead ends stop at the closing
                cell.progress = Math.min(cap, cell.progress + speed * dt / g.tile);
                // Dead end: once the head reaches the stop point, SNAP the rest of
                // the tile full instantly (no slow fill behind a vanished head) and
                // finish — so the head never overruns the rounded closing.
                if (cell.isEnd && cell.progress >= endStop) {
                    cell.progress = cap;
                    cell.filled = true;
                    continue;
                }
                const through = cell.entryDir ? DIR[cell.entryDir][2] : null;
                if (!cell.split && cell.progress >= 0.5) {
                    cell.split = true;
                    for (const d of ['n', 'e', 's', 'w']) {
                        if (cell.conn[d] && d !== cell.entryDir && d !== through) spawn(cell, d);
                    }
                }
                if (cell.progress >= cap) {
                    cell.filled = true;
                    if (through && cell.conn[through]) spawn(cell, through);
                }
            }
        }

        // 3. Reveal sprites (the wet TRAIL), then draw a rounded head at each
        //    advancing front. Main cells reveal the DRY tile (by the dig) then
        //    the FILLED tile (by the water); branches reveal only FILLED. The
        //    head sits on the reveal edge and hides its straight line, so the
        //    water reads as a flowing front, not a sliding bar.
        F.foamMask.clear().fillStyle(0xffffff, 1);   // rebuilt per head below
        for (const cell of F.cells.values()) {
            if (cell.isMain) this._revealCrop(cell.dry, cell.dryP, 's');
            this._revealCrop(cell.flow, cell.progress, cell.entryDir);
        }

        // Channel widths (the gap between banks): one tile's fraction for a
        // branch; for the N-wide main only the two outer walls eat in.
        const cf      = CONFIG.ROAD.TILEMAP.CHANNEL_FRAC || 0.5;

        // Heads: a bulge of the WATER TEXTURE at each front (a pooled sprite of
        // the plain water frame), with textured foam blobs churning at the
        // leading edge — the blobs sit below the revealed water so it swallows
        // them behind its edge.
        const fit     = CONFIG.ROAD.TILEMAP.HEAD_FIT || 1;
        const branchW = g.tile * cf * fit;
        const mainChW = g.tile * (g.mainW - 1 + cf) * fit;   // sits inside the banks
        const MOT = { w: [1, 0], e: [-1, 0], n: [0, 1], s: [0, -1] };
        let hi = 0, fbi = 0;
        const putHead = (x, y, mx, my, chW) => {
            const horiz = mx !== 0;
            const ew = horiz ? chW * 0.7 : chW, eh = horiz ? chW : chW * 0.7;
            let spr = F.heads[hi];
            if (!spr) {
                spr = this._addB(this.add.image(0, 0, 'canal_sheet', F.headFrame)
                    .setDepth(1.56).setVisible(false), F.seg);
                spr._noRebase = true;                // repositioned every frame
                F.heads.push(spr);
            }
            spr.setVisible(true).setPosition(x, y).setDisplaySize(ew, eh);
            hi++;
            // Mask strip: channel-wide across, long along the flow (so the
            // forward foam bulge isn't clipped, only the sides).
            if (horiz) F.foamMask.fillRect(x - chW, y - chW / 2, 2 * chW, chW);
            else       F.foamMask.fillRect(x - chW / 2, y - chW, chW, 2 * chW);
            fbi = this._placeFoamBlobs(F, fbi, x, y, mx, my, chW, time);
        };

        for (const cell of F.active) {
            // Shown for every still-filling cell. A dead end is snapped to
            // `filled` the instant its head hits the stop point (see step 2),
            // so this skip also drops its head there — no overrun, no gap.
            if (cell.filled) continue;
            const cx = g.left + (cell.col + 0.5) * g.tile;
            const cy = tn.exitY + (cell.row + 0.5) * g.tile;
            const half = g.tile / 2, p = cell.progress;
            let fx = cx, fy = cy;
            switch (cell.entryDir) {
                case 'w': fx = cx - half + p * g.tile; break;
                case 'e': fx = cx + half - p * g.tile; break;
                case 'n': fy = cy - half + p * g.tile; break;
                case 's': fy = cy + half - p * g.tile; break;
            }
            const m = MOT[cell.entryDir] || [0, 0];
            putHead(fx, fy, m[0], m[1], branchW);
        }
        // Main-canal head: one wide front across the 2-wide channel, riding the
        // waterline up.
        if (tn.wet > 1 && tn.wet < tn.len - 1) {
            const cx = g.left + F.mainRightCol * g.tile;
            const wy = tn.exitY + tn.len - tn.wet;
            putHead(cx, wy, 0, -1, mainChW);
        }
        for (let k = hi; k < F.heads.length; k++) F.heads[k].setVisible(false);
        for (let k = fbi; k < F.foamBlobs.length; k++) F.foamBlobs[k].setVisible(false);
        for (let k = fbi; k < F.foamWhite.length; k++) F.foamWhite[k].setVisible(false);
    }

    // Foam: a few big overlapping textured blobs (long axis along the flow)
    // laid across the channel in a forward-bowed cluster — deepest at the
    // centre — so they merge into a forward-bulging crest. Pooled sprites of
    // the baked foam texture, below the water. Returns the next pool index.
    _placeFoamBlobs(F, fbi, x, y, mx, my, chW, time) {
        const WA = CONFIG.ROAD.WATER;
        const horiz = mx !== 0;             // flow runs left-right?
        const px = -my, py = mx;            // across-channel axis
        const n        = 4;                 // blobs per head
        const spread   = chW * 0.35;        // across half-span of the centres
        const arcDepth = chW * 0.30;        // forward bow at the centre
        const baseFwd  = chW * 0.10;        // whole cluster sits ahead of centre
        const across   = chW * 0.5;         // blob across-diameter
        const LONG     = 1.8;               // stretched along the flow
        const WIDE     = 2;                 // across (perpendicular) side ×2
        const RIM      = 1.18;              // white backing this much larger → rim
        for (let i = 0; i < n; i++) {
            const t   = (i / (n - 1)) * 2 - 1;                 // -1..1 across
            const fwd = baseFwd + arcDepth * (1 - t * t);      // parabolic forward bow
            const jit = Math.sin(i * 3.1 + time / 170) * chW * 0.04;
            const cx  = x + px * (t * spread) + mx * (fwd + jit);
            const cy  = y + py * (t * spread) + my * (fwd + jit);
            const d   = across * (0.85 + 0.15 * Math.sin(time / 130 + i));
            const alongD = d * LONG, acrossD = d * WIDE;   // along flow / perpendicular
            const ew = horiz ? alongD : acrossD, eh = horiz ? acrossD : alongD;
            const grab = (pool, tex, depth) => {
                let s = pool[fbi];
                if (!s) {
                    s = this._addB(this.add.image(0, 0, tex).setDepth(depth).setVisible(false), F.seg);
                    s._noRebase = true; s.setMask(F.blobMask); pool.push(s);
                }
                return s;
            };
            // White backing (larger, behind), then the water blob on top —
            // both share the position/size so the rim animates with the blob.
            grab(F.foamWhite, 'foam_white', 1.525).setVisible(true)
                .setPosition(cx, cy).setDisplaySize(ew * RIM, eh * RIM);
            grab(F.foamBlobs, 'foam_blob', 1.53).setVisible(true)
                .setPosition(cx, cy).setDisplaySize(ew, eh);
            fbi++;
        }
        return fbi;
    }

    // A FIXED crack pattern belonging to the ground down the whole dig column
    // (generated once, in band-relative coords so it never slides with the
    // machine). Earthy wandering lines with a few forks — not zigzag.
    _genCrackPattern(tn) {
        const s     = this.layoutConfig.platformScale;
        const halfW = tn.crackW * 0.5 * (CONFIG.ROAD.TUNNEL.CRACK.WIDTH || 0.55);
        const nMain = Math.max(1, CONFIG.ROAD.TUNNEL.CRACK.LINES || 2);
        const lines = [];
        for (let m = 0; m < nMain; m++) {
            const main = [];
            let dx = (m / Math.max(1, nMain - 1) - 0.5) * halfW * (nMain > 1 ? 1 : 0);
            for (let dY = 0; dY <= tn.len; dY += 5 * s) {
                dx += (Math.random() - 0.5) * 2.2 * s;          // gentle wander, not zigzag
                dx = Math.max(-halfW, Math.min(halfW, dx));
                main.push({ dx, dY });
            }
            lines.push(main);
            // Occasional short forks off the main crack.
            for (let i = 3; i < main.length - 3; i += 3 + Math.floor(Math.random() * 4)) {
                if (Math.random() > 0.5) continue;
                const dir = Math.random() < 0.5 ? -1 : 1;
                let bdx = main[i].dx, bdY = main[i].dY;
                const br = [{ dx: bdx, dY: bdY }];
                for (let j = 0, n = 2 + (Math.random() * 2 | 0); j < n; j++) {
                    bdx += dir * (3 + Math.random() * 2) * s;
                    bdY += (3 + Math.random() * 3) * s;
                    br.push({ dx: bdx, dY: bdY });
                }
                lines.push(br);
            }
        }
        tn.crackLines = lines;
    }

    // Draw only the stretch of the fixed crack pattern within a short window
    // AHEAD of the blade: thick/opaque at the face, thinning and fading out
    // ~a cell ahead. The pattern stays put; only this reveal window moves.
    _drawAugerCrack(tn, time) {
        const C = CONFIG.ROAD.TUNNEL.CRACK;
        const g = tn.crack;
        if (!g || !C || !C.ENABLED) return;
        g.clear();
        if (tn.open || tn.progressPx <= 0 || tn.progressPx >= tn.len - 0.5) return;
        if (!tn.crackLines) this._genCrackPattern(tn);

        const s      = this.layoutConfig.platformScale;
        const reveal = (C.LEN || 22) * s;                       // how far ahead is visible
        const cx = tn.bore.x, ey = tn.entryY, prog = tn.progressPx;
        const col = C.COLOR !== undefined ? C.COLOR : 0x3c2c1a;
        const thNear = Math.max(0.5, (C.THICKNESS || 2) * s), thFar = thNear * 0.3;
        const aNear = C.ALPHA !== undefined ? C.ALPHA : 0.6;

        for (const line of tn.crackLines) {
            for (let i = 0; i < line.length - 1; i++) {
                const a = line[i], b = line[i + 1];
                const ahead = (a.dY + b.dY) / 2 - prog;         // px ahead of the face
                if (ahead < 0 || ahead > reveal) continue;
                const f  = ahead / reveal;                      // 0 at face → 1 at limit
                const th = (thNear + (thFar - thNear) * f) * (1 + 0.18 * Math.sin(time * 0.006 + a.dY)); // pulse thickness only
                g.lineStyle(Math.max(0.4, th), col, aNear * (1 - f));
                g.beginPath();
                g.moveTo(cx + a.dx, ey - a.dY);
                g.lineTo(cx + b.dx, ey - b.dY);
                g.strokePath();
            }
        }
    }

    // Reveal a sprite up to fraction `p`, cropping from the edge `dir` faces
    // (so it wipes on in the flow direction). dir 's' → bottom-up.
    _revealCrop(spr, p, dir) {
        if (!spr) return;
        if (p <= 0.001) { if (spr.visible) spr.setVisible(false); return; }
        if (!spr.visible) spr.setVisible(true);
        if (p >= 0.999) { spr.setCrop(); return; }        // full — no crop
        const W = spr.frame.width, H = spr.frame.height;
        switch (dir) {
            case 'w': spr.setCrop(0, 0, W * p, H); break;
            case 'e': spr.setCrop(W * (1 - p), 0, W * p, H); break;
            case 'n': spr.setCrop(0, 0, W, H * p); break;
            case 's': spr.setCrop(0, H * (1 - p), W, H * p); break;
            default:  spr.setCrop();
        }
    }

    // ================================================================
    // THE BORING MACHINE (battery-powered)
    // ================================================================
    // Merged batteries bank digging distance; the auger cuts the channel
    // bottom → top. The apparent rotation is the barber-pole illusion: a helix
    // spinning about its long axis reads, from above, as its flights sliding
    // ALONG the axis — so the shaft is a TileSprite whose helix texture
    // scrolls, with the cylinder shading baked in per-column (x-only, so
    // scrolling never disturbs it).
    createTunnel(band, seg) {
        const TN = CONFIG.ROAD.TUNNEL;
        const s  = (v) => v * this.layoutConfig.platformScale;
        const r  = this.road;

        // Entry = the head of the canal already built at the bottom of the
        // band. Exit = the TOP of the band, not the far side of some obstacle:
        // this level's dig is everything still dry, so finishing it leaves a
        // continuous channel for the next segment to carry on from.
        const entryY = band.headY;
        const exitY  = band.bandTop;
        const len    = entryY - exitY;

        // The bore is the channel plus a margin of loose ground each side.
        const margin = s(TN.MARGIN);
        const boreW  = r.canalW + margin * 2;
        // The machine is the auger.png art, sliced into tip / spiral / cap by
        // _makeTunnelTextures. Its flight is the widest part, scaled to nearly
        // fill the bore.
        const mw = Math.max(8, Math.round(boreW * (TN.BLADE_DIAM || 0.82)));
        // The soil strip is CHANNEL-sized, not bore-sized: what the blade
        // leaves behind is exactly as wide as the finished canal.
        const cutW = Math.round(r.canalW);
        this._makeTunnelTextures(cutW);

        const bladeLen = s(TN.BLADE_LEN);
        // One uniform scale maps the art onto the machine width; tip and cap
        // keep the art's proportions, the spiral section fills the rest of
        // BLADE_LEN (measured behind the face).
        const sc    = mw / this.textures.get('auger_mid').getSourceImage().width;
        const capH  = this.textures.get('auger_tail').getSourceImage().height * sc;
        const bodyH = Math.max(4, bladeLen - capH);

        // The water for the whole stretch is drawn complete at create and
        // hidden behind a mask that follows the blade, so it appears
        // progressively in the machine's wake (see _paintWater).
        const WA    = CONFIG.ROAD.WATER;
        const halfW = r.canalW / 2;
        // Depth 2.1 puts the water ABOVE the raw soil strip (2.05) and below
        // the machine (2.2): wherever the mask has let it through, the water
        // covers the cut; everywhere else the bare soil shows. No side rim —
        // the lit bank line would break the seam where branches join.
        // The blue water strip and its foam are hidden: in tile-map mode the
        // filled `flow_*` sprites are revealed instead (see the flood system).
        // The objects are kept so the mask/paint code and foam-finger layout
        // still have something to write to, but nothing shows.
        const roadGfx = this._addB(this.add.graphics().setDepth(2.1).setVisible(false), seg);
        roadGfx.fillStyle(WA.COLOR, 1);
        roadGfx.fillRect(band.cx - halfW, exitY, r.canalW, len);

        const foamGfx = this._addB(this.add.graphics().setDepth(2.15).setVisible(false), seg);
        foamGfx._noRebase = true;

        const maskShape = this._addB(this.add.graphics().setVisible(false), seg);
        // Future mask draws use post-rebase coordinates, so the graphics
        // object itself must never be shifted (see _rebaseWorld).
        maskShape._noRebase = true;
        const revealMask = maskShape.createGeometryMask();
        roadGfx.setMask(revealMask);

        // The machine: a FIXED-length rig that climbs with the face — head at
        // the front, a machine-length of auger behind it. It parks at the head
        // of the built canal and digs upward. Drawn above the water it leaves.
        const x = band.cx;
        // The raw cut: a strip of churned soil over the dug wake, face back
        // to the mouth it started from.
        const cut = this._addB(this.add.tileSprite(x, entryY, cutW, 1, 'cut_sand')
            .setOrigin(0.5, 0).setDepth(2.05).setVisible(false), seg);
        // Three stacked slices of the art: pointed tip biting into the face,
        // the spiral section behind it (a TileSprite — scrolling its UVs is
        // the rotation), and the drive cap at the rear. The slice edges all
        // sit at bare-shaft rows, so they join cleanly.
        const head = this._addB(this.add.image(x, entryY, 'auger_tip')
            .setOrigin(0.5, 1).setScale(sc).setDepth(2.25), seg);
        const shaft = this._addB(this.add.tileSprite(x, entryY, mw, bodyH, 'auger_mid')
            .setOrigin(0.5, 0).setTileScale(sc).setDepth(2.2), seg);
        const tail = this._addB(this.add.image(x, entryY + bodyH, 'auger_tail')
            .setOrigin(0.5, 0).setScale(sc).setDepth(2.2), seg);
        const wobble = this.tweens.add({ targets: head, x: x + Math.max(1, s(0.8)),
                          duration: 55, yoyo: true, repeat: -1, paused: true });
        const bore = { x, cut, shaft, tail, head, wobble };

        // No grass overlay in tile-map mode — the base layer already shows
        // grass down the centre, and the flood reveals the dug main-canal tiles
        // over it as the auger climbs.

        // Cracks in the grass just ahead of the blade — drawn over the not-yet
        // dug ground (below the machine), redrawn each frame at the current
        // face, so it must never be shifted by a rebase.
        const crack = this._addB(this.add.graphics().setDepth(2.15), seg);
        crack._noRebase = true;

        // The machine advances off a banked-charge account: one progress
        // value drives the shaft, the mask and the head.
        this.tunnel = {
            entryY, exitY, len, bladeLen, bodyH, texScale: sc,
            progressPx: 0, earnedPx: 0, open: false, lastTime: 0, pulseT: 0,
            wet: 0,                          // how far the water has actually come
            bore, maskShape, foam: foamGfx, crack, crackW: mw, chips: [], debrisAcc: 0,
            flood: this._buildFlood(seg, band),   // canal water (tilemap only)
            seg: seg || null,
            // A dig site built ahead (endless: the NEXT band, while the
            // camera is still down at the current one) stays dormant — no
            // charge banks, no digging — until the camera has arrived and
            // settled (_rebaseWorld arms it). The first segment starts armed.
            ready: this.segments.length <= 1,
        };
        if (seg) seg.tunnel = this.tunnel;
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
        const chipPx = Math.max(2, Math.round((TN.CHIP_SIZE || 10)
                        * this.layoutConfig.platformScale));
        const chip = this.textures.createCanvas('debris_chip', chipPx, chipPx);
        const cc = chip.getContext();
        cc.fillStyle = '#ffffff';
        cc.fillRect(0, 0, chipPx, chipPx);
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

    // One charge tick: slotted batteries bank digging distance.
    // update() spends it — the blade only advances while it's owed distance, so
    // pulling the batteries out visibly stalls the machine.
    _tunnelChargeCycle() {
        const tn = this.tunnel;
        if (!tn || tn.open || !tn.ready) return;

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
        if (!tn || (tn.open && !tn.flooding)) return;
        const dt = tn.lastTime ? Math.min((time - tn.lastTime) / 1000, 0.05) : 0;
        tn.lastTime = time;
        if (dt <= 0) return;

        // Cracks in the grass ahead of the blade — while there's still dig left.
        this._drawAugerCrack(tn, time);

        // Drilling is done: the machine no longer holds the water back, so it
        // runs on to the far mouth — same flow, just a longer way to go.
        if (tn.flooding) {
            this._advanceWater(tn, dt, time, tn.len);
            if (tn.wet >= tn.len - 0.5) {
                tn.flooding = false;
                // Settled: a still, straight-edged canal — no rippling front,
                // and the foam that rode on it is spent.
                if (tn.foam) tn.foam.clear();
                tn.maskShape.clear().fillStyle(0xffffff)
                    .fillRect(0, tn.exitY - 2, this.scale.width, tn.len + 4);
                this._finishStretch(tn);
            }
            return;
        }

        // The water has its own life: it runs BEFORE the drilling branch below,
        // so it keeps creeping up the cut and rippling while the blade rests.
        this._advanceWater(tn, dt, time);

        const remaining = Math.min(tn.earnedPx, tn.len) - tn.progressPx;

        // The machine runs on the battery's 1-second pulse: each charge tick
        // arms a short burst (pulseT). Outside a burst — or with nothing owed —
        // it sits completely dead: no spin, no wobble, no advance.
        if (remaining <= 0.01 || tn.pulseT <= 0) {
            const b = tn.bore;
            if (!b.wobble.isPaused()) { b.wobble.pause(); b.head.x = b.x; }
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

        // The face climbs from the mouth the machine started at.
        const cutH  = tn.progressPx;
        const faceY = tn.entryY - tn.progressPx;
        const b     = tn.bore;
        if (b.wobble.isPaused()) b.wobble.resume();
        // UV scroll = rotation: the spiral marches along the shaft (spoil
        // being augered back out of the cut). tilePositionY is in SOURCE
        // texture pixels, so divide by the display scale to get SCROLL px/s
        // on screen. Winds down over the burst: jolt, then coast.
        b.shaft.tilePositionY -= TN.SCROLL * (0.35 + 0.65 * wind) * dt / tn.texScale;
        b.shaft.y = faceY;
        b.tail.y  = faceY + tn.bodyH;
        b.head.y  = faceY;
        // The soil strip in the wake is no longer shown — the ditch sprite is
        // what gets uncovered as the grass recedes. (The cut sprite is kept only
        // so its width still feeds the foam-finger layout.)

        // Soil chips off the face while cutting.
        tn.debrisAcc += dt;
        if (tn.debrisAcc > 0.04) {
            tn.debrisAcc = 0;
            this._spawnTunnelChip(b, faceY);
        }

        if (tn.progressPx >= tn.len - 0.5) this._breakthrough();
    }

    // ── The waterline ────────────────────────────────────────────────────────
    // The canal fills from its own mouth, and the water is NOT bolted to the
    // machine: the blade opening `LAG` of dry cut ahead of it only sets where
    // the water is ALLOWED to reach. The level itself chases that limit with a
    // damped lag (FLOW_TAU), so it lingers when the blade lurches forward and
    // is still creeping up the cut long after the machine has gone quiet.
    // `limit` overrides where the water is allowed to reach (the final flood
    // passes the full length); by default it's the blade's position less LAG.
    _advanceWater(tn, dt, time, limit) {
        const WA  = CONFIG.ROAD.WATER;
        const lag = tn.bladeLen * (WA.LAG !== undefined ? WA.LAG : 1);
        const target = limit !== undefined
            ? limit
            : Math.max(0, tn.progressPx - lag);
        const gap = target - tn.wet;
        if (gap > 0) {
            const tau = Math.max(0.05, WA.FLOW_TAU || 0.9);
            // Exponential approach — frame-rate independent, and it can never
            // overtake the target however long the frame was. On its own it
            // would crawl to a halt as the gap closes, so a steady minimum
            // creep carries the last stretch home at a believable pace.
            const eased = gap * (1 - Math.exp(-dt / tau));
            const floor = (WA.MIN_SPEED || 0) * this.layoutConfig.platformScale * dt;
            tn.wet = Math.min(target, tn.wet + Math.max(eased, floor));
        }
        this._paintWater(tn, time);
    }

    // Redraw the reveal mask for the current level. The body is one rect; the
    // leading edge is a row of fingers of differing length, each on
    // its own slow phase — a wavering tongue of water instead of a ruled line
    // being towed along. Drawn from scratch every frame: the mask object is
    // never rebased, so these are always current world coordinates.
    _paintWater(tn, time) {
        const WA = CONFIG.ROAD.WATER;
        const g  = tn.maskShape;
        const fm = tn.foam;
        g.clear();
        if (fm) fm.clear();
        if (tn.wet <= 0.5) return;
        g.fillStyle(0xffffff);
        if (fm) fm.fillStyle(WA.FOAM_COLOR !== undefined ? WA.FOAM_COLOR : 0xffffff,
                             WA.FOAM_ALPHA !== undefined ? WA.FOAM_ALPHA : 0.9);

        const W     = this.scale.width;
        const sc    = this.layoutConfig.platformScale;
        const front = Math.min(tn.wet, (WA.FRONT || 12) * sc);
        const foamL = (WA.FOAM || 4) * sc;
        const bulk  = tn.wet - front;
        const cols  = Math.max(3, WA.FRONT_COLS || 7);
        const b     = tn.bore;
        const edge  = tn.entryY - bulk;          // the water fills upward
        if (bulk > 0) g.fillRect(0, edge, W, bulk);

        const cw = b.cut.width / cols;
        const x0 = b.x - b.cut.width / 2;
        for (let i = 0; i < cols; i++) {
            // Two incommensurate waves per finger, so the front never repeats
            // a shape and never pulses in unison.
            const ph = i * 1.7;
            const w  = 0.5 + 0.25 * Math.sin(time / 260 + ph)
                           + 0.25 * Math.sin(time / 430 + ph * 2.3);
            const len = front * (0.15 + 0.85 * w);
            const fx  = x0 + i * cw - 0.5;
            g.fillRect(fx, edge - len, cw + 1, Math.max(0, len));
            // White cap on this finger's tip — same blocky column, so the
            // foam breaks up along the front exactly as the water does.
            const fl = Math.min(len, foamL);
            if (fm && fl > 0.5) fm.fillRect(fx, edge - len, cw + 1, fl);
        }
    }

    // Spoil at the blade: soil augered off the face falls BEHIND the machine,
    // down-screen against the direction of the dig — it can't spread sideways,
    // the sides of the cut are right there. Chips rain from the blade onto the
    // raw cut behind it, plus soft dust puffs sinking the same way. Everything
    // is pooled — chips and puffs share one pool and just swap texture/tint.
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
        const midCol = cols[0], endCol = cols[cols.length - 1];
        const n = 10 + Math.floor(Math.random() * 7);
        for (let i = 0; i < n; i++) {
            const off  = Math.random() - 0.5;          // -0.5..0.5 across the blade
            const frac = Math.abs(off) * 2;            // 0 centre .. 1 at either end
            // Squared so the middle colour dominates and the end tint only shows
            // out at the two extremes of the spray.
            const tint = this._lerpColor(midCol, endCol, frac * frac);
            const chip = grab('debris_chip', 2.3)
                .setTint(tint)
                .setAngle(Math.random() * 90)          // varied square orientation
                .setPosition(b.x + off * b.shaft.width * 0.9,
                             faceY + Math.random() * tn.bodyH * 0.5)
                .setScale(0.8 + Math.random() * 0.8)
                .setAlpha(1);
            this.tweens.add({
                targets:  chip,
                x:        chip.x + (Math.random() - 0.5) * 4,
                y:        chip.y + (14 + Math.random() * 26),
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
                             faceY + Math.random() * tn.bodyH * 0.4)
                .setScale(0.6 + Math.random() * 0.4)
                .setAlpha(0.55);
            this.tweens.add({
                targets:  puff,
                x:        puff.x + (Math.random() - 0.5) * 5,
                y:        puff.y + (10 + Math.random() * 12),
                scale:    puff.scale * (2.2 + Math.random()),
                alpha:    0,
                duration: 450 + Math.random() * 300,
                ease:     'Quad.easeOut',
                onComplete: done(puff),
            });
        }
    }

    // The blade exits the far edge: retire the machines, then flood the last
    // dry stretch — the one the rig was standing on — as TILE_COUNT discrete
    // sections, entry → exit, one per tick. Each section's water replaces its
    // stretch of raw sand, and the canal is only declared through once the
    // last section has filled.
    _breakthrough() {
        const tn = this.tunnel;
        if (tn.open) return;
        tn.open = true;

        this.tweens.killTweensOf(tn.bore.head);
        const parts = [tn.bore.shaft, tn.bore.tail, tn.bore.head];
        this.tweens.add({
            targets: parts,
            alpha: 0, duration: 700,
            onComplete: () => parts.forEach((o) => o.setVisible(false)),
        });

        // The waterline just carries on: it runs from where it was holding
        // (LAG behind the blade) up to the far mouth in one smooth flood —
        // same mask, same soil-recedes-ahead-of-it behaviour as while digging,
        // so the finish reads as the last of the water flowing in rather than
        // as anything being built.
        // No timed flood: the water just keeps flowing at the speed it was
        // already flowing at. The blade is simply no longer holding it back,
        // so its target becomes the far mouth and it runs the last stretch on
        // its own — _updateTunnel keeps stepping it while `flooding` is set.
        tn.flooding = true;
    }

    // This stretch of canal is finished. In endless mode this is also the
    // moment the NEXT band appears above — the machine starts over there —
    // while the finished stretch is held on screen for SETTLE_MS before the
    // camera rides up to the new site.
    _finishStretch(tn) {
        if (this.endless) {
            // A breakthrough during a pan (extreme charge rates) must wait
            // for the rebase — the band above is still occupied until then.
            if (this.endless.panning) this.endless.deferBuild = true;
            else this._buildNextSegment();
            this.time.delayedCall(CONFIG.ROAD.ENDLESS.SETTLE_MS || 5000,
                                  () => this._maybePan());
        }
    }

    // ── Endless progression ──────────────────────────────────────────────────
    // Stack the next band above the world: fresh land, a fresh stretch of
    // built canal at its foot and a machine parked at that head. From here the
    // batteries bank charge toward the NEW machine.
    _buildNextSegment() {
        const E = this.endless;
        const r = this.road;

        E.segIndex++;
        this._buildSegment(r.top - E.segH, r.top);
        E.nextReady = true;
    }

    // Once the finished stretch has been admired: if the next band is
    // waiting, ride up to it.
    _maybePan() {
        const E = this.endless;
        if (!E || !E.nextReady || E.panning) return;
        // Don't move on until the finished band's branches have all filled —
        // let the water reach the end of every ditch first — and then until
        // every crop it waters has grown through to its final stage. The whole
        // point of the level is watching the field come in, so the payoff is
        // never cut short by the pan.
        for (const seg of this.segments) {
            if (!seg.tunnel || !seg.tunnel.open) continue;
            if (!this._floodDone(seg.tunnel) || !this._cropsDone(seg)) {
                this.time.delayedCall(300, () => this._maybePan());
                return;
            }
        }
        E.panning  = true;
        E.nextReady = false;
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
    // never drifts. Everything shifts down by segH — display objects, band
    // and dig anchors — the old segment is destroyed, the camera snaps back,
    // and on screen NOTHING moves: world+camera shift cancel out.
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
        }
        this.segments = [survivor];

        // 2. Shift the survivor's visuals and anchors down into the home band.
        for (const o of survivor.objects) {
            if (!o._noRebase) o.y += segH;
        }
        survivor.band.headY   += segH;
        survivor.band.bandTop += segH;
        survivor.band.bandBot += segH;
        r.band = survivor.band;
        const tn = survivor.tunnel;
        if (tn) {
            tn.entryY += segH; tn.exitY += segH;
            // The reveal mask stays at y=0 (future draws use new coords); if
            // this stretch somehow finished before the rebase, refill the
            // whole span in the new coordinate frame.
            if (tn.open) {
                tn.maskShape.clear().fillStyle(0xffffff)
                    .fillRect(0, tn.exitY - 2, this.scale.width, tn.len + 4);
            }
        }
        // 3. Camera home and stationary — NOW the new site opens for work:
        // the parked machine accepts charge from the next battery tick.
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

    chargeCycle() {
        // Canal pivot: charge powers the boring machine.
        if (CONFIG.ROAD && CONFIG.ROAD.ENABLED) {
            this._tunnelChargeCycle();
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
        // Dev toggle: with the tutorial off there is no mask and no pointer, and
        // play starts immediately (removeStartOverlay's side effects run here).
        if (!CONFIG.POINTER.TUTORIAL_ENABLED) {
            this.startOverlay = null;
            this.startOverlayB = null;
            this.startPointer = null;
            this.hasStartedPlaying = true;
            this.levelUpTimer = this.time.now;
            this.firstLevelUpTimer = true;
            return;
        }
        const W = this.scale.width;
        const H = this.scale.height;
        const L = this.layoutConfig;
        
        // Use actual camera/game dimensions for the overlay rect to ensure full coverage
        const gameW = this.cameras.main.width;
        const gameH = this.cameras.main.height;
        
        const maskColor = parseInt(CONFIG.POINTER.TUTORIAL_MASK_COLOR.substring(1), 16);
        this.startOverlay = this.add.rectangle(gameW / 2, gameH / 2, gameW, gameH, maskColor,
            CONFIG.POINTER.TUTORIAL_MASK_OPACITY).setAlpha(0).setDepth(99);

        // camB renders AFTER the main camera, so the landscape it owns would be
        // painted straight over the mask above and read as "highlighted". Give
        // camB its own copy of the mask, pinned to its viewport (scrollFactor 0
        // so panning can't slide it off), faded in lockstep with the main one.
        this.startOverlayB = null;
        if (this.camB) {
            this.startOverlayB = this._addB(this.add.rectangle(
                this.camB.width / 2, this.camB.height / 2,
                this.camB.width, this.camB.height, maskColor,
                CONFIG.POINTER.TUTORIAL_MASK_OPACITY)
                .setScrollFactor(0).setAlpha(0).setDepth(99), null);
        }

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
                targets: [this.startOverlay, this.startOverlayB].filter(Boolean), alpha: 1,
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
        if (this.startOverlayB) this.startOverlayB.destroy();
        if (this.startPointer) this.startPointer.destroy();
        this.startOverlay = null;
        this.startOverlayB = null;
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
        // Drive the boring machine — and the water it leaves behind.
        if (this.tunnel) this._updateTunnel(time);
        // Spread water from the main canal into the pre-built side branches.
        this._updateFlood(time);
        // Grow crops as the water reaches them.
        this._updateCrops(time);
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
