// @ts-check

import {
  Handlers,
  ButtonInputs,
  KeyAliases,
  KeyHighlighter,
  KeySynthesizer,
  KeyChorder,
  KeyChordEvent,
} from './input';
import {
  TileGrid,
  TileInspector, dumpTiles,
} from './tiles';
import {everyFrame, schedule} from './anim';
import {GridLighting} from './fov';

/** @typedef { import("./tiles").Point } Point */
/** @typedef { import("./tiles").Rect } Rect */
/** @typedef { import("./tiles").TileFilter } TileFilter */
/** @typedef { import("./tiles").TileSpec } TileSpec */
/** @typedef { import("./tiles").TileInspectEvent } TileInspectEvent */
/** @typedef {{kind: string}&TileSpec} TileSpecKind */

/**
 * @template T
 * @typedef {object} Anim
 * @prop {number} t
 * @prop {number} et
 * @prop {T} from
 * @prop {T} to
 */

/**
 * @param {DOMgeon} dmg
 * @param {TileGrid} grid
 * @param {HTMLElement[]} interacts
 * @param {HTMLElement} subject
 * @returns {boolean}
 */
function procInteraction(dmg, grid, interacts, subject) {
  if (!interacts.length) return false;
  // TODO interaction loop to choose
  if (interacts.length > 1) return false;
  const interact = interacts[0];

  // TODO cross planar capability
  if (grid.getTilePlane(subject) !== grid.getTilePlane(interact)) return false;

  const pos = grid.getTilePosition(subject);
  const at = grid.getTilePosition(interact);
  if (Math.sqrt(
    Math.pow(at.x - pos.x, 2) +
    Math.pow(at.y - pos.y, 2)
  ) >= 2) return false;

  const kind = grid.getTileKind(interact);
  const proc = dmg.procs[kind];
  if (proc) {
    proc({dmg, grid, object: interact, subject});
    return true;
  }

  const spawn = grid.getTileData(interact, 'morph_spawn');
  if (spawn) {
    const tile = grid.buildTile({pos: at, kind, ...spawn});
    if (tile.id === subject.id) return true;
  }

  applyMorph(grid, interact, grid.getTileData(interact, 'morph_target'));
  applyMorph(grid, subject, grid.getTileData(interact, 'morph_subject'));

  return true;
}

/**
 * A procedure (Proc) involves a subject and object DOMgeon element
 * and produces some effect upon the subject's express interaction
 * with that object.
 *
 * @typedef {Object} ProcOptions
 * @prop {DOMgeon} dmg
 * @prop {TileGrid} grid
 * @prop {HTMLElement} object
 * @prop {HTMLElement} subject
 */

/**
 * A procedure (Proc) involves a subject and object DOMgeon element
 * and produces some effect upon the subject's express interaction
 * with that object.
 *
 * @callback Proc
 * @param {ProcOptions} options
 */

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
function procMove({dmg, grid, mover, move}) {
  const {action, data} = move;

  // interact with target tile
  if (action === 'interact') {
    const tileID = data?.tileID;
    const interact = tileID && grid.getTile(tileID);
    if (interact) procInteraction(dmg, grid, [interact], mover)
    return;
  }

  const plane = grid.getTilePlane(mover);
  const {x, y} = grid.getTilePosition(mover);
  const to = {x: x + move.x, y: y + move.y};
  const at = grid.tilesAt(to);

  // interact with any co-planar tiles present
  let present = at.filter(h => grid.getTilePlane(h) === plane);

  // boop-interact with first present .tile.interact:not(.passable)
  const interacts = present.filter(h =>
    h.classList.contains('interact') &&
    !h.classList.contains('passable')
  );
  if (interacts.length) {
    if (!procInteraction(dmg, grid, interacts, mover)) return;
    // re-query over any interaction updates
    present = grid.tilesAt(to).filter(h => grid.getTilePlane(h) === plane);
  }

  // blocked by any present .tile:not(.passable)
  if (present.some(h => !h.classList.contains('passable'))) return;

  // move must be supported:

  if (
    // mover is self-supported ( #wedontneedroads )
    mover.classList.contains('support') ||
    // otherwise there must present a .tile.support (e.g. a "floor")
    present.some(h => h.classList.contains('support'))
  ) grid.moveTileTo(mover, to);
}

