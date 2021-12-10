/**
 * Coalesces "chords" of held keys from any received keydown and keyup events.
 *
 * Dispatches a "keychord" event on itself, passing a KeyChordEvent to
 * listeners, after the last held key is released.
 *
 * Example usage:
 *
 *     const keyChorder = new KeyChorder();
 *     document.addEventListener('keydown', keyChorder);
 *     document.addEventListener('keyup', keyChorder);
 *     keyChorder.addEventListener('keychord', ({keys}) => console.log('keychord', keys));
 *
 * @implements {EventListenerObject}
 */
export class KeyChorder extends EventTarget {
  constructor(
    allowedModifiers = ['Shift'],
  ) {
    super();
    for (const key of allowedModifiers)
      this.ignoredModifiers.delete(key);
  }

  held = new Set()
  chord = new Set()

  clear() {
    this.held.clear();
    this.chord.clear();
  }

  /**
   * @param {KeyboardEvent} event
   * @returns {boolean}
   */
  filter(event) {
    const { key, view } = event;
    if (!view?.document) return false;
    if (this.hasIgnoredModifier(event)) {
      if (this.held.has(key)) return true;
      return false;
    }
    return true;
  }

  ignoredModifiers = new Set([
    'Alt',
    'AltGraph',
    'CapsLock',
    'Control',
    'Fn',
    'FnLock',
    'Hyper',
    'Meta',
    'OS', // since meta isn't consistent on windows
    'NumLock',
    'ScrollLock',
    'Shift',
    'Super',
    'Symbol',
    'SymbolLock',
    'Win', // IE9 compat; can drop?
  ])

  /** @param {KeyboardEvent} event */
  hasIgnoredModifier(event) {
    if (this.ignoredModifiers.has(event.key)) return true;
    for (const key of this.ignoredModifiers)
      if (event.getModifierState(key)) return true;
    return false;
  }

  /** @param {Event} event */
  handleEvent(event) {
    if (!(event instanceof KeyboardEvent)) return;
    if (!this.filter(event)) return;
    const { type, key } = event;
    switch (type) {

      case 'keyup':
        if (this.held.delete(key)) {
          this.chord.add(key);
          if (!this.held.size) {
            this.dispatchEvent(new KeyChordEvent(this.chord));
            this.chord.clear();
          }
        }
        event.stopImmediatePropagation();
        event.preventDefault();
        break;

      case 'keydown':
        if (!this.held.has(key)) {
          this.chord.clear();
          this.held.add(key);
          event.stopImmediatePropagation();
          event.preventDefault();
        }
        break;

    }
  }
}

export class KeyChordEvent extends Event {
  /** @type {readonly string[]} */
  keys

  /** @param {Iterable<string>} keys */
  constructor(keys) {
    super('keychord');
    this.keys = Object.freeze([...keys]);
  }
}
