// Keyboard and pointer input. Held keys give a 2D steering vector; the mouse
// gives an aim point in field coordinates and a held fire button. One-shot
// presses (start, pause, mute, upgrade keys) are queued as bit flags and taken
// once by the loop, so a press between two frames is never lost or counted
// twice. A click on the canvas also confirms (start / next wave / restart).

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);
/** Upgrade hotkeys 1..6, read by the upgrade screen. */
export const UPGRADE_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'];

export function createInput(canvas, toField) {
  const keys = { up: false, down: false, left: false, right: false };
  let actions = 0;
  let upgradePressed = -1; // index 0..5, or -1
  const mouse = { x: 0, y: 0, down: false, clicked: false, clickX: 0, clickY: 0 };

  function setKey(code, value) {
    if (UP.has(code)) keys.up = value;
    else if (DOWN.has(code)) keys.down = value;
    else if (LEFT.has(code)) keys.left = value;
    else if (RIGHT.has(code)) keys.right = value;
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      setKey(event.code, true);
      event.preventDefault();
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
      event.preventDefault();
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (UPGRADE_KEYS.includes(event.code)) {
      if (!event.repeat) upgradePressed = UPGRADE_KEYS.indexOf(event.code);
    } else {
      return;
    }
  });
  window.addEventListener('keyup', (event) => {
    setKey(event.code, false);
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    keys.up = false;
    keys.down = false;
    keys.left = false;
    keys.right = false;
    mouse.down = false;
  });

  function trackMouse(event) {
    const point = toField(event.clientX, event.clientY);
    mouse.x = point.x;
    mouse.y = point.y;
  }
  canvas.addEventListener('pointermove', trackMouse);
  canvas.addEventListener('pointerdown', (event) => {
    trackMouse(event);
    mouse.down = true;
    mouse.clicked = true;
    mouse.clickX = mouse.x;
    mouse.clickY = mouse.y;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });

  return {
    /** Normalised steering vector {x, y} from the held movement keys. */
    moveVector() {
      const x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      const y = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const length = Math.hypot(x, y);
      return { x: x / length, y: y / length };
    },
    mouse,
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The upgrade hotkey pressed since the last call (0..5), or -1. */
    takeUpgrade() {
      const taken = upgradePressed;
      upgradePressed = -1;
      return taken;
    },
    /** A canvas click since the last call, in field coordinates, or null. */
    takeClick() {
      if (!mouse.clicked) return null;
      mouse.clicked = false;
      return { x: mouse.clickX, y: mouse.clickY };
    },
  };
}