/**
 * @typedef {object} ButtonSpec
 * @prop {string} label
 * @prop {string} [key]
 * @prop {string} [keycode]
 * @prop {string} [title]
 * @prop {string} [legend]
 * @prop {string} [alias]
 * @prop {string[]} [aliasKeys]
 * @prop {string[]} [aliasCodes]
 */

/** @typedef {ButtonSpec&Partial<Move>} ActionButtonSpec */

/**
 * @param {any} btn
 * @returns {null|ActionButtonSpec}
 */
function toActionButtonSpec(btn) {
  if (typeof btn === 'string') btn = JSON.parse(btn);
  if (typeof btn !== 'object') return null;
  // Partial<Move>
  if (btn.action !== undefined && typeof btn.action !== 'string') return null;
  if (btn.x !== undefined && typeof btn.x !== 'number') return null;
  if (btn.y !== undefined && typeof btn.y !== 'number') return null;
  // ButtonSpec
  if (typeof btn.label !== 'string') return null;
  if (btn.key !== undefined && typeof btn.key !== 'string') return null;
  if (btn.keycode !== undefined && typeof btn.keycode !== 'string') return null;
  if (btn.title !== undefined && typeof btn.title !== 'string') return null;
  if (btn.legend !== undefined && typeof btn.legend !== 'string') return null;
  if (btn.data !== undefined) {
    if (typeof btn.data !== 'object') return null;
    if (Object.values(btn.data).some(
      val => val !== undefined && typeof val !== 'string'
    )) return null;
  }
  return btn;
}

/**
 * @param {any} btns
 * @returns {null|ActionButtonSpec[]}
 */
function toActionButtonSpecs(btns) {
  if (typeof btns === 'string') btns = JSON.parse(btns);
  if (!Array.isArray(btns)) return null;
  btns = btns.map(toActionButtonSpec).filter(btn => !!btn);
  return btns.length ? btns : null;
}

/** @type {Object<string, string>} */
const defaultCodeLegends = {
  'ArrowLeft': '←',
  'ArrowDown': '↓',
  'ArrowUp': '↑',
  'ArrowRight': '→',
};

/**
 * @param {HTMLElement} cont
 * @param {null|HTMLButtonElement} button
 * @param {null|ActionButtonSpec} spec
 */
function updateActionButton(cont, button, spec) {
  if (!spec) {
    if (button) button.parentNode?.removeChild(button);
    return;
  }

  let {label, key, keycode, alias, title, legend, action, x, y, data} = spec;
  if (data?.key) ({key, ...data} = data);
  if (data?.keycode) ({keycode, ...data} = data);
  if (data?.legend) ({legend, ...data} = data);

  if (!button) button = cont.appendChild(cont.ownerDocument.createElement('button'));

  const priorData = new Set(Object.keys(button.dataset));

  if (!title) title = '';
  if (button.title !== title) button.title = title;

  if (!key) key = button.dataset['key'];
  if (!keycode) keycode = button.dataset['keycode'];
  if (!legend && keycode) legend = defaultCodeLegends[keycode];
  if (!legend && key) {
    const K = key.toUpperCase();
    if (!label) label = K;
    else if (key.length === 1 && K !== label) legend = K;
  }
  if (button.dataset['key'] !== key) button.dataset['key'] = key;
  if (button.dataset['keycode'] !== keycode) button.dataset['keycode'] = keycode;
  if (button.dataset['alias'] !== alias) button.dataset['alias'] = alias;
  priorData.delete('key');
  priorData.delete('keycode');
  priorData.delete('alias');

  if (!label) label = '';
  else if (legend === label) legend = '';
  if (button.textContent !== label) button.textContent = label;

  if (button.dataset['legend'] !== legend) button.dataset['legend'] = legend;
  priorData.delete('legend');

  if (button.dataset['action'] !== action)
    button.dataset['action'] = action;
  priorData.delete('action');

  if (x !== undefined && !isNaN(x) &&
      y !== undefined && !isNaN(y)) {
    const val = `${x},${y}`;
    if (button.dataset['movedir'] !== val)
      button.dataset['movedir'] = val;
    priorData.delete('movedir');
  }
  if (data) for (const [prop, val] of Object.entries(data)) if (val !== undefined) {
    if (button.dataset[prop] !== val)
      button.dataset[prop] = val;
    priorData.delete(prop);
  }
  for (const prop of priorData)
    delete button.dataset[prop];

  if (spec.aliasKeys) for (const aliasKey of spec.aliasKeys)
    updateActionButton(cont, cont.querySelector(`button[data-key="${aliasKey}"]`), {
      alias: keycode || key,
      label: `Alias: ${keycode || key}`,
      key: aliasKey
    });

  if (spec.aliasCodes) for (const aliasCode of spec.aliasCodes)
    updateActionButton(cont, cont.querySelector(`button[data-keycode="${aliasCode}"]`), {
      alias: keycode || key,
      label: `Alias: ${keycode || key}`,
      keycode: aliasCode,
    });
}

