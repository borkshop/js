// @ts-check

/**
 * @typedef {Object} Point
 * @prop {number} x
 * @prop {number} y
 */

/**
 * @typedef {Object} Size
 * @prop {number} w
 * @prop {number} h
 */

/**
 * @typedef {Point&Size} Rect
 */

/**
 * @typedef {Object} TileQuery
 *
 * @prop {(string|string[])} [className] - matches tile element class names
 * @prop {string} [id] - matches tile element ID strings
 * @prop {Object<string, string>} [data] - matches tile dataset attributes
 *
 * NOTE: non-string tile data are encoded as JSON
 * NOTE: id and data matcher strings may start with ^ $ or * to encode a
 *       startsWith/endsWith/contains match
 */

/**
 * @callback TileFilter
 * @param {HTMLElement} tile
 * @param {TileGrid} grid
 * @returns {boolean}
 */

/*** @typedef {Object<string,TileDatum>} TileData */
/*** @typedef {string|number|TileDatum[]|TileData} TileDatum */

/**
 * @typedef {object} classMut
 * @prop {string} [toggle]
 * @prop {string} [remove]
 * @prop {string} [add]
 */

/**
 * @typedef TileSpec
 * @prop {Point} [pos] - specifies new tile location within tile coordinate space
 * @prop {string} [kind] - primary tile class name
 * @prop {string|string[]|classMut|classMut[]} [classList] - specifies more
 * limited classList mutations, rather than full className syncing; string args
 * may start with + - or ! to add, remove, or toggle the string remaining
 * string class name, defaulting to add behavior.
 * @prop {string} [text] - specifies new tile innerText content
 * @prop {Partial<CSSStyleDeclaration>} [style] - specifies new tile inline styles
 * @prop {Object<string,any>} [data] - specifies new tile dataset attributes
 */

/**
 * Inserts a 0 bit after each of 26 the low bits of x, masking
 * away any higher bits; this is the best we can do in JavaScript since integer
 * precision maxes out at 53 bits.
 * @param {number} x
 * @return {number}
 */
export function mortonSpread1(x) {
  x =  x             & 0x00000002ffffff; // x = ---- ----  ---- ----  ---- ----  ---- --98  7654 3210  fedc ba98  7654 3210
  x = (x ^ (x << 8)) & 0x0200ff00ff00ff; // x = ---- --98  ---- ----  7654 3210  ---- ----  fedc ba98  ---- ----  7654 3210
  x = (x ^ (x << 4)) & 0x020f0f0f0f0f0f; // x = ---- ----  ---- 7654  ---- 3210  ---- fedc  ---- ba98  ---- 7654  ---- 3210
  x = (x ^ (x << 2)) & 0x02333333333333; // x = ---- --98  --76 --54  --32 --10  --fe --dc  --ba --98  --76 --54  --32 --10
  x = (x ^ (x << 1)) & 0x05555555555555; // x = ---- -9-8  -6-6 -5-4  -3-2 -1-0  -f-e -d-c  -b-a -9-8  -7-6 -5-4  -3-2 -1-0
  return x;
}

/**
 * Removes half (the even ones) of the lower 53 bits from x.
 * @param {number} x
 * @return {number}
 */
export function mortonCompact1(x) {
  x =  x             & 0x05555555555555;
  x = (x ^ (x >> 1)) & 0x02333333333333;
  x = (x ^ (x >> 2)) & 0x020f0f0f0f0f0f;
  x = (x ^ (x >> 4)) & 0x0200ff00ff00ff;
  x = (x ^ (x >> 8)) & 0x00000002ffffff;
  return x;
}

/**
 * @param {Point} p
 * @return the Z-order curve index for for p, aka its "Morton code"
 *
 * See https://en.wikipedia.org/wiki/Z-order_curve
 */
export function mortonKey(p) {
  return mortonSpread1(Math.floor(p.x)) | mortonSpread1(Math.floor(p.y))<<1;
}

