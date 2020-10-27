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

/*** @typedef {Object<string,TileDatum>} TileData */
/*** @typedef {string|number|TileDatum[]|TileData} TileDatum */

/**
 * @typedef TileSpec
 * @prop {Point} [pos] - specifies new tile location within tile coordinate space
 * @prop {string|string[]} [className] - specifies new tile class name or list of names
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
  #fore = new Map();

  /** @type {Map<string, number>} */
  #back = new Map();

  /**
   * @param {string[]} ids
   * @param {Point[]} pos
   * @return {void}
   */
  update(ids, pos) {
    for (let i = 0; i < ids.length; ++i) {
      const id = ids[i];
      const key = mortonKey(pos[i]);
      const prior = this.#back.get(id);
      if (prior !== undefined) this.#fore.get(prior)?.delete(id);
      const at = this.#fore.get(key);
      if (at) at.add(id);
      else this.#fore.set(key, new Set([id]));
      this.#back.set(id, key);
    }
  }

  /**
   * @param {Point} at
   * @return {Set<string>|undefined}
   */
  tilesAt(at) {
    return this.#fore.get(mortonKey(at));
  }
}

export class TileGrid {
  /** @type {HTMLElement} */
  el

  /** @type {string} */
  idspace = 'tile' // TODO autogen this

  /** @type {ResizeObserver} */
  #obs

  /**
   * @param {HTMLElement} el
   */
  constructor(el) {
    this.el = el;
    this.#obs = new ResizeObserver(() => this._updateSize());
    this.#obs.observe(this.el);
    const tiles = this.queryTiles();
    this.spatialIndex.update(
      tiles.map(tile => tile.id),
      tiles.map(tile => this.getTilePosition(tile)),
    );
  }

