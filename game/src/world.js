// The game's rules and state, with no drawing and no browser in it: the player
// and the lantern, the waves of shadows, bullets, embers, particles and floating
// score text, the upgrade economy and the win/lose conditions. step() advances
// one fixed step and returns what happened as bit flags, so the caller can play
// a sound or announce it without the world knowing about screens or audio.
// Pools are allocated once at boot; nothing here allocates while playing.

import { BULLET, EMBER, ENEMY, FIELD, LANTERN, PARTICLES, PLAYER, STEP, WAVE } from './config.js';
import { chooseTarget, createEnemy, splitterChildren, steer, typesForWave } from './enemies.js';

export const EVENT_SHOOT = 1;
export const EVENT_HIT = 2;
export const EVENT_DIE = 4;
export const EVENT_PICKUP = 8;
export const EVENT_HURT = 16;
export const EVENT_LANTERN_HIT = 32;
export const EVENT_WAVE = 64;
export const EVENT_WAVE_CLEAR = 128;
export const EVENT_OVER = 256;
export const EVENT_UPGRADE = 512;

export const PHASE_FIGHT = 'fight';
export const PHASE_INTERMISSION = 'intermission';
export const PHASE_UPGRADE = 'upgrade';

const MAX_ENEMIES = 40;
const MAX_BULLETS = 96;
const MAX_EBULLETS = 48;
const MAX_EMBERS = 120;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const player = {
    x: LANTERN.x, y: LANTERN.y + 150,
    radius: PLAYER.radius,
    hp: PLAYER.maxHp, maxHp: PLAYER.maxHp,
    speed: PLAYER.speed, damage: PLAYER.damage, fireRate: PLAYER.fireRate,
    spread: 0, piercing: false,
    invulnerable: 0, fireTimer: 0, angle: -Math.PI / 2,
  };
  const lantern = { x: LANTERN.x, y: LANTERN.y, radius: LANTERN.radius, hp: LANTERN.maxHp, maxHp: LANTERN.maxHp };

  const enemies = [];
  for (let i = 0; i < MAX_ENEMIES; i += 1) enemies.push({ active: false });
  const bullets = [];
  for (let i = 0; i < MAX_BULLETS; i += 1) bullets.push({ active: false, hitSet: new Set() });
  const ebullets = [];
  for (let i = 0; i < MAX_EBULLETS; i += 1) ebullets.push({ active: false });
  const embers = [];
  for (let i = 0; i < MAX_EMBERS; i += 1) embers.push({ active: false });
  const particles = [];
  for (let i = 0; i < PARTICLES.max; i += 1) particles.push({ active: false });
  const floats = [];
  for (let i = 0; i < 24; i += 1) floats.push({ active: false });

  const state = {
    player, lantern, enemies, bullets, ebullets, embers, particles, floats,
    score: 0, kills: 0, emberCount: 0, wave: 0,
    phase: PHASE_FIGHT, phaseTimer: 0,
    spawnQueue: [], spawnTimer: 0,
    shake: 0, banner: '', bannerTimer: 0,
    time: 0, over: false, overReason: '',
    bought: {},
  };

  function reset() {
    player.x = LANTERN.x;
    player.y = LANTERN.y + 150;
    player.hp = PLAYER.maxHp;
    player.maxHp = PLAYER.maxHp;
    player.speed = PLAYER.speed;
    player.damage = PLAYER.damage;
    player.fireRate = PLAYER.fireRate;
    player.spread = 0;
    player.piercing = false;
    player.invulnerable = 0;
    player.fireTimer = 0;
    player.angle = -Math.PI / 2;
    lantern.hp = LANTERN.maxHp;
    lantern.maxHp = LANTERN.maxHp;
    for (const list of [enemies, bullets, ebullets, embers, particles, floats]) {
      for (const item of list) item.active = false;
    }
    state.score = 0;
    state.kills = 0;
    state.emberCount = 0;
    state.wave = 0;
    state.phase = PHASE_FIGHT;
    state.phaseTimer = 0;
    state.spawnQueue = [];
    state.spawnTimer = 0;
    state.shake = 0;
    state.banner = '';
    state.bannerTimer = 0;
    state.time = 0;
    state.over = false;
    state.overReason = '';
    state.bought = {};
    startWave(1);
  }

  /** Build the spawn list for a wave and open with a banner. */
  function startWave(n) {
    state.wave = n;
    state.phase = PHASE_FIGHT;
    const budget = WAVE.baseBudget + WAVE.budgetPerWave * (n - 1);
    const types = typesForWave(n);
    const queue = [];
    let remaining = budget;
    // Brutes and Spitters cost more, so they appear once the budget allows.
    while (remaining > 0) {
      const kind = types[Math.floor(random() * types.length)];
      const cost = ENEMY[kind].cost;
      if (cost > remaining && queue.length > 0) {
        queue.push('shade');
        remaining -= 1;
      } else {
        queue.push(kind);
        remaining -= cost;
      }
    }
    state.spawnQueue = queue;
    state.spawnTimer = 0.8;
    state.banner = `WAVE ${n}`;
    state.bannerTimer = 2.2;
  }

  function freeSlot(list) {
    for (let i = 0; i < list.length; i += 1) if (!list[i].active) return list[i];
    return null;
  }

  function spawnEnemy(kind) {
    const slot = freeSlot(enemies);
    if (!slot) return;
    // Spawn just outside a random edge.
    const edge = Math.floor(random() * 4);
    let x = 0;
    let y = 0;
    if (edge === 0) { x = random() * FIELD.width; y = -30; }
    else if (edge === 1) { x = FIELD.width + 30; y = random() * FIELD.height; }
    else if (edge === 2) { x = random() * FIELD.width; y = FIELD.height + 30; }
    else { x = -30; y = random() * FIELD.height; }
    const fresh = createEnemy(kind, x, y, state.wave, random);
    Object.assign(slot, fresh, { active: true });
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const p = freeSlot(particles);
      if (!p) return;
      const angle = random() * Math.PI * 2;
      const v = speed * (0.4 + random() * 0.8);
      p.active = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(angle) * v;
      p.vy = Math.sin(angle) * v;
      p.life = 0.35 + random() * 0.35;
      p.maxLife = p.life;
      p.size = 2 + random() * 3;
      p.color = color;
    }
  }

  function floatText(x, y, text, color) {
    const f = freeSlot(floats);
    if (!f) return;
    f.active = true;
    f.x = x; f.y = y;
    f.text = text;
    f.color = color;
    f.life = 0.9;
    f.maxLife = 0.9;
  }

  function dropEmbers(x, y, count) {
    for (let i = 0; i < count; i += 1) {
      const e = freeSlot(embers);
      if (!e) return;
      const angle = random() * Math.PI * 2;
      const d = 10 + random() * 26;
      e.active = true;
      e.x = x + Math.cos(angle) * d;
      e.y = y + Math.sin(angle) * d;
      e.vx = Math.cos(angle) * 60;
      e.vy = Math.sin(angle) * 60;
      e.life = 12; // embers linger, then fade
    }
  }

  function fireBullet(angle) {
    const b = freeSlot(bullets);
    if (!b) return;
    b.active = true;
    b.x = player.x + Math.cos(angle) * (player.radius + 6);
    b.y = player.y + Math.sin(angle) * (player.radius + 6);
    b.vx = Math.cos(angle) * PLAYER.bulletSpeed;
    b.vy = Math.sin(angle) * PLAYER.bulletSpeed;
    b.life = PLAYER.bulletRange / PLAYER.bulletSpeed;
    b.damage = player.damage;
    b.piercing = player.piercing;
    b.hitSet.clear();
  }

  function fireEnemyGlob(enemy, tx, ty) {
    const g = freeSlot(ebullets);
    if (!g) return;
    const dx = tx - enemy.x;
    const dy = ty - enemy.y;
    const d = Math.hypot(dx, dy) || 1;
    g.active = true;
    g.x = enemy.x;
    g.y = enemy.y;
    g.vx = (dx / d) * 220;
    g.vy = (dy / d) * 220;
    g.life = 3;
    g.damage = enemy.damage;
    g.radius = 7;
  }

  function killEnemy(enemy, events) {
    enemy.active = false;
    state.kills += 1;
    state.score += enemy.score;
    dropEmbers(enemy.x, enemy.y, enemy.embers);
    burst(enemy.x, enemy.y, enemy.color, PARTICLES.burst, 190);
    floatText(enemy.x, enemy.y - enemy.radius, `+${enemy.score}`, '#e8e4ff');
    if (enemy.kind === 'splitter') {
      for (const child of splitterChildren(enemy)) {
        const slot = freeSlot(enemies);
        if (!slot) break;
        const fresh = createEnemy(child.kind, child.x, child.y, state.wave, random);
        Object.assign(slot, fresh, { active: true });
      }
    }
    return events | EVENT_DIE;
  }

  function gameOver(reason) {
    state.over = true;
    state.overReason = reason;
    state.phase = PHASE_FIGHT;
    burst(player.x, player.y, '#7dd3fc', 40, 260);
    return EVENT_OVER;
  }

  /**
   * One fixed step. `input` is { mx, my, aimX, aimY, firing } — the move
   * vector, the aim point in field coordinates, and whether the fire button
   * is held. Returns event bit flags.
   */
  function step(dt, input) {
    let events = 0;
    state.time += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);
    if (state.bannerTimer > 0) state.bannerTimer -= dt;

    if (state.over) {
      updateParticles(dt);
      updateFloats(dt);
      return events;
    }

    // --- intermission: a breath, then the upgrade menu ---
    if (state.phase === PHASE_INTERMISSION) {
      state.phaseTimer -= dt;
      updateParticles(dt);
      updateFloats(dt);
      updateEmbers(dt);
      if (state.phaseTimer <= 0) {
        state.phase = PHASE_UPGRADE;
      }
      return events;
    }
    if (state.phase === PHASE_UPGRADE) {
      updateParticles(dt);
      updateFloats(dt);
      return events;
    }

    // --- player ---
    const px = player.x + input.mx * player.speed * dt;
    const py = player.y + input.my * player.speed * dt;
    player.x = Math.min(FIELD.width - player.radius, Math.max(player.radius, px));
    player.y = Math.min(FIELD.height - player.radius, Math.max(player.radius, py));
    player.angle = Math.atan2(input.aimY - player.y, input.aimX - player.x);
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);

    player.fireTimer -= dt;
    if (input.firing && player.fireTimer <= 0) {
      const spread = player.spread;
      const shots = spread === 0 ? [0] : spread === 1 ? [-0.11, 0, 0.11] : [-0.2, -0.1, 0, 0.1, 0.2];
      for (const offset of shots) fireBullet(player.angle + offset);
      player.fireTimer = 1 / player.fireRate;
      events |= EVENT_SHOOT;
    }

    // --- spawning ---
    if (state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        const kind = state.spawnQueue.shift();
        spawnEnemy(kind);
        const interval = Math.max(
          WAVE.spawnIntervalMin,
          WAVE.spawnInterval * WAVE.spawnIntervalScale ** (state.wave - 1),
        );
        state.spawnTimer = interval;
      }
    }

    // --- enemies ---
    let aliveEnemies = 0;
    for (const enemy of enemies) {
      if (!enemy.active) continue;
      aliveEnemies += 1;
      if (enemy.flash > 0) enemy.flash -= dt;
      enemy.target = chooseTarget(enemy, player, lantern);
      const tx = enemy.target === 'player' ? player.x : lantern.x;
      const ty = enemy.target === 'player' ? player.y : lantern.y;
      const dir = steer(enemy, tx, ty, dt);
      enemy.x += dir.x * enemy.speed * dt;
      enemy.y += dir.y * enemy.speed * dt;

      // Spitters shoot from range.
      if (enemy.kind === 'spitter') {
        enemy.shootTimer -= dt;
        const d = Math.hypot(tx - enemy.x, ty - enemy.y);
        if (enemy.shootTimer <= 0 && d < 420) {
          fireEnemyGlob(enemy, tx, ty);
          enemy.shootTimer = 2.2 + random() * 0.8;
        }
      }

      // Attacking the lantern.
      const dLantern = Math.hypot(lantern.x - enemy.x, lantern.y - enemy.y);
      if (dLantern < lantern.radius + enemy.radius + 4) {
        enemy.attackTimer -= dt;
        if (enemy.attackTimer <= 0) {
          lantern.hp -= enemy.damage;
          enemy.attackTimer = 0.9;
          burst(lantern.x, lantern.y, '#ffd166', 8, 120);
          state.shake = Math.max(state.shake, 7);
          events |= EVENT_LANTERN_HIT;
          floatText(lantern.x, lantern.y - 40, `-${enemy.damage}`, '#f87171');
          if (lantern.hp <= 0) {
            lantern.hp = 0;
            events |= gameOver('lantern');
            return events;
          }
        }
      }

      // Touching the player.
      const dPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
      if (dPlayer < player.radius + enemy.radius) {
        // Shove the enemy back so it does not sit on top of the player.
        const push = (player.radius + enemy.radius - dPlayer) || 1;
        const nx = (enemy.x - player.x) / (dPlayer || 1);
        const ny = (enemy.y - player.y) / (dPlayer || 1);
        enemy.x += nx * push;
        enemy.y += ny * push;
        if (player.invulnerable === 0) {
          player.hp -= enemy.damage;
          player.invulnerable = PLAYER.invulnerable;
          state.shake = Math.max(state.shake, 10);
          burst(player.x, player.y, '#7dd3fc', 10, 160);
          events |= EVENT_HURT;
          floatText(player.x, player.y - 24, `-${enemy.damage}`, '#f87171');
          if (player.hp <= 0) {
            player.hp = 0;
            events |= gameOver('player');
            return events;
          }
        }
      }
    }

    // --- player bullets ---
    for (const b of bullets) {
      if (!b.active) continue;
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.life <= 0 || b.x < 0 || b.x > FIELD.width || b.y < 0 || b.y > FIELD.height) {
        b.active = false;
        continue;
      }
      for (const enemy of enemies) {
        if (!enemy.active || (b.hitSet && b.hitSet.has(enemy))) continue;
        const rr = enemy.radius + BULLET.radius;
        if (dist2(b.x, b.y, enemy.x, enemy.y) < rr * rr) {
          enemy.hp -= b.damage;
          enemy.flash = 0.09;
          burst(b.x, b.y, '#fde68a', PARTICLES.hit, 110);
          events |= EVENT_HIT;
          if (b.piercing) {
            b.hitSet.add(enemy);
          } else {
            b.active = false;
          }
          if (enemy.hp <= 0) events |= killEnemy(enemy, events);
          if (!b.active) break;
        }
      }
    }

    // --- enemy globs ---
    for (const g of ebullets) {
      if (!g.active) continue;
      g.life -= dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      if (g.life <= 0 || g.x < -20 || g.x > FIELD.width + 20 || g.y < -20 || g.y > FIELD.height + 20) {
        g.active = false;
        continue;
      }
      // Hits the player.
      const dp = Math.hypot(player.x - g.x, player.y - g.y);
      if (dp < player.radius + g.radius && player.invulnerable === 0) {
        g.active = false;
        player.hp -= g.damage;
        player.invulnerable = PLAYER.invulnerable;
        state.shake = Math.max(state.shake, 8);
        events |= EVENT_HURT;
        if (player.hp <= 0) {
          player.hp = 0;
          events |= gameOver('player');
          return events;
        }
        continue;
      }
      // Hits the lantern.
      const dl = Math.hypot(lantern.x - g.x, lantern.y - g.y);
      if (dl < lantern.radius + g.radius) {
        g.active = false;
        lantern.hp -= g.damage;
        state.shake = Math.max(state.shake, 5);
        events |= EVENT_LANTERN_HIT;
        if (lantern.hp <= 0) {
          lantern.hp = 0;
          events |= gameOver('lantern');
          return events;
        }
      }
    }

    // --- embers, particles, floats ---
    updateEmbers(dt);
    updateParticles(dt);
    updateFloats(dt);

    // --- wave clear ---
    if (state.spawnQueue.length === 0 && aliveEnemies === 0) {
      const bonus = WAVE.clearBonus * state.wave;
      state.score += bonus;
      floatText(LANTERN.x, LANTERN.y - 70, `WAVE CLEAR +${bonus}`, '#fbbf24');
      state.phase = PHASE_INTERMISSION;
      state.phaseTimer = WAVE.intermission;
      state.banner = 'WAVE CLEAR';
      state.bannerTimer = 2.2;
      events |= EVENT_WAVE_CLEAR;
    }

    return events;
  }

  function updateEmbers(dt) {
    for (const e of embers) {
      if (!e.active) continue;
      e.life -= dt;
      if (e.life <= 0) {
        e.active = false;
        continue;
      }
      // Drift, then magnet toward the player when close.
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.vx *= 0.92;
      e.vy *= 0.92;
      const d = Math.hypot(player.x - e.x, player.y - e.y);
      if (d < PLAYER.pickupRadius && d > 1) {
        e.x += ((player.x - e.x) / d) * EMBER.magnetSpeed * dt;
        e.y += ((player.y - e.y) / d) * EMBER.magnetSpeed * dt;
      }
      if (d < PLAYER.collectRadius) {
        e.active = false;
        state.emberCount += EMBER.value;
        state.score += EMBER.score;
      }
    }
  }

  function updateParticles(dt) {
    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }
  }

  function updateFloats(dt) {
    for (const f of floats) {
      if (!f.active) continue;
      f.life -= dt;
      if (f.life <= 0) {
        f.active = false;
        continue;
      }
      f.y -= 34 * dt;
    }
  }

  /** Open the next wave from the upgrade menu. */
  function nextWave() {
    startWave(state.wave + 1);
    return EVENT_WAVE;
  }

  reset();
  return { state, reset, step, nextWave };
}
