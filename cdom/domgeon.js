// @ts-check

import {
  TileGrid,
  TileInspector, dumpTiles,
  moveTiles,
  centroid,
} from './tiles';
import {KeyCtl, coalesceMoves} from './input';
import {everyFrame, schedule} from './anim';

/** @typedef { import("./tiles").TileMoverProc } TileMoverProc */

/** @typedef {Object} DOMgeonOptions
 *
 * @prop {HTMLElement} grid - document element to place tiles within
 * @prop {HTMLElement} [ui] - document element to toggle UI state classes upon
 * @prop {HTMLElement} [keys] - document element to listen for key events upon
 * @prop {number} [inputRate=100] - how often to process key events, defaults to 100ms or 10hz
 */

/** @type {TileMoverProc} */
export function solidMoverProc({at}) {
  // can only move there if have particle support
  if (!at.some(h => h.classList.contains('floor'))) return false;

  // may move if not occupied
  const solids = at.filter(h => h.classList.contains('solid'));
  if (!solids.length) return true;

  return false;
}

export class DOMgeon extends EventTarget {
  /** @type {TileGrid} */
  grid

  /** @type {HTMLElement} */
  ui

  /** @type {KeyCtl} */
  keys

  /** @type {number} */
  inputRate

  /** @type {boolean} */
  running = false

  /** @type {Object<string, TileMoverProc>} */
  moveProcs = {
    solid: solidMoverProc,
  }

  /**
   * May pass just a grid element if no other option is needed.
   *
   * @param {HTMLElement|DOMgeonOptions} options
   */
  constructor(options) {
    super();
    if (options instanceof HTMLElement) options = {grid: options};
    if (!options.grid) throw new Error('must provide a DOMgeon grid element');

    const {
      // element bindings
      grid,

      // TODO should the default be more like ownerDocument.body?
      keys = grid,

      // TODO this should be wholly optional or dropped entirely now that we
      // provide start/stop events
      ui = grid,

      // config
      inputRate = 100,
    } = options;
    this.ui = ui;
    this.inputRate = inputRate;

    this.grid = new TileGrid(grid);
    this.grid.viewPoint = centroid(this.grid.queryTiles({className: ['mover', 'input']})
      .map(input => this.grid.getTilePosition(input)));

    this.keys = new KeyCtl(keys);
    this.keys.on.code['Escape'] = (ev) => {
      if (ev.type !== 'keyup') return;
      if (this.running) this.stop(); else this.start();
    };

    this.ui.classList.toggle('showUI', true);
  }

  stop() {
    this.running = false;
  }

  /** @type {import('./anim').SchedulePart[]} */
  animParts = []

  async start() {
    this.running = true;
    this.ui.classList.toggle('running', true);
    this.keys.counting = true;
    this.dispatchEvent(new Event('start'));
    await everyFrame(schedule(
      () => !!this.running,
      {every: this.inputRate, then: () => { this.processInput(); return true }},
      ...this.animParts
    ));
    this.dispatchEvent(new Event('stop'));
    this.keys.counting = false;
    this.ui.classList.toggle('running', false);
    this.running = false;
  }

  processInput() {
    let {have, move} = coalesceMoves(this.keys.consume());
    if (have) for (const mover of this.grid.queryTiles({className: ['mover', 'input']})) {
      this.grid.setTileData(mover, 'move', move);
    }

    moveTiles({grid: this.grid, kinds: this.moveProcs});

    // ensure viewport centered on player input(s)
    const c = centroid(this.grid.queryTiles({className: ['mover', 'input']})
      .map(input => this.grid.getTilePosition(input)));
    const {x: vx, y: vy, w, h} = this.grid.viewport;
    if (c.x <= vx || c.y <= vy || c.x+1 >= vx + w || c.y+1 >= vy + h)
      this.grid.viewPoint = c;
  }
}

export class DOMgeonInspector extends TileInspector {
  /** @type {HTMLElement} */
  el

  /** @type {DOMgeon} */
  dmg

  /**
   * @param {DOMgeon} dmg
   * @param {HTMLElement} el
   */
  constructor(dmg, el) {
    const txt = el.querySelector('textarea');
    const at = /** @type {HTMLElement|null} */ (el.querySelector('[data-for="pos"]'));
    super(dmg.grid, ({pos: {x, y}, tiles}) => {
      if (at) at.innerText = `${isNaN(x) ? 'X' : Math.floor(x)},${isNaN(y) ? 'Y' : Math.floor(y)}`;
      if (txt) dumpTiles({tiles, into: txt});
    });

    this.el = el;
    this.dmg = dmg;
    this.dmg.addEventListener('stop', () => {
      this.dmg.grid.el.classList.toggle('inspectable', true);
      this.dmg.grid.el.addEventListener('mousemove', this);
    });
    this.dmg.addEventListener('start', () => {
      this.dmg.grid.el.classList.toggle('inspectable', false);
      this.dmg.grid.el.removeEventListener('mousemove', this);
    });
    this.dmg.grid.el.classList.toggle('inspectable', !this.dmg.running);
    if (!this.dmg.running) this.dmg.grid.el.addEventListener('mousemove', this);
  }
}
