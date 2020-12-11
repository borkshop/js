// @ts-check

import {find, mustFind} from 'cdom/wiring';

import {DOMgeon, DOMgeonInspector} from 'cdom/domgeon';
import * as build from 'cdom/builder';
import * as PRNG from 'cdom/prng';

const search = new URLSearchParams(location.search);
const prng = PRNG.ingest(
  new PRNG.XorShift128Plus(),
  search.get('seed') || '',
);

/* {
  // logs frequency tables to test prng seeding
  const levels = 100;
  for (const {label, rngs} of [
    {
      label: 'old scheme, cold',
      rngs: new Array(levels).fill(1).map((_, i) =>
        PRNG.ingest(new PRNG.XorShift128Plus(), `${i}`)),
    },
    {
      label: 'old scheme, warmed up',
      rngs: new Array(levels).fill(1).map((_, i) => {
        const rng = PRNG.ingest(new PRNG.XorShift128Plus(), `${i}`);
        while (rng.random() < 0.8) {}
        return rng;
      }),
    },
    {
      label: 'new scheme',
      rngs: function*() {
        let seed = '';
        for (let i = 0; i < levels; ++i) {
          const rng = PRNG.ingest(new PRNG.XorShift128Plus(), seed);
          const nextSeedBytes = new Uint8Array(32);
          rng.scribble(nextSeedBytes.buffer);
          seed = btoa(String.fromCharCode(...nextSeedBytes));
          yield rng;
        }
      },
    },
  ]) {
    console.log(label);
    console.table(PRNG.countOutcomes(
      typeof rngs === 'function' ? rngs() : rngs, (rng, count) => {
        const rounds = 10, n = 100;
        // roll {rounds}d{N}
        for (let i = 0; i < rounds; ++i)
          count(Math.floor((rng.random() * n)));
      })
      // transform count maps to descending outcome strings
      .map(counts => Array.from(counts.entries())
        .map(([rand, count]) => [count, rand])
        .sort(([a], [b]) => b - a)
        .map(([count, rand]) => `${count} x ${rand}`)
      )
      // only return the top-10 from reach round
      .map(row => row.slice(0, 10)));
  }
} */

const nextSeedBytes = new Uint8Array(32);
prng.scribble(nextSeedBytes.buffer);
const nextSeed = btoa(String.fromCharCode(...nextSeedBytes));

/** @typedef { import("cdom/tiles").Point } Point */
/** @typedef { import("cdom/tiles").Rect } Rect */
/** @typedef { import("cdom/builder").Context } Context */

/**
 * @template T
 * @typedef { import("cdom/builder").Shader<T> } Shader
 */

const dmg = new DOMgeon({
  ui: document.body,
  keys: document.body,
  grid: mustFind('.grid'),
  moveBar: find('.buttonbar.moves'),
  actionBar: find('.buttonbar.actions'),
  lightLimit: 0.2,
  procs: {
    link() {
      window.location.search = new URLSearchParams({seed: nextSeed}).toString();
    }
  }
});
globalThis.dmg = dmg;
const inspector = find('#inspector');
if (inspector) new DOMgeonInspector(dmg, inspector);

const floorShader = build.toShader({plane: 'solid', kind: 'floor', classList: ['support', 'passable'], text: ''});
const treeShader = build.toShader({plane: 'solid', kind: 'tree', text: '🌲'});
const linkShader = build.toShader({
  plane: 'solid',
  kind:  'link',
  text: '🔗',
  classList: ['interact'],
  data: { proc: 'link' }
});

dmg.grid.getPlane('solid').classList.add('lit');

const distance = prng.random() * 10 + 10;
const angle = prng.random() * Math.PI * 2;
const linkPos = {
  x: Math.round(distance * Math.cos(angle)),
  y: Math.round(distance * Math.sin(angle)),
};

/**
 * @param {Context} grid
 * @param {Point} pos
 * @param {Rect} rect
 */
function forestShader(grid, pos, rect) {
  floorShader(grid, pos, rect);
  if (pos.x === 0 && pos.y === 0) {
  } else if (pos.x == linkPos.x && pos.y === linkPos.y) {
    linkShader(grid, pos, rect);
  } else if ((prng.randomUint32() & 0x3) === 0) {
    treeShader(grid, pos, rect);
  }
}

build.fillRect((dmg.grid), {x: -50, y: -50, w: 101, h: 101}, forestShader);

const actor = dmg.grid.createTile({
  pos: {x: 0, y: 0},
  plane: 'solid',
  kind: 'char',
  classList: ['mover', 'input', 'focus'],
  text: '🙂'
});

dmg.updateActorView(actor);
dmg.start();