/**
 * @typedef {Object} TileSpatialIndex
 * @prop {(ids:string[], pos:Point[]) => void} update
 * @prop {(at:Point) => Set<string>|undefined} tilesAt
 * // TODO range query
 */

class TileMortonIndex {
  /** @type {Map<number, Set<string>>} */
  _fore = new Map();

  /** @type {Map<string, number>} */
  _back = new Map();

  /**
   * @param {string[]} ids
   * @param {Point[]} pos
   * @return {void}
   */
  update(ids, pos) {
    for (let i = 0; i < ids.length; ++i) {
      const id = ids[i];
      const key = mortonKey(pos[i]);
      const prior = this._back.get(id);
      if (prior !== undefined) this._fore.get(prior)?.delete(id);
      const at = this._fore.get(key);
      if (at) at.add(id);
      else this._fore.set(key, new Set([id]));
      this._back.set(id, key);
    }
  }

  /**
   * @param {Point} at
   * @return {Set<string>|undefined}
   */
  tilesAt(at) {
    return this._fore.get(mortonKey(at));
  }
}

export class TileGrid {
  /** @type {HTMLElement} */
  el

  /** @type {ResizeObserver} */
  _obs

  /**
   * @param {HTMLElement} el
   */
  constructor(el) {
    this.el = el;
    this._obs = new ResizeObserver(() => this._updateSize());
    this._obs.observe(this.el);
    const tiles = this.queryTiles();
    this.spatialIndex.update(
      tiles.map(tile => tile.id),
      tiles.map(tile => this.getTilePosition(tile)),
    );
  }

  /** @return {Point} */
  get tileSize() {
    // TODO use an invisible measurement tile? cache?
    for (const tile of /** @type {NodeListOf<HTMLElement>} */ (this.el.querySelectorAll('.tile'))) {
      const x = tile.offsetWidth;
      const y = tile.offsetHeight;
      return {x, y};
    }
    return {x: 0, y: 0};
  }

  /** @return {Point} */
  get viewOffset() {
    const x = parseFloat(this.el.style.getPropertyValue('--xlate-x')) || 0;
    const y = parseFloat(this.el.style.getPropertyValue('--xlate-y')) || 0;
    return {x, y};
  }

  /** @param {Point} p */
  set viewOffset(p) {
    this.el.style.setProperty('--xlate-x', p.x.toString());
    this.el.style.setProperty('--xlate-y', p.y.toString());
  }

  /** @return {Size} */
  get viewSize() {
    const {clientWidth, clientHeight} = this.el,
          {x, y} = this.tileSize;
    return {w: clientWidth / x, h: clientHeight / y};
  }

  /** @return {Rect} */
  get viewport() {
    return {...this.viewOffset, ...this.viewSize};
  }

  /** @type {?Point} */
  _viewPoint = null

  /** @return {Point} */
  get viewPoint() {
    const {x: vx, y: vy, w, h} = this.viewport;
    const x = vx + w / 2, y = vy + h / 2;
    return {x, y};
  }

  hasFixedViewPoint() {
    return this._viewPoint !== null;
  }

  /** @param {Point} p */
  set viewPoint(p) {
    const {x, y} = p;
    if (isNaN(x) || isNaN(y)) return;
    this._viewPoint = {x, y};
    this._updateSize();
  }

  _updateSize() {
    if (!this._viewPoint) return;
    const {x, y} = this._viewPoint;
    const {w, h} = this.viewSize;
    this.viewOffset = {x: x - w / 2, y: y - h / 2};
  }

  idPrefix() { return `${this.el.id}${this.el.id ? '-': ''}tile-`; }

  /** @type Map<string, number> */
  _kindid = new Map()

  /**
   * @param {{kind: string}&TileSpec} spec
   * @returns {HTMLElement}
   */
  buildTile(spec) {
    if (spec.pos) {
      const tile = this.tileAt(spec.pos, spec.kind);
      if (tile) return this.updateTile(tile, spec);
    }
    // TODO garbage re-use
    return this.createTile(spec);
  }

