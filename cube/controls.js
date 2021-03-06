// @ts-check

import {north, east, south, west, same} from './geometry2d.js';
import {placeEntity} from './animation2d.js';
import {makeTileView} from './tile-view.js';
import {makeViewModel} from './view-model.js';
import {makeMacroViewModel} from './macro-view-model.js';
import {viewText, tileTypesByName} from './data.js';

/** @typedef {import('./animation.js').AnimateFn} AnimateFn */
/** @typedef {import('./animation.js').Progress} Progress */
/** @typedef {import('./animation2d.js').Coord} Coord */
/** @typedef {import('./animation2d.js').Transition} Transition */
/** @typedef {import('./view-model.js').Watcher} Watcher */
/** @typedef {import('./view-model.js').PlaceFn} PlaceFn */
/** @typedef {import('./view-model.js').EntityWatchFn} EntityWatchFn */
/** @typedef {ReturnType<makeControlsController>} Controls */

const svgNS = "http://www.w3.org/2000/svg";
const tileSize = 75;

export function createControls() {
  const $controls = document.createElementNS(svgNS, 'svg');
  $controls.setAttributeNS(null, 'viewBox', `0 0 3 3`);
  $controls.setAttributeNS(null, 'height', `${3 * tileSize}`);
  $controls.setAttributeNS(null, 'width', `${3 * tileSize}`);
  $controls.setAttributeNS(null, 'id', 'controls');
  $controls.setAttributeNS(null, 'class', 'panel');
  return $controls;
}

/**
 * @param {Coord} dimensions
 */
function makeTileMap({x: w, y: h, a}) {
  const map = new Map();
  for (let x = 0; x < w; x += 1) {
    for (let y = 0; y < h; y += 1) {
      map.set(y * 3 + x, {x, y, a});
    }
  }
  return map;
}

const tileMap = makeTileMap({x: 3, y: 3, a: 0});

/**
 * @callback DirectionFn
 * @param {number} direction
 */

/**
 * @typedef {Object} Controller
 * @property {DirectionFn} up
 * @property {DirectionFn} down
 */

/**
 * @param {Element} $parent
 * @param {Controller} controller
 */
export function makeControlsController($parent, controller) {
  const $controls = createControls();
  $parent.appendChild($controls);

  const elements = new Map();

  /**
   * @param {number} entity
   * @param {number} type
   */
  function createElement(entity, type) {
    const text = viewText[type];
    const element = document.createElementNS(svgNS, 'text');
    element.setAttributeNS(null, 'class', 'moji');
    element.appendChild(document.createTextNode(text));
    elements.set(entity, element);
    return element;
  }

  /**
   * @param {number} entity
   */
  function collectElement(entity) {
    elements.delete(entity);
  }

  const tileView = makeTileView($controls, createElement, collectElement);
  const {enter, exit} = tileView;

  /** @type {PlaceFn} */
  function place(entity, coord, pressure, progress, transition) {
    const element = elements.get(entity);
    // TODO y u no element evar?
    if (element) {
      placeEntity(element, coord, pressure, progress, transition);
    }
  }

  const viewModel = makeViewModel();
  const macroViewModel = makeMacroViewModel(viewModel, {name: 'controls'});

  viewModel.watch(tileMap, {enter, exit, place});

  // Entity id corresponds to digit on numeric keypad.
  // Entity location is raster 3x3 offset.
  macroViewModel.put(7, 0, tileTypesByName.backpack);
  macroViewModel.put(8, 1, tileTypesByName.north);
  macroViewModel.put(9, 2, tileTypesByName.shield);
  macroViewModel.put(4, 3, tileTypesByName.west);
  macroViewModel.put(5, 4, tileTypesByName.watch);
  macroViewModel.put(6, 5, tileTypesByName.east);
  macroViewModel.put(1, 6, tileTypesByName.left);
  macroViewModel.put(2, 7, tileTypesByName.south);
  macroViewModel.put(3, 8, tileTypesByName.right);

  /** @type {Record<number, number>} */
  const commandDirection = {
    8: north,
    4: west,
    6: east,
    2: south,
    5: same,
  };

  /**
   * @param {number} command
   */
  function up(command) {
    macroViewModel.up(command);
    if (command in commandDirection) {
      controller.up(commandDirection[command]);
    }
  }

  /**
   * @param {number} command
   */
  function down(command) {
    macroViewModel.down(command);
    if (command in commandDirection) {
      controller.down(commandDirection[command]);
    }
  }

  /**
   * @param {number} type
   */
  function left(type) {
    if (type === undefined) {
      macroViewModel.replace(1, tileTypesByName.left);
    } else {
      macroViewModel.replace(1, type);
    }
  }

  /**
   * @param {number} type
   */
  function right(type) {
    if (type === undefined) {
      macroViewModel.replace(3, tileTypesByName.right);
    } else {
      macroViewModel.replace(3, type);
    }
  }

  const {reset, animate} = macroViewModel;

  return {
    reset,
    animate,
    up,
    down,
    left,
    right,
  }
}
