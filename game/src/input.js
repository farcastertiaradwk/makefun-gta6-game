// Keyboard + mouse input for SOLMAR HEAT.
// One object owns every key and the mouse. The game loop reads it once per
// frame: held keys for movement, edge-triggered presses for actions (E, R,
// Esc, Enter, M), and the mouse position for aiming plus clicks for firing.
// Edge presses are consumed by the loop and cleared at the end of each frame
// so a single keypress never fires twice.

import { KEYS } from './config.js';

/** All codes the game listens to, so the page never scrolls mid-game. */
const GAME_CODES = new Set([
  ...KEYS.up,
  ...KEYS.down,
  ...KEYS.left,
  ...KEYS.right,
  ...KEYS.sprint,
  ...KEYS.handbrake,
  ...KEYS.interact,
  ...KEYS.reload,
  ...KEYS.pause,
  ...KEYS.mute,
  ...KEYS.start,
]);

export function makeInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 640, y: 360, down: false, clicked: false, clickX: 640, clickY: 360 };
  let attached = false;

  function toCanvas(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function onKeyDown(event) {
    if (!GAME_CODES.has(event.code)) return;
    event.preventDefault();
    if (!held.has(event.code)) pressed.add(event.code);
    held.add(event.code);
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onMouseMove(event) {
    const p = toCanvas(event);
    mouse.x = p.x;
    mouse.y = p.y;
  }

  function onMouseDown(event) {
    const p = toCanvas(event);
    mouse.x = p.x;
    mouse.y = p.y;
    mouse.down = true;
    mouse.clicked = true;
    mouse.clickX = p.x;
    mouse.clickY = p.y;
  }

  function onMouseUp() {
    mouse.down = false;
  }

  function onBlur() {
    held.clear();
    mouse.down = false;
  }

  function attach() {
    if (attached) return;
    attached = true;
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
  }

  /** True while any of the codes is held down. */
  function isDown(codes) {
    for (const c of codes) if (held.has(c)) return true;
    return false;
  }

  /** True if any of the codes was pressed since the last frame clear. */
  function wasPressed(codes) {
    for (const c of codes) if (pressed.has(c)) return true;
    return false;
  }

  /** Consume a press so it does not fire again this frame. */
  function consume(codes) {
    for (const c of codes) pressed.delete(c);
  }

  /** Call at the end of every frame: edges live exactly one frame. */
  function endFrame() {
    pressed.clear();
    mouse.clicked = false;
  }

  /** Test / staging helper: pretend a key is held. */
  function fakeHold(code) {
    held.add(code);
  }

  /** Test / staging helper: release a faked key. */
  function fakeRelease(code) {
    held.delete(code);
  }

  /** Test / staging helper: clear every held key. */
  function fakeClear() {
    held.clear();
    pressed.clear();
  }

  return {
    held,
    pressed,
    mouse,
    attach,
    isDown,
    wasPressed,
    consume,
    endFrame,
    fakeHold,
    fakeRelease,
    fakeClear,
  };
}

/** Movement vector from the held keys, normalised. */
export function moveVector(input) {
  let x = 0;
  let y = 0;
  if (input.isDown(KEYS.left)) x -= 1;
  if (input.isDown(KEYS.right)) x += 1;
  if (input.isDown(KEYS.up)) y -= 1;
  if (input.isDown(KEYS.down)) y += 1;
  if (x !== 0 && y !== 0) {
    const inv = 1 / Math.sqrt(2);
    x *= inv;
    y *= inv;
  }
  return { x, y };
}