  /**
   * Creates a new tile element from a given specification, returning it.
   *
   * @param {{id?: string, kind: string}&TileSpec} idSpec
   * @return {HTMLElement}
   */
  createTile({id, ...spec}) {
    // const {id, ...rest} = spec;
    let tile = id ? this.getTile(id) : null;
    if (!tile) {
      tile = this.el.ownerDocument.createElement('div');
      this.el.appendChild(tile)
      if (!id) {
        const kind = spec.kind;
        let n = this._kindid.get(kind) || 0;
        id = `${kind}${kind ? '-' : ''}${++n}`;
        this._kindid.set(kind, n);
      }
      tile.id = this.idPrefix() + id;
    }
    tile.classList.add('tile');
    tile.classList.add(spec.kind);
    if (!spec.pos) spec.pos = {x: 0, y: 0};
    return this.updateTile(tile, spec);
  }

  /**
   * Updates an existing tile element to match the given specification.
   *
   * @param {HTMLElement} tile
   * @param {TileSpec} spec
   * @return {HTMLElement}
   */
  updateTile(tile, spec) {
    if (spec.pos) this.moveTileTo(tile, spec.pos);
    if (spec.text) tile.innerText = spec.text;
    if (spec.classList) {
      const classList = Array.isArray(spec.classList) ? spec.classList : [spec.classList];
      for (const mut of classList) {
        if (typeof mut === 'string') {
          if      (mut.startsWith('!')) tile.classList.toggle(mut.slice(1));
          else if (mut.startsWith('-')) tile.classList.remove(mut.slice(1));
          else if (mut.startsWith('+')) tile.classList.add(mut.slice(1));
          else                          tile.classList.add(mut);
        } else {
          if (mut.toggle) tile.classList.toggle(mut.toggle);
          if (mut.remove) tile.classList.remove(mut.remove);
          if (mut.add)    tile.classList.add(mut.add);
        }
      }
    }
    if (spec.style) Object.assign(tile.style, spec.style);
    if (spec.data) {
      for (const [name, value] of Object.entries(spec.data))
        if (value === null || value === undefined) {
          delete tile.dataset[name];
          tile.style.removeProperty(`--${name}`);
        } else {
          const dval = typeof value === 'string' ? value : JSON.stringify(value);
          tile.dataset[name] = dval;
          tile.style.setProperty(`--${name}`, dval);
        }
    }
    return tile;
  }

  /**
   * Get a tile by id string returning null if no such tile exists.
   *
   * @param {string} id
   * @return {HTMLElement|null}
   */
  getTile(id) {
    if (typeof id === 'string') {
      return this.el.querySelector(`#${this.idPrefix()}${id}`);
    }
    return id;
  }

  /**
   * Query a tile returning the first match or null if no tile matches.
   *
   * @param {TileQuery} query
   * @return {HTMLElement|null}
   */
  queryTile(query) {
    return this.el.querySelector(this.tileQuerySelector(query));
  }

  /**
   * Query tiles returing all that match.
   *
   * @param {TileQuery} [query] - optional, match all tiles if omitted.
   * @return {HTMLElement[]}
   */
  queryTiles(query) {
    const els = this.el.querySelectorAll(query ? this.tileQuerySelector(query) : '.tile');
    const tiles = [];
    for (const el of els) if (el)
      tiles.push(/** @type {HTMLElement} */(el));
    return tiles;
  }

