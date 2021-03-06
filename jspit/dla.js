// @ts-check

/// module code with more-or-less reusable bits
// TODO consider factoring them out into cdom/...

import {toRad, parseAngle} from './units';
import {stepParticles} from './particles';

import {centroid} from 'cdom/tiles';
import {
  cardinals,
  neighbors,
} from 'cdom/procgen';

/**
 * @template T
 * @param {Iterable<T>} it
 * @param {(t: T) => boolean} where
 * @returns {boolean}
 */
function some(it, where) {
  for (const thing of it)
    if (where(thing)) return true;
  return false;
}

/**
 * @template S
 * @template T
 * @param {Iterable<S>} it
 * @param {(s: S) => Iterable<T>} each
 * @returns {IterableIterator<T>}
 */
function *flatmap(it, each) {
  for (const thing of it)
    yield* each(thing);
}

/** @typedef {import('cdom/tiles').Point} Point */

import {DOMgeon, DOMgeonInspector} from 'cdom/domgeon';

/**
 * @param {Generator<Point>} it
 * @returns {Point}
 */
function nextPoint(it) {
  return it.next().value || {x: NaN, y: NaN};
}

/** @typedef {Point&{heading:number}} Heading */

/**
 * @param {Point[]} A
 * @param {Point[]} B
 * @returns {Heading}
 */
function choosePointFacing(A, B) {
  let pos = null, at = null, dab = NaN;
  for (const a of A) for (const b of B) {
    const d = Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2);
    if (d >= dab) continue;
    pos=a, at=b, dab=d;
  }
  if (!pos || !at) return {heading: NaN, x: NaN, y: NaN};
  const heading = Math.atan2(at.x - pos.x, at.y - pos.y);
  return {heading, ...pos};
}

/**
 * @param {number} n
 * @param {Generator<Point>} g
 * @returns {Point[]}
 */
function takePoints(n, g) {
  const r = [];
  for (let i = 0; i < n; ++i) {
    const {value, done} = g.next();
    if (value) r.push(value)
    if (done) break;
  }
  return r;
}

/** @enum {number} */
const InitWhere = {
  Seed: 0,
  RandSeed: 1,
  RandPrior: 2,
  RandVoid: 3,
  RandAny: 4,
};

export default class DLA {
  static config = {
    genRate:   1,
    playRate:  100,

    bounds: {x: 0, y: 0, w: 0, h: 0},

    seeds: [
      {x: 0, y: 0},
    ],

    initWhere: {
      value: InitWhere.RandAny,
      options: [
        {label: 'First Seed', value: InitWhere.Seed},
        {label: 'Random Seed', value: InitWhere.RandSeed},
        {label: 'Random Point: World', value: InitWhere.RandPrior},
        {label: 'Random Point: Void', value: InitWhere.RandVoid},
        {label: 'Random Point', value: InitWhere.RandAny},
      ],
    },
    initAnyBalance: 0.25,

    turnLeft:  0.1,
    turnRight: 0.1,

    stepLimit: 0,
    particleLimit: 0,

    ordinalMoves: false,
  }

  dmg
  config = DLA.config
  particleID = 0
  havePlayed = false;

  /**
   * @param {DOMgeon} dmg
   */
  constructor(dmg) {
    this.dmg = dmg;
    dmg.animParts.push({
      every: () => this.stepRate(),
      then: n => {
        this.stepN(n);
        this.dmg.updateActorView(this.dmg.focusedActor());
        return true;
      },
    });
    this.reset();
  }

  reset() {
    this.dmg.grid.clear();
    this.particleID = 0
    this.config = Object.create(DLA.config);

    for (const pos of this.config.seeds) this.dmg.grid.createTile({
      plane: 'solid',
      pos,
      id: `particle-${++this.particleID}`, // TODO re-use TileGrid's kind counter
      kind: 'particle',
      classList: ['init', 'support', 'passable'],
      text: '·',
    });

    this.dmg.grid.viewPoint = centroid(
      Array.from(this.dmg.grid.queryTiles({plane: 'solid', className: ['particle', 'init']}))
        .map(p => this.dmg.grid.getTilePosition(p)));

    if (!(this.config.bounds.w*this.config.bounds.h)) {
      const {w, h} = this.dmg.grid.viewSize;
      this.config.bounds = {
        x: -w/2, y: -h/2,
        w:  w,   h:  h,
      };
    }
    if (!(this.config.bounds.w*this.config.bounds.h))
      throw new Error('invalid DLA bounds');

    if (!this.config.particleLimit) {
      const {bounds: {w, h}} = this.config;
      this.config.particleLimit = (w * h)/3;
    } else if (this.config.particleLimit < 1) {
      const {bounds: {w, h}, particleLimit} = this.config;
      this.config.particleLimit = (w * h)*particleLimit;
    }

    if (!this.config.stepLimit) {
      const {bounds: {w, h}} = this.config;
      this.config.stepLimit = Math.max(w, h) / 2;
    }

    dmg.updateActorView(dmg.grid.createTile({
      plane: 'solid',
      pos: this.config.seeds[0],
      kind: 'mover',
      classList: ['input', 'focus'],
      text: '@',
    }));

    this.dmg.playing = false;
    this.havePlayed = false;
  }

