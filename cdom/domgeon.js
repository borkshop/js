// @ts-check

import {
  TileGrid,
  TileInspector, dumpTiles,
  moveTiles,
  centroid,
} from './tiles';
import KeyCtl from './input';
import {everyFrame, schedule} from './anim';
import {updatePlayerFOV} from './fov';

/** @typedef { import("./tiles").Point } Point */
/** @typedef { import("./tiles").TileFilter } TileFilter */
/** @typedef { import("./tiles").TileMoverProc } TileMoverProc */
/** @typedef { import("./tiles").TileSpec } TileSpec */
/** @typedef { import("./tiles").TileInspectEvent } TileInspectEvent */

/** @typedef {Object} DOMgeonOptions
 *
 * @prop {HTMLElement} grid - document element to place tiles within
 * @prop {HTMLElement} [moveBar] - element under which to place move buttons
 * @prop {HTMLElement} [actionBar] - element under which to add action buttons
 * @prop {HTMLElement} [ui] - document element to toggle UI state classes upon
 * @prop {HTMLElement} [keys] - document element to listen for key events upon
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

  if (grid.getTileData(subject, 'plane') !== grid.getTileData(interact, 'plane')) {
    // TODO cross planar capability
    return false;
  }

  const pos = grid.getTilePosition(subject);
  const at = grid.getTilePosition(interact);
  if (Math.sqrt(
    Math.pow(at.x - pos.x, 2) +
    Math.pow(at.y - pos.y, 2)
  ) >= 2) return false;

  const spawn = grid.getTileData(interact, 'morph_spawn');
  if (spawn) {
    const kind = grid.getTileKind(interact);
    const tile = grid.buildTile({pos: at, kind, ...spawn});
    if (tile.id === subject.id) return true;
  }

  applyMorph(grid, interact, grid.getTileData(interact, 'morph_target'));
  applyMorph(grid, subject, grid.getTileData(interact, 'morph_subject'));

  return true;
}

/**
 * @param {TileGrid} grid
 * @param {HTMLElement} tile
 * @param {any} morph
 * @returns {void}
 */
function applyMorph(grid, tile, morph) {
  if (!morph) return;
  if (Array.isArray(morph))
    for (const m of morph) grid.updateTile(tile, {classList: m});
  else if (typeof morph === 'string')
    grid.updateTile(tile, {classList: morph});
  else
    grid.updateTile(tile, morph);
}

/** @type {TileMoverProc} */
export function procMoveAction({grid, mover, action}) {
  if (!action) return true;

  // interact with target tile
  if (action.startsWith('interact:')) {
    const target = action.slice(9);
    if (target.startsWith('tile:')) {
      const interact = grid.getTile(target.slice(5));
      if (interact) procInteraction(grid, [interact], mover)
    }
    // no need for intrinsic spatial move
    return false;
  }

  // TODO intrinsic (cap)abilities

  // unknown action, allow intrinsic move
  return true;
}

