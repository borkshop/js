// @ts-check

import {
  sizeOfRect,
  insetRect,
  rectForCorners,
  origin,
} from './geometry.js';

import {
  transform,
  identity,
  translate,
  flipY as flip,
  transpose,
  multiply,
} from './matrix.js';

/** @typedef { import("cdom/tiles").Rect } Rect */
/** @typedef { import("cdom/tiles").Point } Point */
/** @typedef {import('./matrix.js').Matrix} Matrix */

/**
 * @template Room
 * @typedef {Object} BspPlan
 * @prop {number} maxRoomCount
 * @prop {number} minRoomArea
 * @prop {number} [wallThickness]
 * @prop {(rect:Rect) => Room} [drawRoom]
 * @prop {(left:Room, right:Room) => Room} [drawHall]
 * @prop {() => number} [random]
 */

/**
 * @template Room
 * @typedef {Object} BspResult
 * @prop {Point} size
 * @prop {number} area
 * @prop {Room} room The root room.
 */

/**
 * @template Room
 * @param {Rect} rect
 * @param {BspPlan<Room>} plan
 * @returns {BspResult<Room>}
 */
export function planRooms(rect, plan) {
  const { maxRoomCount } = plan;
  const roomToWorldPosition = translate({x: 1, y: 1});
  const roomToWorldSize = identity;
  const size = sizeOfRect(insetRect(rect));
  const room = partition(
    size,
    roomToWorldPosition,
    roomToWorldSize,
    maxRoomCount,
    plan
  );
  const area = size.x * size.y;
  return { size, area, room };
}

/**
 * @template Room
 * @param {Point} size is the size of the room anchored at the origin in the
 * room's coordinate space.
 * @param {Matrix} roomToWorldPosition is a matrix that transforms room
 * coordinates into world coordinates.
 * @param {Matrix} roomToWorldSize is a matrix that transforms the room size to
 * dimensions of the room in the world's coordinate space, which may vary by
 * transposition and flipping about an axis.
 * @param {number} maxRoomCount is the number of rooms that should spawn within
 * the current partition.
 * @param {BspPlan<Room>} plan
 * @return {Room}
 */
function partition(size, roomToWorldPosition, roomToWorldSize, maxRoomCount, plan) {
  const {minRoomArea, wallThickness = 1} = plan;
  const minRoomWidth = Math.ceil(minRoomArea / size.y);

  if (size.x === 0 || size.y === 0) {
    throw new Error(`Assertion failed: cannot partition zero-wide or zero-height space`);
  }

  if (size.y > size.x) {
    // Always partition across the dominant axis to facilitate alternation of
    // orientation.
    return partition(
      transform(size, transpose),
      multiply(roomToWorldPosition, transpose),
      multiply(roomToWorldSize, transpose),
      maxRoomCount,
      plan,
    );

  } else if (maxRoomCount === 1 || size.x <= minRoomWidth * 2 + wallThickness) {
    // There are two conditions that will produce a leaf room:
    // 1. The budget calls for only one room, regardless of the
    // remaining area.
    // 2. The remaining area, less the area that would be consumed
    // if we built a partition between to subordinate areas, is
    // not sufficient to build a single room.
    return leaf(size, roomToWorldPosition, roomToWorldSize, plan);

  } else if (maxRoomCount >= 2) {
    return branch(size, roomToWorldPosition, roomToWorldSize, maxRoomCount, plan);

  } else {
    throw new Error(`maxRoomCount must be at least 1`);
  }
}

/**
 * @template Room
 * @param {Point} size is the size of the room anchored at the origin in the
 * room's coordinate space.
 * @param {Matrix} roomToWorldPosition is a matrix that transforms room
 * coordinates into world coordinates.
 * @param {Matrix} roomToWorldSize is a matrix that transforms the room size to
 * dimensions of the room in the world's coordinate space, which may vary by
 * transposition and flipping about an axis.
 * @param {number} maxRoomCount is the number of rooms that should spawn within
 * the current partition.
 * @param {BspPlan<Room>} plan
 * @return {Room}
 */
function branch(size, roomToWorldPosition, roomToWorldSize, maxRoomCount, plan) {
  const {
    minRoomArea,
    drawHall = Function.prototype,
    wallThickness = 1,
    random = Math.random,
  } = plan;
  const minRoomWidth = Math.ceil(minRoomArea / size.y);

  // The size of any child wall will never be more than the height of
  // this room's wall.
  // - If a child room is wider than high, the child's wall height will
  // be the same as this the wall in this room.
  // - If a child room is higher than wide, the child's wall length will
  // be less than the height of this room, because we will transpose
  // the algorithm's orientation such that the wall cuts through
  // the width instead of the height, from this room's frame of reference.
  // Supposing we evenly divided the area among the descendent rooms, each
  // room would need the minimum room area and a wall for every child
  // room except one.
  // For a clean division, we add the wall area to both the numerator
  // and the denominator.
  const roomCount = Math.min(maxRoomCount, Math.floor((size.x + wallThickness) / (minRoomWidth + wallThickness)));

  // We must produce at least one room on each side of the wall.
  // The remaining rooms may be divided toward one side or the other.
  const divisibleRoomCount = roomCount - 2;
  const leftRoomCountBonus = Math.floor(divisibleRoomCount * random());
  const rightRoomCountBonus = divisibleRoomCount - leftRoomCountBonus;
  const leftRoomCount = 1 + leftRoomCountBonus;
  const rightRoomCount = 1 + rightRoomCountBonus;
  const spareWidth = size.x - roomCount * minRoomWidth - (roomCount - 1);
  const fudge = Math.floor(spareWidth * random());
  // The minimum room width for every room left of the wall, and one
  // more cell for the wall between every room (leftRoomCount) except
  // the last (-1) plus some of the room to spare.
  let wall = minRoomWidth*leftRoomCount + wallThickness*(leftRoomCount - 1) + fudge;
  // Compensate for floorward rounding bias.
  if (random() < 0.5) {
    wall = size.x - wall;
  }

  if (
    size.y === 0 ||
    wall < 2 ||
    size.x - wall - wallThickness < 2 ||
    rightRoomCount === 0 ||
    leftRoomCount === 0
  ) {
    return leaf(size, roomToWorldPosition, roomToWorldSize, plan);
  }

  const leftRoom = partition(
    {x: wall, y: size.y},
    roomToWorldPosition,
    roomToWorldSize,
    leftRoomCount,
    plan,
  );

  const rightRoom = partition(
    {x: size.x - wall - wallThickness, y: size.y},
    multiply(multiply(roomToWorldPosition, translate({x: size.x, y: 0})), flip),
    multiply(roomToWorldSize, flip),
    rightRoomCount,
    plan,
  );

  return drawHall(leftRoom, rightRoom);
}

/**
 * @template Room
 * @param {Point} size is the size of the room anchored at the origin in the
 * room's coordinate space.
 * @param {Matrix} roomToWorldPosition is a matrix that transforms room
 * coordinates into world coordinates.
 * @param {Matrix} roomToWorldSize is a matrix that transforms the room size to
 * dimensions of the room in the world's coordinate space, which may vary by
 * transposition and flipping about an axis.
 * @param {BspPlan<Room>} plan
 * @return {Room}
 */
function leaf(size, roomToWorldPosition, roomToWorldSize, plan) {
  const {drawRoom = Function.prototype} = plan;
  const a = transform(origin, roomToWorldPosition);
  const b = transform(size, multiply(translate(a), roomToWorldSize));
  const rect = rectForCorners(a, b);
  return drawRoom(rect);
}
