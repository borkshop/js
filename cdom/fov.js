import {mortonKey} from './tiles';

/** @typedef { import("./tiles").TileGrid } TileGrid */
/** @typedef { import("./tiles").Point } Point */

export class GridLighting {
  /** @type {TileGrid} */
  grid
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

  /** @type {null|((tile:HTMLElement)=>boolean)} */
  filter = null

  /**
   * @returns {void}
   */
  clearLight() {
    /** @type {NodeListOf<HTMLElement>} */
    const priors = this.grid.el.querySelectorAll(`.tile[data-${this.lightVar}]`);
    for (const tile of priors)
      if (!this.filter || this.filter(tile))
        this.grid.setTileData(tile, this.lightVar, null);
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
    this.computeField(source, depthLimit, (pos) => {
      const dsq = Math.pow(pos.x - origin.x, 2) + Math.pow(pos.y - origin.y, 2)
      const light = lightScale*lightInit/dsq;
      if (light >= this.lightLimit) {
        const tiles = this.grid.tilesAt(pos);
        for (const tile of this.filter ? tiles.filter(this.filter) : tiles)
          this.addLight(tile, light);
      }
    });
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
   * @returns {void}
   */
  revealViewField(source, {
    depthLimit=1000,
  }) {
    this.computeField(source, depthLimit, (pos, depth) => {
      const tiles = this.grid.tilesAt(pos);
      const present = this.filter ? tiles.filter(this.filter) : tiles;
      this.revealView(present, pos, depth);
    });
  }

  /**
   * @param {Iterable<HTMLElement>} tiles
   * @param {Point} _pos
   * @param {number} depth
   */
  revealView(tiles, _pos, depth) {
    for (const tile of tiles) this.setView(tile, depth);
  }

  /**
   * @param {HTMLElement} tile
   * @param {number} depth
   */
  setView(tile, depth) {
    const prior = this.grid.getTileData(tile, this.fovVar);
    this.grid.setTileData(tile, this.fovVar,
      typeof prior === 'number' ? Math.min(prior, depth) : depth);
  }

  /**
   * @param {HTMLElement} source
   * @param {number} depthLimit
   * @param {(pos:Point, depth:number) => void} update
   * @returns {void}
   */
  computeField(source, depthLimit, update) {
    const origin = this.grid.getTilePosition(source);
    const selfSupported = !!source.classList.contains('support');
    computeField({
      origin,
      depthLimit,
      query: (pos) => {
        const tiles = this.grid.tilesAt(pos);
        const present = this.filter ? tiles.filter(this.filter) : tiles;
        const supported = selfSupported || present.some(t => t.classList.contains('support'));
        const blocked = !supported || present.some(t => !t.classList.contains('passable'));
        return {supported, blocked};
      },
      update,
    });
  }
}

/**
 * Implements a reasonably general Symmetric Shadowcasting
 * adapted from https://www.albertford.com/shadowcasting/
 *
 * @param {object} params
 * @param {Point} params.origin
 * @param {(pos:Point)=>{supported: boolean, blocked: boolean}} params.query
 * @param {(pos:Point, depth:number)=>void} params.update
 * @param {number} [params.depthLimit]
 * @returns {void}
 */
export function computeField({origin, query, update, depthLimit=1000}) {
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

  /**
   * @param {Point} pos
   * @param {number} depth
   */
  function visit(pos, depth) {
    const key = mortonKey(pos);
    if (!visited.has(key)) {
      visited.add(key);
      update(pos, depth);
    }
  }

  visit(origin, 0);

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
        const {supported, blocked} = query(pos);

        if (blocked) {
          if (supported) visit(pos, depth);
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
              col <= depth * endSlope)
            visit(pos, depth); // TODO depth based falloff
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
