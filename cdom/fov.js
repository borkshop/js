import {mortonKey} from './tiles';

/** An Iterator version of Array.prototype.filter
 *
 * TODO maybe share with procgen
 *
 * @template T
 * @param {Iterable<T>} it
 * @param {(t: T) => boolean} filter
 * @returns {IterableIterator<T>}
 */
function* filter(it, filter) {
  for (const i of it) if (filter(i)) yield i;
}

/** @typedef { import("./tiles").TileGrid } TileGrid */
/** @typedef { import("./tiles").Point } Point */

export class GridLighting {
  /** @type {TileGrid} */
  grid

  /** @type {null|((tile:HTMLElement)=>boolean)} */
  filter = null

  fovVar = 'fov'
  lightVar = 'light'
  lightMax = 1.0
  lightLimit = 0.0001

  /**
   * @param {TileGrid} grid
   */
  constructor(grid) {
    this.grid = grid;
  }

  /**
   * @returns {void}
   */
  clearLight() {
    clearGridLight(this.grid, this.filter, {
      lightVar: this.lightVar,
    });
  }

  /**
   * @returns {void}
   */
  clearView() {
    /** @type {NodeListOf<HTMLElement>} */
    const priors = this.grid.el.querySelectorAll(`.tile[data-${this.fovVar}]`);
    for (const tile of priors)
      if (!this.filter || this.filter(tile))
        this.grid.setTileData(tile, this.fovVar, null);
  }

  /**
   * @param {HTMLElement} source
   * @param {object} params
   * @param {number} [params.lightScale]
   * @param {number} [params.lightInit] - initial lighting value, defaults to 8
   * @returns {void}
   */
  addLightField(source, {
    lightInit=(source && this.grid.getTileData(source, 'lightInit')) || 8,
    lightScale=1,
  }) {
    const origin = this.grid.getTilePosition(source);
    const depthLimit = Math.sqrt(lightInit/this.lightLimit);
    for (const {at, x, y} of iterateGridField(this.grid, this.filter, source, depthLimit)) {
      const dsq = Math.pow(x - origin.x, 2) + Math.pow(y - origin.y, 2)
      const light = lightScale*lightInit/dsq;
      if (light < this.lightLimit) continue;
      for (const tile of at) this.addLight(tile, light);
    }
  }

  /**
   * @param {HTMLElement} tile
   * @param {number} light
   */
  addLight(tile, light) {
    if (light >= this.lightLimit) {
      const prior = this.grid.getTileData(tile, this.lightVar);
      this.grid.setTileData(tile, this.lightVar,
        Math.min(this.lightMax, typeof prior === 'number' ? prior + light : light));
    }
  }

  /**
   * @param {HTMLElement} source
   * @param {object} [options]
   * @param {number} [options.depthLimit]
   * @param {(tiles: HTMLElement[]) => HTMLElement[]} [options.mask]
   * @param {(tiles: Iterable<HTMLElement>, pos: Point, depth: number) => void} [options.revealView]
   * @returns {void}
   */
  revealViewField(source, options) {
    revealGridViewField(this.grid, this.filter, source, {
      fovVar: this.fovVar,
      lightVar: this.lightVar,
      lightLimit: this.lightLimit,
      ...options,
    });
  }
}

/**
 * @param {TileGrid} grid
 * @param {null|((tile:HTMLElement)=>boolean)} filter
 * @param {object} [options]
 * @param {string} [options.lightVar]
 * @returns {void}
 */
export function clearGridLight(grid, filter, options={}) {
  const {
    lightVar='light',
  } = options;
  /** @type {NodeListOf<HTMLElement>} */
  const priors = grid.el.querySelectorAll(`.tile[data-${lightVar}]`);
  for (const tile of priors)
    if (!filter || filter(tile))
      grid.setTileData(tile, lightVar, null);
}

/**
 * @param {TileGrid} grid
 * @param {null|((tile:HTMLElement)=>boolean)} filter
 * @param {HTMLElement} source
 * @param {object} [options]
 * @param {string} [options.fovVar]
 * @param {string} [options.lightVar]
 * @param {number} [options.lightLimit]
 * @param {number} [options.depthLimit]
 * @param {(tiles: HTMLElement[]) => HTMLElement[]} [options.mask]
 * @param {(tiles: Iterable<HTMLElement>, pos: Point, depth: number) => void} [options.revealView]
 * @returns {void}
 */
export function revealGridViewField(grid, filter, source, options={}) {
  const {
    fovVar='fov',
    lightVar='light',
    lightLimit=0.0001,
    depthLimit=1000,
    mask=(present) => present.filter(
      t => grid.getTileData(t, lightVar) >= lightLimit),
    revealView=(tiles, _pos, depth) => {
      for (const tile of tiles) {
        const prior = grid.getTileData(tile, fovVar);
        grid.setTileData(tile, fovVar,
          typeof prior === 'number' ? Math.min(prior, depth) : depth);
      }
    },
  } = options;
  for (const {depth, at, ...pos} of iterateGridField(grid, filter, source, depthLimit)) {
    const visible = mask ? mask(at) : at;
    if (visible.length) revealView(visible, pos, depth);
  }
}

