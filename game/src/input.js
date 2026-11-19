// Keyboard + mouse input for SOLMAR HEAT.
// Held keys live in a Set keyed by e.code; single presses (E, R, Esc, M,
// Enter) go through a one-frame action queue so a press is never eaten by
// the update order. The mouse position is kept in canvas pixels.

export function makeInput(canvas) {
  const input = {
    held: new Set(),
    actions: [],
    mouse: { x: 0, y: 0, down: false, clicked: false },
    // True while the key is held down.
    is(code) {
      return input.held.has(code);
    },
    // Consume one queued press of this action name, if any.
    take(action) {
      const i = input.actions.indexOf(action);
      if (i === -1) return false;
      input.actions.splice(i, 1);
      return true;
    },
    clearActions() {
      input.actions.length = 0;
    },
    attach() {
      window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown') {
          e.preventDefault();
        }
        if (!e.repeat) {
          input.held.add(e.code);
          if (e.code === 'KeyE') input.actions.push('interact');
          if (e.code === 'KeyR') input.actions.push('reload');
          if (e.code === 'Escape') input.actions.push('pause');
          if (e.code === 'KeyM') input.actions.push('mute');
          if (e.code === 'Enter') input.actions.push('confirm');
        }
      });
      window.addEventListener('keyup', (e) => {
        input.held.delete(e.code);
      });
      window.addEventListener('blur', () => {
        input.held.clear();
      });
      canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        input.mouse.x = e.clientX - r.left;
        input.mouse.y = e.clientY - r.top;
      });
      canvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        const r = canvas.getBoundingClientRect();
        input.mouse.x = e.clientX - r.left;
        input.mouse.y = e.clientY - r.top;
        input.mouse.down = true;
        input.mouse.clicked = true;
      });
      window.addEventListener('mouseup', () => {
        input.mouse.down = false;
      });
      // Arrow keys drive too, for players who prefer them.
      input.aliases = { ArrowUp: 'KeyW', ArrowDown: 'KeyS', ArrowLeft: 'KeyA', ArrowRight: 'KeyD' };
    },
  };
  return input;
}

// Resolve an alias (arrows) to its WASD code for movement checks.
export function heldMove(input, code) {
  if (input.held.has(code)) return true;
  for (const [alias, wasd] of Object.entries(input.aliases || {})) {
    if (wasd === code && input.held.has(alias)) return true;
  }
  return false;
}
