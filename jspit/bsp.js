// @ts-check

import {
  BSP,
  chooseSubRect,
} from 'cdom/procgen';

/// TODO move worthwhile parts into cdom/procgen

/** @typedef { import("cdom/tiles").Point } Point */
/** @typedef { import("cdom/tiles").Size } Size */
/** @typedef { import("cdom/tiles").Rect } Rect */

/** @enum {number} */
export const Side = {
  None: 0,
  Top: 1,
  Right: 2,
  Bottom: 3,
  Left: 4,
};

/**
 * Yields (in clockwise order) any sides of rectangle A that are externally
 * adjacent to the 4 infinite lines that intersect to define rectangle B.
 *
 * These results are tangent candidates, which need to be further checked for
 * orthogonal overlap to confirm their tangency.
 *
 * @param {Rect} a
 * @param {Rect} b
 * @returns {IterableIterator<Side>}
 */
export function* adjacent(a, b) {
  const {x, y, w, h} = a;
  if (b.y + b.h === y    ) yield Side.Top;
  if (b.x       === x + w) yield Side.Right;
  if (b.y       === y + h) yield Side.Bottom;
  if (b.x + b.w === x    ) yield Side.Left;
}

/**
 * A range defined by offset (lower bound inclusive) and length (relative upper
 * bound exclusive). Essentially this is "half of a Rect", since either it's
 * x/w or y/h pairs define a Range.
 *
 * @typedef {object} Range
 * @prop {number} o - starting offset (absolute inclusive lower bound)
 * @prop {number} n - ending length (relative exclusive upper bound)
 */

/**
 * Returns any overlap between the two given ranges, maybe empty.
 *
 * @param {Range} a
 * @param {Range} b
 * @returns {Range}
 */
export function overlap({o: off1, n: n1}, {o: off2, n: n2}) {
  const hi1 = off1 + n1;
  const hi2 = off2 + n2;
  if (off1 <= off2 && hi2 <= hi1) return {o: off2, n: n2};
  if (off2 < off1 && hi1 < hi2) return {o: off1, n: n1};
  if (off2 <= off1 && off1 <= hi2) return {o: off1, n: Math.min(hi1, hi2) - off1};
  if (off2 <= hi1 && hi1 <= hi2) {
    const off = Math.max(off1, off2);
    return {o: off, n: hi1 - off};
  }
  return {o: 0, n: 0};
}

/**
 * @param {Side} s
 * @param {Rect} a
 * @param {Rect} b
 * @returns {Range}
 */
function orthoOverlap(s, a, b) {
  switch (s) {
    case Side.Top:
    case Side.Bottom:
      return overlap({o: a.x, n: a.w}, {o: b.x, n: b.w});
    case Side.Right:
    case Side.Left:
      return overlap({o: a.y, n: a.h}, {o: b.y, n: b.h});
  }
  return {o: 0, n: 0};
}

/**
 * @typedef {object} Tangent
 * @prop {Side} t
 * @prop {Range} o
 */

/**
 * @param {Rect} a
 * @param {Rect} b
 * @returns {IterableIterator<Tangent>}
 */
export function* tangent(a, b) {
  for (const t of adjacent(a, b)) {
    const o = orthoOverlap(t, a, b);
    if (o.n > 0) yield {t, o};
  }
}

/**
 * A Point from a Range; its p property is a proportion in [0, 1) indicating
 * how far through the Range.
 *
 * @typedef {Point&{p: number}} RangePoint
 */

/**
 * @param {Range} range
 * @param {number} co
 * @returns {IterableIterator<RangePoint>}
 */
function* eachPointX(range, co) {
  for (let i=0, v=range.o; i<range.n; i++, v++) {
    const p = i/range.n;
    yield {x: v, y: co, p};
  }
}

/**
 * @param {Range} range
 * @param {number} co
 * @returns {IterableIterator<RangePoint>}
 */
function* eachPointY(range, co) {
  for (let i=0, v=range.o; i<range.n; i++, v++) {
    const p = i/range.n;
    yield {x: co, y: v, p};
  }
}

/**
 * Yields labeled points along an edge of rectangle A and the adjacent edge of
 * rectangle B.
 *
 * Rectangle B is considered to be the "co-rectangle", its points have their
 * added co property set true.
 *
 * @param {Side} s
 * @param {Range} o
 * @param {Rect} a
 * @param {Rect} b
 * @returns {IterableIterator<{co: boolean}&RangePoint>}
 */