  /** @return {Point} */
  get tileSize() {
    // TODO use an invisible measurement tile? cache?
    for (const tile of this.el.querySelectorAll('.tile')) {
      const x = tile.clientWidth;
      const y = tile.clientHeight;
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
    this.el.style.setProperty('--xlate-x', Math.floor(p.x).toString());
    this.el.style.setProperty('--xlate-y', Math.floor(p.y).toString());
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
  #viewPoint = null

  /** @return {Point} */
  get viewPoint() {
    const {x: vx, y: vy, w, h} = this.viewport;
    const x = vx + w / 2, y = vy + h / 2;
    return {x, y};
  }

  /** @param {Point} p */
  set viewPoint(p) {
    const {x, y} = p;
    if (isNaN(x) || isNaN(y)) return;
    this.#viewPoint = {x, y};
    this._updateSize();
  }

  _updateSize() {
    if (!this.#viewPoint) return;
    const {x, y} = this.#viewPoint;
    const {w, h} = this.viewSize;
    this.viewOffset = {x: x - w / 2, y: y - h / 2};
  }

  /**
   * maps a specified id string (see TileSpec) into the grid's namespace,
   * attempting to keep tile ids unique within the owning document.
   *
   * @param {string} id
   * @return {string}
   */
  tileID(id) {
    return `${this.el.id}${this.el.id ? '-': ''}${this.idspace}-${id}`;
  }

  /** @type Map<string, number> */
  #kindid = new Map()

  /**
   * Creates a new tile element from a given specification, returning it.
   *
   * @param {{id?: string}&TileSpec} idSpec
   * @return {HTMLElement}
   */
  createTile({id, ...spec}) {
    // const {id, ...rest} = spec;
    let tile = id ? this.getTile(id) : null;
    if (!tile) {
      tile = this.el.ownerDocument.createElement('div');
      this.el.appendChild(tile)
      if (!id) {
        let kind = '';
        if (typeof spec.className === 'string') kind = spec.className;
        else if (Array.isArray(spec.className)) kind = spec.className[0];
        let n = this.#kindid.get(kind) || 0;
        id = `${kind}${kind ? '-' : ''}${++n}`;
        this.#kindid.set(kind, n);
      }
      tile.id = this.tileID(id)
    }
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
    if (spec.className) {
      tile.className = 'tile';
      if (typeof spec.className === 'string') tile.classList.add(spec.className);
      else if (Array.isArray(spec.className))
        for (const name of spec.className) tile.classList.add(name);
    } else if (!tile.className) tile.className = 'tile';
    if (spec.style) Object.assign(tile.style, spec.style);
    if (spec.data) {
      for (const [name, value] of Object.entries(spec.data))
        if (value === null || value === undefined)
          delete tile.dataset[name];
        else if (typeof value === 'string')
          tile.dataset[name] = value;
        else
          tile.dataset[name] = JSON.stringify(value);
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
      return this.el.querySelector('#' + this.tileID(id));
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
      if (!match || match === '^') value = `${this.idspace}-${value}`;
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
   * Load JSON encoded data from tile's dataset.
   *
   * @param {HTMLElement} tile
   * @param {string} name
   * @return {any}
   */
  getTileData(tile, name) {
    const val = tile?.dataset[name];
    if (!val) return null;
    try {
      return JSON.parse(val);
    } catch(e) {
      return val;
    }
  }

  /**
   * Save data to tile's dataset in JSON encoded form.
   *
   * @param {HTMLElement} tile
   * @param {string} name
   * @param {any} value
   * @return {void}
   */
  setTileData(tile, name, value) {
    if (!tile) return;
    if (typeof value === 'string') tile.dataset[name] = value;
    else if (value === null || value === undefined) delete tile.dataset[name];
    else tile.dataset[name] = JSON.stringify(value);
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
          !className.every(name => el.classList.contains(name)))
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

  /**
   * @param {MouseEvent} ev
   * @return {void}
   */
  handleEvent(ev) {
    let {x, y} = this.grid.viewOffset;
    const gridRect = this.grid.el.getBoundingClientRect();
    const {x: w, y: h} = this.grid.tileSize;
    x += (ev.clientX - gridRect.left) / w;
    y += (ev.clientY - gridRect.top) / h;
    this.update({x, y});
  }

  /** @type {string} */
  #lastHandlid = ''

  /**
   * @param {Point} pos
   * @return void
   */
  update(pos) {
    const tiles = this.grid.tilesAt(pos);
    const handlid = `${pos.x},${pos.y}[${tiles.map(({id}) => id).join(';')}]`;
    if (this.#lastHandlid !== handlid) {
      this.#lastHandlid = handlid;
      this.handler({pos, tiles});
    }
  }
}

/**
 * @param {Object} options
 * @param {HTMLElement[]} options.tiles
 * @param {HTMLTextAreaElement} options.into
 * @param {(tile: HTMLElement)=>string} [options.dump]
 * @return void
 */
export function dumpTiles({tiles, into, dump}) {
  if (!dump) dump = t => {
    let line = `id=${t.id}`
    line += ` class=[${Array.from(t.classList).filter(n => n !== 'tile').join(', ')}]`;
    return line;
  };

  if (!tiles.length) {
    into.style.display = 'none';
  } else {
    into.style.display = '';
    const lines = tiles.map(dump);
    into.value = lines.join('\n');
    into.rows = lines.length;
    into.cols = lines.reduce((max, line) => Math.max(max, line.length), 0);
  }
}

// TODO support grouped resolution and/or priority...

/** @typedef {(req:{
 *   grid: TileGrid,
 *   mover: HTMLElement,
 *   at: HTMLElement[],
 *   pos: Point,
 *   to: Point,
 * }) => boolean} TileMoverProc
 */

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
    if (!(
      'x' in move && typeof move.x === 'number' &&
      'y' in move && typeof move.y === 'number'
    )) continue;
    const pos = grid.getTilePosition(mover);
    const to = {x: pos.x + move.x, y: pos.y + move.y};
    const at = grid.tilesAt(to);
    if (!may || may({grid, mover, at, pos, to}))
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
