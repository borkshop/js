// @ts-check

import {makeViewModel} from './view-model.js';
import {makeMacroViewModel} from './macro-view-model.js';
import {rotate, matrixStyle} from './matrix2d.js';
import {makeTileView} from './tile-view.js';
import {makeElementTracker} from './element-tracker.js';
import {makeBoxTileMap} from './tile-map-box.js';
import {ss, nn} from './geometry2d.js';

const svgNS = "http://www.w3.org/2000/svg";

/**
 * @param {Object} args
 * @param {number} args.tileSize
 * @param {number} args.pointerTileType
 * @param {(tile: number, type: number) => Element} args.createElement
 * @param {(tile: number) => void} [args.collectElement]
 */
export function createMenuBlade({
  tileSize,
  pointerTileType,
  createElement,
  collectElement,
}) {
  let state = 0;
  let entity = 0;
  let prev = false;
  let next = false;

  const $menuBlade = document.createElement('div');
  $menuBlade.setAttribute('id', 'menuBlade');
  $menuBlade.setAttribute('class', 'blade');
  $menuBlade.style.transform = matrixStyle(rotate(-Math.PI/2));

  const $menu = document.createElement('div');
  $menu.setAttribute('id', 'menu');
  $menu.setAttribute('class', 'panel');
  $menuBlade.appendChild($menu);

  const $curb = document.createElementNS(svgNS, 'svg');
  $curb.setAttribute('id', 'curb');
  $curb.setAttributeNS(null, 'viewBox', `0 0 1 4`);
  $curb.setAttributeNS(null, 'height', `${4 * tileSize}`);
  $curb.setAttributeNS(null, 'width', `${1 * tileSize}`);
  $menu.appendChild($curb);

  /**
   * @param {string} label
   */
  function appendLabel(label) {
    const $label = document.createElement('div');
    $label.innerText = label;
    $label.setAttribute('class', 'menuLabel');
    $menu.appendChild($label);
  }

  appendLabel('Play');
  appendLabel('Save');
  appendLabel('Load');
  appendLabel('Edit');

  const {create, collect, place} = makeElementTracker({ createElement, collectElement });
  const tileView = makeTileView($curb, null, create, collect);
  const {enter, exit} = tileView;
  const viewModel = makeViewModel();
  const tileMap = makeBoxTileMap({ x: 1, y: 4 });
  viewModel.watch(tileMap, {enter, exit, place});
  const macroViewModel = makeMacroViewModel(viewModel, {name: 'menu-pointer-curb'});

  macroViewModel.put(entity, state, pointerTileType);

  /** @type {import('./animation.js').AnimateFn} */
  function animate(progress) {
    macroViewModel.animate(progress);

    // animate rotation of menu
    if (prev !== next) {
      if (next) { // showing
        $menuBlade.style.transform = matrixStyle(rotate(-Math.PI/2 * (1 - progress.sinusoidal)));
      } else { // hiding
        $menuBlade.style.transform = matrixStyle(rotate(-Math.PI/2 * progress.sinusoidal));
      }
    } else {
      if (next) { // shown
        $menuBlade.style.transform = matrixStyle(rotate(0));
      } else { // hidden
        $menuBlade.style.transform = matrixStyle(rotate(-Math.PI/2));
      }
    }
  }

  function reset() {
    macroViewModel.reset();
    prev = next;
  }

  function goNorth() {
    state -= 1;
    if (state >= 0) {
      macroViewModel.move(entity, state, nn, 0);
    } else {
      macroViewModel.exit(entity);
      entity += 1;
      state = 3;
      macroViewModel.put(entity, state, pointerTileType);
      macroViewModel.enter(entity);
    }
  }

  function goSouth() {
    state += 1;
    if (state < 4) {
      macroViewModel.move(entity, state, ss, 0);
    } else {
      macroViewModel.exit(entity);
      entity += 1;
      state = 0;
      macroViewModel.put(entity, state, pointerTileType);
      macroViewModel.enter(entity);
    }
  }

  function getState() {
    return ['play', 'save', 'load', 'edit'][state];
  }

  function show() {
    next = true;
  }

  function hide() {
    next = false;
  }

  const menuController = {
    show,
    hide,
    goNorth,
    goSouth,
    getState,
    animate,
    reset
  };

  return {$menuBlade, menuController};
}

/**
 * @typedef {ReturnType<createMenuBlade>['menuController']} MenuController
 */