export function* adjacentPoints(s, o, a, b) {
  let as, bs;
  switch (s) {
  case Side.Bottom:
    as = eachPointX(o, a.y + a.h - 1);
    bs = eachPointX(o, b.y);
    break;
  case Side.Top:
    as = eachPointX(o, a.y);
    bs = eachPointX(o, b.y + b.h - 1);
    break;
  case Side.Right:
    as = eachPointY(o, a.x + a.w - 1);
    bs = eachPointY(o, b.x);
    break;
  case Side.Left:
    as = eachPointY(o, a.x);
    bs = eachPointY(o, b.x + b.w - 1);
    break;
  default: return;
  }
  for (const p of as) yield {co: false, ...p}
  for (const p of bs) yield {co: true, ...p}
}

/** @typedef {{s: Side}&RangePoint} SidePoint */

/**
 * @param {Rect} a
 * @param {Side[]} ss
 * @returns {IterableIterator<SidePoint>}
 */
export function* sidePoints(a, ...ss) {
  for (const s of ss) switch (s) {
  case Side.Top:
    for (const p of eachPointX({o: a.x+1, n: a.w-2}, a.y)) yield {s, ...p};
    break;
  case Side.Right:
    for (const p of eachPointY({o: a.y+1, n: a.h-2}, a.x + a.w - 1)) yield {s, ...p};
    break;
  case Side.Bottom:
    for (const p of eachPointX({o: a.x+1, n: a.w-2}, a.y + a.h - 1)) yield {s, ...p};
    break;
  case Side.Left:
    for (const p of eachPointY({o: a.y+1, n: a.h-2}, a.x)) yield {s, ...p};
    break;
  }
}

// TODO maybe collect hallway utils into a static class and/or object

/**
 * @typedef {object} ConnectionPoint
 * @prop {SidePoint} ap
 * @prop {SidePoint} bp
 */

/**
 * Yields candidate hallway connection points between two rectangles.
 *
 * @param {Rect} a
 * @param {Rect} b
 * @param {object} [options]
 * @param {(p: Point) => boolean} [options.pointFilter]
 * @returns {IterableIterator<ConnectionPoint>}
 */
export function* connectionPoints(a, b, options={}) {
  const {
    pointFilter = _p => true
  } = options;
  for (const aSide of [Side.Top, Side.Right, Side.Bottom, Side.Left])
  for (const bSide of [Side.Top, Side.Right, Side.Bottom, Side.Left])
  if (hallwaySidesFeasible(bSide, aSide))
    for (const ap of sidePoints(a, aSide)) if (pointFilter(ap))
    for (const bp of sidePoints(b, bSide)) if (pointFilter(bp))
    if (hallwayPointsFeasible(ap, bp)) yield {ap, bp};
}

/**
 * Returns false if it's not feasible to build a hallway between
 * any point along two given rectangle sides.
 *
 * @param {Side} a
 * @param {Side} b
 * @returns {boolean}
 */
function hallwaySidesFeasible(a, b) {
  if (a === b) return false;
  // TODO more checks
  return true;
}

/**
 * Returns false if it's not feasible to build a hallway between
 * two given rectangle side points. Currently the only check is
 * against backtracking.
 *
 * @param {SidePoint} a
 * @param {SidePoint} b
 * @returns {boolean}
 */
function hallwayPointsFeasible(a, b) {
  const td = absDist(a, b);

  const aFirst = addPoints(a, sideNormal(a.s));
  const bFirst = addPoints(b, sideNormal(b.s));

  // would require backtracking
  if (absDist(aFirst, b) > td) return false;
  if (absDist(a, bFirst) > td) return false;

  // TODO more checks
  return true;
}

/**
 * @param {Side} s
 * @returns {Point}
 */
export function sideNormal(s) {
  switch (s) {
  case Side.Top:    return {x:  0, y: -1};
  case Side.Right:  return {x:  1, y:  0};
  case Side.Bottom: return {x:  0, y:  1};
  case Side.Left:   return {x: -1, y:  0};
  }
  return {x: 0, y: 0};
}

/**
 * @param {Point} a
 * @param {Point} b
 * @returns {number}
 */
export function absDist(a, b) {
  return Math.abs(b.x - a.x) +
         Math.abs(b.y - a.y);
}

/**
 * @param {Point} a
 * @param {Point} b
 * @returns {Point}
 */
function addPoints(a, b) {
  return {x: a.x + b.x, y: a.y + b.y};
}

/// demo page specifics

import {find, mustFind} from 'cdom/wiring';

