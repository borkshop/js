// @ts-check

import {
  TileGrid,
  TileInspector, dumpTiles,
  moveTiles,
  centroid,
} from './tiles';
import KeyCtl from './input';
import {everyFrame, schedule} from './anim';
import {GridLighting} from './fov';

/** @typedef { import("./tiles").Point } Point */
/** @typedef { import("./tiles").Rect } Rect */
/** @typedef { import("./tiles").TileFilter } TileFilter */
/** @typedef { import("./tiles").TileMoverProc } TileMoverProc */
/** @typedef { import("./tiles").TileSpec } TileSpec */
/** @typedef { import("./tiles").TileInspectEvent } TileInspectEvent */

/**
 * @template T
 * @typedef {object} Anim
 * @prop {number} t
 * @prop {number} et
 * @prop {T} from
 * @prop {T} to
 */

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

  // TODO cross planar capability
  if (grid.getTileData(subject, 'plane') !== grid.getTileData(interact, 'plane')) return false;

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
  let present = at.filter(h => grid.getTileData(h, 'plane') === plane);

  // boop-interact with first present .tile.interact:not(.passable)
  const interacts = present.filter(h =>
    h.classList.contains('interact') &&
    !h.classList.contains('passable')
  );
  if (interacts.length) {
    if (!procInteraction(grid, interacts, mover)) return false;
    // re-query over any interaction updates
    present = grid.tilesAt(to).filter(h => grid.getTileData(h, 'plane') === plane);
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
 * @param {string} key
 * @param {NodeListOf<HTMLButtonElement>} buttons
 * @returns {null|Move}
 */
function parseButtonKey(key, buttons) {
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
 * @param {TileGrid} grid
 * @param {HTMLElement} tile
 * @returns {string}
 */
function actionLabel(grid, tile) {
  const kind = grid.getTileKind(tile, 'interact') || 'interact';
  const name = grid.getTileData(tile, 'name') || kind;
  const action = grid.getTileData(tile, 'action');
  return `${action || 'use'} ${name}`;
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
    this.grid.viewPoint = centroid(
      Array.from(this.grid.queryTiles({className: ['mover', 'input']}))
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

  /**
   * How long viewport move animations should take; default 1s.
   */
  viewAnimTime = 1000

  /**
   * @param {number} p - animation progress proportion
   * @returns {number} - eased animation progress proportion
   */
  viewAnimEase(p) {
    // circular ease in/out
    return p < 0.5
      ? (1 - Math.sqrt(1 - Math.pow( 2 * p,     2)))     / 2
      : (    Math.sqrt(1 - Math.pow(-2 * p + 2, 2)) + 1) / 2;
  }

  /**
   * Sets a goal point for viewport animation to re-center upon, superceding
   * any previous goal point. The animation takes plaec over the next t time,
   * defaulting to 100ms.
   *
   * @param {Point} to - new grid viewPoint
   * @param {number} t - how long the animation should take
   * @returns {void}
   */
  viewTo(to, t=this.viewAnimTime) {
    const at = this.grid.viewPoint;
    if (this.grid.hasFixedViewPoint()) {
      if (at.x === to.x && at.y === to.y) return;
    }
    this._viewAnim = {t, et: 0, from: at, to};
  }

  /** @type {null|Anim<Point>} */
  _viewAnim = null

  /**
   * @param {number} dt
   * @returns {void}
   */
  _animView(dt) {
    if (!this._viewAnim) return;
    let {t, et, from, to} = this._viewAnim;
    et += dt;
    let p = et/t;
    if (p >= 1) this._viewAnim = null;
    else this._viewAnim.et = et;

    this.grid.viewPoint = {
      x: from.x * (1 - p) + p * to.x,
      y: from.y * (1 - p) + p * to.y,
    };
  }

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
      (dt) => {
        this._animView(dt);
        this._runLightAnim(dt);
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
   * Computes any newly desired grid viewPoint to (re)-center upon given the
   * position of the currently focused actor.
   *
   * The default simply returns pos so that we alway follow the new player
   * location. If instead you only want to move the viewport when the player
   * tries to go outside of it, override with something like:
   *
   *   (pos, {x: vx, y: vy, w: vw, h: vh}) => (
   *       pos.x   <= vx      ? pos
   *     : pos.y   <= vy      ? pos
   *     : pos.x+1 >= vx + vw ? pos
   *     : pos.y+1 >= vy + vh ? pos
   *     : null);
   *
   * @param {Point} pos - position of the currently focused actor
   * @param {Rect} _viewport - current viewport rectangle in tile space
   * @returns {null|Point} - null for no change, or a new viewPoint
   */
  wantedViewPoint(pos, _viewport) {
    return pos;
  }

  /**
   * @param {HTMLElement} actor
   * @returns {void}
   */
  updateActorView(actor) {
    const pos = this.grid.getTilePosition(actor);
    const wanted = this.wantedViewPoint(pos, this.grid.viewport);
    if (wanted) this.viewTo(wanted);
    else if (!this.grid.hasFixedViewPoint()) this.viewTo(pos);
    this.updateLighting({actor});
    if (this.actionBar)
      updateActionButtons(this.actionBar, this.collectActions(), this.keys);
    this.dispatchEvent(new Event('view'));
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

  _litActorID = ''

  /** @type {({id:string}&Anim<number>)[]} */
  _lightAnim = []

  /**
   * @param {string} id
   * @param {number} from
   * @param {number} to
   */
  _updateLightAnim(id, from, to) {
    for (let i = 0; i < this._lightAnim.length; ++i) {
      const anim = this._lightAnim[i];
      if (anim.id === id) {
        const p = anim.et / anim.t;
        const v = anim.from*(1 - p) + anim.to*p;
        this._lightAnim[i] = {id, t: p*this.viewAnimTime, et: 0, from: v, to};
        return;
      }
    }
    this._lightAnim.push({id, t: this.viewAnimTime, et: 0, from, to})
  }

  /**
   * @param {number} dt
   */
  _runLightAnim(dt) {
    const scheme = new GridLighting(this.grid);

    /**
     * @typedef {object} LitActor
     * @prop {HTMLElement} actor
     * @prop {number} lightScale
     */

    /**
     * @typedef {object} LitPlane
     * @prop {number} lightScale
     * @prop {LitActor[]} actors
     */

    /** @type {Map<string, LitPlane>} */
    const litPlanes = new Map();

    /**
     * @param {string} id
     * @param {number} lightScale
     */
    const collectActor = (id, lightScale=1) => {
      const actor = /** @type {null|HTMLElement} */ (this.grid.el.querySelector(`#${id}`));
      if (!actor) return;
      const plane = this.grid.getTileData(actor, 'plane');
      let litPlane = litPlanes.get(plane);
      if (litPlane === undefined) litPlanes.set(plane, litPlane = {
        lightScale: 0,
        actors: [],
      });
      if (litPlane.lightScale < lightScale) litPlane.lightScale = lightScale;
      litPlane.actors.push({actor, lightScale});
    };

    // collect lit actors, advancing any animation times
    if (this._lightAnim.length) {
      for (let i = 0; i < this._lightAnim.length; ++i) {
        this._lightAnim[i].et += dt;
        const {id, et, t, from, to} = this._lightAnim[i];
        const p = this.viewAnimEase(et/t);
        const v = (1 - p)*from + p*to;
        collectActor(id, v);
      }
      this._lightAnim = this._lightAnim.filter(({et, t}) => et < t);
    } else if (this._litActorID) {
      collectActor(this._litActorID);
    }

    // light each involved plane
    for (const [plane, litPlane] of litPlanes.entries()) {
      scheme.filter = tile => this.grid.getTileData(tile, 'plane') === plane;

      // clear prior light
      scheme.clear();

      // add actor light fields
      for (const {actor, lightScale} of litPlane.actors)
        scheme.addField(actor, {lightScale});
    }
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

    // TODO environmental sources

    if (actor.id !== this._litActorID) {
      this._updateLightAnim(actor.id, 0, 1);
      if (this._litActorID)
        this._updateLightAnim(this._litActorID, 1, 0);
      this._litActorID = actor.id;
    }
    this._runLightAnim(0);
  }

  /**
   * @returns {null|HTMLElement}
   */
  processInput() {
    let move = Array.from(this.keys.consume() || [])
      .map(key => {
        /** @type {NodeListOf<HTMLButtonElement>} */
        const buttons = this.ui.querySelectorAll('button[data-key]');
        return parseButtonKey(key, buttons);
      })
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
      this.dispatchEvent(new Event('move'));
      moveTiles({grid: this.grid, kinds: this.moveProcs});
    }

    return actor;
  }

  collectActions() {
    /** @type {{action:string, label:string}[]} */
    const actions = [];

    const actors = Array.from(this.grid.queryTiles({className: ['mover', 'input']}));
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
        const tileID = this.grid.getTileID(interact);
        const action = `interact:tile:${tileID}`;
        const label = actionLabel(this.grid, interact);
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
      this.cur = this.dmg.grid.createTile({
        kind: 'inspect-cursor',
        data: {plane: 'domgeon-inspect'},
      });
    this.grid.moveTileTo(this.cur, pos);
    this.cur.classList.toggle('pinned', pinned);
    const {x, y} = pos;
    const atText = `${isNaN(x) ? 'X' : x},${isNaN(y) ? 'Y' : y}`;
    const at = /** @type {HTMLElement|null} */ (this.el.querySelector('[data-for="pos"]'));
    if (at) at.innerText = atText;
    const txt = this.el.querySelector('textarea');
    if (txt) dumpTiles({tiles, into: txt, detail: pinned});
    if (pinned) {
      console.groupCollapsed(`tiles @${atText}`);
      for (const tile of tiles) console.log(tile);
      console.groupEnd();
    }
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
