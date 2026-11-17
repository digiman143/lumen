// Lumen — every tuning number and colour in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below
// depends on the screen size. The lantern sits at the exact centre and is the
// thing the player defends.

export const FIELD = { width: 1280, height: 720 };

export const LANTERN = {
  x: FIELD.width / 2,
  y: FIELD.height / 2,
  radius: 26,
  maxHp: 100,
  /** Light radius at full health; it shrinks as the lantern is damaged. */
  lightRadius: 340,
  lightRadiusMin: 170,
};

export const PLAYER = {
  radius: 14,
  speed: 275,
  maxHp: 100,
  fireRate: 4.5, // shots per second
  damage: 12,
  bulletSpeed: 580,
  bulletRange: 480,
  bulletRadius: 5,
  pickupRadius: 96, // embers drift toward the player inside this radius
  collectRadius: 26,
  invulnerable: 1.0, // seconds of mercy after taking a hit
  contactDamage: 12, // damage an enemy deals on touch
};

export const BULLET = {
  radius: 5,
};

/** Embers are both currency and score. */
export const EMBER = {
  radius: 7,
  magnetSpeed: 320,
  value: 1,
  score: 2,
};

/** Enemy types. hp and speed grow a little with the wave (see enemies.js). */
export const ENEMY = {
  shade: {
    kind: 'shade', name: 'Shade',
    radius: 13, hp: 22, speed: 165, damage: 8, score: 10, embers: 1,
    cost: 1, color: '#8b7ff0', eye: '#e8e4ff',
  },
  splitter: {
    kind: 'splitter', name: 'Splitter',
    radius: 17, hp: 34, speed: 105, damage: 10, score: 15, embers: 2,
    cost: 2, color: '#2dd4bf', eye: '#d8fff8',
  },
  spitter: {
    kind: 'spitter', name: 'Spitter',
    radius: 16, hp: 30, speed: 95, damage: 6, score: 20, embers: 2,
    cost: 3, color: '#a3e635', eye: '#f7fee7',
  },
  brute: {
    kind: 'brute', name: 'Brute',
    radius: 26, hp: 95, speed: 58, damage: 18, score: 30, embers: 3,
    cost: 4, color: '#f43f5e', eye: '#ffe4e6',
  },
};

/** How many spawn "points" a wave is worth, and how fast they arrive. */
export const WAVE = {
  baseBudget: 6,
  budgetPerWave: 4,
  spawnInterval: 1.15, // seconds between spawns at wave 1
  spawnIntervalMin: 0.35,
  spawnIntervalScale: 0.92, // multiplier per wave
  maxAlive: 18,
  intermission: 2.5, // seconds of quiet before the upgrade menu opens
  clearBonus: 100, // score for clearing a wave, times the wave number
};

export const PARTICLES = {
  max: 420,
  burst: 14, // particles on an enemy death
  hit: 5, // particles when a bullet lands
};

/** Fixed simulation step: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'lumen.best';

export const PALETTE = {
  backdrop: '#05060a',
  ground: '#0a0d16',
  groundGrid: '#12172a',
  lanternGlow: '#ffd166',
  lanternCore: '#fff3c4',
  player: '#7dd3fc',
  playerCore: '#e0f2fe',
  bullet: '#fde68a',
  ember: '#fbbf24',
  emberCore: '#fef3c7',
  text: '#f1f5f9',
  muted: '#94a3b8',
  danger: '#f87171',
  panel: '#0f172acc',
  panelEdge: '#334155',
  barBg: '#1e293b',
  hpGood: '#4ade80',
  hpLow: '#f87171',
  upgrade: '#fbbf24',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
