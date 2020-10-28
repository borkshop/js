import {
  Point, TileGrid,
  TileInspector, TileInspectEvent, dumpTiles,
  moveTiles,
} from 'cdom/tiles';
import {KeyCtl, coalesceMoves} from 'cdom/input';
import {everyFrame, schedule} from 'cdom/anim';
import {toRad, parseAngle} from './units';

import {bindVars} from './config';
import {stepParticles} from './particles';

const enum InitWhere {
  Seed = 0,
  RandSeed,
  RandPrior,
  RandVoid,
  RandAny,
}

function nextPoint(it:Generator<Point>):Point {
  return it.next().value || {x: NaN, y: NaN};
}

function choosePointFacing(A: Point[], B: Point[]):Point&{heading:number} {
  let pos: Point|null = null,
      at:  Point|null = null,
      dab: number     = NaN;
  for (const a of A) for (const b of B) {
    const d = Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2);
    if (d >= dab) continue;
    pos=a, at=b, dab=d;
  }
  if (!pos || !at) return {heading: NaN, x: NaN, y: NaN};
  const heading = Math.atan2(at.x - pos.x, at.y - pos.y);
  return {heading, ...pos};
}

function takePoints(n:number, g:Generator<Point>):Point[] {
  const r: Point[] = [];
  for (let i = 0; i < n; ++i) {
    const {value, done} = g.next();
    if (value) r.push(value)
    if (done) break;
  }
  return r;
}

export class DLA {
  // rate at which to coalesce and process movement input
  static inputRate = 100

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

  particleID = 0

  grid: TileGrid

  config?:any

  constructor(grid:TileGrid) {
    this.config = Object.create(DLA.config);
    this.grid = grid;

    const {seeds} = this.config;
    this.grid.clear();
    const center = {x: NaN, y: NaN};
    for (const pos of seeds) {
      this.grid.createTile({
        id: `particle-${++this.particleID}`,
        pos,
        text: '·',
        className: ['particle', 'init'],
      });
      if (isNaN(center.x) || isNaN(center.y)) center.x = pos.x, center.y = pos.y;
      else center.x = (center.x + pos.x)/2, center.y = (center.y + pos.y)/2;
    }
    if (!isNaN(center.x) && !isNaN(center.y)) this.grid.viewPoint = center;

    if (!(this.config.bounds.w*this.config.bounds.h)) {
      const {w, h} = this.grid.viewSize;
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
  }

  dropPlayer() {
    const {seeds} = this.config;
    const pos = seeds[0];
    this.grid.createTile({
      pos,
      text: '@',
      className: ['input', 'solid', 'mover'],
    });
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

      const at = this.grid.tilesAt(pos, 'particle')
        .filter(t => !t.classList.contains('live'));
      if (!at.length) yield pos;
    }
  }

  *choosePrior() {
    const prior = this.grid.queryTiles({className: 'particle'})
      .filter(t => !t.classList.contains('live'));
    while (true) {
      const tile = prior[Math.floor(Math.random()*prior.length)];
      yield this.grid.getTilePosition(tile);
    }
  }