import {DOMgeon} from 'cdom/domgeon';
const dmg =
  new DOMgeon({
  ui: document.body,
  keys: document.body,
  grid: mustFind('.grid'),
  moveBar: find('.buttonbar.moves'),
  actionBar: find('.buttonbar.actions'),
  lightLimit: 0.2,
});
globalThis.dmg = dmg;

find('#debug')?.addEventListener('change', ev => {
  if (ev.target instanceof HTMLInputElement)
    dmg.grid.el.classList.toggle('debugging', !!ev.target.checked);
});

import {DOMgeonInspector} from 'cdom/domgeon';
const inspectorEl = find('#inspector');
if (inspectorEl) new DOMgeonInspector(dmg, inspectorEl);

import * as build from 'cdom/builder';
const floorShader = build.toShader({
  plane: 'solid',
  kind: 'floor',
  classList: ['support', 'passable'],
  text: '·',
});
const wallShader = build.toShader({
  plane: 'solid',
  kind: 'wall',
  text: '#',
});
const doorShader = build.toShader({
  plane: 'solid',
  kind: 'door',
  classList: 'interact',
});
const roomShader = build.roomShader({
  floors: (grid, pos, shape) => {
    floorShader(grid, pos, shape);
    const {x, y, w, h} = shape;
    if (pos.x === x + Math.floor(w/2) &&
        pos.y === y + Math.floor(h/2)) {
      const tile = grid.tileAt(pos, 'floor');
      if (tile) tile.classList.add('spawn');
    }
  },
  walls: wallShader,
});

const minRoomSize = {w: 4, h: 4};
const minRoomArea = 25;
const maxRoomArea = 108;

const plane = 'solid';

/** @type {null|Point} */
let lastSpawn = null;
function chooseSpawn() {
  let spawn = null, bestScore = 0;
  for (const tile of dmg.grid.queryTiles({
    plane,
    className: 'spawn',
  })) {
    const pos = dmg.grid.getTilePosition(tile);
    if (pos.x === lastSpawn?.x && pos.y === lastSpawn?.y) continue;
    const score = Math.random();
    if (!spawn || bestScore < score)
      spawn = pos, bestScore = score;
  }
  lastSpawn = spawn;
  return spawn;
}

/**
 * @param {Point} pos
 * @param {string} [kind]
 */
function* tilesAt(pos, kind) {
  // TODO tilesAt should require a plane, or be limited to one by a view
  const tiles = kind
    ? dmg.grid.tilesAt(pos, kind)
    : dmg.grid.tilesAt(pos);
  for (const tile of tiles)
    if (dmg.grid.getTilePlane(tile) === plane)
      yield tile;
}

/**
 * @param {Point} pos
 * @param {string} kind
 */
function removeAt(pos, kind) {
  for (const tile of tilesAt(pos, kind))
    tile.parentNode?.removeChild(tile);
}

/**
 * @param {Point} pos
 */
function doorAt(pos) {
  removeAt(pos, 'wall');
  doorShader(dmg.grid, pos, null);
}

// /**
//  * @param {Point} pos
//  * @param {string} kind
//  * @param {string} text
//  */
// function markAt(pos, kind, text) {
//   for (const tile of tilesAt(pos, kind)) {
//     tile.textContent = text;
//     tile.classList.add('mark');
//   }
// }

/**
 * @param {Point} pos
 */
function digAt(pos) {
  // shade room tiles into a 3x3 cell around the dig point
  const place = {x: pos.x-1, y: pos.y-1, w: 3, h: 3};
  build.fillRect(dmg.grid, place, (ctx, pos, shape) => {
    if (!ctx.tileAt(pos, 'support'))
      roomShader(ctx, pos, shape);
  });
  // then dig out that location
  for (const present of tilesAt(pos))
    if (!present.classList.contains('passable'))
      present.parentNode?.removeChild(present);
}

/**
 * Implements stateful fill and connect methods usable under BSPOptions.
 */
class BSPRoomBuilder {
  interiorPoints = new Set()
  regionID = 0
  random = Math.random

  reset() {
    this.interiorPoints.clear();
    this.regionID = 0;
  }

  /**
   * @param {Rect} region
   * @param {string} kind
   * @param {number} [id]
   */
  makeRegion(region, kind, id) {
    if (typeof id !== 'number') id = ++this.regionID; // gen next (connect phase)
    else this.regionID = Math.max(id, this.regionID); // given (fill phase)
    return {kind, id, ...region};
  }

