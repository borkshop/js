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
