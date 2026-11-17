// Enemy definitions and behaviour. An enemy is a dark shape with glowing eyes
// that hunts the nearest thing it wants — the player or the lantern. Each type
// has one clear personality: the Shade is fast and frail, the Brute is slow and
// heavy and prefers the lantern, the Splitter breaks into two Shades when it
// dies, and the Spitter keeps its distance and fires globs. Nothing here draws
// or owns the world; it only answers "what kind" and "where does it go next".

import { ENEMY } from './config.js';

export const KIND_SHADE = 'shade';
export const KIND_SPLITTER = 'splitter';
export const KIND_SPITTER = 'spitter';
export const KIND_BRUTE = 'brute';

/** Which types a wave may spawn. Brutes and Spitters join from wave 2 and 3. */
export function typesForWave(wave) {
  const types = [KIND_SHADE, KIND_SPLITTER];
  if (wave >= 2) types.push(KIND_BRUTE);
  if (wave >= 3) types.push(KIND_SPITTER);
  return types;
}

/** A fresh enemy of `kind` at the field edge, with wave-scaled stats. */
export function createEnemy(kind, x, y, wave, random) {
  const base = ENEMY[kind];
  const hpScale = 1 + (wave - 1) * 0.12;
  const speedScale = 1 + Math.min(0.35, (wave - 1) * 0.03);
  return {
    kind,
    x, y,
    radius: base.radius,
    hp: Math.round(base.hp * hpScale),
    maxHp: Math.round(base.hp * hpScale),
    speed: base.speed * speedScale,
    damage: base.damage,
    score: base.score,
    embers: base.embers,
    color: base.color,
    eye: base.eye,
    target: 'player', // 'player' | 'lantern'
    attackTimer: 0, // cooldown between attacks on the lantern
    shootTimer: 1 + random() * 1.5, // spitters only
    flash: 0, // white flash timer after a hit
    wobble: random() * Math.PI * 2, // per-enemy phase for the walk sway
    active: true,
  };
}

/**
 * Pick what this enemy hunts. Brutes always want the lantern; the rest take
 * whichever is nearer — the player or the lantern.
 */
export function chooseTarget(enemy, player, lantern) {
  if (enemy.kind === KIND_BRUTE) return 'lantern';
  const dPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
  const dLantern = Math.hypot(lantern.x - enemy.x, lantern.y - enemy.y);
  return dPlayer <= dLantern ? 'player' : 'lantern';
}

/**
 * Where the enemy moves this step. Returns a unit vector. Spitters stop at
 * range and strafe; everything else walks straight at its target.
 */
export function steer(enemy, targetX, targetY, dt) {
  const dx = targetX - enemy.x;
  const dy = targetY - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;
  if (enemy.kind === KIND_SPITTER) {
    enemy.wobble += dt * 1.5;
    const holdRange = 260;
    if (distance < holdRange - 30) return { x: -dx / distance, y: -dy / distance }; // too close: back off
    if (distance > holdRange + 40) return { x: dx / distance, y: dy / distance }; // too far: close in
    // At range: strafe sideways, slowly circling the target.
    const side = Math.sin(enemy.wobble) > 0 ? 1 : -1;
    return { x: (-dy / distance) * side * 0.7, y: (dx / distance) * side * 0.7 };
  }
  // A little wobble so a pack does not walk in a perfect straight line.
  enemy.wobble += dt * 2.2;
  const wobble = Math.sin(enemy.wobble) * 0.25;
  const nx = dx / distance;
  const ny = dy / distance;
  const wx = nx - ny * wobble;
  const wy = ny + nx * wobble;
  const len = Math.hypot(wx, wy) || 1;
  return { x: wx / len, y: wy / len };
}

/** Where a Splitter's two children appear when it dies. */
export function splitterChildren(enemy) {
  return [
    { kind: KIND_SHADE, x: enemy.x - 14, y: enemy.y },
    { kind: KIND_SHADE, x: enemy.x + 14, y: enemy.y },
  ];
}
