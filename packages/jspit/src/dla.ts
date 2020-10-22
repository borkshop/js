import {bindVars} from './config';
import {
  Point, TileGrid,
  TileInspector, TileInspectEvent, dumpTiles,
  processMoves,
} from './tiles';
import {KeyMap, coalesceMoves} from './input';
import {everyFrame, schedule} from './anim';
import {show as showUI, Bindings as UIBindings} from './ui';

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
      this.grid.createTile(`particle-${++this.particleID}`, {
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

  elapsed = 0

  dropPlayer() {
    const {seeds} = this.config;
    const pos = seeds[0];
    this.grid.createTile('at', {
      pos,
      text: '@',
      className: ['solid', 'mover', 'input'],
    });
  }

  *chooseVoid() {
    const {bounds} = this.config;
    while (true) {
      const pos = {
        x: bounds.x + Math.random() * bounds.w,
        y: bounds.y + Math.random() * bounds.h,
      };
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
      text: '*',
      className: ['particle', 'live', kind],
      data: {heading},
    };
    if (ghost)
      return this.grid.updateTile(ghost, spec);
    return this.grid.createTile(`particle-${++this.particleID}`, spec);
  }

  anyCell(...pts:Point[]):boolean {
    for (const pt of pts)
      if (this.grid.tilesAt(pt, 'particle')
          .filter(t => !t.classList.contains('live'))
          .length) return true;
    return false;
  }

  update(dt:number): void {
    const {
      genRate, playRate,
      turnLeft, turnRight,
      ordinalMoves,
      stepLimit,
    } = this.config;

    const havePlayer = !!this.grid.queryTile({className: ['mover', 'input']});

    const rate = havePlayer ? playRate : genRate;
    this.elapsed += dt
    const n = Math.floor(this.elapsed / rate);
    if (!n) return;
    this.elapsed -= n * rate;
    let ps = this.grid.queryTiles({className: ['particle', 'live']});

    for (let i = 0; i < n; ++i) {
      ps = ps.filter(p => p.classList.contains('live'));
      if (!ps.length) {
        const p = this.spawn();
        if (!p) {
          if (!havePlayer) this.dropPlayer();
          return;
        }
        ps.push(p);
        continue;
      }

      for (const p of ps) {
        let steps = this.grid.getTileData(p, 'steps');
        if (typeof steps !== 'number') steps = 0;
        this.grid.setTileData(p, 'steps', ++steps);

        let heading = this.grid.getTileData(p, 'heading');
        if (typeof heading !== 'number') heading = 0;

        const adj = Math.random() * (turnLeft + turnRight) - turnLeft;
        heading += Math.PI * adj;
        heading %= 2 * Math.PI;
        this.grid.setTileData(p, 'heading', heading);

        const p1 = this.grid.getTilePosition(p);

        // move along heaading... somehow
        const p2 = {x: p1.x, y: p1.y};
        let dx = Math.cos(heading);
        let dy = Math.sin(heading);
        if (!ordinalMoves) {
          // movement clamped to cardinal directions, with optional tracking of
          // "debt" from the diagonal not taken
          const prior = this.grid.getTileData(p, 'prior');
          if (prior !== null && typeof prior === 'object' && !Array.isArray(prior)) {
            if (typeof prior.x === 'number') dx += prior.x;
            if (typeof prior.y === 'number') dy += prior.y;
          }
          if (Math.abs(dy) > Math.abs(dx)) {
            if (dy < 0) p2.y++, dy++;
            else        p2.y--, dy--;
          } else {
            if (dx < 0) p2.x++, dx++;
            else        p2.x--, dx--;
          }
          this.grid.setTileData(p, 'prior', {x: dx, y: dy});
        } else {
          // smooth movement, taking fractional positions
          p2.x += dx;
          p2.y += dy;
        }

        // clamped to grid boundaries
        const p3 = {x: Math.floor(p1.x), y: Math.floor(p1.y)};
        const p4 = {x: Math.floor(p2.x), y: Math.floor(p2.y)};

        // check for phase transition when entering a new grid cell based on
        // what non-live particle prescence
        if (p3.x !== p4.x || p3.y !== p4.y) {
          const at3 = this.grid.tilesAt(p3, 'particle')
            .filter(t => t.id !== p.id && !t.classList.contains('live'));
          const at4 = this.grid.tilesAt(p4, 'particle')
            .filter(t => !t.classList.contains('live'));

          // in-world particles may forge into the void; aka random walker
          if (at3.length && !at4.length) {
            // TODO allow for more than 1 step
            this.grid.updateTile(p, {
              pos: p4,
              text: '·',
              className: ['particle', 'prime'],
            });
            continue;
          }

          // in-void particle aggregating onto world; aka DLA depostion
          else if (!at3.length && (
            at4.length
            || this.anyCell(
              {x: p3.x,   y: p3.y-1},
              {x: p3.x+1, y: p3.y},
              {x: p3.x,   y: p3.y+1},
              {x: p3.x-1, y: p3.y},
            )
            || (ordinalMoves && this.anyCell(
              {x: p3.x+1, y: p3.y-1},
              {x: p3.x+1, y: p3.y+1},
              {x: p3.x-1, y: p3.y+1},
              {x: p3.x-1, y: p3.y-1},
            ))
          )) {
            this.grid.updateTile(p, {
              pos: p3,
              text: '·',
              className: ['particle', 'void'],
            });
            continue;
          }
        }

        this.grid.moveTileTo(p, p2);

        // increment step counter, and leave a ghost if limit met or exceeded
        if (steps >= stepLimit) {
          this.grid.updateTile(p, {
            pos: p1,
            className: ['ghost'],
          });
        }
      }
    }
  }
}

// injected DOM parts
interface Bindings extends UIBindings {
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
  keys: KeyMap,
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

export function init(bind:Bindings) {
  Object.assign(bound, bind);

  if (bound.grid) {
    state.grid = new TileGrid(bound.grid);
    if (bound.inspector) {
      state.inspector = new TileInspector(state.grid, onInsepcted);
      state.inspector.disable();
    }
  }

  if (bound.keys) state.keys = new KeyMap(bound.keys, (ev:KeyboardEvent):boolean => {

    if (ev.key === 'Escape') {
      if (ev.type === 'keydown') playPause();
      return false;
    }

    if (ev.code === 'Space') {
      const enabled = ev.type === 'keydown';
      if (enabled) state.inspector?.enable();
      else         state.inspector?.disable();
      state.grid?.el.classList.toggle('inspectable', enabled && !!state.inspector);
      state.grid?.el.classList.toggle('retro', enabled);
      return false;
    }

    if (!state.running) return false;
    return !ev.altKey && !ev.ctrlKey && !ev.metaKey;
  });

  bound.run?.addEventListener('click', playPause);
  bound.reset?.addEventListener('click', () => {
    if (state.world) state.running = false;
    state.world = undefined;
    if (bound.reset) bound.reset.disabled = true;
    showUI(bound, false, false);
  });
  bound.dropPlayer?.addEventListener('click', () => {
    if (state.world) {
      if (bound.dropPlayer) bound.dropPlayer.disabled = true;
      state.world.dropPlayer();
    }
  });

  bindVars({
    data: DLA.config,
    getInput: (name:string) => bound.menu?.querySelector(`input[name="${name}"]`) || null,
    getSelect: (name:string) => bound.menu?.querySelector(`select[name="${name}"]`) || null,
  });

  showUI(bound, false, false);
}

function thenInput():boolean {
  const {keys, grid} = state;
  if (!keys || !grid) return false;

  const presses = keys.consumePresses();

  let {have, move} = coalesceMoves(presses);
  if (have) for (const mover of grid.queryTiles({className: ['mover', 'input']}))
    grid.setTileData(mover, 'move', move);

  const playerAt: Point[] = [];

  processMoves({grid, kinds: {
    // solid movers must stay on particle support and are subject to collison
    solid: ({mover, at, to}):boolean => {

      // TODO restore dig ability
      // if (!at.length) {
      //   const aid = mover.id;
      //   const did = (digSeq.get(aid) || 0) + 1;
      //   digSeq.set(aid, did);
      //   grid.createTile(`particle-placed-${aid}-${did}`, {
      //     className: ['particle'],
      //     pos: to,
      //     fg: 'var(--dla-player)',
      //     text: '·',
      //   });
      //   return;
      // }

      // can only move there if have particle support
      if (!at.some(h => h.classList.contains('particle'))) return false;

      // may not move there if occupied by another solid
      if (at.some(h => h.classList.contains('solid'))) return false;
      // TODO interaction

      if (mover.classList.contains('input')) playerAt.push(to);
      return true;
    }
  }});

  const c = playerAt.reduce((c, p) => {
    if (isNaN(c.x) || isNaN(c.y)) return p;
    return {x: (c.x + p.x)/2, y: (c.y + p.y)/2};
  }, {x: NaN, y: NaN});
  if (!isNaN(c.x) && !isNaN(c.y)) {
    const {x: vx, y: vy, w, h} = grid.viewport;
    if (c.x <= vx || c.y <= vy || c.x+1 >= vx + w || c.y+1 >= vy + h)
      grid.viewPoint = c;
  }

  return true;
}

function playPause() {
  if (!state.grid) return;

  showUI(bound, true, !state.running);

  if (!state.world) {
    state.world = new DLA(state.grid);
    if (bound.dropPlayer) bound.dropPlayer.disabled = false;
    if (bound.reset) bound.reset.disabled = false;
  }

  if (state.running) state.running = false; else {
    state.running = true;
    everyFrame(schedule(
      () => !!state.running,

      {every: DLA.inputRate, then: thenInput},

      (dt:number) => {
        const {world} = state;
        if (!world) return false;
        world.update(dt);
        if (bound.particleID)
          bound.particleID.innerText = world.particleID.toString();
        return true;
      },
    ));
  }
}
