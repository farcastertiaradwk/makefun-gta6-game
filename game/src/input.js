// Keyboard + mouse, with an action queue for one-shot presses (E, R,
// Enter) so the game loop never misses a tap between frames. Shot
// staging can override the held-E check through fakeInput.
import { CFG } from './config.js';

export function makeInput(canvas) {
  const input = {
    keys: new Set(),
    actions: [],
    mouse: { x: CFG.view.w / 2, y: CFG.view.h / 2, down: false },
    fakeInput: null,
    attach() {
      window.addEventListener('keydown', (e) => {
        if (e.repeat) return;
        input.keys.add(e.code);
        input.actions.push(e.code);
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      });
      window.addEventListener('keyup', (e) => input.keys.delete(e.code));
      window.addEventListener('blur', () => input.keys.clear());
      canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        // the canvas is CSS-scaled below its 1280x720 bitmap on narrow
        // windows: map display pixels back to canvas pixels, or the aim
        // drifts off the cursor by the scale factor
        input.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
        input.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
      });
      canvas.addEventListener('mousedown', (e) => {
        input.mouse.down = true;
        input.actions.push('MouseDown');
        const r = canvas.getBoundingClientRect();
        input.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
        input.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
      });
      window.addEventListener('mouseup', () => { input.mouse.down = false; });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    },
    // drain one-shot presses; call once per frame
    takeActions() {
      const out = input.actions;
      input.actions = [];
      return out;
    },
    held(code) {
      if (input.fakeInput && input.fakeInput.held) return input.fakeInput.held(code);
      return input.keys.has(code);
    },
  };
  return input;
}
