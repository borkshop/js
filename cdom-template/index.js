// @ts-check

import {find, mustFind} from 'cdom/wiring';

import {DOMgeon} from 'cdom/domgeon';
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

import * as build from 'cdom/builder';
const floorShader = {plane: 'solid', kind: 'floor', classList: ['support', 'passable'], text: '·'};
const wallShader = {plane: 'solid', kind: 'wall', text: '#'};
const doorShader = {plane: 'solid', kind: 'door'};

dmg.grid.getPlane('solid').classList.add('lit');

build.fillRect(dmg.grid, {x: 0, y: 0, w: 13, h: 8}, build.roomShader({
  floors: floorShader,
  walls: wallShader,
  doors: doorShader,
  doorsAt: (pos, rect) => 
    pos.x === rect.x + Math.floor(rect.w/2),
}));

build.fillRect(dmg.grid, {x: 5, y: -5, w: 3, h: 5}, build.roomShader({
  floors: floorShader,
  walls: build.borderShader(null, wallShader),
}));

build.fillRect(dmg.grid, {x: 4, y: -10, w: 5, h: 5}, build.roomShader({
  floors: floorShader,
  walls: wallShader,
  doors: doorShader,
  doorsAt: (pos, rect) => 
    pos.x === rect.x + Math.floor(rect.w/2) &&
    pos.y === rect.y + rect.h-1,
}));

dmg.grid.buildTile({
  pos: {x: 6, y: -8},
  plane: 'solid',
  kind: 'floor',
  classList: ['rune', '-passable'],
  text: 'V',
  data: {
    name: 'void rune',
    morph_spawn: {plane: 'solid', kind: 'char', classList: ['mover', 'input', 'support', 'focus'], text: '*'},
    morph_subject: '-focus',
  },
});

const actor = dmg.grid.createTile({pos: {x: 6, y: 4}, plane: 'solid', kind: 'char', classList: ['mover', 'input', 'focus'], text: '@'});
dmg.updateActorView(actor);
