// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred. The lantern is
// the light: a warm radial glow whose radius shrinks as it is damaged, plus a
// small cool halo around the player. Shadows are dark shapes with glowing
// eyes, so they are readable even outside the light. Flat shapes, canvas text
// for the HUD and panels, and a screen shake on hits.

import { FIELD, FONT, LANTERN, PALETTE } from './config.js';
import { PHASE_UPGRADE } from './world.js';
import { UPGRADES, canBuy, specialNext, upgradeCost } from './upgrades.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

/** The upgrade menu's layout, shared with main.js for click hit-testing. */
export const UPGRADE_LAYOUT = {
  cardsX: 140, cardsY: 210, cardW: 320, cardH: 118, gapX: 20, gapY: 16, cols: 3,
  nextX: 490, nextY: 600, nextW: 300, nextH: 56,
};

export function upgradeCardRect(index) {
  const col = index % UPGRADE_LAYOUT.cols;
  const row = Math.floor(index / UPGRADE_LAYOUT.cols);
  return {
    x: UPGRADE_LAYOUT.cardsX + col * (UPGRADE_LAYOUT.cardW + UPGRADE_LAYOUT.gapX),
    y: UPGRADE_LAYOUT.cardsY + row * (UPGRADE_LAYOUT.cardH + UPGRADE_LAYOUT.gapY),
    w: UPGRADE_LAYOUT.cardW,
    h: UPGRADE_LAYOUT.cardH,
  };
}