  /**
   * @param {Rect} region
   * @param {number} id
   * @returns {null|Rect[]}
   */
  fill(region, id) {
    const {x, y, w, h} = region;
    if (w < minRoomSize.w || h < minRoomSize.h) return null;

    const depth = Math.floor(Math.log2(id + 1));
    const box = dmg.grid.createTile({
      id: `bsp-box-${id}`,
      plane: 'debug',
      kind: 'box',
      pos: {x, y},
      data: {bspID: id, depth, w, h},
    });

    // increasing probability of stopping here and placing a room within
    // this region, starting once we get under max area, reaching 100%
    // certainty at min area.
    region = chooseSubRect(region, {a: minRoomArea, ...minRoomSize});
    const p = (maxRoomArea - region.w * region.h) / (maxRoomArea - minRoomArea);
    if (p < 0 || this.random() >= p) return null;

    build.fillRect(dmg.grid, region, roomShader);
    box.classList.add('leaf');
    return [this.makeRegion(region, 'room', id)];
  }

  /**
   * @param {Rect[]} as
   * @param {Rect[]} bs
   * @returns {Rect[]}
   */
  connect(as, bs) {
    if (as.length === 1 && bs.length > 1) return this.connect(bs, as);

    // simplify any shared walls, and add doors
    let connected = false;
    for (const b of bs) for (const a of as)
      for (const tan of tangent(b, a))
        if (this.simplifyTangentRooms(b, a, tan)) connected = true;

    // try to build a hallway between the two (presumed connected) sets
    if (!connected) {
      const halls = this.buildHallBetween(as, bs);
      if (halls) {
        for (const hall of halls) {
          for (const a of as) for (const tan of tangent(hall, a))
            this.simplifyTangentRooms(hall, a, tan, {placeDoor: false});
          for (const b of bs) for (const tan of tangent(hall, b))
            this.simplifyTangentRooms(hall, b, tan, {placeDoor: false});
          as.push(this.makeRegion(hall, 'hall'));
        }
        connected = true;
      }
    }

    return as.concat(bs);
  }

  /**
   * @param {Rect} a
   * @param {Rect} b
   * @param {Tangent} a2b
   * @param {object} [options]
   * @param {boolean} [options.placeDoor]
   * @returns {boolean}
   */
  simplifyTangentRooms(a, b, {t, o}, options={}) {
    if (o.n <= 2) return false;
    const {
      placeDoor = true
    } = options;

    // shrink overlap to never consider extreme points, since
    // erasing those walls could introduce unintended diagonal
    // freedoms
    o.o++, o.n -= 2;

    const dir = !!(t % 2); // true iff top/bottom
    const eraseCo = dir // erase from the smaller dimension, except for room v hallway
      ? b.h !== 1 && b.h < a.h
      : b.w !== 1 && b.w < a.w;
    let choice = null, doorScore = 0;
    for (const {co, p, ...pos} of adjacentPoints(t, o, a, b)) {
      this.interiorPoints.add(`${pos.x},${pos.y}`);
      if (co === eraseCo) {
        removeAt(pos, 'wall');
      } else if (placeDoor) {
        // scale of [0, 100], quadratically peaking in the middle
        const weight = Math.pow((0.5 - Math.abs(p - 0.5))/0.5*10, 2);
        const score = weight ? Math.pow(this.random(), 1/weight) : 0;
        if (!choice || doorScore < score)
          choice = pos, doorScore = score;
      }
    }

    if (choice) doorAt(choice);
    else if (placeDoor) return false;
    return true;
  }

  /**
   * @param {Point} p
   */
  isInteriorPoint({x,y}) {
    return !this.interiorPoints.has(`${x},${y}`);
  }

  /**
   * @param {Rect[]} as
   * @param {Rect[]} bs
   */
  *hallwayCandidates(as, bs) {
    for (const a of as) for (const b of bs)
      for (const cp of connectionPoints(a, b, {
        pointFilter: p => this.isInteriorPoint(p),
      })) {
        const {ap, bp} = cp;
        const d = {x: bp.x - ap.x, y: bp.y - ap.y};
        const td = Math.abs(d.x) + Math.abs(d.y);
        yield {td, d, a, b, ...cp};
      }
  }

  /**
   * @param {Rect[]} as
   * @param {Rect[]} bs
   * @returns {null|Rect[]}
   */
  buildHallBetween(as, bs) {
    // find closest candidate wall points to form a hallway
    // TODO maybe do random weighting rather than hard "best candidate"?
    const cand = Array
      .from(this.hallwayCandidates(as, bs));
    for (const {ap, bp} of cand
      .sort(({td: a}, {td: b}) => b - a)
    ) {
      const {trace, ok} = this.traceHallway(ap, bp);
      const halls = ok ? this.extrudeHallway(ap, trace) : null;
      if (!halls?.length) continue;
      for (const pos of trace) digAt(pos);
      doorAt(ap);
      doorAt(bp);
      return halls;
    }
    return null;
  }

