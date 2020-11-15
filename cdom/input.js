// @ts-check

/**
 * Allows easy handling of one-off keys, cancelling the triggering event.
 * Useful for handling things like a modal Escape menu.
 *
 * Also supports clicking data-keycode or data-key annotated buttons.
 *
 * Prefers to call any byCode handler over any byKey handler.
 *
 * @implements {EventListenerObject}
 */
export class Handlers {
  /** @typedef {(event:Event)=>void} EventHandler */
  /** @typedef {Object<string, EventHandler>} EventHandlers */

  /** @type {EventHandlers} */
  byCode = {}

  /** @type {EventHandlers} */
  byKey = {}

  /**
   * @param {Event} event
   * @returns {null|EventHandler}
   */
  lookup(event) {
    if (event instanceof MouseEvent) {
      const {type, target} = event;
      if (type === 'click' && target instanceof HTMLButtonElement) {
        const {key, keycode} = target.dataset;
        return (keycode && this.byCode[keycode])
            || (key && this.byKey[key])
            || null;
      }
    } else if (event instanceof KeyboardEvent) {
      const {key, code} = event;
      return this.byCode[code] || this.byKey[key] || null;
    }
    return null;
  }

  /** @param {Event} event */
  handleEvent(event) {
    const handler = this.lookup(event);
    if (handler) {
      event.stopPropagation();
      event.preventDefault();
      handler(event);
    }
  }
}

/**
 * Toggles a CSS class on any <button data-key="KEY" data-keycode="CODE">
 * element that matches received keydown/keyup events.
 *
 * Buttons should have at least one of the data-key or data-keycode attributes.
 * Any keycode match is preferred to a mere key match.
 *
 * @implements {EventListenerObject}
 */
export class KeyHighlighter {
  className = 'held'

  /** @param {Event} event */
  handleEvent(event) {
    if (!(event instanceof KeyboardEvent)) return;
    const {type, key, code, view} = event;
    const root = view?.document;
    if (!root) return;
    /** @type {null|HTMLButtonElement} */
    const button = root.querySelector(`button[data-keycode="${code}"]`)
                || root.querySelector(`button[data-key="${key}"]`);
    if (button) {
      if      (type === 'keydown') button.classList.toggle('held', true);
      else if (type === 'keyup')   button.classList.toggle('held', false);
    }
  }
}

/**
 * Dispatches keydown and keyup events synthesized from any mouse clicks events
 * targeted at a <button data-key="KEY" data-keycode="CODE"> element.
 *
 * Buttons should at least have the data-key attribute, and may also have a
 * data-keycode attribute.
 *
 * @implements {EventListenerObject}
 */
export class KeySynthesizer {
  /** @param {Event} event */
  handleEvent(event) {
    if (event instanceof MouseEvent) {
      const {type, target, view} = event;
      if (type !== 'click' || !(target instanceof HTMLButtonElement)) return;
      const key = target.dataset['key'];
      if (key && !target.disabled) {
        event.stopPropagation();
        event.preventDefault();
        const holdable = !!view?.getComputedStyle(target).getPropertyValue('--holdable');
        const code = target.dataset['keycode'] || '';
        /** @type {KeyboardEventInit} */
        const init = {
          bubbles: true, cancelable: true, composed: true,
          view,
          key, code,
        };
        if (!holdable) {
          target.dispatchEvent(new KeyboardEvent('keydown', init));
          target.dispatchEvent(new KeyboardEvent('keyup', init));
        } else if (target.classList.toggle('held')) {
          target.dispatchEvent(new KeyboardEvent('keydown', init));
        } else {
          target.dispatchEvent(new KeyboardEvent('keyup', init));
        }
      }
    }
  }
}

/**
 * Coalesces "chords" of held keys from any received keydown and keyup events.
 *
 * Dispatches a "keychord" event on itself, passing a KeyChordEvent to
 * listeners, after the last held key is released.
 *
 * @implements {EventListenerObject}
 */
export class KeyChorder extends EventTarget {
  held = new Set()
  chord = new Set()

  clear() {
    this.held.clear();
    this.chord.clear();
  }

  /** @param {Event} event */
  handleEvent(event) {
    if (!(event instanceof KeyboardEvent)) return;
    const {type, key, code, view} = event;
    const root = view?.document;
    if (!root) return;
    /** @type {null|HTMLButtonElement} */
    const button = root.querySelector(`button[data-keycode="${code}"]`)
                || root.querySelector(`button[data-key="${key}"]`);
    if (button?.disabled) return;
    if (!['control', 'shift', 'alt', 'meta'].includes(key.toLowerCase())) {
      if (type === 'keyup') {
        if (this.held.delete(key)) {
          this.chord.add(key);
          if (!this.held.size) {
            this.dispatchEvent(new KeyChordEvent(this.chord));
            this.chord.clear();
          }
        }
      } else if (type === 'keydown') {
        this.chord.clear();
        this.held.add(key);
      } else {
        return;
      }
    }
    event.stopPropagation();
    event.preventDefault();
  }
}

export class KeyChordEvent extends Event {
  /** @type {Iterable<string>} */
  keys

  /** @param {Iterable<string>} keys */
  constructor(keys) {
    super('keychord');
    this.keys = keys;
  }
}