/**
 * @param {HTMLButtonElement} button
 * @returns {Move}
 */
function parseButtonMove(button) {
  const {action, movedir, ...data} = button.dataset;
  let x = NaN, y = NaN;
  if (movedir) {
    const parts = movedir.split(',');
    x = parseFloat(parts[0]);
    y = parseFloat(parts[1]);
  }
  return {action: action || '', x, y, data};
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

class MemeCollector {
  grid
  memeSpace
  ignoreVars = ['x', 'y']
  ignoreClasses = new Map([
    ['tile', null],
    ['meme', null],
    ['input', 'inputable'],
    ['focus', 'focused'],
  ])

  /**
   * @param {TileGrid} grid
   * @param {string} [memeSpace]
   */
  constructor(grid, memeSpace='meme') {
    this.grid = grid;
    this.memeSpace = memeSpace;
  }

  /** @type {Map<string, string>} */
  planes = new Map()

  /** @type {Map<string, HTMLElement>} */
  staleMemes = new Map()

  /** @type {Map<string, TileSpecKind>} */
  freshMemes = new Map()

  /**
   * @param {HTMLElement} tile
   * @returns {TileSpec}
   */
  sense(tile) {
    const spec = {
      className: ['tile', 'meme', ...(tile.className
        .split(/\s+/g)
        .map(n => {
          const ign = this.ignoreClasses.get(n);
          return ign === undefined ? n : ign;
        })
        .filter(n => !!n)
      )].join(' '),
      text: tile.textContent || undefined,
      data: {...tile.dataset},
    };
    for (const ign of this.ignoreVars)
      delete spec.data[ign];
    return spec;
  }

  /**
   * @param {string} plane
   * @param {Point} pos
   * @param {Iterable<HTMLElement>} tiles
   */
  collectMemesAt(plane, pos, tiles) {
    const memePlane = `${plane}-${this.memeSpace}`;
    if (!this.planes.has(plane)) this.planes.set(plane, memePlane);
    for (const meme of this.grid.tilesAt(pos, 'meme'))
      if (this.grid.getTilePlane(meme) === memePlane) {
        const id = this.grid.getTileID(meme);
        if (!this.freshMemes.has(id)) this.staleMemes.set(id, meme);
      }
    for (const tile of tiles) {
      const id = `${this.memeSpace}-${this.grid.getTileID(tile)}`;
      this.freshMemes.set(id, {
        plane: memePlane,
        pos,
        kind: 'meme',
        ...this.sense(tile),
      });
      this.staleMemes.delete(id);
    }
  }

  update() {
    // TODO better long term storage semantics
    const store = this.grid.getPlane(`${this.memeSpace}-store`);
    store.classList.add(this.memeSpace);
    store.style.display = 'none';
    const planes = new Set();
    for (const {plane} of this.freshMemes.values())
      if (plane) planes.add(plane);
    for (const name of planes) {
      const plane = this.grid.getPlane(name);
      plane.classList.add(this.memeSpace);
    }
    for (const [id, kspec] of this.freshMemes)
      this.grid.createTile({id, ...kspec});
    this.freshMemes.clear();
    if (this.staleMemes.size) {
      for (const meme of this.staleMemes.values())
        store.appendChild(meme.parentNode
          ? meme.parentNode.removeChild(meme)
          : meme);
      this.staleMemes.clear();
    }
  }
}

/**
 * Carries config data for a DOMgeon.
 * See DOMgeon.prototype.config for detailed defaults.
 * May pass override to DOMgeon.constructor.
 *
 * @typedef {Object} DOMgeonConfig
 * @prop {ActionButtonSpec[]} moveButtons - movement button definitions;
 * defaults to WASD cardinal moves
 * @prop {number} lightLimit
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

  /** @type {HTMLElement} */
  keys

  /** @type {Handlers} */
  onKey

  /** @type {ButtonInputs} */
  inputs

  /** @type {KeySynthesizer} */
  keySynth

  /** @type {KeyAliases} */
  keyAliases

  /** @type {KeyHighlighter} */
  keyShow

  /** @type {KeyChorder} */
  keyChord

  /** @type {boolean} */
  running = false

  /** @type {Object<string, TileMoverProc>} */
  moveProcs = {
    '': procMove,
  };

  /** @type {Object<string, Proc>} */
  procs = {};

  /** @type {DOMgeonConfig} */
  config = {
    moveButtons: [
      {x: 0, y: -1, keycode: 'ArrowUp', title: 'Move Up', label: '↑'},
      {x: -1, y: 0, keycode: 'ArrowLeft', title: 'Move Left', label: '←'},
      {x: 0, y: 1, keycode: 'ArrowDown', title: 'Move Down', label: '↓'},
      {x: 1, y: 0, keycode: 'ArrowRight', title: 'Move Right', label: '→'},

      {x: 0, y: -1, key: 'w', title: 'Move Up', label: '↑'},
      {x: -1, y: 0, key: 'a', title: 'Move Left', label: '←'},
      {x: 0, y: 1, key: 's', title: 'Move Down', label: '↓'},
      {x: 1, y: 0, key: 'd', title: 'Move Right', label: '→'},

      // These override the existing buttons if present.
      // {x: 0, y: -1, key: 'k', title: 'Move Up', label: '↑'},
      // {x: -1, y: 0, key: 'h', title: 'Move Left', label: '←'},
      // {x: 0, y: 1, key: 'j', title: 'Move Down', label: '↓'},
      // {x: 1, y: 0, key: 'l', title: 'Move Right', label: '→'},
      // {x: 0, y: 0, key: 'r', title: 'Stay (no move)', label: '⊙'},
    ],
    lightLimit: 0.2,
  }

  /**
   * DOMgeon binding elements
   *
   * @typedef {Object} DOMgeonBindings
   * @prop {HTMLElement} grid - document element to place tiles within
   * @prop {HTMLElement} [ui] - document element to toggle UI state classes upon; defaults to grid
   * @prop {HTMLElement} [keys] - document element to listen for key events upon; defaults to ui
   * @prop {HTMLElement} [moveBar] - element under which to place move buttons; defaults to ui
   * @prop {HTMLElement} [actionBar] - element under which to add action buttons; defaults to ui
   * @prop {Object<string, Proc>} [procs] - callbacks for interaction with objects by kind
   */

  /**
   * Options to DOMgeon constructor, must specify a grid binding element, may
   * specify ancillary elements, and config overrides.
   *
   * @typedef {DOMgeonBindings&Partial<DOMgeonConfig>} DOMgeonOptions
   */

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
      actionBar = ui,
      moveBar = ui,

      /** @type {Object<string, Proc>} */
      procs = {},
    } = options;
    this.ui = ui;
    this.keys = keys;
    this.actionBar = actionBar;
    this.moveBar = moveBar;

    this.grid = new TileGrid(grid);
    this.procs = procs;

    this.onKey = new Handlers();
    this.inputs = new ButtonInputs();
    this.keySynth = new KeySynthesizer();
    this.keyAliases = new KeyAliases();
    this.keyShow = new KeyHighlighter();
    this.keyChord = new KeyChorder();

    this.ui.addEventListener('click', this.keyAliases);
    this.ui.addEventListener('click', this.onKey);
    this.ui.addEventListener('click', this.keySynth);
    this.keys.addEventListener('keyup', this.keyShow);
    this.keys.addEventListener('keydown', this.keyShow);
    this.keys.addEventListener('keyup', this.keyAliases);
    this.keys.addEventListener('keydown', this.keyAliases);
    this.keys.addEventListener('keyup', this.onKey);
    this.keys.addEventListener('keydown', this.onKey);
    this.keys.addEventListener('keyup', this.inputs);

    this.onKey.byCode['Escape'] = (ev) => {
      if (ev.type === 'keydown') return;
      if (this.running) this.stop(); else this.start();
    };

    /** @type {null|ActionButtonSpec[]} */
    let moveButtons = toActionButtonSpecs(localStorage.getItem('domgeon.moveButtons'));
    if (!moveButtons) {
      moveButtons = [...this.config.moveButtons];
    } else {
      const moves = new Set(moveButtons.map(({x,y}) => `${x},${y}`));
      if (this.config.moveButtons.some(({x,y}) => !moves.has(`${x},${y}`))) {
        moveButtons.push(...this.config.moveButtons.filter(({x,y}) => !moves.has(`${x},${y}`)));
      }
    }

    if (this.moveBar) for (let moveButton of moveButtons) {
      let {x, y} = moveButton;
      /** @type {null|HTMLButtonElement} */
      const button = this.moveBar.querySelector(`button[data-movedir="${x},${y}"]`);
      updateActionButton(this.moveBar, button, moveButton);
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
   * Consult things like https://easings.net for some likely maths.
   *
   * @param {number} p - animation progress proportion
   * @returns {number} - eased animation progress proportion
   */
  viewAnimEase(p) {
    // sine easing in to the animation
    return 1 - Math.cos((p * Math.PI) / 2);
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
    if (p >= 1) this._viewAnim = null, p = 1
    else this._viewAnim.et = et, p = this.viewAnimEase(et/t);
    this.grid.viewPoint = {
      x: from.x * (1 - p) + p * to.x,
      y: from.y * (1 - p) + p * to.y,
    };
  }

  async start() {
    this.running = true;
    this.ui.classList.toggle('running', true);

    this.keyChord.clear();
    /** @type {null|Set<string>} */
    let lastChord = null;
    /** @param {Event} event */
    const keepLastKeyChord = (event) => {
      if (event instanceof KeyChordEvent)
        lastChord = new Set(event.keys);
    };

    this.keys.addEventListener('keyup', this.keyChord);
    this.keys.addEventListener('keydown', this.keyChord);
    this.keyChord.addEventListener('keychord', keepLastKeyChord);

    this.dispatchEvent(new Event('start'));

    const actor = this.focusedActor();
    if (actor) this.updateActorView(actor);

    await everyFrame(schedule(
      () => !!this.running,
      () => {
        if (lastChord !== null) {
          const actor = this.processInput(lastChord);
          if (actor) this.updateActorView(actor);
          lastChord = null;
        }
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

    this.keyChord.removeEventListener('keychord', keepLastKeyChord);
    this.keys.removeEventListener('keyup', this.keyChord);
    this.keys.removeEventListener('keydown', this.keyChord);

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
   * @param {null|HTMLElement} actor
   * @returns {void}
   */
  updateActorView(actor) {
    if (actor) {
      const pos = this.grid.getTilePosition(actor);
      const wanted = this.wantedViewPoint(pos, this.grid.viewport);
      const to = wanted || (this.grid.hasFixedViewPoint() ? null : pos);
      if (to) {
        if (this.running) this.viewTo(to);
        else this.grid.viewPoint = to;
      }
    } // else TODO what should view track?
    const actorID = actor?.id || '';
    if (actorID !== this._litActorID) this._litActorID = actorID;
    this._runLightAnim(0);
    if (this.actionBar) {
      /** @type {NodeListOf<HTMLButtonElement>} */
      const buttons = this.actionBar.querySelectorAll('button[data-action]');
      const actions = this.collectActions();
      for (let i=0; i<buttons.length || i<actions.length; i++) {
        const button = buttons[i] || null;
        let action = actions[i] || null;
        if (action && i < 10) action = {key: `${i+1}`, ...action};
        updateActionButton(this.actionBar, button, action);
      }
    }
    this.dispatchEvent(new Event('view'));
  }

  focusedActor() {
    /** @type {HTMLElement|null} */
    let actor = this.grid.el.querySelector('.mover.input.focus');
    if (actor) return actor;
    actor = this.grid.el.querySelector('.mover.input');
    if (actor) actor.classList.add('focus');
    return actor;
  }

  _litActorID = '';
  _fovID = '';

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
   * @param {number} _dt
   */
  _runLightAnim(_dt) {
    const scheme = new GridLighting(this.grid);
    scheme.lightLimit = this.config.lightLimit;

    // TODO cache and invalidate on (rare) mutation
    const lightSelectors = Array.from(this._findLightSelectors());

    /**
     * @typedef {object} LitPlane
     * @prop {number} lightScale
     * @prop {HTMLElement[]} actors
     */

    /** @type {Map<string, LitPlane>} */
    const litPlanes = new Map();

    // TODO support multiple view points
    let fovID = '';
    if (this._litActorID) {
      const actor = /** @type {null|HTMLElement} */ (this.grid.el.querySelector(`#${this._litActorID}`));
      if (!actor) return;
      const plane = this.grid.getTilePlane(actor);
      const litPlane = litPlanes.get(plane);
      if (litPlane === undefined) litPlanes.set(plane, {lightScale: 1, actors: [actor]});
      else litPlane.actors.push(actor);
      fovID += `;${plane}:${actor.id}`;
    }
    const fovChanged = this._fovID !== fovID;

    // recompute FOV when changed
    // TODO bring back support for animated light levels
    if (fovChanged) {
      const {w: vw, h: vh} = this.grid.viewport;
      const viewLimit = Math.ceil(Math.sqrt(vw*vw + vh*vh));
      const mc = new MemeCollector(this.grid);
      /** @type {Map<string, HTMLElement>} */
      const otherActors = new Map();
      for (const actor of this.grid.el.querySelectorAll('.mover.input'))
        otherActors.set(actor.id, /** @type {HTMLElement} */ (actor));

      for (const [plane, {lightScale, actors}] of litPlanes) {
        scheme.filter = tile => this.grid.getTilePlane(tile) === plane;
        scheme.clearLight();

        // skip plane if its lightScale is below threshold; this makes it so
        // that we leave the light values cleared within a just-exited plane
        if (lightScale < scheme.lightLimit) continue;

        // add ambient light
        for (const tile of this.grid.queryTiles({plane})) {
          const lightAmbient = this.grid.getTileData(tile, 'lightAmbient');
          if (typeof lightAmbient === 'number')
            scheme.addLight(tile, lightAmbient);
        }

        // add light fields from point sources
        /** @type {Set<string>} */
        const done = new Set();
        for (const lightSelector of lightSelectors) {
          const el = this.grid.getPlane(plane);
          /** @type {NodeListOf<HTMLElement>} */
          const tiles = el.querySelectorAll(lightSelector);
          for (const tile of tiles) if (!done.has(tile.id)) {
            done.add(tile.id);
            scheme.addLightField(tile, {
              lightScale,
              lightInit: this.grid.getTileData(tile, 'lightInit'),
            });
          }
        }

        // reveal actor view fields by extracting seen tile data
        scheme.revealView = (tiles, pos) => mc.collectMemesAt(plane, pos, tiles);
        for (const actor of actors) {
          // TODO compute a tighter viewLimit wrt actor position
          scheme.revealViewField(actor, {depthLimit: viewLimit});
          otherActors.delete(actor.id);
        }
      }

      // also collect any other actor cells
      for (const actor of otherActors.values()) {
        const plane = this.grid.getTilePlane(actor);
        const pos = this.grid.getTilePosition(actor);
        const tiles = this.grid.tilesAt(pos).filter(t => this.grid.getTilePlane(t) === plane);
        mc.collectMemesAt(plane, pos, tiles);
      }

      // clear light within all affected subjective planes
      for (const plane of mc.planes.values()) {
        scheme.filter = tile => this.grid.getTilePlane(tile) === plane;
        scheme.clearLight();
      }

      // copy seen tile data into subjective planes
      mc.update();
      this._fovID = fovID;
    }
  }

  /**
   * @param {Iterable<string>} keys
   * @returns {null|HTMLElement}
   */
  processInput(keys) {
    let move = Array.from(keys)
      .map(key => {
        /** @type {null|HTMLButtonElement} */
        const button =
          this.ui.querySelector(`button[data-keycode="${key}"]`) ||
          this.ui.querySelector(`button[data-key="${key}"]`);
        return button && parseButtonMove(button);
      })
      .reduce(mergeMoves, null);

    let actor = this.focusedActor();
    if (move?.action === 'actor') {
      const actorID = move.data?.actorID;
      const newActor = actorID && this.grid.getTile(actorID);
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
      moveTiles({dmg: this, grid: this.grid, kinds: this.moveProcs});
      this._fovID = ''; // force FOV recompute during next lighting update
    }

    return actor;
  }

  collectActions() {
    /** @type {ActionButtonSpec[]} */
    const actions = [];

    const subject = this.focusedActor();
    const subjectPlane = subject && this.grid.getTilePlane(subject);
    const subjectPos = subject && this.grid.getTilePosition(subject);

    /** @type {NodeListOf<HTMLElement>} */
    const actors = this.grid.el.querySelectorAll('.mover.input:not(.focus)');
    actions.push(...Array.from(actors)
      .map(actor => {
        const pos = this.grid.getTilePosition(actor);
        const dsq = subjectPos
          ? Math.pow(pos.x - subjectPos.x, 2) +
            Math.pow(pos.y - subjectPos.y, 2)
          : 0;
        return {actor, pos, dsq};
      })
      .sort(({dsq: da}, {dsq: db}) => da - db)
      .map(({actor, pos}) => {
        const text = actor.textContent;
        const actorID = this.grid.getTileID(actor);
        return {
          label: `Focus: ${text} <${pos.x},${pos.y}>`,
          action: 'actor',
          data: {actorID},
        };
      }));

    if (subjectPos) {
      const {x, y} = subjectPos;
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
          const at = {x: x + dx, y: y + dy};
          return this.grid.tilesAt(at, 'interact')
            .filter(tile => this.grid.getTilePlane(tile) === subjectPlane);
        })
        .map(tile => ( {tile, pos: this.grid.getTilePosition(tile)} ))
        .sort(({pos: apos}, {pos: bpos}) => bpos.y - apos.y || bpos.x - apos.x)
        .map(({tile}) => tile);

      // TODO directional de-dupe: e.g. open door x2 ... W / E, or Left / Right

      actions.push(...interacts.map(interact => {
        const tileID = this.grid.getTileID(interact);
        return {
          label: actionLabel(this.grid, interact),
          action: 'interact',
          data: {tileID},
        };
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
        plane: 'domgeon-inspect',
      });
    this.grid.moveTileTo(this.cur, pos);
    this.cur.classList.toggle('pinned', pinned);
    const {x, y} = pos;
    const atText = `${isNaN(x) ? 'X' : x},${isNaN(y) ? 'Y' : y}`;
    const at = /** @type {HTMLElement|null} */ (this.el.querySelector('[data-for="pos"]'));
    if (at) at.textContent = atText;
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

/**
 * @typedef {object} TileMove
 * @prop {DOMgeon} dmg
 * @prop {TileGrid} grid
 * @prop {HTMLElement} mover
 * @prop {Move} move
 */

/** @typedef {(req:TileMove) => void} TileMoverProc */

/**
 * A move has a spatial component and an optional action string.
 * The action string may be used to define custom extensions or to otherwise
 * change the semantics of the x,y spatial component.
 *
 * @typedef {object} Move
 * @prop {string} action
 * @prop {number} x
 * @prop {number} y
 * @prop {Object<string, string|undefined>} [data]
 */

/**
 * @param {Object} options
 * @param {DOMgeon} options.dmg
 * @param {TileGrid} options.grid
 * @param {string} [options.moverClass]
 * @param {Object<string, TileMoverProc>} [options.kinds]
 * @return {void}
 */
function moveTiles({dmg, grid, moverClass='mover', kinds}) {
  if (!kinds) {
    moveTileClass({dmg, grid, moverClass});
    return;
  }
  for (const kind in kinds) if (kind)
    moveTileClass({dmg, grid, moverClass, kind, proc: kinds[kind]});
  moveTileClass({dmg, grid, moverClass, proc: kinds['']});
}

/**
 * @param {Object} options
 * @param {DOMgeon} options.dmg
 * @param {TileGrid} options.grid
 * @param {string} [options.moverClass]
 * @param {string} [options.kind]
 * @param {TileMoverProc} [options.proc]
 * @return {void}
 */
function moveTileClass({dmg, grid, moverClass='mover', kind='', proc=defaultMoverProc}) {
  for (const mover of grid.queryTiles({
    className: kind ? [moverClass, kind] : moverClass,
  })) {
    const move = grid.getTileData(mover, 'move');
    grid.setTileData(mover, 'move', null);
    if (!move || typeof move !== 'object') continue;
    proc({dmg, grid, mover, move})
  }
}

/**
 * @param {TileMove} move
 */
function defaultMoverProc({grid, mover, move}) {
  if (move.action) return;
  if (typeof move.x !== 'number' || isNaN(move.x)) return;
  if (typeof move.y !== 'number' || isNaN(move.y)) return;
  const {x, y} = grid.getTilePosition(mover);
  const to = {x: x + move.x, y: y + move.y};
  grid.moveTileTo(mover, to);
}
