// @ts-check

import {
  sizeOfRect,
  areaOfPoint,
  insetRect,
  rectForCorners,
  centerOfRect,
} from './geometry.js';

const mathRandom = () => Math.random();

/** @typedef { import("cdom/tiles").Rect } Rect */
/** @typedef { import("cdom/tiles").Point } Point */

/** @typedef {(point:Point) => Point} Projection */

// TODO: use homogeneous matrix composition instead of functional composition. 

/** @type {(a:Point, b:Point) => Point} */
const translate = ({x: dx, y: dy}, {x, y}) => ({x: x + dx, y: y + dy});
/** @type {Projection} */
const transpose = ({x, y}) => ({x: y, y: x});
/** *type {Projection} */
const flip = (/** @type {Point} */{x, y}) => ({x: -x, y});
/** @type {Projection} */
const identity = (point) => point;

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
export function planRooms(rect, reqs, random = mathRandom) {
  const { maxRoomCount } = reqs;
  /** @type {Rect[]} */
  const rooms = [];
  const projectPosition = (/** @type {Point} */{x, y}) => ({x: x+1, y: y+1});
  const projectSize = identity;
  const inset = insetRect(rect);
  const size = sizeOfRect(inset);
  partition(size, projectPosition, projectSize, maxRoomCount, reqs, rooms);
  const centers = rooms.map(rect => centerOfRect(rect, random));
  const area = size.x * size.y;
  return { size, area, rooms, centers };
}

/**
 * @param {Point} size
 * @param {Projection} projectPosition
 * @param {Projection} projectSize
 * @param {number} maxRoomCount
 * @param {MineRequirements} reqs
 * @param {Rect[]} rooms
 * @param {() => number} random
 */
function partition(size, projectPosition, projectSize, maxRoomCount, reqs, rooms, random = mathRandom) {
  const {minRoomArea, maxRoomArea} = reqs;
  const area = areaOfPoint(size);

  if (maxRoomCount === 0 || areaOfPoint(size) < minRoomArea) {
    // Noop.

  } else if (size.y > size.x) {
    // Always partition across the dominant axis to facilitate alternation of
    // orientation.
    partition(
      transpose(size),
      point => projectPosition(transpose(point)),
      point => projectSize(transpose(point)),
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
      projectPosition,
      projectSize,
      countA,
      reqs,
      rooms
    );

    partition(
      {x: right, y: size.y},
      point => projectPosition(translate({x: size.x, y: 0}, flip(point))),
      point => projectSize(flip(point)),
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

    const a = projectPosition({x, y});
    const b = translate(a, projectSize({x: w, y: h}));
    const r = rectForCorners(a, b);
    rooms.push(r);
  }
}
