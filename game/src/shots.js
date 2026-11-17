// The screenshot scenes behind ?shot=start|play|upgrade|end. Each one plays the
// real rules forward from a fresh world, steered by a simple autopilot (aim at
// the nearest shadow, fire, keep a little distance, chase nearby embers, and
// stay near the lantern), so the frame is what a short game really looks like
// and the same seed always gives the same frame. The end scene uses a timid
// pilot that never fires, so the dark catches it the way it catches a player
// who freezes.

import { LANTERN, STEP } from './config.js';
import { PHASE_UPGRADE } from './world.js';
import { UPGRADES, buyUpgrade } from './upgrades.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE } from './render.js';

const START_SECONDS = 4;
const PLAY_SECONDS = 60;
const PLAY_TARGET_WAVE = 3;
const UPGRADE_LIMIT_SECONDS = 180;
const END_PLAY_SECONDS = 45;
const END_LIMIT_SECONDS = 240;

function activeEnemies(state) {
  let count = 0;
  for (const enemy of state.enemies) if (enemy.active) count += 1;
  return count;
}

/** Spend embers on the best affordable upgrades, then open the next wave. */
function advanceWave(world) {
  if (world.state.phase !== PHASE_UPGRADE) return;
  const state = world.state;
  // Priority: damage, fire rate, lantern repair when hurt, then the rest.
  const priority = ['damage', 'firerate', 'repair', 'maxhp', 'speed', 'special'];
  for (const id of priority) {
    const upgrade = UPGRADES.find((u) => u.id === id);
    if (upgrade) buyUpgrade(upgrade, state);
  }
  world.nextWave();
}

function nearestEnemyToLantern(state) {
  let best = null;
  let bestD = Infinity;
  for (const enemy of state.enemies) {
    if (!enemy.active) continue;
    const d = Math.hypot(enemy.x - LANTERN.x, enemy.y - LANTERN.y);
    if (d < bestD) {
      bestD = d;
      best = enemy;
    }
  }
  return best === null ? null : { enemy: best, distance: bestD };
}

function nearestEnemy(state) {
  let best = null;
  let bestD = Infinity;
  for (const enemy of state.enemies) {
    if (!enemy.active) continue;
    const d = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y);
    if (d < bestD) {
      bestD = d;
      best = enemy;
    }
  }
  return best === null ? null : { enemy: best, distance: bestD };
}

function nearestEmber(state) {
  let best = null;
  let bestD = Infinity;
  for (const ember of state.embers) {
    if (!ember.active) continue;
    const d = Math.hypot(ember.x - state.player.x, ember.y - state.player.y);
    if (d < bestD) {
      bestD = d;
      best = ember;
    }
  }
  return best === null ? null : { ember: best, distance: bestD };
}

/**
 * The autopilot's input for one step. `orbit` is a slowly turning angle the
 * pilot circles the lantern on when there is nothing urgent to do.
 */
function autopilot(state, orbit) {
  const player = state.player;
  // Defend the lantern first: shoot the shadow nearest to it, not to you.
  const threat = nearestEnemyToLantern(state);
  const foe = nearestEnemy(state);
  const target = threat || foe;
  const aimX = target ? target.enemy.x : LANTERN.x;
  const aimY = target ? target.enemy.y : LANTERN.y;
  const firing = target !== null && Math.hypot(target.enemy.x - player.x, target.enemy.y - player.y) < 520;

  let mx = 0;
  let my = 0;
  if (foe && foe.distance < 100) {
    // Too close: back away from the shadow.
    mx = (player.x - foe.enemy.x) / foe.distance;
    my = (player.y - foe.enemy.y) / foe.distance;
  } else {
    const ember = nearestEmber(state);
    if (ember && ember.distance < 220) {
      mx = (ember.ember.x - player.x) / ember.distance;
      my = (ember.ember.y - player.y) / ember.distance;
    } else {
      // Patrol a ring around the lantern.
      const tx = LANTERN.x + Math.cos(orbit) * 210;
      const ty = LANTERN.y + Math.sin(orbit) * 150;
      const d = Math.hypot(tx - player.x, ty - player.y);
      if (d > 12) {
        mx = (tx - player.x) / d;
        my = (ty - player.y) / d;
      }
    }
  }
  const len = Math.hypot(mx, my) || 1;
  return { mx: mx / len, my: my / len, aimX, aimY, firing };
}

/** A pilot that never fires and never moves — the dark catches it. */
function timidPilot(state) {
  const foe = nearestEnemy(state);
  return {
    mx: 0, my: 0,
    aimX: foe ? foe.enemy.x : LANTERN.x,
    aimY: foe ? foe.enemy.y : LANTERN.y,
    firing: false,
  };
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best score to show. Unknown names stage the title.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name === 'play') {
    // Play well, advancing through each upgrade menu, until wave 3 is busy.
    let orbit = 0;
    for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
      orbit += STEP * 0.5;
      advanceWave(world);
      world.step(STEP, autopilot(state, orbit));
      if (state.over) break;
      if (state.wave >= PLAY_TARGET_WAVE && activeEnemies(state) >= 4) break;
    }
    return { screen: state.over ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
  }
  if (name === 'upgrade') {
    let orbit = 0;
    for (let i = 0; i < UPGRADE_LIMIT_SECONDS / STEP; i += 1) {
      orbit += STEP * 0.5;
      world.step(STEP, autopilot(state, orbit));
      if (state.over) break;
      if (state.phase === PHASE_UPGRADE) break;
    }
    if (state.phase === PHASE_UPGRADE) return { screen: SCREEN_UPGRADE, best: state.score };
    return { screen: state.over ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
  }
  if (name === 'end') {
    // Fight well for a while, so the fall has a real score behind it, then
    // freeze: the dark catches a player who stops shooting.
    let orbit = 0;
    for (let i = 0; i < END_PLAY_SECONDS / STEP; i += 1) {
      orbit += STEP * 0.5;
      advanceWave(world);
      world.step(STEP, autopilot(state, orbit));
      if (state.over) break;
    }
    if (!state.over) {
      for (let i = 0; i < END_LIMIT_SECONDS / STEP; i += 1) {
        advanceWave(world);
        world.step(STEP, timidPilot(state));
        if (state.over) break;
      }
    }
    return { screen: state.over ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
  }
  // Title: a few seconds of the real game running behind the panel.
  let orbit = 0;
  for (let i = 0; i < START_SECONDS / STEP; i += 1) {
    orbit += STEP * 0.5;
    world.step(STEP, autopilot(state, orbit));
    if (state.over) break;
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
