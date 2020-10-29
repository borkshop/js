// @ts-check

/**
 * @param {KeyboardEvent} ev
 * @return {string} - a string representing a key event with A- C- M- and S-
 * prefixes for alt, control, meta, and shift modifiers.
 */
function mappedKeyName(ev) {
  const {altKey, ctrlKey, metaKey, shiftKey, key} = ev;
  return `${
    altKey ? 'A-' : ''}${
    ctrlKey ? 'C-' : ''}${
    metaKey ? 'M-' : ''}${
    shiftKey ? 'S-' : ''}${
    key}`;
}

/**
 * @extends {Map<string, number>}
 */
export class KeyCtl extends Map {
  /**
   * @param {?EventTarget} target
   */
  constructor(target=null) {
    super();
    if (target) {
      target.addEventListener('keydown', this);
      target.addEventListener('keyup', this);
    }
  }

  /**
   * Registry for custom key event handlers that take priority over counting.
   *
   * Useful for handling things like an Escape menu, or to dispatch number keys
   * to actions.
   *
   * @typedef {(keyEvent:KeyboardEvent)=>void} KeyHandler
   * @typedef {Object<string, KeyHandler>} KeyHandlers
   */
  on = {
    /** @type {KeyHandlers} */
    code: {},
    /** @type {KeyHandlers} */
    key: {},
  }

  /**
   * If set true all key events are consumed and counted by handleEvent() for
   * later consume() ing by something like a main interaction loop.
   *
   * @type {boolean}
   */
  counting = false

  /** @param {Event} event */
  handleEvent(event) {
    if (!(event instanceof KeyboardEvent) ||
        event.type !== 'keyup' && event.type !== 'keydown') return;

    // consume the key event if a custom handler has been defined for it
    const on = this.on.code[event.code] || this.on.key[event.key];
    if (on) {
      on(event);
      event.stopPropagation();
      event.preventDefault();
      return;
    }

    // consume the key event if we're counting
    if (this.counting) {
      const name = mappedKeyName(event);
      const n = this.get(name) || 0;
      this.set(name, n+1);
      event.stopPropagation();
      event.preventDefault();
    }
  }

  /**
   * Consumes whole key presses, returning a list of unique keys pressed since
   * last consume(), along with a >=1 count.
   *
   * @typedef {Array<[string, number]>} Presses
   * @return {Presses}
   */
  consume() {
    /** @type Presses */
    const presses = [];
    for (const [name, count] of Array.from(this.entries())) {
      const n = Math.floor(count / 2);
      if (n > 0) {
        const d = count % 2;
        if (d == 0) this.delete(name);
        else        this.set(name, 1);
        presses.push([name, n]);
      }
    }
    return presses;
  }
}

/**
 * A move has a spatial component and an optional action string.
 * The action string may be used to define custom extensions or to otherwise
 * change the semantics of the x,y spatial component.
 *
 * @typedef {Object} Move @prop {number} x
 * @prop {number} y
 * @prop {string} [action]
 */

/**
 * Parses common arrow keys plus "." to not move.
 *
 * @param {string}key
 * @return {?Move}
 */
export function parseCommmonKeys(key) {
  switch (key) {
    case 'ArrowUp':    return {x:  0, y: -1};
    case 'ArrowRight': return {x:  1, y:  0};
    case 'ArrowDown':  return {x:  0, y:  1};
    case 'ArrowLeft':  return {x: -1, y:  0};
    case '.':          return {x:  0, y:  0};
    default:           return null;
  }
}

/**
 * @param {Move} a
 * @param {Move} b
 * @return {Move}
 */
export function mergeMoves(a, b) {
  // TODO afford domain specific action-aware merge, e.g. at least a priority
  // (partial) ordering
  if (a.action) return a;
  if (b.action) return b;
  return {x: a.x + b.x, y: a.y + b.y};
}

/**
 * Parses and coalesces a single move from a list of pressed keys,
 * @param {Presses} presses - a list of pressed keys
 * TODO optional parser and reducer params
 *
 * TODO this, and parseCommmonKeys above, should probably move into the domgeon
 * module entirely, as it's really bleeding into domain-specific territory now
 */
export function coalesceMoves(presses) {
  // TODO currently this erases any action string
  return presses
    .map(([key, _count]) => parseCommmonKeys(key))
    .reduce((acc, move) => {
      if (!move) return acc;
      acc.move = mergeMoves(acc.move, move);
      acc.have = true
      return acc;
    }, {
      have: false,
      move: {x: 0, y: 0},
    });
}