  /**
   * @param {?TileQuery} query
   * @return {string}
   */
  tileQuerySelector(query) {
    /**
     * @param {string} s
     * @return {{match:string, value:string}}
     */
    const parseMatcher = (s) => {
      switch (s[0]) {
        case '^':
        case '$':
        case '*':
          return {match: s[0], value: s.slice(1)};
        default:
          return {match: '', value: s};
      }
    };

    /** @type string[] */
    const attrs = [];

    /**
     * @param {string} name
     * @param {string} match
     * @param {string} value
     * @return {void}
     */
    const addAttr = (name, match, value) => { attrs.push(`${name}${match}=${JSON.stringify(value)}`) };

    if (query?.id) {
      let {match, value} = parseMatcher(query.id);
      if (!match || match === '^') value = this.idPrefix() + value;
      addAttr('id', match, value);
    }

    if (query?.data) for (const name in query.data) {
      const {match, value} = parseMatcher(query.data[name]);
      addAttr(`data-${name}`, match, value);
    }

    // TODO how to support className negation
    const tagClasses = typeof query?.className === 'string'
      ? `.${query.className}` : Array.isArray(query?.className)
      ? query?.className.map(t => `.${t}`).join('')
      : '';

    return `.tile${tagClasses}${attrs.map(attr => `[${attr}]`).join('')}`;
  }

  clear() {
    for (const tile of this.queryTiles())
      this.el.removeChild(tile);
  }

  /**
   * Load tile data, first from the tile's dataset, falling back to a computed
   * CSS --name variable.
   *
   * @param {HTMLElement} tile
   * @param {string} name
   * @return {any}
   */
  getTileData(tile, name) {
    let val = tile?.dataset[name];
    if (val === undefined || val === '') {
      val = getComputedStyle(tile).getPropertyValue(`--${name}`);
      if (val === '') return null;
    }
    if (val === undefined) return null;
    if (val === '') return '';
    try {
      return JSON.parse(val);
    } catch(e) {
      return val;
    }
  }

  /**
   * Save tile data: strings and numbers are stored directly, all else is JSON
   * encoded. Data is stored both into the element's dataset and to a CSS
   * --name variable on its inline style declaration.
   *
   * @param {HTMLElement} tile
   * @param {string} name
   * @param {any} value
   * @return {void}
   */
  setTileData(tile, name, value) {
    if (!tile) return;
    if (value === null || value === undefined) {
      delete tile.dataset[name];
      tile.style.removeProperty(`--${name}`);
    } else {
      const dval =
        typeof value === 'string'
        ? value
        : typeof value === 'number'
        ? value.toString()
        : JSON.stringify(value);
      tile.dataset[name] = dval;
      tile.style.setProperty(`--${name}`, dval);
    }
  }

  /**
   * @param {HTMLElement} tile
   * @returns {string} - un-prefixed id string that may be passed back to getTile
   */
  getTileID(tile) {
    const prefix = this.idPrefix();
    return tile.id.startsWith(prefix)
      ? tile.id.slice(prefix.length)
      : tile.id;
  }

  /**
   * Get a tile's current position in tile coordinate space.
   *
   * @param {HTMLElement} tile
   * @return {Point}
   */
  getTilePosition(tile) {
    const x = parseFloat(tile.style.getPropertyValue('--x')) || 0;
    const y = parseFloat(tile.style.getPropertyValue('--y')) || 0;
    return {x, y};
  }

  /**
   * Get a tiles "kind": it's first non-generic class name.
   *
   * @param {HTMLElement} tile
   * @param {string[]} ignore - additional class names that the caller
   * considers generic, and should be ignored in addition to the builtin "tile"
   * class name
   * @returns {string} - the tile's kind or the empty string if the tile only
   * has generic class names
   */
  getTileKind(tile, ...ignore) {
    for (const k of tile.classList)
      if (k !== 'tile' && ignore.every(s => s !== k))
        return k;
    return '';
  }

  /**
   * Move a tile to a given position in tile coordinate space, returning it for
   * convenience.
   *
   * @param {HTMLElement} tile
   * @param {Point} pt
   * @return {Point}
   */
  moveTileTo(tile, pt) {
    tile.style.setProperty('--x', pt.x.toString());
    tile.style.setProperty('--y', pt.y.toString());
    // TODO decouple/batch these with a mutation observer?
    this.spatialIndex.update([tile.id], [pt]);
    return pt;
  }

  /** @type TileSpatialIndex */
  spatialIndex = new TileMortonIndex()

