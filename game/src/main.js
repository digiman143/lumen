// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between five screens: title, play,
// upgrade (between waves), paused and game over. Sounds fire on the world's
// events; the best score is kept in local storage.
//
// ?seed=N fixes the random pattern. ?shot=start|play|upgrade|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot. window.__lumen exposes the live
// state for automated play and testing.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import {
  EVENT_DIE, EVENT_HURT, EVENT_HIT, EVENT_LANTERN_HIT, EVENT_OVER,
  EVENT_PICKUP, EVENT_SHOOT, EVENT_UPGRADE, EVENT_WAVE, EVENT_WAVE_CLEAR,
  PHASE_UPGRADE, createWorld,
} from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import {
  SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE,
  createRenderer, nextWaveRect, upgradeCardRect,
} from './render.js';
import { UPGRADES, buyUpgrade } from './upgrades.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, renderer.toField);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Defend the lantern.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    audio.gameOver();
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function playEventSounds(events) {
    if (events & EVENT_SHOOT) audio.shoot();
    if (events & EVENT_HIT) audio.hit();
    if (events & EVENT_DIE) audio.die();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_HURT) audio.hurt();
    if (events & EVENT_LANTERN_HIT) audio.lanternHit();
    if (events & EVENT_WAVE) audio.wave();
    if (events & EVENT_WAVE_CLEAR) audio.wave();
    if (events & EVENT_UPGRADE) audio.upgrade();
  }

  function tryBuy(index) {
    const upgrade = UPGRADES[index];
    if (!upgrade) return;
    if (buyUpgrade(upgrade, world.state)) {
      audio.upgrade();
      announce(`${upgrade.name} bought. ${world.state.emberCount} embers left.`);
    }
  }

  function handleUpgradeClick(point) {
    for (let i = 0; i < UPGRADES.length; i += 1) {
      const rect = upgradeCardRect(i);
      if (point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h) {
        tryBuy(i);
        return true;
      }
    }
    const next = nextWaveRect();
    if (point.x >= next.x && point.x <= next.x + next.w && point.y >= next.y && point.y <= next.y + next.h) {
      audio.unlock();
      world.nextWave();
      screen = SCREEN_PLAY;
      announce(`Wave ${world.state.wave}. Defend the lantern.`);
      return true;
    }
    return false;
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen === SCREEN_UPGRADE) {
      const upgradeIndex = input.takeUpgrade();
      if (upgradeIndex >= 0) tryBuy(upgradeIndex);
      const click = input.takeClick();
      if (click) handleUpgradeClick(click);
      else if (actions & ACTION_CONFIRM) {
        audio.unlock();
        world.nextWave();
        screen = SCREEN_PLAY;
        announce(`Wave ${world.state.wave}. Defend the lantern.`);
      }
    }
  }

  function step() {
    if (screen !== SCREEN_PLAY) return;
    const move = input.moveVector();
    const events = world.step(STEP, {
      mx: move.x, my: move.y,
      aimX: input.mouse.x, aimY: input.mouse.y,
      firing: input.mouse.down,
    });
    playEventSounds(events);
    if (world.state.over) {
      endGame();
      return;
    }
    if (world.state.phase === PHASE_UPGRADE) {
      screen = SCREEN_UPGRADE;
      // Drain any click left over from shooting, so it cannot buy or skip.
      input.takeClick();
      announce(`Wave ${world.state.wave} clear. Spend your embers.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, audio.muted);
  }

  // Leaving the tab pauses a running game rather than letting shadows hunt unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // A live handle for automated play and testing (does not affect the game).
  window.__lumen = {
    get state() { return world.state; },
    get screen() { return screen; },
    get best() { return best; },
    world,
    start: startGame,
  };

  announce('Lumen. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
