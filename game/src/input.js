// Keyboard + mouse input. The game reads a plain state object each frame; the
// menu screens read edge-triggered actions. Mouse position is kept in screen
// space and converted by the camera when the game needs an aim point.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_INTERACT = 8;
export const ACTION_RELOAD = 16;

const KEY_ACTIONS = {
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

export function createInput(canvas) {
  const keys = new Set();
  const state = {
    keys,
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    actions: 0,
  };

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.key.length === 1 ? event.key.toLowerCase() : event.key);
    const action = KEY_ACTIONS[event.key];
    if (action) state.actions |= action;
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
    }
  }
  function onKeyUp(event) {
    keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key);
  }
  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    state.mouseX = event.clientX - rect.left;
    state.mouseY = event.clientY - rect.top;
  }
  function onMouseDown(event) {
    if (event.button === 0) {
      state.mouseDown = true;
      state.actions |= ACTION_CONFIRM;
    }
  }
  function onMouseUp(event) {
    if (event.button === 0) state.mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  state.held = (key) => keys.has(key);
  state.axis = () => {
    let x = 0;
    let y = 0;
    if (keys.has('a') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('d') || keys.has('ArrowRight')) x += 1;
    if (keys.has('w') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('s') || keys.has('ArrowDown')) y += 1;
    return { x, y };
  };
  state.shift = () => keys.has('Shift');
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