  /**
   * Returns the first tile at a given point, optionally constrained to having
   * all of the given class names, or null if there is no such tile.
   *
   * @param {Point} at
   * @param {string[]} className
   * @return {HTMLElement|null}
   */
  tileAt(at, ...className) {
    const ids = this.spatialIndex.tilesAt(at);
    if (ids) for (const id of ids) {
      const el = /** @type {HTMLElement|null} */ (this.el.querySelector(`#${id}`)) ;
      if (!el) continue;
      if (className.length &&
          !className.every(t => el.classList.contains(t))
      ) continue;
      return el;
    }
    return null;
  }

  /**
   * Returns a list of all tiles at a given point, optionally constrained to
   * having all of the given class names.
   *
   * @param {Point} at
   * @param {string[]} className
   * @return {HTMLElement[]}
   */
  tilesAt(at, ...className) {
    const tiles = [];
    const ids = this.spatialIndex.tilesAt(at);
    if (ids) for (const id of ids) {
      const el = /** @type{HTMLElement|null} */(this.el.querySelector(`#${id}`));
      if (!el) continue;
      if (className.length &&
          !className.every(name => !name || el.classList.contains(name)))
        continue;
      tiles.push((el));
    }
    return tiles;
  }
}

/**
 * @typedef {Object} TileInspectEvent
 * @prop {Point} pos
 * @prop {HTMLElement[]} tiles
 * @prop {boolean} pinned
 */

/**
 * @typedef {(ev:TileInspectEvent)=>void} TileInspectHandler
 */

export class TileInspector {
  /** @type {TileGrid} */
  grid

  /** @type {TileInspectHandler} */
  handler

  /**
   * @param {TileGrid} grid
   * @param {TileInspectHandler} handler
   */
  constructor(grid, handler) {
    this.grid = grid;
    this.handler = handler;
  }

  /** @type {Point|null} */
  pinned = null

  /** @type {TileFilter} */
  filter = _ => true

  /**
   * @param {MouseEvent} ev
   * @return {void}
   */
  handleEvent(ev) {
    let {x, y} = this.grid.viewOffset;
    const gridRect = this.grid.el.getBoundingClientRect();
    const {x: w, y: h} = this.grid.tileSize;
    x += Math.floor((ev.clientX - gridRect.left) / w);
    y += Math.floor((ev.clientY - gridRect.top) / h);
    const pos = {x, y};
    const tiles = this.grid.tilesAt(pos).filter(t => this.filter(t, this.grid));
    switch (ev.type) {
    case 'click':
      if (!tiles.length) this.pinned = null;
      else if (!this.pinned) this.pinned = pos;
      else if (this.pinned.x === pos.x && this.pinned.y === pos.y) this.pinned = null;
      else this.pinned = pos;
      this.update(pos, tiles);
      break;
    case 'mousemove':
      if (this.pinned === null) this.update(pos, tiles);
    }
  }

  refresh() {
    if (!this.pinned) return;
    const pos = this.pinned;
    const tiles = this.grid.tilesAt(pos).filter(t => this.filter(t, this.grid));
    const pinned = !!this.pinned;
    this._lastHandlid = `pinned:${pinned};${pos.x},${pos.y}[${tiles.map(({id}) => id).join(';')}]`;
    this.handler({pos, tiles, pinned});
  }

  /** @type {string} */
  _lastHandlid = ''

  /**
   * @param {Point} pos
   * @param {HTMLElement[]} tiles
   * @return void
   */
  update(pos, tiles) {
    const pinned = !!this.pinned;
    const handlid = `pinned:${pinned};${pos.x},${pos.y}[${tiles.map(({id}) => id).join(';')}]`;
    if (this._lastHandlid !== handlid) {
      this._lastHandlid = handlid;
      this.handler({pos, tiles, pinned});
    }
  }
}

/**
 * @param {Object} options
 * @param {HTMLElement[]} options.tiles
 * @param {HTMLTextAreaElement} options.into
 * @param {boolean} [options.detail]
 * @return void
 */
