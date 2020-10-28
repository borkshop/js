import {toRad, parseAngle} from './units';

/**
 * @typedef {import('cdom/tiles').Point} Point
 * @typedef {import('cdom/tiles').TileGrid} TileGrid
 * @typedef {import('cdom/tiles').TileQuery} TileQuery
 * @typedef {import('cdom/tiles').TileSpec} TileSpec
 */

/**
 * @param {Point} pos
 * @param {number} θ
 * @param {number} r
 * @return {Point}
 */
export function atHeading({x, y}, θ, r=1) {
  x -= r * Math.sin(θ);
  y += r * Math.cos(θ);
  return {x, y};
}

/**
 * @typedef {(grid: TileGrid, ps: HTMLElement[])=>void} ParticleUpdater
 * @typedef {(grid: TileGrid, p: HTMLElement, pos: Point, to: Point)=>boolean} ParticleMover
 *
 * @param {object} params
 * @param {TileGrid} params.grid
 * @param {TileQuery} [params.query]
 * @param {ParticleUpdater} [params.update]
 * @param {ParticleMover} [params.move]
 * @param {boolean} [params.ordinalMoves]
 * @param {number} [params.stepLimit]
 * @param {TileSpec} [params.ghostSpec]
 * @return {boolean}
 *
 * TODO support Object<string, ParticleUpdater> under params.update
 * TODO reconcile params.move with domgeon movers
 */
export function stepParticles({
  grid,
  query = {className: ['particle', 'live']},
  update,
  move,
  ordinalMoves = false,
  stepLimit = 0,
  ghostSpec = {className: ['ghost']},
}) {
  if (typeof update === 'function') {
    update(grid, grid.queryTiles(query))
  }

  const ps = grid.queryTiles(query);
  for (const p of ps) {
    let steps = grid.getTileData(p, 'steps');
    if (typeof steps !== 'number') steps = 0;
    grid.setTileData(p, 'steps', ++steps);
    if (stepLimit && steps >= stepLimit)
      grid.updateTile(p, ghostSpec);

    const pos = grid.getTilePosition(p);

    // move along heaading... somehow
    let heading = toRad(parseAngle(grid.getTileData(p, 'heading')));
    if (isNaN(heading)) heading = 0;
    let {x: dx, y: dy} = atHeading({x:0, y:0}, heading);
    const to = {x: pos.x, y: pos.y};
    if (!ordinalMoves) {
      // movement clamped to cardinal directions, with optional tracking of
      // "debt" from the diagonal not taken
      const debt = grid.getTileData(p, 'cardinalMoveDebt');
      if (debt !== null && typeof debt === 'object' && !Array.isArray(debt)) {
        if (typeof debt.x === 'number') dx += debt.x;
        if (typeof debt.y === 'number') dy += debt.y;
      }
      if (Math.abs(dy) > Math.abs(dx)) {
        if (dy < 0) to.y--, dy++;
        else        to.y++, dy--;
      } else {
        if (dx < 0) to.x--, dx++;
        else        to.x++, dx--;
      }
      grid.setTileData(p, 'cardinalMoveDebt', {x: dx, y: dy});
    } else {
      // smooth movement, taking fractional positions
      to.x += dx;
      to.y += dy;
    }

    if (!move || move(grid, p, pos, to)) grid.moveTileTo(p, to);
  }
  return !!ps.length;
}