export function nextWaveRect() {
  return {
    x: UPGRADE_LAYOUT.nextX, y: UPGRADE_LAYOUT.nextY,
    w: UPGRADE_LAYOUT.nextW, h: UPGRADE_LAYOUT.nextH,
  };
}

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const waveLabel = cachedLabel('WAVE ');
  const emberLabel = cachedLabel('◆ ');
  const finalLabel = cachedLabel('Score ');
  const bestLabel = cachedLabel('Best ');
  const waveReachedLabel = cachedLabel('Wave ');
  const killsLabel = cachedLabel('Shadows banished ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  /** Convert a client (mouse) point to field coordinates. */
  function toField(clientX, clientY) {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) * ratio - view.x) / view.scale,
      y: ((clientY - rect.top) * ratio - view.y) / view.scale,
    };
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight = '') {
    const key = `${weight}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function bar(x, y, w, h, fraction, good, low) {
    context.fillStyle = PALETTE.barBg;
    context.fillRect(x, y, w, h);
    const f = Math.max(0, Math.min(1, fraction));
    context.fillStyle = f > 0.35 ? good : low;
    context.fillRect(x, y, w * f, h);
  }

  function lightRadius(state) {
    const f = state.lantern.hp / state.lantern.maxHp;
    return LANTERN.lightRadiusMin + (LANTERN.lightRadius - LANTERN.lightRadiusMin) * f;
  }

  function drawGlow(x, y, radius, color) {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  function drawField(state) {
    // Ground and a faint grid, so motion reads in the dark.
    context.fillStyle = PALETTE.ground;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.strokeStyle = PALETTE.groundGrid;
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 80; x < FIELD.width; x += 80) {
      context.moveTo(x, 0);
      context.lineTo(x, FIELD.height);
    }
    for (let y = 80; y < FIELD.height; y += 80) {
      context.moveTo(0, y);
      context.lineTo(FIELD.width, y);
    }
    context.stroke();

    // The lantern's light, and a smaller halo around the player.
    context.save();
    context.globalCompositeOperation = 'lighter';
    const lr = lightRadius(state);
    drawGlow(state.lantern.x, state.lantern.y, lr, 'rgba(255, 209, 102, 0.20)');
    drawGlow(state.lantern.x, state.lantern.y, 90, 'rgba(255, 209, 102, 0.30)');
    drawGlow(state.player.x, state.player.y, 110, 'rgba(125, 211, 252, 0.12)');
    context.restore();

    // Embers: small glowing diamonds.
    for (const e of state.embers) {
      if (!e.active) continue;
      const pulse = 0.75 + 0.25 * Math.sin(state.time * 6 + e.x);
      context.save();
      context.globalAlpha = pulse;
      context.fillStyle = PALETTE.ember;
      context.beginPath();
      context.moveTo(e.x, e.y - 7);
      context.lineTo(e.x + 5, e.y);
      context.lineTo(e.x, e.y + 7);
      context.lineTo(e.x - 5, e.y);
      context.closePath();
      context.fill();
      context.fillStyle = PALETTE.emberCore;
      context.beginPath();
      context.arc(e.x, e.y, 2.5, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    // The lantern itself: a little house of light.
    const lantern = state.lantern;
    context.fillStyle = '#78350f';
    context.fillRect(lantern.x - 4, lantern.y + 10, 8, 18); // post
    context.fillStyle = '#f59e0b';
    context.beginPath();
    context.arc(lantern.x, lantern.y, lantern.radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.lanternCore;
    context.beginPath();
    context.arc(lantern.x, lantern.y, lantern.radius - 8, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#92400e';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(lantern.x, lantern.y, lantern.radius, 0, Math.PI * 2);
    context.stroke();
    // A flickering flame.
    const flicker = Math.sin(state.time * 9) * 2;
    context.fillStyle = '#fde68a';
    context.beginPath();
    context.ellipse(lantern.x, lantern.y - 2 + flicker * 0.3, 5, 9 + flicker, 0, 0, Math.PI * 2);
    context.fill();

    // Shadows: dark bodies, glowing eyes, a white flash when hit.
    for (const enemy of state.enemies) {
      if (!enemy.active) continue;
      const flash = enemy.flash > 0;
      context.fillStyle = flash ? '#ffffff' : enemy.color;
      context.strokeStyle = flash ? '#ffffff' : enemy.color;
      if (enemy.kind === 'shade') {
        // A wisp: a circle with a trailing tail.
        context.beginPath();
        context.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.moveTo(enemy.x - enemy.radius * 0.7, enemy.y + 4);
        context.quadraticCurveTo(enemy.x, enemy.y + enemy.radius + 12, enemy.x + enemy.radius * 0.6, enemy.y + 6);
        context.closePath();
        context.fill();
      } else if (enemy.kind === 'splitter') {
        // A diamond that will split.
        context.beginPath();
        context.moveTo(enemy.x, enemy.y - enemy.radius);
        context.lineTo(enemy.x + enemy.radius, enemy.y);
        context.lineTo(enemy.x, enemy.y + enemy.radius);
        context.lineTo(enemy.x - enemy.radius, enemy.y);
        context.closePath();
        context.fill();
      } else if (enemy.kind === 'spitter') {
        // A spiky orb.
        context.beginPath();
        for (let i = 0; i < 8; i += 1) {
          const a = (i / 8) * Math.PI * 2 + state.time * 0.8;
          const r = i % 2 === 0 ? enemy.radius + 6 : enemy.radius - 2;
          const px = enemy.x + Math.cos(a) * r;
          const py = enemy.y + Math.sin(a) * r;
          if (i === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        }
        context.closePath();
        context.fill();
      } else {
        // Brute: a heavy blob with horns.
        context.beginPath();
        context.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.moveTo(enemy.x - enemy.radius * 0.8, enemy.y - enemy.radius * 0.6);
        context.lineTo(enemy.x - enemy.radius * 0.5, enemy.y - enemy.radius - 10);
        context.lineTo(enemy.x - enemy.radius * 0.2, enemy.y - enemy.radius * 0.6);
        context.closePath();
        context.fill();
        context.beginPath();
        context.moveTo(enemy.x + enemy.radius * 0.8, enemy.y - enemy.radius * 0.6);
        context.lineTo(enemy.x + enemy.radius * 0.5, enemy.y - enemy.radius - 10);
        context.lineTo(enemy.x + enemy.radius * 0.2, enemy.y - enemy.radius * 0.6);
        context.closePath();
        context.fill();
      }
      // Eyes, always glowing so the shadow is readable in the dark.
      const angle = Math.atan2(state.player.y - enemy.y, state.player.x - enemy.x);
      const ex = Math.cos(angle);
      const ey = Math.sin(angle);
      context.fillStyle = enemy.eye;
      context.beginPath();
      context.arc(enemy.x + ex * 5 - ey * 5, enemy.y + ey * 5 + ex * 5, 2.6, 0, Math.PI * 2);
      context.arc(enemy.x + ex * 5 + ey * 5, enemy.y + ey * 5 - ex * 5, 2.6, 0, Math.PI * 2);
      context.fill();
      // A thin health bar over hurt brutes and splitters.
      if (enemy.hp < enemy.maxHp && enemy.maxHp >= 30) {
        const w = enemy.radius * 2;
        bar(enemy.x - w / 2, enemy.y - enemy.radius - 12, w, 4, enemy.hp / enemy.maxHp, PALETTE.hpGood, PALETTE.hpLow);
      }
    }

    // Player bullets: bright streaks.
    for (const b of state.bullets) {
      if (!b.active) continue;
      context.strokeStyle = PALETTE.bullet;
      context.lineWidth = 4;
      context.lineCap = 'round';
      context.beginPath();
      context.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      context.lineTo(b.x, b.y);
      context.stroke();
      context.fillStyle = '#fffbeb';
      context.beginPath();
      context.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
      context.fill();
    }

    // Enemy globs: sickly green orbs.
    for (const g of state.ebullets) {
      if (!g.active) continue;
      context.fillStyle = '#a3e635';
      context.beginPath();
      context.arc(g.x, g.y, g.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#d9f99d';
      context.beginPath();
      context.arc(g.x, g.y, 3, 0, Math.PI * 2);
      context.fill();
    }

    // The player: a small warden with a bright core and an aim tick.
    const player = state.player;
    const blink = player.invulnerable > 0 && Math.floor(player.invulnerable * 12) % 2 === 0;
    if (!blink) {
      context.fillStyle = PALETTE.player;
      context.beginPath();
      context.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.playerCore;
      context.beginPath();
      context.arc(player.x, player.y, player.radius - 6, 0, Math.PI * 2);
      context.fill();
      // Aim tick: a short line toward the mouse.
      context.strokeStyle = PALETTE.player;
      context.lineWidth = 3;
      context.lineCap = 'round';
      context.beginPath();
      context.moveTo(player.x + Math.cos(player.angle) * (player.radius + 2), player.y + Math.sin(player.angle) * (player.radius + 2));
      context.lineTo(player.x + Math.cos(player.angle) * (player.radius + 12), player.y + Math.sin(player.angle) * (player.radius + 12));
      context.stroke();
    }

    // Particles.
    for (const p of state.particles) {
      if (!p.active) continue;
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;

    // Floating score text.
    for (const f of state.floats) {
      if (!f.active) continue;
      context.globalAlpha = Math.max(0, f.life / f.maxLife);
      text(f.text, f.x, f.y, 20, f.color, 'center', 'bold ');
    }
    context.globalAlpha = 1;
  }

  function drawHud(state, muted) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 18, 26, PALETTE.text, 'left', 'bold ');
    text(waveLabel(state.wave), FIELD.width / 2, 18, 26, PALETTE.text, 'center', 'bold ');
    text(emberLabel(state.emberCount), FIELD.width - 24, 18, 26, PALETTE.upgrade, 'right', 'bold ');
    // Player HP (top left, under the score) and lantern HP (top centre).
    text('YOU', 24, 56, 15, PALETTE.muted, 'left', 'bold ');
    bar(24, 76, 200, 12, state.player.hp / state.player.maxHp, PALETTE.hpGood, PALETTE.hpLow);
    text('LANTERN', FIELD.width / 2 - 100, 56, 15, PALETTE.muted, 'left', 'bold ');
    bar(FIELD.width / 2 - 100, 76, 200, 12, state.lantern.hp / state.lantern.maxHp, PALETTE.lanternGlow, PALETTE.hpLow);
    if (muted) text('MUTED (M)', FIELD.width - 24, 56, 15, PALETTE.muted, 'right');
  }

  function drawBanner(state) {
    if (state.bannerTimer <= 0 || !state.banner) return;
    const alpha = Math.min(1, state.bannerTimer);
    context.globalAlpha = alpha;
    text(state.banner, FIELD.width / 2, 190, 54, PALETTE.lanternGlow, 'center', 'bold ');
    context.globalAlpha = 1;
  }

  function drawPanel(title, lines, prompt) {
    const width = 640;
    const height = 150 + lines.length * 34 + 64;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    text(title, FIELD.width / 2, y + 66, 46, PALETTE.text, 'center', 'bold ');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 122 + i * 34, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 36, 22, PALETTE.upgrade, 'center', 'bold ');
  }

  function drawUpgrade(state) {
    // Dim the field behind the menu.
    context.fillStyle = 'rgba(3, 5, 10, 0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    text('WAVE CLEAR', FIELD.width / 2, 92, 44, PALETTE.lanternGlow, 'center', 'bold ');
    text(`Spend your embers, then face wave ${state.wave + 1}.`, FIELD.width / 2, 140, 21, PALETTE.muted, 'center');
    text(`◆ ${state.emberCount} embers`, FIELD.width / 2, 176, 26, PALETTE.upgrade, 'center', 'bold ');

    for (let i = 0; i < UPGRADES.length; i += 1) {
      const upgrade = UPGRADES[i];
      const rect = upgradeCardRect(i);
      const bought = state.bought[upgrade.id] || 0;
      const cost = upgradeCost(upgrade, bought);
      const affordable = canBuy(upgrade, state);
      const desc = upgrade.id === 'special' ? specialNext(state) : upgrade.desc;
      context.fillStyle = affordable ? '#131c2e' : '#0b0f1a';
      context.fillRect(rect.x, rect.y, rect.w, rect.h);
      context.strokeStyle = affordable ? PALETTE.upgrade : PALETTE.panelEdge;
      context.lineWidth = affordable ? 2 : 1;
      context.strokeRect(rect.x, rect.y, rect.w, rect.h);
      text(`${upgrade.key}. ${upgrade.name}`, rect.x + 16, rect.y + 30, 20, affordable ? PALETTE.text : PALETTE.muted, 'left', 'bold ');
      text(desc, rect.x + 16, rect.y + 58, 16, PALETTE.muted, 'left');
      text(`◆ ${cost}`, rect.x + 16, rect.y + 92, 18, affordable ? PALETTE.upgrade : PALETTE.muted, 'left', 'bold ');
      if (bought > 0) text(`owned ×${bought}`, rect.x + rect.w - 16, rect.y + 92, 16, PALETTE.muted, 'right');
    }

    const next = nextWaveRect();
    context.fillStyle = PALETTE.upgrade;
    context.fillRect(next.x, next.y, next.w, next.h);
    text(`NEXT WAVE  →`, next.x + next.w / 2, next.y + 37, 24, '#1c1005', 'center', 'bold ');
    text('or press Space', FIELD.width / 2, next.y + next.h + 30, 16, PALETTE.muted, 'center');
  }

  const TITLE_LINES = [
    'The lantern is the only light. The shadows want it.',
    'Move with WASD or arrows. Aim with the mouse, hold click to shoot.',
    'Shadows drop embers — spend them between waves to grow stronger.',
    'If you fall, or the lantern goes out, the dark wins.',
    '',
  ];
  const PAUSED_LINES = ['The shadows wait for you.'];

  /** Paint one frame: the field, the HUD, and the panel for the screen. */
  function draw(state, screen, best, muted) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    // Screen shake: a small random offset while the shake timer runs.
    const shake = state.shake;
    const sx = shake > 0 ? (Math.random() * 2 - 1) * shake : 0;
    const sy = shake > 0 ? (Math.random() * 2 - 1) * shake : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + sx * view.scale, view.y + sy * view.scale);
    drawField(state);
    if (screen === SCREEN_TITLE) {
      drawPanel('LUMEN', [...TITLE_LINES.slice(0, 4), bestLabel(best)], 'Click or press Space to begin');
      return;
    }
    drawHud(state, muted);
    drawBanner(state);
    if (screen === SCREEN_UPGRADE) drawUpgrade(state);
    else if (screen === SCREEN_PAUSED) drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    else if (screen === SCREEN_OVER) {
      const reason = state.overReason === 'lantern'
        ? 'The lantern went out.'
        : 'You fell in the dark.';
      drawPanel('Game over', [
        reason,
        finalLabel(state.score),
        waveReachedLabel(state.wave),
        killsLabel(state.kills),
        bestLabel(best),
      ], 'Click or press Space to play again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toField };
}