  /**
   * @param {SidePoint} from
   * @param {SidePoint} to
   * @returns {{
   *   trace: Point[]
   *   ok: boolean
   *   reason?: string
   *   blocked?: HTMLElement
   * }}
   */
  traceHallway(from, to) {
    const trace = [];
    const maxSteps = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
    let {x, y} = from, dir = sideNormal(from.s);
    while (trace.length < maxSteps) {
      // turn if we've exhausted the current direction
      if (dir.y !== 0 && y === to.y)
        dir = {y: 0, x: Math.sign(to.x - x)};
      if (dir.x !== 0 && x === to.x)
        dir = {x: 0, y: Math.sign(to.y - y)};

      // are we there yet?
      x += dir.x, y += dir.y;
      // TODO ensure proper approach against sideNormal(to)
      if (x === to.x && y === to.y) return {trace, ok: true};
      trace.push({x, y});

      // we somehow lost the way; shouldn't be possible, since the dir update
      // above should only go to zero when we reach to
      if (!dir.x && !dir.y)
        return {trace, ok: false, reason: 'hallway trace lost the way'};

      // blocked by any present .tile:not(.passable)
      for (const present of tilesAt({x, y}))
        if (!present.classList.contains('passable'))
          return {trace, ok: false, reason: 'blocked', blocked: present};
    }
    return {trace, ok: false, reason: 'max hallway steps exceeded'};
  }

  /**
   * @param {SidePoint} from
   * @param {Point[]} trace
   * @returns {null|Rect[]}
   */
  extrudeHallway(from, trace) {
    /** @type {Rect[]} */
    const halls = [];

    /** @type {Rect|null} */
    let hall = null;

    let {x, y} = from;
    for (const to of trace) {
      const dx = to.x - x, dy = to.y - y;
      if (Math.abs(dx) + Math.abs(dy) !== 1) return null; // invalid trace

      // the digging head defines a newly revealed 2x3 region
      const head = dx === 0
        ? {x: x-1, w: 3, y, h: dy*2}
        : {y: y-1, h: 3, x, w: dx*2};

      // such head region either extends the current hall, or starts a new one
      if      (hall?.x === head.x) hall.h += dy;
      else if (hall?.y === head.y) hall.w += dx;
      else if (!hall) hall = head; // first hall, no overlap since trace is exclusive
      else {
        halls.push(hall);
        // prior hall overlaps half of the revealed region
        head.x -= dx, head.y -= dy;
        hall = head;
      }

      ({x, y} = to);
    }
    if (hall) halls.push(hall);

    // normalize negative width/heights
    return halls.map(hall => {
      let {x, y, w, h} = hall;
      if (w < 0) hall.x = x + w + 1, hall.w = -w;
      if (h < 0) hall.y = y + h + 1, hall.h = -h;
      return hall;
    });
  }
}

const roomBuilder = new BSPRoomBuilder();
const bsp = new BSP({
  fill: (region, id) => roomBuilder.fill(region, id),
  connect: (as, bs) => roomBuilder.connect(as, bs),
});

/** @type {null|Point} */
let origin = null;
function reset() {
  dmg.grid.clear();
  const bounds = dmg.grid.viewbox;
  origin = {
    x: bounds.x + bounds.w/2,
    y: bounds.y + bounds.h/2,
  };
  dmg.grid.viewPoint = origin;
  roomBuilder.reset();
  bsp.run(bounds);

  const spawn = chooseSpawn();
  if (spawn) dmg.updateActorView(dmg.grid.createTile({
    plane: 'solid',
    pos: spawn,
    kind: 'mover',
    classList: ['input', 'focus'],
    text: '@',
  }));
}

/** @param {Event} event */
dmg.onKey.byID['regenWorld'] = ({type}) => { if (type === 'keyup') reset(); };

// TODO custom action/ability, rather than a one-off key
/** @param {Event} event */
dmg.onKey.byID['jump'] = ({type}) => {
  if (type !== 'keyup') return;
  const actor = dmg.focusedActor();
  const spawn = chooseSpawn();
  if (actor && spawn) {
    dmg.grid.moveTileTo(actor, spawn);
    // FIXME hack to invalidate FOV ; should be internalized post-action, as
    // this handler should be an action, not a one-off function outside DOMgeon
    dmg._fovID = '';
  }
};

dmg.addEventListener('pause', () => {
  if (origin) dmg.viewTo(origin);
});
dmg.playing = false;

reset();
