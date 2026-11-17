// Keyboard and mouse, reduced to what the game needs: which keys are held
// down, which action keys were tapped since the last frame, and where the
// mouse points. Taps are edge-triggered — a tap is consumed exactly once —
// and the frame loop, not the world, owns pause, mute and confirm, so the
// world only ever sees interact and reload.

export const KEY_CONFIRM = 1;
export const KEY_PAUSE = 2;
export const KEY_MUTE = 4;
export const KEY_INTERACT = 8;
export const KEY_RELOAD = 16;

// Which physical key raises which action bit. Checked against event.key,
// so shift-letter variants count too.
const KEY_ACTIONS = {
  Enter: KEY_CONFIRM,
  ' ': KEY_CONFIRM,
  Escape: KEY_PAUSE,
  p: KEY_PAUSE,
  P: KEY_PAUSE,
  m: KEY_MUTE,
  M: KEY_MUTE,
  e: KEY_INTERACT,
  E: KEY_INTERACT,
  r: KEY_RELOAD,
  R: KEY_RELOAD,
};

// Keys that would rather scroll the page than play the game.
const SCROLL_KEYS = [' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

function normalizeKey(event) {
  return event.key.length === 1 ? event.key.toLowerCase() : event.key;
}

export function makeInput(canvas) {
  const down = new Set();
  const state = {
    keys: down,
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    actions: 0,
  };

  state.held = (key) => down.has(key);

  // Raw WASD/arrows vector, unnormalised — the player normalises it.
  state.axis = () => {
    let x = 0;
    let y = 0;
    if (down.has('a') || down.has('ArrowLeft')) x -= 1;
    if (down.has('d') || down.has('ArrowRight')) x += 1;
    if (down.has('w') || down.has('ArrowUp')) y -= 1;
    if (down.has('s') || down.has('ArrowDown')) y += 1;
    return { x, y };
  };

  state.shift = () => down.has('Shift');

  state.takeActions = () => {
    const taken = state.actions;
    state.actions = 0;
    return taken;
  };

  // Peek without eating: the frame loop checks pause/mute/confirm while the
  // world step alone consumes interact and reload.
  state.peekActions = () => state.actions;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    down.add(normalizeKey(event));
    const action = KEY_ACTIONS[event.key];
    if (action) state.actions |= action;
    if (SCROLL_KEYS.includes(event.key)) event.preventDefault();
  });

  window.addEventListener('keyup', (event) => {
    down.delete(normalizeKey(event));
  });

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    state.mouseX = event.clientX - rect.left;
    state.mouseY = event.clientY - rect.top;
  });

  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    state.mouseDown = true;
    state.actions |= KEY_CONFIRM;
  });

  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) state.mouseDown = false;
  });

  return state;
}
