// @ts-check

// NOTE: currently this code is meant to by copy-pasted into a browser console,
// so no exports are defined until some sort of better bundling / deployment
// strategy is determined

/** Sched is a delay sleeping and function calling machine.
  * It always sleeps at least 0 between each function.
  * Functions are invoked with the schedule object as this.
  */
class Sched {
  /** @param {(number|function)[]} steps */
  constructor(...steps) {
    this.steps = steps;
  }

  /** trimStart removes any beginning delay.
   * Returns this for easy chaining at construction time.
   */
  trimStart() {
    if (typeof this.steps[0] === 'number') {
      this.steps.shift();
      if (this.i > 0) this.i--;
    }
    return this;
  }

  /** trimEnd removes any ending delay.
   * Returns this for easy chaining at construction time.
   */
  trimEnd() {
    if (typeof this.steps[this.steps.length-1] === 'number') {
      this.steps.pop();
    }
    return this;
  }

  start() { if (!this._timer) this.next() }
  stop() {
    if (this._timer !== null) clearTimeout(this._timer);
    this._timer = null;
  }

  /** @type {null|ReturnType<setTimeout>} */
  _timer = null;
  next() {
    this.stop();
    let delay = this.step();
    this._timer = setTimeout(() => this.next(), delay);
  }

  i = 0;
  step() {
    const i = this.i++ % this.steps.length;
    const part = this.steps[i];
    switch (typeof part) {
      case 'function': part.call(this); return 0;
      case 'number':                    return part;
      default: throw new Error(`invalid sched.steps[${i}] type ${typeof part}`);
    }
  }

  /** afterNext blocks until all current steps have been executed */
  async afterNext() {
    return new Promise(resolve => {
      // TODO reject() if step throws?
      const i = this.steps.length;
      this.steps.push(() => {
        resolve();
        this.steps.splice(i, 1);
      })
    });
  }

  /** finish waits for all steps to complete, and then stops execution */
  async finish() {
    await this.afterNext();
    this.stop();
    this.i = 0;
  }
}

/** clickit creates a Sched to click an html element with given delay(s)
 * between successive clicks; the schedule starts with a click, followed by the
 * first delay.
 *
 * @param {HTMLElement} el
 * @param {number[]} every
 */
function clickit(el, ...every) {
  const click = () => el.click();
  const it = new Sched(...every.flatMap(n => [click, n]));
  it.start();
  return it;
}

/** Recorder supports recording DOM events under some element.
 */
class Recorder {
  /** @type {Element} */
  under

  /** until determines when recording stops.
   * The trigerring event is ignored, but a time is still recorded.
   * May be overridden by constructor option.
   *
   * @param {Event} ev
   * @returns {boolean}
   */
  until(ev) {
    return ev instanceof KeyboardEvent && ev.type === 'keydown' && ev.key === 'Escape';
  }

  /** ignore determines events elide from recording.
   * May be overridden by constructor option.
   *
   * @param {Event} ev
   * @returns {boolean}
   */
  ignore(ev) {
    const {type} = ev
    return type !== 'click' && type !== 'keypress';
  }

  /** event types to start listening to.
   * May be overridden by constructor option.
   */
  types = [
    'click',
    'keydown', // needed to recognize terminal <Escape> key
    'keypress',
  ]

  /**
   * @typedef {object} RecorderOptions
   * @prop {(ev: Event) => boolean} [until]
   * @prop {(ev: Event) => boolean} [ignore]
   * @prop {string[]} [types]
   */

  /**
   * @param {Element} under
   * @param {RecorderOptions} [options]
   */
  constructor(under, options) {
    this.under = under;
    if (options?.until) this.until = options.until;
    if (options?.ignore) this.ignore = options.ignore;
    if (options?.types) this.types = options.types;
  }

  now() {
    return this.under.ownerDocument?.defaultView?.performance.now() || 0;
  }

  /** @type {Set<string>} */
  listening = new Set()

  started = 0

  start() {
    for (const type of this.types) {
      this.under.addEventListener(type, this, {capture: true});
      this.listening.add(type);
    }
    this.started = this.now();
    this.times = [];
    this.events = [];
  }

  stop() {
    for (const type of this.listening)
      this.under.removeEventListener(type, this);
    this.listening.clear();
  }

  /** @type {number[]} */
  times = []

  /** @type {(null|Event)[]} */
  events = []

  /** @type {null|((rec: Recorder) => void)} */
  ondone = null

  /** @param {Event} ev */
  handleEvent(ev) {
    const time = this.now();
    if (this.until(ev)) {
      this.times.push(time);
      this.events.push(null);
      ev.stopPropagation();
      ev.preventDefault();
      this.stop();
      if (this.ondone) this.ondone(this)
    } else if (!this.ignore(ev)) {
      this.times.push(time);
      this.events.push(ev);
    }
  }

  /** @param {(number|function)[]} steps */
  addSteps(steps) {
    let last = this.started;
    for (let i=0; i<this.times.length; i++) {
      const time = this.times[i];
      const delay = time - last;
      last = time;
      steps.push(delay);

      const ev = this.events[i];
      if (!ev) return;

      const {target, type, ...init} = ev;
      if (!target) return;

      const cons = /** @type {{new(type: string, init: any) : Event}} */ (ev.constructor);
      steps.push(() => target.dispatchEvent(new cons(type, init)));
    }
  }

  /** @returns {(number|function)[]} */
  steps() {
    /** @type {(number|function)[]} steps */
    const steps = [];
    this.addSteps(steps);
    return steps;
  }
}

/**
 * @param {Element} under
 * @param {RecorderOptions} [options]
 */
function record(under, options={}) {
  return new Promise(resolve => {
    const rec = new Recorder(under, options);
    rec.ondone = () => resolve(rec);
    rec.start();
  });
}

// TODO: typical use case for further elaboration in some sort of a AutoCtl?
// record(document.body)
//   .then(rec => new Sched(...rec.steps()))
//   .then(sched => sched.trimStart())
//   .then(sched => {
//     if (lol?.stop) lol.stop();
//     lol = sched;
//     lol.start();
//     return lol;
//   })
//   .then(sched => console.log(sched.steps))