/**
 * @param {TileGrid} grid
 * @param {null|((tile:HTMLElement)=>boolean)} filter
 * @param {HTMLElement} source
 * @param {number} [depthLimit]
 * @returns {IterableIterator<DepthPoint & {at: HTMLElement[]}>}
 */
export function *iterateGridField(grid, filter, source, depthLimit) {
  const origin = grid.getTilePosition(source);
  const selfSupported = !!source.classList.contains('support');
  yield* iterateField(origin, pos => {
    const tiles = grid.tilesAt(pos);
    const at = Array.from(filter ? filter(tiles, filter) : tiles);
    const supported = selfSupported || at.some(t => t.classList.contains('support'));
    const blocked = !supported || at.some(t => !t.classList.contains('passable'));
    return {supported, blocked, at};
  }, depthLimit);
}

/** A depth-labeled point is the result unit generated by iterateField.
 *
 * The depth is the row number within the first quadrant to encounter each location.
 *
 * @typedef {Point & {depth: number}} DepthPoint
 */

/** A result from point query under iterateField.
 *
 * @typedef {object} PointAttributes
 * @prop {boolean} blocked - whether FOV is blocked at the query location.
 * @prop {boolean} supported - whether FOV is even defined at the given
 * location; unsupported locations, while not technically blocked, do not
 * generate a result point.
 */

/**
 * Implements a reasonably general Symmetric Shadowcasting
 * adapted from https://www.albertford.com/shadowcasting/
 *
 * @template At
 * @param {Point} origin
 * @param {(pos:Point)=>{supported: boolean, blocked: boolean, at: At}} query
 * @param {number} [depthLimit]
 * @returns {IterableIterator<DepthPoint & {at: At}>}
 */
export function* iterateField(origin, query, depthLimit=1000) {
  /* TODO support casting from walls:
   * > So here are the modifications for casting field of view from a wall tile:
   * > - Make slopes originate from the edges of the tile instead of the center.
   * > - Change the comparisons in is_symmetric to strict inequalities.
   */

  /**
   * Used to dedupe calls to update so that the caller only sees any position
   * at most once. Ideally we'd get the quadrant boundary maths below fixed to
   * not produce duplicates, but for now a visited set prevents visual
   * artifacts (e.g. so what addGridLight doesn't add to the same cell twice).
   *
   * @type {Set<Number>} */
  const visited = new Set();

  /** @param {Point} pos */
  function visit(pos) {
    const key = mortonKey(pos);
    if (visited.has(key)) return false;
    visited.add(key);
    return true;
  }

  if (visit(origin)) {
    const {at} = query(origin);
    yield {...origin, depth: 0, at};
  }

  // work in cardinally aligned quadrants around origin; each quadrant is
  // essentially a π/2 section centered around each +/- x/y axis
  const {x: ox, y: oy} = origin;
  /** @type {((row: number, col:number) => Point)[]} */
  const quadrants = [
    (row, col) => ({x: ox + col, y: oy - row}), // north quadrant
    (row, col) => ({x: ox + col, y: oy + row}), // east  quadrant
    (row, col) => ({x: ox + row, y: oy + col}), // south quadrant
    (row, col) => ({x: ox - row, y: oy + col}), // west  quadrant
  ];

  /**
   * @typedef {{depth:number, startSlope:number, endSlope:number}} Row
   * @type {Row[]}
   */
  const rows = [];
  for (const quadrant of quadrants) {
    // iterate (sub-)row arcs within each quadrant
    rows.push({depth: 1, startSlope: -1, endSlope: 1});
    while (rows.length) {
      const row = rows.pop();
      if (!row) continue; // inconceivable, but ok type checker

      const {depth, startSlope, endSlope} = row;
      if (depth > depthLimit) continue;

      // row scan state:
      let wasBlocked = null;
      let restartSlope = startSlope;

      const start = depth * startSlope, end = depth * endSlope;
      const minCol = Math.floor(start + 0.5); // round ties up
      const maxCol = Math.ceil(end - 0.5);    // round ties down
      for (let col = minCol; col <= maxCol; col++) {
        const tileSlope = (2*col - 1) / (2*depth);
        const pos = quadrant(depth, col);
        const {supported, blocked, at} = query(pos);

        if (blocked) {
          if (supported && visit(pos)) yield {...pos, depth, at};
          if (wasBlocked === false) rows.push({
            depth: depth + 1,
            startSlope: restartSlope,
            endSlope: tileSlope,
          });
        } else {
          // TODO this symmetric check seems awfully redundant... either I
          // messed something up in translating, or just don't understand the
          // edge case semantics yet...
          if (supported && // isSymmetric
              col >= depth * restartSlope &&
              col <= depth * endSlope &&
              visit(pos)
          ) yield {...pos, depth, at};
          if (wasBlocked) restartSlope = tileSlope;
        }
        wasBlocked = blocked;
      }

      // continue to the next row if unblocked
      if (wasBlocked === false) rows.push({
        depth: depth + 1,
        startSlope: restartSlope,
        endSlope,
      })
    }
  }
}
