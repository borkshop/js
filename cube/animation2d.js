/**
 * The animation2d module provides shaared utilities for Emoji Quest 2D
 * animation, particularly setting the 'transform' property of an SVG element
 * each animation frame.
 */

// @ts-check

import { octurnVectors } from './lib/geometry2d.js';
import {
  compose,
  translate,
  rotate,
  scale,
  matrixStyle,
} from './lib/matrix2d.js';

/** @typedef {import('./progress.js').Progress} Progress */

/**
 * @typedef {Object} Coord
 * @prop {number} x - integer in the coordinate space of tiles.
 * @prop {number} y - integer in the coordinate space of tiles.
 * @prop {number} a - angle, in increments of 90 degrees clockwise from due
 * north.
 */

/**
 * @typedef {Object} Transition
 * @prop {number} [directionOcturns] - in 1/8 turns clockwise from north.
 * @prop {number} [rotation] - in quarter turns clockwise, positive or negative.
 * @prop {boolean} [bump] - whether the entity makes an aborted attempt in the
 * direction.
 * @prop {'exit' | 'enter' | 'stay'} [stage] - whether to pop in or pop out.
 */

/** @type {Transition} */
const noTransition = {
  directionOcturns: 0,
  rotation: 0,
  bump: false,
  stage: 'stay',
};

/** @type {Progress} */
const noProgress = {
  elapsed: 0,
  linear: 0,
  sinusoidal: 0,
  sinusoidalQuarterTurn: 0,
  bounce: 0,
  exit: 1,
  enter: 0,
};

/**
 * @param {Element} $entity
 * @param {Coord} coord
 * @param {number} [pressure] how firmly the entity is pressed, 0 (up, no pressure) 1 (down, full pressure)
 * @param {Progress} [progress]
 * @param {Transition} [transition]
 * @param {number} [adjustOrientationOcturns]
 */
export function placeEntity(
  $entity,
  coord,
  pressure = 0,
  progress = noProgress,
  transition = noTransition,
  adjustOrientationOcturns = 0,
) {
  const {
    directionOcturns = 0,
    rotation = 0,
    bump = false,
    stage = 'stay',
  } = transition;
  const { sinusoidal, sinusoidalQuarterTurn, bounce, linear, enter, exit } =
    progress;
  const adjustedDirectionOcturns =
    stage === 'enter' ? (directionOcturns + 4) % 8 : directionOcturns;
  const { x: dx, y: dy } =
    octurnVectors[(adjustedDirectionOcturns + 8 - coord.a * 2) % 8];
  const shiftProgress = bump
    ? bounce
    : stage === 'stay'
    ? linear
    : stage === 'enter'
    ? 1 - sinusoidal
    : sinusoidal;
  const scaleProgress = stage === 'stay' ? 1 : stage === 'exit' ? exit : enter;
  const transform = compose(
    scale(scaleProgress * (1 + pressure / 3)),
    rotate(sinusoidalQuarterTurn * rotation),
    rotate((-Math.PI / 4) * (coord.a * 2 + adjustOrientationOcturns)),
    translate(coord),
    translate({ x: dx * shiftProgress, y: dy * shiftProgress }),
    translate({ x: 0.5, y: 0.5 }),
  );
  $entity.setAttributeNS(null, 'transform', matrixStyle(transform));
}