  initPlace():Point&{heading:number} {
    const taken = 10;
    const {seeds, initWhere: {value: where}, initAnyBalance} = this.config;
    switch (where) {

    case InitWhere.Seed:
      // TODO round robin all seeds?
      return choosePointFacing(seeds[0], takePoints(taken, this.chooseVoid()));
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
      const nVoid  = this.grid.queryTiles({className: ['particle', 'void']}).length;
      const nPrime = this.grid.queryTiles({className: ['particle', 'prime']}).length;
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

  spawn():HTMLElement|null {
    const {particleLimit} = this.config;

    const ghost = this.grid.queryTile({
      className: 'ghost',
      id: '^particle-',
    });
    if (!ghost &&
       this.grid.queryTiles({className: 'particle'}).length >= particleLimit) return null;

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
      pos,
      text: '🌲',
      className: ['particle', 'live', kind],
      data: {
        heading: `${heading}rad`,
      },
    };
    if (ghost)
      return this.grid.updateTile(ghost, spec);
    return this.grid.createTile({
      id: `particle-${++this.particleID}`,
      ...spec});
  }

  anyCell(...pts:Point[]):boolean {
    for (const pt of pts)
      if (this.grid.tilesAt(pt, 'particle')
          .filter(t => !t.classList.contains('live'))
          .length) return true;
    return false;
  }

  stepRate() {
    const {genRate, playRate} = this.config;
    const havePlayer = !!this.grid.queryTile({className: ['mover', 'input']});
    return havePlayer ? playRate : genRate;
  }

  stepN(n:number): void {
    const havePlayer = !!this.grid.queryTile({className: ['mover', 'input']});
    const {
      turnLeft, turnRight,
      ordinalMoves,
      stepLimit,
    } = this.config;

    for (let i = 0; i < n; ++i) if (!stepParticles({
      grid: this.grid,
      update: (grid, ps) => {
        for (const p of ps) {
          let heading = toRad(parseAngle(grid.getTileData(p, 'heading')));
          const adj = Math.random() * (turnLeft + turnRight) - turnLeft;
          heading += Math.PI * adj;
          heading %= 2 * Math.PI;
          grid.setTileData(p, 'heading', `${heading}rad`);
        }
      },
      move: (grid:TileGrid, p, pos, to) => {
        // clamped to grid boundaries
        const posCell = {x: Math.floor(pos.x), y: Math.floor(pos.y)};
        const toCell = {x: Math.floor(to.x), y: Math.floor(to.y)};

        // check for phase transition when entering a new grid cell based on
        // any non-live particle prescence
        if (posCell.x !== toCell.x || posCell.y !== toCell.y) {
          const at3 = grid.tilesAt(posCell, 'particle')
            .filter(t => t.id !== p.id && !t.classList.contains('live'));
          const at4 = grid.tilesAt(toCell, 'particle')
            .filter(t => !t.classList.contains('live'));

          // in-world particles may forge into the void; aka random walker
          if (at3.length && !at4.length) {
            // TODO allow for more than 1 step
            grid.updateTile(p, {
              pos: toCell,
              text: '·',
              className: ['particle', 'prime'],
            });
            return false;
          }

          // in-void particle aggregating onto world; aka DLA depostion
          else if (!at3.length && (
            at4.length
            || this.anyCell(
              {x: posCell.x,   y: posCell.y-1},
              {x: posCell.x+1, y: posCell.y},
              {x: posCell.x,   y: posCell.y+1},
              {x: posCell.x-1, y: posCell.y},
            )
            || (ordinalMoves && this.anyCell(
              {x: posCell.x+1, y: posCell.y-1},
              {x: posCell.x+1, y: posCell.y+1},
              {x: posCell.x-1, y: posCell.y+1},
              {x: posCell.x-1, y: posCell.y-1},
            ))
          )) {
            grid.updateTile(p, {
              pos: posCell,
              text: '·',
              className: ['particle', 'void'],
            });
            return false;
          }
        }

        return true;
      },
      ordinalMoves,
      stepLimit,
    })) {
      const p = this.spawn();
      if (!p) {
        if (!havePlayer) this.dropPlayer();
        return;
      }
    }
  }

  processMoves() {
    const playerAt: Point[] = [];

    moveTiles({grid: this.grid, kinds: {
      // solid movers must stay on particle support and are subject to collison
      solid: ({mover, at, to}):boolean => {
        // can only move there if have particle support
        if (!at.some(h => h.classList.contains('particle'))) return false;

        // may not move there if occupied by another solid
        if (at.some(h => h.classList.contains('solid'))) return false;

        if (mover.classList.contains('input')) playerAt.push(to);
        return true;
      }
    }});

    const c = playerAt.reduce((c, p) => {
      if (isNaN(c.x) || isNaN(c.y)) return p;
      return {x: (c.x + p.x)/2, y: (c.y + p.y)/2};
    }, {x: NaN, y: NaN});
    if (!isNaN(c.x) && !isNaN(c.y)) {
      const {x: vx, y: vy, w, h} = this.grid.viewport;
      if (c.x <= vx || c.y <= vy || c.x+1 >= vx + w || c.y+1 >= vy + h)
        this.grid.viewPoint = c;
    }
  }
}

// injected DOM parts
interface Bindings {
  ui: HTMLElement,
  menu: HTMLElement,
  grid: HTMLElement,
  particleID: HTMLElement,
  keys: HTMLElement,
  run: HTMLButtonElement,
  reset: HTMLButtonElement,
  dropPlayer: HTMLButtonElement,
  inspector: HTMLTextAreaElement,
  inspectorAt: HTMLElement,
}
export const bound:Partial<Bindings> = {};

// simulation / "game" state and dependencies
interface State {
  grid: TileGrid,
  inspector: TileInspector,
  keys: KeyCtl,
  world: DLA,
  running: boolean
}
export const state:Partial<State> = {};

function onInsepcted({pos: {x, y}, tiles}:TileInspectEvent) {
  if (bound.inspectorAt) {
    bound.inspectorAt.innerText = `${isNaN(x) ? 'X' : Math.floor(x)},${isNaN(y) ? 'Y' : Math.floor(y)}`;
  }
  if (bound.inspector) dumpTiles({tiles, into: bound.inspector});
}

const keyCodeMap = {
  'Escape': (ev:KeyboardEvent) => {
    if (ev.type === 'keydown') playPause();
  },
  'Space': (ev:KeyboardEvent) => {
    const enabled = ev.type === 'keydown';
    if (state.grid) {
      if (state.inspector) {
        if (enabled)
          state.grid.el.addEventListener('mousemove', state.inspector);
        else
          state.grid.el.removeEventListener('mousemove', state.inspector);
      }
      state.grid.el.classList.toggle('inspectable', enabled && !!state.inspector);
      state.grid.el.classList.toggle('retro', enabled);
    }
  },
};

export function init(bind:Bindings) {
  Object.assign(bound, bind);

  if (bound.grid) {
    state.grid = new TileGrid(bound.grid);
    if (bound.inspector)
      state.inspector = new TileInspector(state.grid, onInsepcted);
  }

  if (bound.keys) {
    state.keys = new KeyCtl(bound.keys);
    Object.assign(state.keys.on.code, keyCodeMap);
  }

  bound.run?.addEventListener('click', playPause);
  bound.reset?.addEventListener('click', () => {
    stop();
    state.world = undefined;
    if (bound.reset) bound.reset.disabled = true;
    toggleUI();
  });
  bound.dropPlayer?.addEventListener('click', () => {
    if (state.world) {
      state.world.dropPlayer();
    }
  });

  bindVars({
    ctx: {
      getInput: (name:string) => bound.menu?.querySelector(`input[name="${name}"]`) || null,
      getSelect: (name:string) => bound.menu?.querySelector(`select[name="${name}"]`) || null,
    },
    data: DLA.config,
  });
  toggleUI();
}

function toggleUI() {
  if (!bound.ui) return;
  bound.ui.classList.toggle('showUI', !!state.world);
  bound.ui.classList.toggle('running', !!state.running);
}

function playPause() {
  if (!state.grid) return;

  if (!state.world) {
    state.world = new DLA(state.grid);
    if (bound.dropPlayer) bound.dropPlayer.disabled = false;
    if (bound.reset) bound.reset.disabled = false;
  }

  if (state.running) stop(); else start();
}

function stop() {
  state.running = false;
}

async function start() {
  const {keys, world, grid} = state;
  if (!keys || !world || !grid) return;

  state.running = true;
  toggleUI();
  keys.counting = true;
  await everyFrame(schedule(
    () => !!state.running,

    {every: DLA.inputRate, then: () => {
      const presses = keys.consume();
      let {have, move} = coalesceMoves(presses);
      if (have) for (const mover of grid.queryTiles({className: ['mover', 'input']}))
        grid.setTileData(mover, 'move', move);
      world.processMoves();
      return true;
    }},

    {
      every: () => world.stepRate(),
      then: (n) => { world.stepN(n); return true },
    },

    () => {
      if (bound.particleID)
        bound.particleID.innerText = world.particleID.toString();
      if (bound.dropPlayer)
        bound.dropPlayer.disabled = !!state.grid?.queryTile({className: ['mover', 'input']});
      return true;
    },
  ));
  keys.counting = false;
  toggleUI();
}
