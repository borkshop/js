// @ts-check

import {neighbors, chooseSubRect} from 'cdom/procgen';

import {count, select} from './iteration.js';
import {sizeOfRect, outerCorners, pointsForRect, centerOfRect, border} from './geometry.js';
import {Space} from './space.js';
import {fill} from './paint-by-numbers.js';
import {computeDistancesBreadthFirst} from './bfs.js';
import {computeDistancesDijkstra, trace} from './dijkstra.js';
import {makeRookSpace} from './rook.js';

import {partition} from './bsp.js';

/** @typedef { import("cdom/tiles").Rect } Rect */
/** @typedef { import("cdom/tiles").Point } Point */

/**
 * @typedef {Object} Plan
 * @prop {Rect} rect
 * @prop {number} maxRoomCount
 * @prop {number} minRoomCount
 * @prop {number} minRoomArea
 * @prop {number} maxRoomArea
 * @prop {() => number} [random]
 * @prop {number} [tunnelDiggingCost]
 * @prop {number} [tunnelTurningCost]
 */

/**
 * @typedef {Object} Result
 * @prop {number} area
 * @prop {Space} space
 * @prop {Array<Rect>} rooms
 * @prop {Array<Point>} centers
 * @prop {Array<number>} floors
 * @prop {Array<number>} walls
 * @prop {Array<number>} doors
 * @prop {Array<number>} weights
 */

/**
 * @param {Plan} plan
 * @param {(result: Result) => void} draw
 * @param {boolean} [noStep]
 */
export function *planMineStepwise(plan, draw, noStep = false) {
  const {rect, tunnelTurningCost = 1, random = Math.random} = plan;
  let {tunnelDiggingCost = 20} = plan;

  const area = rect.w * rect.h;

  /** @type {Rect[]} */
  const rooms = [];
  /** @type {Point[]} */
  const centers = [];

  const minRoomArea = 9;
  const maxRoomCount = 40;
  const wallThickness = 3;
  partition(rect, {
    maxRoomCount,
    minRoomArea,
    wallThickness,
    random: () => (random() + random() + random() + random()) / 4,
    /**
     * @callback
     * @param {Rect} rect
     */
    drawRoom: (rect) => {
      const subRect = chooseSubRect(rect, {w: 3, h: 3, a: minRoomArea}, {random});
      // const subRect = rect;
      rooms.push(subRect);
      centers.push(centerOfRect(subRect, random));
    },
  });

  const space = new Space(sizeOfRect(rect));
  const neighborIndexes = (/** @type {number} */index) => space.indexes(neighbors(space.point(index)));
  const centerIndexes = centers.map(point => space.index(point));
  // Allocations for computeDistancesBreadthFirst.
  const cornerDistances = new Array(area); // bfs
  const seen = new Array(area);
  // Allocations for computeDistancesDijkstra.
  // The graph we operate on for computing the shortest distance between two
  // points is twice the area of the region: one layer for vertical travel,
  // another for horizontal travel, with a fixed cost for switching layers.
  const weights = new Array(area * 2);
  const rook = makeRookSpace(area, space, weights, tunnelTurningCost);
  const distances = new Array(area * 2); // dijkstra
  const heap = Array.from(count(area * 2));
  const coheap = Array.from(count(area * 2));
  // Render bitmaps.
  const floors = new Array(area);
  const doors = new Array(area);
  const walls = new Array(area);

  // Compute the distance of every cell to the nearest corner of a room.
  // This creates a gradient, such that we will later favor paths that join
  // rooms toward the center of a wall and tend to travel between rooms
  // in the space toward the middle between them.
  cornerDistances.fill(-1);
  seen.fill(0);
  computeDistancesBreadthFirst(
    area,
    cornerDistances,
    seen,
    rooms.flatMap(rect => Array.from(outerCorners(rect)))
      .map(point => space.index(point)),
    neighborIndexes
  );

  // Initialize the pathing with the interior of the rooms.
  // Each new hall will be augment the pathing.
  floors.fill(0);
  for (const room of rooms) {
    fill(floors, space.indexes(pointsForRect(room)), 1)
  }

  if (!noStep) {
    redraw();
    yield;
  }

  /**
   * @param {Array<number>} options
   */
  function *permute(options) {
    for (let s = 0; s < 4; s += 1) {
      for (let i = 0; i < options.length; i += 1) {
        const j = (i + s) % options.length;
        yield [options[i], options[j]];
      }
    }
  }

  for (const [from, to] of permute(centerIndexes)) {

    // Compute wall mask.
    walls.fill(0);
    for (const index of select(floors)) {
      for (const neighbor of neighborIndexes(index)) {
        if (floors[neighbor] === 0) {
          walls[neighbor] = 1;
        }
      }
    }

    // Compute path weights for hall-digging over the entire space.
    for (const index of count(area)) {
      const weight = floors[index] ? 1 :
        walls[index] ? tunnelDiggingCost * 2 + 1 :
        tunnelDiggingCost + tunnelDiggingCost / cornerDistances[index];
      weights[index] = weight;
      weights[index + area] = weight;
    }

    // Dissuade connections at corners.
    for (const rect of rooms) {
      for (const corner of outerCorners(rect)) {
        const index = space.index(corner);
        weights[index] = Infinity;
        weights[index + area] = Infinity;
      }
    }

    // Find shortest path between these two rooms.
    distances.fill(Infinity);
    if (centerIndexes.length >= 2) {
      computeDistancesDijkstra(
        area * 2,
        distances,
        heap,
        coheap,
        rook.weights,
        rook.neighbors,
        [from, from + area],
      );
      for (const index of trace(area, distances, rook.neighbors, [to, to + area])) {
        floors[index % area] = 1;
      }
    }

    if (!noStep) {
      walls.fill(0);
      redraw();
      yield;
    }
  }

  // Compute wall mask.
  walls.fill(0);
  for (const index of select(floors)) {
    for (const neighbor of neighborIndexes(index)) {
      if (floors[neighbor] === 0) {
        walls[neighbor] = 1;
      }
    }
  }

  // Compute door mask.
  doors.fill(0);
  for (const rect of rooms) {
    for (const point of border(rect)) {
      const index = space.index(point);
      doors[index] = floors[index];
    }
  }

  redraw();

  function redraw() {
    draw({area, space, rooms, centers, floors, walls, doors, weights});
  }
}

/**
 * @param {Plan} plan
 * @param {(result: Result) => void} draw
 */
export function planMine(plan, draw) {
  for (const _ of planMineStepwise(plan, draw, true)) {}
}
