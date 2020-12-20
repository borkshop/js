// @ts-check

/** @typedef { import("cdom/tiles").NewTileSpec } NewTileSpec */

import {DOMgeon} from 'cdom/domgeon';
import {find, mustFind} from 'cdom/wiring';
import {select} from './iteration.js';
import {planMine} from './mine.js';

const dmg = new DOMgeon({
  ui: document.body,
  keys: document.body,
  grid: mustFind('.grid'),
  moveBar: mustFind('.buttonbar.moves'),
  actionBar: find('.buttonbar.actions'),
  lightLimit: 0.2,
});
globalThis.dmg = dmg;

import {DOMgeonInspector} from 'cdom/domgeon';
const inspector = find('#inspector');
if (inspector) new DOMgeonInspector(dmg, inspector);

const floorShader = {plane: 'solid', kind: 'floor', classList: ['support', 'passable'], text: '·'};
const wallShader = {plane: 'solid', kind: 'wall', text: '#'};
const doorShader = {plane: 'solid', kind: 'door', classList: 'interact'};

dmg.grid.getPlane('solid').classList.add('lit');

const {
  space,
  rooms,
  centers,
  floors,
  walls,
  doors
} = planMine({
  rect: {x: 0, y: 0, w: 40, h: 30},
  minRoomCount: 3,
  maxRoomCount: 20,
  minRoomArea: 20,
  maxRoomArea: 40,
  wallBreakingCost: 10,
  tunnelTurningCost: 1000
});

/**
 * @param {Iterable<number>} indexes
 * @param {NewTileSpec} shader
 */
function render(indexes, shader) {
  for (const index of indexes) {
    dmg.grid.createTile({
      pos: space.point(index),
      ...shader
    });
  }
}

render(select(floors), floorShader);
render(select(walls), wallShader);
render(select(doors), doorShader);

const start = Math.floor(Math.random() * rooms.length);

const actor = dmg.grid.createTile({
  pos: centers[start],
  plane: 'solid',
  kind: 'char',
  classList: ['mover', 'input', 'focus'],
  text: '@'
});

dmg.updateActorView(actor);
