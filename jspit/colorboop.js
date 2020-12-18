// @ts-check

import {find, mustFind} from 'cdom/wiring';

import {DOMgeon, DOMgeonInspector} from 'cdom/domgeon';
const dmg = new DOMgeon({
  ui: document.body,
  grid: mustFind('.grid'),
  moveBar: find('.buttonbar.moves'),
  actionBar: find('.buttonbar.actions'),
});

globalThis.dmg = dmg;

const inspector = find('#inspector')
if (inspector) new DOMgeonInspector(dmg, inspector);

dmg.onKey.byCode['Backspace'] = () => reset(dmg.grid);

/** @typedef {import('cdom/tiles').TileGrid} TileGrid */

/**
 * @param {TileGrid} grid
 */
function reset(grid) {
  const colors = [
    'black',
    'darker-grey',
    'dark-grey',
    'grey',
    'light-grey',
    'lighter-grey',
    'white',
    'dark-white',
    'blue',
    'bright-purple',
    'cyan',
    'dark-orange',
    'dark-sea-green',
    'green',
    'light-cyan',
    'magenta',
    'orange',
    'purple',
    'red',
    'red-orange',
    'yellow',
    'yellow-orange',
  ];

  grid.clear();

  const pos = {x: 10, y: 10};
  grid.createTile({
    plane: 'solid',
    pos,
    kind: 'mover',
    classList: ['input', 'support'],
    text: '@',
  });
  grid.viewPoint = pos;

  colors.forEach((color, i) => {
    grid.createTile({
      plane: 'solid',
      pos: {x: 5, y: i},
      kind: 'swatch',
      text: '$',
      style: {color: `var(--${color})`},
      data: {
        name: `fg:${color}`,
        morph_subject: {
          style: {color: `var(--${color})`},
        },
      },
    });
    grid.createTile({
      plane: 'solid',
      pos: {x: 15, y: i},
      kind: 'swatch',
      text: '$',
      style: {backgroundColor: `var(--${color})`},
      data: {
        name: `bg:${color}`,
        morph_subject: {
          style: {backgroundColor: `var(--${color})`},
        },
      },
    });
  });
}

reset(dmg.grid);
