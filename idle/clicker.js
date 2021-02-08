// @ts-check

/** Sched is a delay sleeping and function calling machine.
  * It always sleeps at least 0 between each function.
  * Functions are invoked with the schedule object as this.
  */
class Sched {
  /** @param {(number|function)[]} steps */
  constructor(...steps) {
    this.steps = steps;
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