/** @type {TileMoverProc} */
function procMove(move) {
  // process non-spatial move
  if (move.action) return procMoveAction(move);

  const {grid, mover, to, at} = move;
  const plane = grid.getTileData(mover, 'plane');

  // interact with any co-planar tiles present
  let present = plane ? at.filter(h => h.classList.contains(plane)) : at;

  // boop-interact with first present .tile.interact:not(.passable)
  const interacts = present.filter(h =>
    h.classList.contains('interact') &&
    !h.classList.contains('passable')
  );
  if (interacts.length) {
    if (!procInteraction(grid, interacts, mover)) return false;
    // re-query over any interaction updates
    present = plane ? grid.tilesAt(to, plane) : grid.tilesAt(to);
  }

  // blocked by any present .tile:not(.passable)
  if (present.some(h => !h.classList.contains('passable'))) return false;

  // move must be supported:

  // mover is self-supported ( #wedontneedroads )
  if (mover.classList.contains('support')) return true;

  // otherwise there must present a .tile.support (e.g. a "floor")
  return present.some(h => h.classList.contains('support'));
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
 * @param {HTMLElement} button
 * @param {object} params
 * @param {string} [params.label]
 * @param {string} [params.legend]
 * @param {string} [params.title]
 * @returns {void}
 */
function updateButton(button, {label, legend, title}) {
  const key = button.dataset['key'];
  if (label) button.innerText = label;
  button.dataset['legend'] = '';
  if (key) {
    const K = key.toUpperCase();
    if (!label)
      button.innerText = K;
    else if (key.length === 1 && K !== label)
      button.dataset['legend'] = K;
  }
  if (legend && legend !== label) button.dataset['legend'] = legend;
  if (title) button.title = title;
}

/**
 * @param {HTMLElement} cont
 * @param {{action:string, label:string}[]} actions
 * @param {EventListenerOrEventListenerObject} handler
 * @returns {void}
 */
function updateActionButtons(cont, actions, handler) {
  /** @type {NodeListOf<HTMLButtonElement>} */
  const buttons = cont.querySelectorAll('button[data-action]');
  for (let i=0; i<buttons.length || i<actions.length; i++) {
    let button = buttons[i];
    if (actions[i] === undefined) {
      button.parentNode?.removeChild(button);
      continue;
    }
    const {action, label} = actions[i];
    if (button === undefined) {
      const key = i < 10 ? `${i+1}` : undefined;
      button = createButton({cont, handler, key, label});
    } else if (button.dataset['action'] !== action || button.innerText !== label) {
      updateButton(button, {label});
    } else continue;
    button.dataset['action'] = action;
  }
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

  /** @type {HTMLElement|null} */
  actionBar

  /** @type {HTMLElement} */
  ui

  /** @type {KeyCtl} */
  keys

  /** @type {boolean} */
  running = false

  /** @type {Object<string, TileMoverProc>} */
  moveProcs = {
    '': procMove,
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

      actionBar,
      moveBar,

      // TODO this should be wholly optional or dropped entirely now that we
      // provide start/stop events
      ui = grid,

      // TODO should the default be more like ownerDocument.body?
      keys = ui,
    } = options;
    this.actionBar = actionBar || null;
    this.moveBar = moveBar || null;
    this.ui = ui;

    this.grid = new TileGrid(grid);
    this.grid.viewPoint = centroid(this.grid.queryTiles({className: ['mover', 'input']})
      .map(input => this.grid.getTilePosition(input)));

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
    const cont = this.moveBar || this.actionBar || this.ui;
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

    const actor = this.focusedActor();
    if (actor) this.updateActorView(actor);

    await everyFrame(schedule(
      () => !!this.running,
      () => {
        const actor = this.processInput();
        if (actor) this.updateActorView(actor);
        return true;
      },
      ...this.animParts,
    ));
    this.dispatchEvent(new Event('stop'));
    this.keys.counting = false;
    this.ui.classList.toggle('running', false);
    this.running = false;
  }

  /**
   * @param {HTMLElement} actor
   * @returns {void}
   */
  updateActorView(actor) {
    const {x: vx, y: vy, w, h} = this.grid.viewport;
    const pos = this.grid.getTilePosition(actor);
    if (!this.grid.hasFixedViewPoint() ||
        pos.x <= vx || pos.y <= vy || pos.x+1 >= vx + w || pos.y+1 >= vy + h)
      this.grid.viewPoint = pos;
    this.updateLighting({actor});
    if (this.actionBar)
      updateActionButtons(this.actionBar, this.collectActions(), this.keys);
  }

  /** @returns {HTMLElement|null} */
  focusedActor() {
    let actor = this.grid.queryTile({className: ['mover', 'input', 'focus']});
    if (!actor) {
      actor = this.grid.queryTile({className: ['mover', 'input']});
      if (actor) actor.classList.add('focus');
    }
    return actor;
  }

  /**
   * @param {HTMLElement} interact
   * @returns {string}
   */
  actionLabel(interact) {
    const kind = this.grid.getTileKind(interact, 'interact') || 'interact';
    const name = this.grid.getTileData(interact, 'name') || kind;
    const action = this.grid.getTileData(interact, 'action');
    return `${action || 'use'} ${name}`;
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

        const action = button.dataset['action'];
        if (action) move.action = action;

        return move;
      }
    }
    return null;
  }

  /**
   * @param {object} [params]
   * @param {HTMLElement} [params.actor]
   * @returns {void}
   */
  updateLighting({
    actor = this.grid.queryTile({className: ['mover', 'input', 'focus']}) || undefined,
  }={}) {
    if (!actor) return; // TODO should we clear any prior?

    const origin = this.grid.getTilePosition(actor);
    updatePlayerFOV({
      grid: this.grid, origin, source: actor,
    });
  }

  /**
   * @returns {null|HTMLElement}
   */
  processInput() {
    let move = Array.from(this.keys.consume() || [])
      .map(key => this.parseButtonKey(key))
      .reduce((a, b) => {
        // TODO afford action-aware merge, e.g. a priority (partial) ordering
        if (!b) return a;
        if (!a) return b;
        if (a.action) return a;
        if (b.action) return b;
        return {x: a.x + b.x, y: a.y + b.y};
      }, null);
    if (!move) return null;

    let actor = this.focusedActor();
    if (move && move.action?.startsWith('actor:')) {
      const actorID = move.action.slice(6);
      const newActor = this.grid.getTile(actorID);
      if (newActor) {
        newActor.classList.add('focus');
        if (actor) actor.classList.remove('focus');
        actor = newActor;
      }
      move = null;
    }
    if (!actor) return null;

    if (move) {
      this.grid.setTileData(actor, 'move', move);
      moveTiles({grid: this.grid, kinds: this.moveProcs});
    }

    return actor;
  }

  collectActions() {
    /** @type {{action:string, label:string}[]} */
    const actions = [];

    const actors = this.grid.queryTiles({className: ['mover', 'input']});
    actions.push(...actors
      .filter(actor => !actor.classList.contains('focus'))
      .map(actor => {
        const pos = this.grid.getTilePosition(actor);
        const text = actor.innerText;
        const actorID = this.grid.getTileID(actor);
        return {
          label: `Focus: ${text} <${pos.x},${pos.y}>`,
          action: `actor:${actorID}`,
        };
      }));

    const actor = actors.filter(actor => actor.classList.contains('focus')).shift();
    if (actor) {
      const pos = this.grid.getTilePosition(actor);
      const interacts = [ // TODO make this stencil configurable
        {x:  0, y:  0},
        {x:  0, y:  1},
        {x:  1, y:  1},
        {x:  1, y:  0},
        {x:  1, y: -1},
        {x:  0, y: -1},
        {x: -1, y: -1},
        {x: -1, y:  0},
        {x: -1, y:  1},
      ]
        .flatMap(({x: dx, y: dy}) => {
          const at = {x: pos.x + dx, y: pos.y + dy};
          return this.grid.tilesAt(at, 'interact');
        })
        .map(tile => ( {tile, pos: this.grid.getTilePosition(tile)} ))
        .sort(({pos: apos}, {pos: bpos}) => bpos.y - apos.y || bpos.x - apos.x)
        .map(({tile}) => tile);

      // TODO directional de-dupe: e.g. open door x2 ... W / E, or Left / Right

      actions.push(...interacts.map(interact => {
        const label = this.actionLabel(interact);
        const tileID = this.grid.getTileID(interact);
        const action = `interact:tile:${tileID}`;
        return {action, label};
      }));
    }

    return actions;
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
  inspect({pos, tiles, pinned}) {
    if (!this.cur?.parentNode)
      this.cur = this.dmg.grid.createTile({kind: 'inspect-cursor'});
    this.grid.moveTileTo(this.cur, pos);
    this.cur.classList.toggle('pinned', pinned);
    const at = /** @type {HTMLElement|null} */ (this.el.querySelector('[data-for="pos"]'));
    if (at) {
      const {x, y} = pos;
      at.innerText = `${isNaN(x) ? 'X' : x},${isNaN(y) ? 'Y' : y}`;
    }
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
