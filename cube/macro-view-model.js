/**
 * The macro view model is an adapter for a view model that provides
 * higher-level commands for animated entity transitions, including
 * transitions that require a single logical entity to have multiple
 * actual entity representations, like the replacement of an entity
 * with one representation with a new representation, where both
 * representations exist while one waxes and the other wanes.
 *
 * Consequently, the macro view model has an internal mapping
 * from external entity numbers to internal entity numbers.
 */

// @ts-check

import { assert, assumeDefined } from './lib/assert.js';

/**
 * @param {import('./types.js').ViewModelFacetForMacroViewModel} viewModel
 * @param {Object} [options]
 * @param {string} [options.name]
 * @param {number} [options.start]
 * @param {number} [options.stride]
 */
export function makeMacroViewModel(
  viewModel,
  {
    // name = '<unknown>',
    start = 0,
    stride = 1,
  } = {},
) {
  let planning = true;

  /** @type {Map<number, number>} external to internal */
  const entities = new Map();
  /** @type {Map<number, number>} internal to location */
  const locations = new Map();
  /** @type {Map<number, number>} external to internal */
  const removes = new Map();
  /** @type {Map<number, number>} internal to location */
  const moves = new Map();
  /** @type {Set<number>} internal */
  const replaced = new Set();

  function assertPlanning() {
    assert(
      planning,
      `Animation commands must be invoked between tock and tick, not between tick and tock`,
    );
  }

  let nextId = start;
  function create() {
    const id = nextId;
    nextId += stride;
    return id;
  }

  /**
   * @param {number} external
   */
  function entity(external) {
    return assumeDefined(
      entities.get(external),
      `Failed invariant of macro view model: no internal entity for external entity ${external}`,
    );
  }

  /**
   * @param {number} external
   */
  function locate(external) {
    return assumeDefined(
      locations.get(external),
      `Failed invariant of macro view model: no known location for external entity ${external}`,
    );
  }

  /**
   * @param {number} external
   * @param {number} location
   * @param {number} type
   */
  function put(external, location, type) {
    assertPlanning();
    assert(
      entities.get(external) === undefined,
      `Cannot create entity with used value ${external}`,
    );
    const internal = create();
    entities.set(external, internal);
    locations.set(external, location);
    viewModel.put(internal, location, type);
  }

  /**
   * @param {number} external
   */
  function remove(external) {
    assertPlanning();
    const internal = entities.get(external);
    assert(internal !== undefined);
    viewModel.remove(internal);
    entities.delete(external);
    locations.delete(external);
  }

  /**
   * @param {number} external
   * @param {number} origin
   * @param {number} destination
   * @param {number} type
   * @param {number} directionOcturns
   */
  function give(external, origin, destination, type, directionOcturns) {
    assertPlanning();
    assert(entities.get(external) === undefined);
    const internal = create();
    entities.set(external, internal);
    viewModel.put(internal, origin, type);
    locations.set(external, destination);
    moves.set(internal, destination);
    if (viewModel.watched(internal)) {
      viewModel.transition(internal, {
        directionOcturns,
        stage: 'enter',
      });
    }
  }

  /**
   * @param {number} external
   * @param {number} directionOcturns
   */
  function take(external, directionOcturns) {
    assertPlanning();
    const internal = entity(external);
    if (viewModel.watched(internal)) {
      viewModel.transition(internal, {
        directionOcturns,
        stage: 'exit',
      });
    }
    removes.set(external, internal);
  }
  /**
   * @param {number} external
   */
  function fell(external) {
    assertPlanning();
    const internal = entity(external);
    if (viewModel.watched(internal)) {
      viewModel.transition(internal, {
        rotation: 1,
        bump: true,
        stage: 'exit',
      });
    }
    removes.set(external, internal);
  }

  /**
   * @param {number} external
   */
  function exit(external) {
    assertPlanning();
    const internal = entity(external);
    if (viewModel.watched(internal)) {
      viewModel.transition(internal, {
        bump: true,
        stage: 'exit',
      });
    }
    removes.set(external, internal);
  }

  /**
   * @param {number} external
   */
  function enter(external) {
    assertPlanning();
    const internal = entity(external);
    if (viewModel.watched(internal)) {
      viewModel.transition(internal, {
        bump: true,
        stage: 'enter',
      });
    }
  }

  /**
   * @param {number} external
   * @param {number} type
   */
  function replace(external, type) {
    assertPlanning();
    const internal = entity(external);
    const location = locate(external);
    const replacement = create();

    replaced.add(internal);
    locations.set(external, location);
    entities.set(external, replacement);

    viewModel.put(replacement, location, type);
    if (viewModel.watched(internal)) {
      viewModel.transition(internal, {
        bump: true,
        stage: 'exit',
      });
      viewModel.transition(replacement, {
        bump: true,
        stage: 'enter',
      });
    }
  }

  /**
   * @param {number} external
   * @param {number} destination
   * @param {number} directionOcturns
   * @param {number} turn
   */
  function move(external, destination, directionOcturns, turn) {
    assertPlanning();
    const internal = entity(external);
    moves.set(internal, destination);
    locations.set(external, destination);
    if (viewModel.watched(internal)) {
      viewModel.transition(internal, {
        directionOcturns,
        rotation: turn,
      });
    }
  }

  /**
   * @param {number} external
   * @param {number} destination
   * @param {number} directionOcturns
   * @param {number} type
   */
  function jump(external, destination, directionOcturns, type) {
    assertPlanning();
    const internal = entity(external);
    locations.set(external, destination);
    const replacement = create();
    viewModel.put(replacement, destination, type);
    replaced.add(internal);
    entities.set(external, replacement);
    if (viewModel.watched(internal)) {
      viewModel.transition(internal, {
        directionOcturns,
        stage: 'exit',
      });
      viewModel.transition(replacement, {
        directionOcturns,
        stage: 'enter',
      });
    }
  }

  /**
   * @param {number} external
   * @param {number} type
   * @param {number} destination
   * @param {number} directionOcturns
   * @param {number} turn
   */
  function movingReplace(external, type, destination, directionOcturns, turn) {
    assertPlanning();
    const internal = entity(external);
    const replacement = create();

    replaced.add(internal);
    locations.set(external, destination);
    entities.set(external, replacement);

    viewModel.put(replacement, destination, type);
    if (viewModel.watched(internal)) {
      viewModel.transition(internal, {
        directionOcturns,
        rotation: turn,
        stage: 'exit',
      });
      viewModel.transition(replacement, {
        directionOcturns,
        rotation: turn,
        stage: 'enter',
      });
    }
  }

  /**
   * @param {number} external
   * @param {number} directionOcturns
   */
  function bounce(external, directionOcturns) {
    assertPlanning();
    const internal = entity(external);
    if (viewModel.watched(internal)) {
      viewModel.transition(internal, {
        directionOcturns,
        bump: true,
      });
    }
  }

  /**
   * @param {number} external
   */
  function down(external) {
    const internal = entity(external);
    viewModel.down(internal);
    return () => viewModel.up(internal);
  }

  /**
   * Conclude animated transitions from the prior turn, so new plans can be
   * made.
   */
  function tock() {
    for (const [internal, destination] of moves.entries()) {
      viewModel.move(internal, destination);
    }
    for (const [external, internal] of removes.entries()) {
      viewModel.remove(internal);
      entities.delete(external);
      locations.delete(external);
    }
    for (const internal of replaced) {
      viewModel.remove(internal);
    }
    replaced.clear();
    removes.clear();
    moves.clear();
    viewModel.tock();

    planning = true;
  }

  function tick() {
    if (!planning) {
      return;
    }
    planning = false;
    // TODO effect viewModel events according to accumulated plans.
  }

  const { animate } = viewModel;

  return {
    tick,
    tock,

    // Animation functions
    animate,
    down,

    // Planning functions
    put,
    remove,
    take,
    give,
    exit,
    enter,
    fell,
    move,
    jump,
    bounce,
    replace,
    movingReplace,
  };
}