export function dumpTiles({tiles, into, detail}) {
  /** @param {HTMLElement} t */
  const dumpIDC = t => {
    let line = `id=${t.id}`
    line += ` class=[${Array.from(t.classList).filter(n => n !== 'tile').join(', ')}]`;
    return line;
  };

  /** @param {HTMLElement} t */
  const dumpWithSpec = t => {
    const lines = [dumpIDC(t)];
    // TODO something like grid.getTileSpec(t)
    lines.push(`* text: ${JSON.stringify(t.innerText)}`);
    for (const [name, sval] of Object.entries(t.dataset)) {
      let valLines = [sval];
      if (sval) {
        try {
          const val = JSON.parse(sval);
          valLines = JSON.stringify(val, null, '  ').split("\n");
        } catch (e) {}
      }
      lines.push(`* data[${JSON.stringify(name)}]: ${valLines.shift()}`);
      lines.push(...valLines.map(l => `  ${l}`));
    }
    lines.push('');
    return lines;
  };

  const dump = detail ? dumpWithSpec : dumpIDC;

  if (!tiles.length) {
    into.style.display = 'none';
  } else {
    into.style.display = '';
    const lines = tiles.flatMap(dump);
    into.value = lines.join('\n');
    into.rows = lines.length;
    into.cols = lines.reduce((max, line) => Math.max(max, line.length), 0);
  }
}

// TODO support grouped resolution and/or priority...

/**
 * @typedef {object} TileMove
 * @prop {TileGrid} grid
 * @prop {HTMLElement} mover
 * @prop {Point} pos
 * @prop {string|null} action
 * @prop {Point} to
 * @prop {HTMLElement[]} at
 */

/** @typedef {(req:TileMove) => boolean} TileMoverProc */

/**
 * @param {Object} options
 * @param {TileGrid} options.grid
 * @param {string} [options.moverClass]
 * @param {Object<string, TileMoverProc>} [options.kinds]
 * @return {void}
 */
export function moveTiles({grid, moverClass='mover', kinds}) {
  if (!kinds) {
    moveTileClass({grid, moverClass});
    return;
  }
  for (const kind in kinds) if (kind)
    moveTileClass({grid, moverClass, kind, may: kinds[kind]});
  moveTileClass({grid, moverClass, may: kinds['']});
}

/**
 *
 * @param {Object} options
 * @param {TileGrid} options.grid
 * @param {string} [options.moverClass]
 * @param {string} [options.kind]
 * @param {TileMoverProc} [options.may]
 * @return {void}
 */
export function moveTileClass({grid, moverClass='mover', kind='', may}) {
  for (const mover of grid.queryTiles({
    className: kind ? [moverClass, kind] : moverClass,
  })) {
    const move = grid.getTileData(mover, 'move');
    if (!move || typeof move !== 'object') continue;
    if (move.action !== undefined) {
      if (typeof move.x !== 'number') move.x = NaN;
      if (typeof move.y !== 'number') move.y = NaN;
    } else if (!(
      typeof move.x === 'number' &&
      typeof move.y === 'number'
    )) continue;
    const action = typeof move.action === 'string' ? move.action : null;
    const pos = grid.getTilePosition(mover);
    const to = {x: pos.x + move.x, y: pos.y + move.y};
    const at = grid.tilesAt(to);
    if (!may || may({grid, mover, pos, action, to, at}))
      grid.moveTileTo(mover, to);
    grid.setTileData(mover, 'move', null);
  }
}

/**
 * @param {Point[]} ps
 * @return {Point}
 */
export function centroid(ps) {
  switch (ps.length) {
    case 0: return {x: NaN, y: NaN};
    case 1: return ps[0];
  }
  return ps.slice(1).reduce(({x, y}, p) => {
    x += p.x, y += p.y;
    x /= 2, y /= 2;
    return {x, y};
  }, ps[0]);
}
