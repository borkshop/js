// @ts-check

// TODO some sort of element data util module?

/** Load element data, first from its dataset, falling back to a computed CSS
 * --name variable.
 *
 * @param {HTMLElement} el
 * @param {string} name
 * @return {any}
 */
export function getElData(el, name) {
  let val = el?.dataset[name];
  if (val === undefined || val === '') {
    val = getComputedStyle(el).getPropertyValue(`--${name}`);
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

/** Set element data: strings and numbers are stored directly, all else is JSON
 * encoded. Data is stored both into the element's dataset and to a CSS
 * --name variable on its inline style declaration.
 *
 * @param {HTMLElement} el
 * @param {string} name
 * @param {any} value
 * @return {void}
 */
export function setElData(el, name, value) {
  if (!el) return;
  if (value === null || value === undefined) {
    delete el.dataset[name];
    el.style.removeProperty(`--${name}`);
  } else {
    const dval =
      typeof value === 'string'
      ? value
      : typeof value === 'number'
      ? value.toString()
      : JSON.stringify(value);
    el.dataset[name] = dval;
    el.style.setProperty(`--${name}`, dval);
  }
}

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

// TODO probably drop TileQuery

/**
 * @typedef {Object} TileQuery
 *
 * @prop {string} [plane]
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
 * @prop {string} [plane] - optional tile plane; if set, tile is appended to a
 * div.plane element, otherwise directly to the grid element.
 * @prop {string} [kind] - primary tile class name
 * @prop {string} [className] - optional, base before any classList mods; need
 * not contain "tile"
 * @prop {string|string[]|classMut|classMut[]} [classList] - specifies more
 * limited classList mutations, rather than full className syncing; string args
 * may start with + - or ! to add, remove, or toggle the string remaining
 * string class name, defaulting to add behavior.
 * @prop {string} [text] - specifies new tile textContent
 * @prop {Partial<CSSStyleDeclaration>} [style] - specifies new tile inline styles
 * @prop {Object<string,any>} [data] - specifies new tile dataset attributes
 */

/** @typedef {TileSpec&{
 *   id?: string
 *   kind: string
 *   tag?: string
 * }} NewTileSpec */

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
 * Abstract interface that any TileGrid spatial index needs to implement.
 *
 * @typedef {Object} TileSpatialIndex
 * @prop {(ids:string[], pos:Point[]) => void} update
 * @prop {(at:Point) => Iterable<string>} tilesAt
 * // TODO range query
 */

/**
 * Provides fast "get all tiles at a given location" querying, avoiding the
 * need to loop through all tiles.
 *
 * @implements {TileSpatialIndex}
 */
class TileMortonIndex {
  // TODO for a hashmap-based index like this, there's an efficiency tradeoff
  // between storing single locations and storing coarser granularities, say a
  // 4x4 patch of locations in one hashmap entry, and then using an inner for
  // loop over those chunks when querying. However this is likely to be more
  // material to range queries, than single-point queries, so going with the
  // finest granularity for now.

  /**
   * Maps spatial keys to sets of tile IDs; used for point queries.
   *
   * @type {Map<number, Set<string>>}
   */
  _fore = new Map();

  /**
   * Maps tile IDs to last-indexed spatial key; used to remove (invalidate)
   * prior _fore entry when updated.
   *
   * @type {Map<string, number>}
   */
  _back = new Map();

  /**
   * Updates index mappings when tile locations change.
   *
   * @param {string[]} ids - batch of updated tile IDs
   * @param {Point[]} pos - aligned list of positions for each updated id
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
   * @param {Point} at - query location
   * @return {Iterable<string>} - set of tile IDs present at at
   */
  *tilesAt(at) {
    const got = this._fore.get(mortonKey(at));
    if (got) yield* got;
  }
}

export class TileGrid {
  /** @type {HTMLElement} */
  el

  /** @type {ResizeObserver} */
  _obs

  /** @type {HTMLElement} */
  _ghost

  /**
   * @param {HTMLElement} el
   */
  constructor(el) {
    this.el = el;
    this._obs = new ResizeObserver(() => this._updateSize());
    this._obs.observe(this.el);
    this._ghost = this.el.ownerDocument.createElement('div');
    this._ghost.style.display = 'initial';
    this._ghost.style.visibility = 'hidden';
    const tiles = Array.from(this.queryTiles()).filter(({id}) => !!id);
    this.spatialIndex.update(
      tiles.map(tile => tile.id),
      tiles.map(tile => this.getTilePosition(tile)),
    );
  }

  /**
   * @param {Point} client
   * @returns {Point}
   */
  translateClient(client) {
    let {x, y} = this.viewOffset;
    const gridRect = this.el.getBoundingClientRect();
    const {x: w, y: h} = this.tileSize;
    x = Math.floor(x + (client.x - gridRect.left) / w);
    y = Math.floor(y + (client.y - gridRect.top) / h);
    return {x, y};
  }

  /** @return {Point} */
  get tileSize() {
    if (!this._ghost.parentNode) this.updateTile(this._ghost, {
      className: '_ghost',
      text: 'X',
    });
    const x = this._ghost.offsetWidth;
    const y = this._ghost.offsetHeight;
    return {x, y};
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

  /** @return {Rect} */
  get viewbox() {
    let {x, y} = this.viewOffset;
    let {w, h} = this.viewSize;
    x = Math.ceil(x), y = Math.ceil(y);
    w = Math.floor(w), h = Math.floor(h);
    return {x, y, w, h};
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
   * @param {NewTileSpec} spec
   * @returns {HTMLElement}
   */
  buildTile(spec) {
    if (spec.plane && spec.pos) {
      const tile = this.tileAt(spec.plane, spec.pos, spec.kind);
      if (tile) return this.updateTile(tile, spec);
    }
    // TODO garbage re-use
    return this.createTile(spec);
  }

  /**
   * Creates a new tile element from a given specification, returning it.
   *
   * @param {NewTileSpec} idSpec
   * @return {HTMLElement}
   */
  createTile({id, ...spec}) {
    // const {id, ...rest} = spec;
    let tile = id ? this.getTile(id) : null;
    if (!tile) {
      tile = this.el.ownerDocument.createElement(spec.tag || 'div');
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
   * @param {string} name
   * @returns {HTMLElement}
   */
  getPlane(name) {
    if (!name) return this.el;
    /** @type {HTMLElement|null} */
    let plane = this.el.querySelector(`.plane[data-plane="${name}"]`);
    if (!plane) {
      plane = this.el.ownerDocument.createElement('div');
      plane.className = 'plane';
      plane.dataset['plane'] = name;
      plane.style.setProperty('--plane', name);
      plane.id = `${this.idPrefix()}${name}`;
      this.el.appendChild(plane);
    }
    return plane;
  }

  /**
   * @param {HTMLElement} tile
   * @returns {string}
   */
  getTilePlane(tile) {
    const parent = tile.parentNode;
    if (!parent) return '';
    if (!(parent instanceof HTMLElement)) return '';
    return parent.dataset['plane'] || '';
  }

  /**
   * Updates an existing tile element to match the given specification.
   *
   * @param {HTMLElement} tile
   * @param {TileSpec} spec
   * @return {HTMLElement}
   */
  updateTile(tile, spec) {
    if (tile.parentNode && spec.plane !== undefined && spec.plane !== this.getTilePlane(tile))
      this.getPlane(spec.plane).appendChild(
        tile.parentNode.removeChild(tile));
    if (spec.pos) this.moveTileTo(tile, spec.pos);
    if (spec.text) tile.textContent = spec.text;
    if (spec.className) tile.className = `tile ${spec.kind || ''} ${spec.className}`;
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
    if (!tile.parentNode)
      this.getPlane(spec.plane || '').appendChild(tile);
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
    const plane = this.getPlane(query.plane || '');
    return plane.querySelector(this.tileQuerySelector(query));
  }

  /**
   * Query tiles returing all that match.
   *
   * @param {TileQuery} [query] - optional, match all tiles if omitted.
   * @return {NodeListOf<HTMLElement>}
   */
  queryTiles(query) {
    const plane = this.getPlane(query?.plane || '');
    const els = plane.querySelectorAll(query ? this.tileQuerySelector(query) : '.tile');
    return /** @type {NodeListOf<HTMLElement>} */(els);
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

    return `${query?.plane ? `.plane[data-plane="${query.plane}"] `
    : ''}.tile${tagClasses}${attrs.map(attr => `[${attr}]`).join('')}`;
  }

  clear() {
    for (const tile of this.queryTiles())
      if (tile !== this._ghost)
        tile.parentNode?.removeChild(tile);
    this._viewPoint = null;
    this._updateSize();
  }

  /**
   * @param {HTMLElement} tile
   * @param {string} name
   * @return {any}
   */
  getTileData(tile, name) { return getElData(tile, name) }

  /**
   * @param {HTMLElement} tile
   * @param {string} name
   * @param {any} value
   * @return {void}
   */
  setTileData(tile, name, value) { setElData(tile, name, value) }

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
  spatialIndex = new TileMortonIndex();

  /**
   * Returns a list of all tiles at a given point in a plane, optionally
   * constrained to having all of the given class names.
   *
   * @param {string|HTMLElement} plane
   * @param {Point} at
   * @param {string[]} className
   * @return {IterableIterator<HTMLElement>}
   */
  *tilesAt(plane, at, ...className) {
    const pel = typeof plane === 'string' ? this.getPlane(plane) : plane;
    for (const id of this.spatialIndex.tilesAt(at)) {
      const el = pel.querySelector(`#${id}`);
      if (!el || !(el instanceof HTMLElement)) continue;
      if (className.length &&
          !className.every(name => !name || el.classList.contains(name)))
        continue;
      yield el;
    }
  }

  /**
   * Returns the first tile at a given point in a plane, optionally constrained
   * to having all of the given class names, or null if there is no such tile.
   *
   * @param {string|HTMLElement} plane
   * @param {Point} at
   * @param {string[]} className
   * @return {HTMLElement|null}
   */
  tileAt(plane, at, ...className) {
    for (const el of this.tilesAt(plane, at, ...className))
      return el;
    return null;
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
  pinned = null;

  /**
   * @param {Point} pos
   * @returns {IterableIterator<HTMLElement>}
   */
  *tilesAt(pos) {
    for (const plane of this.grid.el.querySelectorAll('.plane'))
      if (plane instanceof HTMLElement)
        yield* this.grid.tilesAt(plane, pos);
  }

  /**
   * @param {MouseEvent} ev
   * @return {void}
   */
  handleEvent(ev) {
    const pos = this.grid.translateClient({x: ev.clientX, y: ev.clientY});
    const tiles = Array.from(this.tilesAt(pos));
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
    const tiles = Array.from(this.tilesAt(pos));
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
    lines.push(`* text: ${JSON.stringify(t.textContent)}`);
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
