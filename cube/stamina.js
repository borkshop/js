// @ts-check

import { assumeDefined } from './lib/assert.js';
import { makeViewModel } from './view-model.js';
import { makeMacroViewModel } from './macro-view-model.js';
import { makeElementWatcher } from './element-watcher.js';
import { makeBoxTileMap } from './tile-map-box.js';
import { makeRotatingElementController } from './rotator.js';

const svgNS = 'http://www.w3.org/2000/svg';

/**
 * @param {Object} args
 * @param {number} args.tileSizePx
 * @param {number} args.staminaTileType
 * @param {(tile: number, type: number) => Element} args.createElement
 * @param {(tile: number) => void} [args.collectElement]
 */
export function writeStaminaBar({
  tileSizePx,
  staminaTileType,
  createElement,
  collectElement,
}) {
  const element = document.createElementNS(svgNS, 'svg');
  element.setAttributeNS(null, 'viewBox', `0 0 5 1`);
  element.setAttributeNS(null, 'height', `${(1 * tileSizePx) / 2}`);
  element.setAttributeNS(null, 'width', `${(5 * tileSizePx) / 2}`);
  element.setAttributeNS(null, 'class', 'staminaBar');

  const rotatingElementController = makeRotatingElementController(element, 1);

  const watcher = makeElementWatcher(
    element,
    null,
    createElement,
    collectElement,
  );
  const viewModel = makeViewModel();
  const tileMap = makeBoxTileMap({ x: 5, y: 1 });
  viewModel.watchEntities(tileMap, watcher);
  const macroViewModel = makeMacroViewModel(viewModel, { name: 'staminaBar' });

  let stamina = 0;
  let next = 0;
  /** @type {Array<number>} */
  const entities = [];

  /** @param {number} newStamina */
  const set = newStamina => {
    while (stamina < newStamina) {
      const entity = next;
      entities.push(entity);
      macroViewModel.put(entity, 4 - stamina, staminaTileType);
      macroViewModel.enter(entity);
      next += 1;
      stamina += 1;
    }
    while (newStamina < stamina) {
      const entity = assumeDefined(entities.pop());
      macroViewModel.exit(entity);
      stamina -= 1;
    }
  };

  const { show, hide } = rotatingElementController;

  const tick = () => {
    macroViewModel.tick();
    rotatingElementController.tick();
  };

  const tock = () => {
    macroViewModel.tock();
    rotatingElementController.tock();
  };

  /** @type {import('./progress.js').AnimateFn} */
  const animate = progress => {
    macroViewModel.animate(progress);
    rotatingElementController.animate(progress);
  };

  const controller = {
    set,
    animate,
    tick,
    tock,
    show,
    hide,
  };

  return { element, controller };
}

/** @typedef {ReturnType<writeStaminaBar>['controller']} StaminaController */
