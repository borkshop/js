// @ts-check

import {
  TileGrid,
  TileInspector, dumpTiles,
  moveTiles,
  centroid,
} from './tiles';
import {KeyCtl, coalesceMoves} from './input';
import {everyFrame, schedule} from './anim';

/** @typedef { import("./tiles").Point } Point */
/** @typedef { import("./tiles").TileFilter } TileFilter */
/** @typedef { import("./tiles").TileMoverProc } TileMoverProc */
/** @typedef { import("./tiles").TileSpec } TileSpec */
/** @typedef { import("./tiles").TileInspectEvent } TileInspectEvent */

/** @typedef {Object} DOMgeonOptions
 *
 * @prop {HTMLElement} grid - document element to place tiles within
 * @prop {HTMLElement} [ui] - document element to toggle UI state classes upon
 * @prop {HTMLElement} [keys] - document element to listen for key events upon
 * @prop {number} [inputRate=100] - how often to process key events, defaults to 100ms or 10hz
 */

/**
 * @param {TileGrid} grid
 * @param {HTMLElement[]} interacts
 * @param {HTMLElement} subject
 * @returns {boolean}
 */
export function procInteraction(grid, interacts, subject) {
  if (!interacts.length) return false;
  // TODO interaction loop to choose
  if (interacts.length > 1) return false;
  const interact = interacts[0];

  const pos = grid.getTilePosition(subject);
  const at = grid.getTilePosition(interact);
  if (Math.sqrt(
    Math.pow(at.x - pos.x, 2) +
    Math.pow(at.y - pos.y, 2)
  ) >= 2) return false;

  applyMorph(grid, interact, grid.getTileData(interact, 'morph_target'));
  applyMorph(grid, subject, grid.getTileData(interact, 'morph_subject'));

  return true;
}

/**
 * @typedef {object} classMut
 * @prop {string} [toggle]
 * @prop {string} [remove]
 * @prop {string} [add]
 */

/**
 * @param {TileGrid} grid
 * @param {HTMLElement} tile
 * @param {any} morph
 * @returns {void}
 */
function applyMorph(grid, tile, morph) {
  if (Array.isArray(morph)) {
    for (const m of morph) applyMorph(grid, tile, m);
    return;
  }
  if (typeof morph === 'string') {
    const form = grid.getTileData(tile, `morph_form_${morph}`);
    if (form) morph = form;
  }
  if (typeof morph !== 'object') return;
  if (!morph) return;
  /** @type {{ classList: (classMut|classMut[]) }&TileSpec} */
  let {classList, ...spec} = morph;
  if (classList) {
    classList = Array.isArray(classList) ? classList : [classList];
    for (const {toggle, add, remove} of classList) {
      if (toggle) tile.classList.toggle(toggle);
      if (remove) tile.classList.remove(remove);
      if (add) tile.classList.add(add);
    }
  }
  grid.updateTile(tile, spec);
}

/** @type {TileMoverProc} */
export function solidMoverProc({grid, to, at, mover}) {
  // can only move there if have particle support
  if (!at.some(h => h.classList.contains('floor'))) return false;

  // may move if not occupied
  let solids = at.filter(h => h.classList.contains('solid'));
  if (!solids.length) return true;

  // may interact with another solid...
  const interacts = solids.filter(h => h.classList.contains('interact'));
  if (interacts.length) {
    if (!procInteraction(grid, interacts, mover)) return false;
    // ...then maybe allowed to pass if no longer occupied
    solids = grid.tilesAt(to, 'solid');
    if (!solids.length) return true;
  }

  // may pass is marked .passable
  return solids.every(h => h.classList.contains('passable'));
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

      // TODO this should be wholly optional or dropped entirely now that we
      // provide start/stop events
      ui = grid,

      // TODO should the default be more like ownerDocument.body?
      keys = ui,

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
    let move = coalesceMoves(this.keys.consume());
    if (move) {
      const actors = this.grid.queryTiles({className: ['mover', 'input']});
      for (const mover of actors)
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

  /** @type {HTMLElement|null} */
  cur = null

  /**
   * @param {DOMgeon} dmg
   * @param {HTMLElement} el
   */
  constructor(dmg, el) {
    super(dmg.grid, (ev) => this.inspect(ev));
    /** @type {TileFilter} */
    this.filter = t => !t.classList.contains('inspect-cursor');
    this.el = el;
    this.dmg = dmg;
    this.dmg.addEventListener('stop', _ => this.enable());
    this.dmg.addEventListener('start', _ => this.disable());
    if (!this.dmg.running) this.enable();
  }

  /**
   * @param {TileInspectEvent} ev
   */
  inspect({pos: {x, y}, tiles, pinned}) {
    if (!this.cur?.parentNode)
      this.cur = this.dmg.grid.createTile({className: 'inspect-cursor'});
    this.grid.updateTile(this.cur, {pos: {x, y}});
    this.cur.classList.toggle('pinned', pinned);
    const at = /** @type {HTMLElement|null} */ (this.el.querySelector('[data-for="pos"]'));
    if (at) at.innerText = `${isNaN(x) ? 'X' : x},${isNaN(y) ? 'Y' : y}`;
    const txt = this.el.querySelector('textarea');
    if (txt) dumpTiles({tiles, into: txt, detail: pinned});
  }

  enable() {
    this.dmg.grid.el.classList.toggle('inspectable', true);
    for (const type of ['mousemove', 'click'])
      this.dmg.grid.el.addEventListener(type, this);
    this.refresh();
  }

  disable() {
    this.dmg.grid.el.classList.toggle('inspectable', false);
    for (const type of ['mousemove', 'click'])
      this.dmg.grid.el.removeEventListener(type, this);
  }
}
