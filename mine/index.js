// @ts-check

/** @typedef { import("cdom/tiles").NewTileSpec } NewTileSpec */

import {DOMgeon, DOMgeonInspector, assignProcs} from 'cdom/domgeon';
import {find, mustFind} from 'cdom/wiring';
import * as PRNG from 'cdom/prng';
import {select} from './iteration.js';
import {planMine} from './mine.js';

const search = new URLSearchParams(location.search);
const prng = PRNG.ingest(
  new PRNG.XorShift128Plus(),
  search.get('seed') || '',
);
const random = () => prng.random();

// const nextSeedBytes = new Uint8Array(32);
// prng.scribble(nextSeedBytes.buffer);
// const nextSeed = btoa(String.fromCharCode(...nextSeedBytes));

const dmg = new DOMgeon({
  ui: document.body,
  keys: document.body,
  grid: mustFind('.grid'),
  moveBar: mustFind('.buttonbar.moves'),
  actionBar: find('.buttonbar.actions'),
  lightLimit: 0.2,
  playing: false,
});
globalThis.dmg = dmg;

assignProcs(dmg.procs, {
  link({grid, object}) {
    const params = grid.getTileData(object, 'linkParams');
    if (typeof params !== 'string') return false;
    window.location.search = params;
    return true;
  }
});

const inspector = find('#inspector');
if (inspector) new DOMgeonInspector(dmg, inspector);

planMine({
  rect: {x: 0, y: 0, w: 40, h: 30},
  minRoomCount: 3,
  maxRoomCount: 20,
  minRoomArea: 20,
  maxRoomArea: 40,
  tunnelDiggingCost: 10,
  tunnelTurningCost: 10,
  random,
}, ({space, rooms, centers, floors, walls, doors, weights}) => {
  dmg.grid.clear();

  const plane = 'solid';

  /**
   * @param {NewTileSpec} spec
   * @param {Iterable<number>[]} indexes
   */
  function render(spec, ...indexes) {
    // TODO push the i < index < indexes revolution up and out through iteration.js
    for (const index of indexes) for (const i of index) {
      const pos = space.point(i);
      dmg.grid.createTile({pos, ...spec});
    }
  }

  for (let i = 0; i < weights.length; i++) {
    const pos = space.point(i);
    dmg.grid.createTile({
      pos,
      kind: 'debug',
      plane: 'debug',
      data: {
        weight: weights[i]
      }
    });
  }

  render({
    plane,
    kind: 'floor',
    classList: ['support', 'passable'],
    text: '·',
  }, select(floors), select(walls));

  render({
    plane,
    kind: 'wall',
    text: '#',
  }, select(walls));

  render({
    plane,
    kind: 'door',
  }, select(doors));

  const start = Math.floor(random() * rooms.length);

  const actor = dmg.grid.createTile({
    plane,
    pos: centers[start],

    kind: 'char',
    classList: ['mover', 'input', 'focus'],
    text: '@'
  });

  dmg.updateActorView(actor);
});

// /**
//  * @param {Event} event
//  */
// dmg.onKey.byID.genNext = ({type}) => {
//   if (type === 'keyup') {
//     generator.next();
//   }
// };
//
// /**
//  * @param {Event} event
//  */
// dmg.onKey.byID.genToEnd = ({type}) => {
//   if (type === 'keyup') {
//     for (const _ of generator) {}
//   }
// };
