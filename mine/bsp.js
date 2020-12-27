// @ts-check

import {
  sizeOfRect,
  areaOfPoint,
  insetRect,
  rectForCorners,
  centerOfRect,
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
 * @typedef {Object} MineRequirements
 * @prop {number} maxRoomCount
 * @prop {number} minRoomArea
 * @prop {number} maxRoomArea
 */

/**
 * @typedef {Object} MineDescription
 * @prop {Point} size
 * @prop {number} area
 * @prop {Rect[]} rooms
 * @prop {Point[]} centers
 */

/**
 * @param {Rect} rect
 * @param {MineRequirements} reqs
 * @param {() => number} random
 * @returns {MineDescription}
 */
export function planRooms(rect, reqs, random = Math.random) {
  const { maxRoomCount } = reqs;
  /** @type {Rect[]} */
  const rooms = [];
  const roomToWorldPosition = translate({x: 1, y: 1});
  const roomToWorldSize = identity;
  const inset = insetRect(rect);
  const size = sizeOfRect(inset);
  partition(size, roomToWorldPosition, roomToWorldSize, maxRoomCount, reqs, rooms);
  const centers = rooms.map(rect => centerOfRect(rect, random));
  const area = size.x * size.y;
  return { size, area, rooms, centers };
}

/**
 * @param {Point} size is the size of the room anchored at the origin in the
 * room's coordinate space.
 * @param {Matrix} roomToWorldPosition is a matrix that transforms room
 * coordinates into world coordinates.
 * @param {Matrix} roomToWorldSize is a matrix that transforms the room size to
 * dimensions of the room in the world's coordinate space, which may vary by
 * transposition and flipping about an axis.
 * @param {number} maxRoomCount is the number of rooms that should spawn within
 * the current partition.
 * @param {MineRequirements} reqs
 * @param {Rect[]} rooms
 * @param {() => number} random
 */
function partition(size, roomToWorldPosition, roomToWorldSize, maxRoomCount, reqs, rooms, random = Math.random) {
  const {minRoomArea, maxRoomArea} = reqs;
  const area = areaOfPoint(size);

  if (maxRoomCount === 0 || areaOfPoint(size) < minRoomArea) {
    // Noop.

  } else if (size.y > size.x) {
    // Always partition across the dominant axis to facilitate alternation of
    // orientation.
    partition(
      transform(size, transpose),
      multiply(roomToWorldPosition, transpose),
      multiply(roomToWorldSize, transpose),
      maxRoomCount,
      reqs,
      rooms
    );

  } else if (maxRoomCount > 1 && size.x > 7 && area - size.y * 2 > 2 * minRoomArea) {
    const left = Math.floor(2 + (size.x - 4) * random());
    const right = size.x - left - 2;

    let countA = Math.floor(maxRoomCount * left / (left + right));
    let countB = maxRoomCount - countA;
    if (random() < 0.5) {
      [countB, countA] = [countA, countB];
    }

    partition(
      {x: left, y: size.y},
      roomToWorldPosition,
      roomToWorldSize,
      countA,
      reqs,
      rooms
    );

    partition(
      {x: right, y: size.y},
      multiply(multiply(roomToWorldPosition, translate({x: size.x, y: 0})), flip),
      multiply(roomToWorldSize, flip),
      countB,
      reqs,
      rooms
    );

  } else {
    const roomArea = minRoomArea + (maxRoomArea - minRoomArea) * random();

    const ratio = (4 + random()) / 5;
    const w = Math.max(1, Math.min(size.x, Math.floor(Math.sqrt(roomArea) * ratio)));
    const h = Math.max(1, Math.min(size.y, Math.floor(roomArea / w)));
    const x = Math.floor((size.x - w) * random());
    const y = Math.floor((size.y - h) * random());

    const a = transform({x, y}, roomToWorldPosition);
    const b = transform({x: w, y: h}, multiply(translate(a), roomToWorldSize));
    const r = rectForCorners(a, b);
    rooms.push(r);
  }
}
