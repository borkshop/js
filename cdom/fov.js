/** @typedef { import("./tiles").TileGrid } TileGrid */
/** @typedef { import("./tiles").Point } Point */

/**
 * Implements easy to integrate player-centric lighting.
 *
 * @param {object} params
 * @param {TileGrid} params.grid
 * @param {Point} params.origin
 * @param {HTMLElement} [params.source]
 * @param {number} [params.lightInit] - initial lighting value, defaults to 8
 * @param {number} [params.lightMax] - upper lighting clamp
 * @param {number} [params.lightLimit] - light visibility threshold
 * @param {(tile:HTMLElement)=>boolean} [params.filter] - used by the default update and query implementations
 * @returns {void}
 */
export function updatePlayerFOV({
  grid, origin, source,
  lightInit=(source && grid.getTileData(source, 'lightInit')) || 8,
  lightMax=1.0,
  lightLimit=0.00001,
  filter,
}) {
  const depthLimit = Math.sqrt(lightMax/lightLimit);

  /** @type {NodeListOf<HTMLElement>} */
  const priors = grid.el.querySelectorAll('.tile[data-light]');
  for (const tile of priors)
    if (!filter || filter(tile))
      grid.setTileData(tile, 'light', null);
  computeFOV({
    origin,
    depthLimit,
    query: (pos) => {
      const tiles = grid.tilesAt(pos);
      const present = filter ? tiles.filter(filter) : tiles;
      const supported = present.some(t => t.classList.contains('support'));
      const passable = supported && present.every(t => t.classList.contains('passable'));
      return {supported, blocked: !passable};
    },
    update: (pos, depth) => {
      const light = Math.min(lightMax, lightInit/(depth*depth));
      const tiles = grid.tilesAt(pos);
      const present = filter ? tiles.filter(filter) : tiles;
      for (const tile of present)
        if (light >= lightLimit)
          grid.setTileData(tile, 'light', light);
    },
  });
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
export function computeFOV({origin, query, update, depthLimit=1000}) {
  /* TODO support casting from walls:
   * > So here are the modifications for casting field of view from a wall tile:
   * > - Make slopes originate from the edges of the tile instead of the center.
   * > - Change the comparisons in is_symmetric to strict inequalities.
   */

  update(origin, 0);

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

  /** @type {{depth:number, startSlope:number, endSlope:number}[]} */       
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
          if (supported) update(pos, depth);
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
            update(pos, depth); // TODO depth based falloff
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
