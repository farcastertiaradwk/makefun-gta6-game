// Keyboard + mouse input. The game reads a plain state object each frame;
// the menu screens read edge-triggered actions. Mouse position is kept in
// screen space and the camera converts it when the game needs an aim point.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_INTERACT = 8;
export const ACTION_RELOAD = 16;

const KEY_TO_ACTION = {
  Enter: ACTION_CONFIRM,
  ' ': ACTION_CONFIRM,
  Escape: ACTION_PAUSE,
  p: ACTION_PAUSE,
  P: ACTION_PAUSE,
  m: ACTION_MUTE,
  M: ACTION_MUTE,
  e: ACTION_INTERACT,
  E: ACTION_INTERACT,
  r: ACTION_RELOAD,
  R: ACTION_RELOAD,
};

// Keys the browser would rather scroll the page with.
const SCROLL_KEYS = [' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

function normaliseKey(event) {
  return event.key.length === 1 ? event.key.toLowerCase() : event.key;
}

export function createInput(canvas) {
  const down = new Set();
  const state = {
    keys: down,
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    actions: 0,
  };

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    down.add(normaliseKey(event));
    const action = KEY_TO_ACTION[event.key];
    if (action) state.actions |= action;
    if (SCROLL_KEYS.includes(event.key)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    down.delete(normaliseKey(event));
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    state.mouseX = event.clientX - rect.left;
    state.mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    state.mouseDown = true;
    state.actions |= ACTION_CONFIRM;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) state.mouseDown = false;
  });

  state.held = (key) => down.has(key);
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
  // Read without consuming: the frame loop peeks for pause/mute/confirm while
  // the world step is the only consumer of interact/reload.
  state.peekActions = () => state.actions;
  return state;
}