  *chooseVoid() {
    const {bounds} = this.config;
    while (true) {

      // TODO this leads to bias for P(reasons); would be nice to unpack and
      // understand that more
      // const pos = {
      //   x: bounds.x + Math.random() * bounds.w,
      //   y: bounds.y + Math.random() * bounds.h,
      // };

      // NOTE choosing points on a 1-d z-curve still has bias
      // // how many random bits do we need to choose a point in bounds?
      // import {mortonCompact1} from './tiles';
      //
      // const {w, h} = this.config.bounds;
      // this.config.boundBits =
      //   Math.ceil(Math.log(w) / Math.log(2)) +
      //   Math.ceil(Math.log(h) / Math.log(2));
      //
      // const r = Math.random() * Math.pow(2, this.config.boundBits);
      // const pos = {
      //   x: bounds.x + mortonCompact1(r),
      //   y: bounds.y + mortonCompact1(r >> 1),
      // };

      const
        r = Math.random() * Math.sqrt(Math.pow(bounds.w, 2) + Math.pow(bounds.h, 2)),
        θ = Math.random() * 2 * Math.PI,
        pos = {x: Math.sin(θ) * r, y: Math.cos(θ) * r};

      if (!some(
        this.dmg.grid.tilesAt(pos, 'particle'),
        t => !t.classList.contains('live')
      )) yield pos;
    }
  }

  *choosePrior() {
    const prior = Array.from(this.dmg.grid.queryTiles({plane: 'solid', className: 'particle'}))
      .filter(t => !t.classList.contains('live'));
    while (true) {
      const tile = prior[Math.floor(Math.random()*prior.length)];
      yield this.dmg.grid.getTilePosition(tile);
    }
  }

  /**
   * @returns {Heading}
   */
  initPlace() {
    const taken = 10;
    const {seeds, initWhere: {value: where}, initAnyBalance} = this.config;
    switch (where) {

    case InitWhere.Seed:
      // TODO round robin all seeds?
      return choosePointFacing([seeds[0]], takePoints(taken, this.chooseVoid()));
    case InitWhere.RandSeed:
      return choosePointFacing(seeds, takePoints(taken, this.chooseVoid()));

    case InitWhere.RandPrior:
      return choosePointFacing(
        takePoints(taken, this.choosePrior()),
        takePoints(taken, this.chooseVoid()),
      );
    case InitWhere.RandVoid:
      return choosePointFacing(
        takePoints(taken, this.chooseVoid()),
        takePoints(taken, this.choosePrior()),
      );
    case InitWhere.RandAny:
      const nVoid  = this.dmg.grid.queryTiles({plane: 'solid', className: ['particle', 'void']}).length;
      const nPrime = this.dmg.grid.queryTiles({plane: 'solid', className: ['particle', 'prime']}).length;
      const total  = nVoid + nPrime;
      const sVoid  = Math.pow(Math.random(), nVoid  - total * (1 - initAnyBalance));
      const sPrime = Math.pow(Math.random(), nPrime - total *      initAnyBalance);
      return sPrime >= sVoid
        ? choosePointFacing(
          takePoints(taken, this.choosePrior()),
          takePoints(taken, this.chooseVoid()),
        )
        : choosePointFacing(
          takePoints(taken, this.chooseVoid()),
          takePoints(taken, this.choosePrior()),
        );

    default:
      throw new Error(`invalid initWhere value ${where}`);
    }
  }

  /**
   * @returns {HTMLElement|null}
   */
  spawn() {
    const {particleLimit} = this.config;

    const ghost = this.dmg.grid.queryTile({
      plane: 'solid',
      className: 'ghost',
      id: '^particle-',
    });
    if (!ghost &&
       this.dmg.grid.queryTiles({plane: 'solid', className: 'particle'}).length >= particleLimit) return null;

    const {heading, ...pos} = this.initPlace();
    const kind = this.anyCell(pos) ? 'prime' : 'void';

    const it = kind === 'prime' ? this.chooseVoid() : this.choosePrior();
    let to = nextPoint(it);
    for (let i = 0; i < 3; ++i) {
      const pt = nextPoint(it);
      if (Math.pow(pt.x - pos.x, 2) + Math.pow(pt.y - pos.y, 2) <
          Math.pow(to.x - pos.x, 2) + Math.pow(to.y - pos.y, 2)
      ) to = pt;
    }

    const spec = {
      plane: 'solid',
      pos,
      text: '🌲',
      kind: 'particle',
      classList: [kind, 'live', '-ghost', 'support'],
      data: {
        steps: 0,
        heading: `${heading}rad`,
      },
    };
    if (ghost)
      return this.dmg.grid.updateTile(ghost, spec);
    return this.dmg.grid.createTile({
      id: `particle-${++this.particleID}`,
      ...spec});
  }

