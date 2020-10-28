import type {Point, TileGrid, TileQuery, TileSpec} from 'cdom/tiles';
import {toRad, parseAngle} from './units';

export function atHeading({x, y}:Point, θ:number, r:number=1):Point {
  x -= r * Math.sin(θ);
  y += r * Math.cos(θ);
  return {x, y};
}

export function stepParticles({
  grid,
  query = {className: ['particle', 'live']},
  update,
  handle,
  ordinalMoves = false,
  stepLimit = 0,
  ghostSpec = {
    className: ['ghost'],
  },
}:{
  grid: TileGrid,
  query?: TileQuery,
  update?: (grid: TileGrid, ps: HTMLElement[])=>void,
  handle?: (grid: TileGrid, p: HTMLElement, pos: Point, to: Point)=>boolean,
  ordinalMoves?: boolean,
  stepLimit?: number,
  ghostSpec?: TileSpec,
}):boolean {
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
        if (dy < 0) to.y++, dy++;
        else        to.y--, dy--;
      } else {
        if (dx < 0) to.x++, dx++;
        else        to.x--, dx--;
      }
      grid.setTileData(p, 'cardinalMoveDebt', {x: dx, y: dy});
    } else {
      // smooth movement, taking fractional positions
      to.x += dx;
      to.y += dy;
    }

    if (!handle || handle(grid, p, pos, to)) grid.moveTileTo(p, to);
  }
  return !!ps.length;
}

