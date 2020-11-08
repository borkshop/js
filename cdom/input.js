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

export default class KeyCtl {
  held = new Set()
  chord = new Set()
  clicked = new Set()

  /**
   * @param {?EventTarget} target
   */
  constructor(target=null) {
    if (target) {
      target.addEventListener('keydown', this);
      target.addEventListener('keyup', this);
    }
  }

  /**
   * @template E
   * @typedef {(event:E)=>void} EventHandler<E>
   */

  /**
   * Registry for custom key event handlers that take priority over counting.
   *
   * Useful for handling things like an Escape menu, or to dispatch number keys
   * to actions.
   *
   * @typedef {Object<string, EventHandler<KeyboardEvent>>} KeyHandlers
   * @typedef {Object<string, EventHandler<MouseEvent>>} MouseHandlers
   */
  on = {
    /** @type {KeyHandlers} */
    code: {},
    /** @type {KeyHandlers} */
    key: {},
    /** @type {MouseHandlers} */
    click: {},
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
    if (event instanceof MouseEvent) {
      const {type, target} = event;
      if (type === 'click' && target instanceof HTMLElement) {
        const key = target.dataset['key'];
        const action = target.dataset['action'];
        const name = key || action;
        if (!name) return;

        const handler = this.on.click[name] || this.on.click[`#${target.id}`];
        if (handler) {
          handler(event);
          event.stopPropagation();
          event.preventDefault();
          return;
        }

        if (this.counting) {
          this.clicked.add(name);
          event.stopPropagation();
          event.preventDefault();
          return;
        }
      }
      return;
    }

    if (event instanceof KeyboardEvent) {
      const {type, key, code} = event;

      // consume the key event if a custom handler has been defined for it
      const on = this.on.code[code] || this.on.key[key];
      if (on) {
        on(event);
        event.stopPropagation();
        event.preventDefault();
        return;
      }

      // consume the key up/downs event if we're counting
      if (this.counting) {
        const name = mappedKeyName(event);
        switch (type) {

        case 'keyup':
          this.held.delete(name);
          this.chord.add(name);
          event.stopPropagation();
          event.preventDefault();
          break;

        case 'keydown':
          this.chord.clear();
          this.held.add(name);
          event.stopPropagation();
          event.preventDefault();
          break;

        }
      }
      return;
    }
  }

  /**
   * Consumes whole key presses, returning a list of unique keys pressed since
   * last consume(), along with a >=1 count.
   *
   * @return {null|Set<string>}
   */
  consume() {
    if (this.held.size) return null;
    if (!(this.chord.size + this.clicked.size)) return null;
    const chord = new Set([...this.chord, ...this.clicked]);
    this.chord.clear();
    this.clicked.clear();
    return chord;
  }
}