  /**
   * @param {Point[]} pts
   * @returns {boolean}
   */
  anyCell(...pts) {
    const allTiles = flatmap(pts, pt => this.dmg.grid.tilesAt(pt, 'particle'));
    return some(allTiles, t => !t.classList.contains('live'));
  }

  stepRate() {
    return this.dmg.playing ? this.config.playRate : this.config.genRate;
  }

  /**
   * @param {number} n
   * @returns {void}
   */
  stepN(n) {
    const {
      turnLeft, turnRight,
      ordinalMoves,
      stepLimit,
    } = this.config;

    const particleNear = ordinalMoves ? neighbors : cardinals;

    for (let i = 0; i < n; ++i) if (!stepParticles({
      grid: this.dmg.grid,
      update: (grid, ps) => {
        for (const p of ps) {
          let heading = toRad(parseAngle(grid.getTileData(p, 'heading')));
          const adj = Math.random() * (turnLeft + turnRight) - turnLeft;
          heading += Math.PI * adj;
          heading %= 2 * Math.PI;
          grid.setTileData(p, 'heading', `${heading}rad`);
        }
      },
      move: (grid, p, pos, to) => {
        // clamped to grid boundaries
        const posCell = {x: Math.floor(pos.x), y: Math.floor(pos.y)};
        const toCell = {x: Math.floor(to.x), y: Math.floor(to.y)};

        // check for phase transition when entering a new grid cell based on
        // any non-live particle prescence
        const livePos = some(
          grid.tilesAt(posCell, 'particle'),
          t => t.id !== p.id && !t.classList.contains('live'));
        const liveTo = some(
          grid.tilesAt(toCell, 'particle'),
          t => !t.classList.contains('live'));

        // in-world particles may forge into the void; aka random walker
        if (livePos && !liveTo) {
          // TODO allow for more than 1 step
          grid.updateTile(p, {
            pos: toCell,
            text: '·',
            classList: ['-live', 'prime', '-void', 'passable', 'support'],
          });
          return false;
        }

        // in-void particle aggregating onto world; aka DLA depostion
        if (!livePos && (                        // no current world particle
          liveTo ||                              // particle hit the world
          this.anyCell(...particleNear(posCell)) // or became adjacent
        )) {
          grid.updateTile(p, {
            pos: posCell,
            text: '·',
            classList: ['-live', 'void', '-prime', 'passable', 'support'],
          });
          return false;
        }

        return true;
      },
      ordinalMoves,
      stepLimit,
    })) if (!this.spawn()) break;
  }
}

/// demo page-level code

import {find, mustFind} from 'cdom/wiring';

const dmg = window.dmg = new DOMgeon({
  ui: document.body,
  keys: document.body,
  grid: mustFind('.grid'),
  moveBar: find('.buttonbar.moves'),
  actionBar: find('.buttonbar.actions'),
});

import * as config from './config';
/** @type {config.Context} */
const ctx = {
  getInput: (name) => document.querySelector(`.menu input[name="${name}"]`) || null,
  getSelect: (name) => document.querySelector(`.menu select[name="${name}"]`) || null,
};
config.bindVars({ctx, data: DLA.config});

const inspectEl = find('#inspector')
const inspector = inspectEl
  ? new DOMgeonInspector(dmg, inspectEl)
  : null;

const initialDrop = 0.25; // auto-drop player at this proportion of limit particles
const particleID = find('#particleID');
const world = new DLA(dmg);
dmg.animParts.push(_ => {
  if (particleID) {
    particleID.textContent = world.particleID.toString();
    if (!world.havePlayed && !dmg.playing && world.particleID >= initialDrop*world.config.particleLimit) {
      dmg.playing = true;
      world.havePlayed = true;
    }
  }
  return true;
});

dmg.onKey.byCode['Backspace'] = () => {
  world.reset();
  if (particleID) particleID.innerText = '0';
};

/** @param {Event} event */
dmg.onKey.byKey['@'] = ({type}) => {
  if (type !== 'keyup') return;
  if (dmg.playing = !dmg.playing) world.havePlayed = true;
};

/** @param {Event} event */
dmg.onKey.byCode['Space'] = ({type}) => {
  const enabled = type === 'keydown';
  dmg.grid.el.classList.toggle('inspectable', enabled);
  dmg.grid.el.classList.toggle('retro', enabled);
  if (inspector) {
    if (enabled) dmg.grid.el.addEventListener('mousemove', inspector);
    else dmg.grid.el.removeEventListener('mousemove', inspector);
  }
};

