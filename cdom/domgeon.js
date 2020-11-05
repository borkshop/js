// @ts-check

import {
  TileGrid,
  TileInspector, dumpTiles,
  moveTiles,
  centroid,
} from './tiles';
import KeyCtl from './input';
import {everyFrame, schedule} from './anim';

/** @typedef { import("./tiles").Point } Point */
/** @typedef { import("./tiles").TileFilter } TileFilter */
/** @typedef { import("./tiles").TileMoverProc } TileMoverProc */
/** @typedef { import("./tiles").TileSpec } TileSpec */
/** @typedef { import("./tiles").TileInspectEvent } TileInspectEvent */

/** @typedef {Object} DOMgeonOptions
 *
 * @prop {HTMLElement} grid - document element to place tiles within
 * @prop {HTMLElement} [moveBar] - element under which to place move buttons
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

  if (subject.dataset['plane'] !== interact.dataset['plane']) {
    // TODO cross planar capability
    return false;
  }

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
  const interacts = solids.filter(h =>
    !h.classList.contains('passable') &&
    h.classList.contains('interact')
  );
  if (interacts.length) {
    if (!procInteraction(grid, interacts, mover)) return false;
    // ...then maybe allowed to pass if no longer occupied
    solids = grid.tilesAt(to, 'solid');
    if (!solids.length) return true;
  }

  // may pass is marked .passable
  return solids.every(h => h.classList.contains('passable'));
}

/**
 * @param {object} params
 * @param {HTMLElement} params.cont
 * @param {EventListenerOrEventListenerObject} params.handler
 * @param {string} [params.key]
 * @param {string} [params.label]
 * @param {string} [params.legend]
 * @param {string} [params.title]
 * @returns {HTMLButtonElement}
 */
function createButton({cont, handler, key, label, legend, title}) {
  const button = cont.ownerDocument.createElement('button');
  if (key) button.dataset['key'] = key;
  if (label) button.innerText = label;
  if (key) {
    const K = key.toUpperCase();
    if (!label)
      button.innerText = K;
    else if (key.length === 1 && K !== label)
      button.dataset['legend'] = K;
  }
  if (legend && legend !== label) button.dataset['legend'] = legend;
  if (title) button.title = title;
  button.addEventListener('click', handler);
  cont.appendChild(button);
  return button;
}

/**
 * A move has a spatial component and an optional action string.
 * The action string may be used to define custom extensions or to otherwise
 * change the semantics of the x,y spatial component.
 *
 * @typedef {Object} Move
 * @prop {number} x
 * @prop {number} y
 * @prop {string} [action]
 */

export class DOMgeon extends EventTarget {
  /** @type {TileGrid} */
  grid

  /** @type {HTMLElement|null} */
  moveBar

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

      moveBar,

      // TODO this should be wholly optional or dropped entirely now that we
      // provide start/stop events
      ui = grid,

      // TODO should the default be more like ownerDocument.body?
      keys = ui,

      // config
      inputRate = 100,
    } = options;
    this.moveBar = moveBar || null;
    this.ui = ui;
    this.inputRate = inputRate;

    this.grid = new TileGrid(grid);
    this.grid.viewPoint = centroid(this.grid.queryTiles({className: ['mover', 'input']})
      .map(input => this.grid.getTilePosition(input)));

    const updateTile = this.grid.updateTile;
    this.grid.updateTile = (tile, spec) => {
      updateTile.call(this.grid, tile, spec);
      tile.dataset['plane'] = this.tilePlane(tile);
      return tile;
    };

    this.keys = new KeyCtl(keys);
    this.keys.on.code['Escape'] = (ev) => {
      if (ev.type !== 'keyup') return;
      if (this.running) this.stop(); else this.start();
    };

    this.ui.classList.toggle('showUI', true);

    /** @type {Object<string, string>} */
    const keyLegends = {
      'ArrowLeft': '←',
      'ArrowDown': '↓',
      'ArrowUp': '↑',
      'ArrowRight': '→',
    };

    /** @type {Object<string, string>} */
    const moveLabels = {
      '-1,0': '←',
      '0,1': '↓',
      '0,-1': '↑',
      '1,0': '→',
      '0,0': '⊙',
    };

    /** @type {Object<string, string>} */
    const moveTitles = {
      '-1,0': 'Move Left',
      '0,1': 'Move Down',
      '0,-1': 'Move Up',
      '1,0': 'Move Right',
      '0,0': 'Stay (no move)',
    };

    /** @type {Object<string, string>} */
    const defaultMoveKeys = {

      // '-1,0': 'ArrowLeft',
      // '0,1': 'ArrowDown',
      // '0,-1': 'ArrowUp',
      // '1,0': 'ArrowRight',
      // '0,0': '.',

      '0,-1': 'w',
      '-1,0': 'a',
      '0,1': 's',
      '1,0': 'd',
      // '0,0': 'r',

      // '-1,0': 'h',
      // '0,1': 'j',
      // '0,-1': 'k',
      // '1,0': 'l',
      // '0,0': '.',

    };

    const missing = new Set(Object.keys(defaultMoveKeys));
    /** @type {NodeListOf<HTMLButtonElement>} */
    const buttons = this.ui.querySelectorAll('button[data-movedir]');
    for (const button of buttons) {
      const movedir = button.dataset['movedir'];
      if (!movedir) continue;
      missing.delete(movedir);
      if (!button.dataset['key']) button.dataset['key'] = defaultMoveKeys[movedir]
    }
    const cont = this.moveBar || this.ui;
    for (const movedir of missing) {
      const key = defaultMoveKeys[movedir];
      const button = createButton({
        cont,
        handler: this.keys,
        key,
        label: moveLabels[movedir],
        legend: keyLegends[key],
        title: moveTitles[movedir],
      });
      button.dataset['movedir'] = movedir;
    }
  }

  /**
   * @param {HTMLElement} tile
   * @returns {string}
   */
  tilePlane (tile) {
    for (const kind in this.moveProcs)
      if (kind && tile.classList.contains(kind))
        return kind;
    return '';
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

  /**
   * @param {string} key
   * @returns {Move|null}
   */
  parseButtonKey(key) {
    /** @type {NodeListOf<HTMLButtonElement>} */
    const buttons = this.ui.querySelectorAll('button[data-key]');
    for (const button of buttons) {
      if (key === button.dataset['key']) {
        /** @type {Move} */
        const move = {x: NaN, y: NaN};

        const dir = button.dataset['movedir'];
        if (dir) {
          const parts = dir.split(',');
          move.x = parseFloat(parts[0]);
          move.y = parseFloat(parts[1]);
        }

        return move;
      }
    }
    return null;
  }

  processInput() {
    let move = this.keys.consume()
      .map(([key, _count]) => this.parseButtonKey(key))
      .reduce((a, b) => {
        // TODO afford action-aware merge, e.g. a priority (partial) ordering
        if (!b) return a;
        if (!a) return b;
        if (a.action) return a;
        if (b.action) return b;
        return {x: a.x + b.x, y: a.y + b.y};
      }, null);

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
