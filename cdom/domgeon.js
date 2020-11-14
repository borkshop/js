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
/** @typedef { import("./tiles").Move } Move */
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
 * @typedef {object} ButtonSpec
 * @prop {string} label
 * @prop {string} [key]
 * @prop {string} [title]
 * @prop {string} [legend]
 */

/** @typedef {ButtonSpec&Partial<Move>} ActionButtonSpec */

/**
 * @param {HTMLElement} cont
 * @param {EventListenerOrEventListenerObject} handler
 * @param {null|HTMLButtonElement} button
 * @param {null|ActionButtonSpec} spec
 */
function updateActionButton(cont, handler, button, spec) {
  if (!spec) {
    if (button) button.parentNode?.removeChild(button);
    return;
  }

  let {label, key, title, legend, action, x, y} = spec;

  if (!button) {
    button = cont.appendChild(cont.ownerDocument.createElement('button'));
    button.addEventListener('click', handler);
  }

  if (!title) title = '';
  if (button.title !== title) button.title = title;

  if (!key) key = button.dataset['key'];
  if (!legend && key) {
    const K = key.toUpperCase();
    if (!label) label = K;
    else if (key.length === 1 && K !== label) legend = K;
  }
  if (button.dataset['key'] !== key) button.dataset['key'] = key;

  if (!label) label = '';
  if (button.innerText !== label) button.innerText = label;

  if (button.dataset['legend'] !== legend) button.dataset['legend'] = legend;

  if (button.dataset['action'] !== action)
    button.dataset['action'] = action;

  if (x !== undefined && !isNaN(x) &&
      y !== undefined && !isNaN(y)) {
    const val = `${x},${y}`;
    if (button.dataset['movedir'] !== val)
      button.dataset['movedir'] = val;
  }
}

/**
 * @param {HTMLButtonElement} button
 * @returns {Move}
 */
function parseButtonMove(button) {
  const {action, movedir} = button.dataset;
  let x = NaN, y = NaN;
  if (movedir) {
    const parts = movedir.split(',');
    x = parseFloat(parts[0]);
    y = parseFloat(parts[1]);
  }
  return {action: action || '', x, y};
}

/**
 * @param {Move|null} a
 * @param {Move|null} b
 * @returns {Move|null}
 */
function mergeMoves(a, b) {
  // TODO afford action-aware merge, e.g. a priority (partial) ordering
  if (!b) return a;
  if (!a) return b;
  if (a.action) return a;
  if (b.action) return b;
  return {action: '', x: a.x + b.x, y: a.y + b.y};
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
    if (this.moveBar) for (let {key, label, title, x, y} of [
      {x: 0, y: -1, key: 'w', title: 'Move Up', label: '↑'},
      {x: -1, y: 0, key: 'a', title: 'Move Left', label: '←'},
      {x: 0, y: 1, key: 's', title: 'Move Down', label: '↓'},
      {x: 1, y: 0, key: 'd', title: 'Move Right', label: '→'},
      // {x: 0, y: 0, key: 'r', title: 'Stay (no move)', label: '⊙'},
    ]) {
      /** @type {null|HTMLButtonElement} */
      const button = this.moveBar.querySelector(`button[data-movedir="${x},${y}"]`);
      if (button?.dataset['key']) key = button.dataset['key'];
      const legend = keyLegends[key];
      updateActionButton(this.moveBar, this.keys, button, {
        label, key, title, legend, x, y,
      });
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
    if (this.actionBar) {
      /** @type {NodeListOf<HTMLButtonElement>} */
      const buttons = this.actionBar.querySelectorAll('button[data-action]');
      const actions = this.collectActions();
      for (let i=0; i<buttons.length || i<actions.length; i++) {
        let action = actions[i];
        if (i < 10) action = {key: `${i+1}`, ...action};
        updateActionButton(this.actionBar, this.keys, buttons[i], action);
      }
    }
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

  *_findLightSelectors() {
    for (const styleSheet of this.grid.el.ownerDocument.styleSheets)
      for (const rule of styleSheet.rules) {
        const {selectorText, style} = /** @type {CSSStyleRule} */ (rule);
        if (style.getPropertyValue('--lightInit')) {
          for (const match of selectorText.matchAll(/(\.tile\.[^\s:#\[]+)/g))
            yield match[1];
        }
      }
  }

  /**
   * @param {number} dt
   */
  _runLightAnim(dt) {
    const scheme = new GridLighting(this.grid);

    // TODO cache and invalidate on (rare) mutation
    const lightSelectors = Array.from(this._findLightSelectors());

    /**
     * @typedef {object} LitActor
     * @prop {HTMLElement} actor
     * @prop {number} lightScale
     */

    /**
     * @typedef {object} LitPlane
     * @prop {number} lightScale
     * @prop {Map<string, LitActor>} actors
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
        actors: new Map(),
      });
      if (litPlane.lightScale < lightScale) litPlane.lightScale = lightScale;
      litPlane.actors.set(actor.id, {actor, lightScale});
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
    const {w: vw, h: vh} = this.grid.viewport;
    const viewLimit = Math.ceil(Math.sqrt(vw*vw + vh*vh)); // TODO could be tightened wrt actor position
    for (const [plane, litPlane] of litPlanes.entries()) {
      scheme.filter = tile => this.grid.getTileData(tile, 'plane') === plane;

      // clear prior light
      scheme.clear();

      // skip plane if its lightScale is below threshold; this happens
      // on the last tick of the fade out animation, and makes it so
      // that we leave the light values cleared within a just-exited
      // plane
      if (litPlane.lightScale < scheme.lightLimit) continue;

      // add ambient light
      for (const tile of this.grid.queryTiles({className: plane})) {
        const lightAmbient = this.grid.getTileData(tile, 'lightAmbient');
        if (typeof lightAmbient === 'number')
          scheme.addLight(tile, lightAmbient);
      }

      // add non-actor light fields
      for (const lightSelector of lightSelectors) {
        /** @type {NodeListOf<HTMLElement>} */
        const tiles = this.grid.el.querySelectorAll(lightSelector);
        for (const tile of tiles) if (!litPlane.actors.has(tile.id)) {
          const lightInit = this.grid.getTileData(tile, 'lightInit');
          scheme.addLightField(tile, {lightInit});
        }
      }

      // add actor light fields and reveal FOV
      for (const {actor, lightScale} of litPlane.actors.values()) {
        scheme.addLightField(actor, {lightScale});
        scheme.revealViewField(actor, plane, viewLimit);
      }
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
        /** @type {null|HTMLButtonElement} */
        const button = this.ui.querySelector(`button[data-key="${key}"]`);
        return button && parseButtonMove(button);
      })
      .reduce(mergeMoves, null);

    let actor = this.focusedActor();
    if (move?.action?.startsWith('actor:')) {
      const actorID = move.action.slice(6);
      const newActor = this.grid.getTile(actorID);
      if (newActor) {
        newActor.classList.add('focus');
        if (actor) actor.classList.remove('focus');
        actor = newActor;
      }
      move = null;
    }

    if (move && actor) {
      this.grid.setTileData(actor, 'move', move);
      this.dispatchEvent(new Event('move'));
      moveTiles({grid: this.grid, kinds: this.moveProcs});
    }

    return actor;
  }

  collectActions() {
    /** @type {ActionButtonSpec[]} */
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
