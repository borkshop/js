import {html, render} from 'lit-html';
import {bindVars} from './config';
import {Point, TileGrid, TileInspector, TileInspectEvent} from './tiles';
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

export class DLA {
  static demoName = 'DLA'
  static demoTitle = 'Diffusion Limited Aggregation'

  // rate at which to coalesce and process movement input
  static inputRate = 100

  // proportion to scroll viewport by when at goes outside
  static nudgeBy = 0.2

  static settings = {
    genRate:   1,
    playRate:  100,

    bounds: {
      x: -15, y: -15,
      w:  30, h:  30,
    },

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
    initBase: 0,
    initArc:  2.0,

    turnLeft:  0.1,
    turnRight: 0.1,

    stepLimit: 0,
    particleLimit: 0,

    ordinalMoves: false,
  }

  particleID = 0

  grid: TileGrid

  constructor(grid:TileGrid) {
    const {seeds} = DLA.settings;

    this.grid = grid;
    this.grid.clear();
    const center = {x: NaN, y: NaN};
    for (const pos of seeds) {
      this.grid.createTile(`particle-${++this.particleID}`, {
        tag: ['particle', 'init'],
        pos,
        text: '·',
      });
      if (isNaN(center.x) || isNaN(center.y)) center.x = pos.x, center.y = pos.y;
      else center.x = (center.x + pos.x)/2, center.y = (center.y + pos.y)/2;
    }
    if (!isNaN(center.x) && !isNaN(center.y)) this.grid.centerViewOn(center);
  }

  elapsed = 0

  dropPlayer() {
    const {seeds} = DLA.settings;
    const pos = seeds[0];
    this.grid.createTile('at', {
      tag: ['solid', 'mind', 'keyMove'],
      pos,
      fg: 'var(--dla-player)',
      text: '@',
    });
  }

  initPlace():Point {
    const {bounds, seeds, initWhere: {value: where}, initAnyBalance} = DLA.settings;

    const chooseVoid = () => {
      while (true) {
        const pos = {
          x: bounds.x + Math.random() * bounds.w,
          y: bounds.y + Math.random() * bounds.h,
        };
        const at = this.grid.tilesAt(pos, 'particle')
          .filter(t => !t.classList.contains('live'));
        if (!at.length) return pos;
      }
    };

    const choosePrior = () => {
      const prior = this.grid.queryTiles({tag: 'particle'})
        .filter(t => !t.classList.contains('live'));
      const tile = prior[Math.floor(Math.random()*prior.length)];
      return this.grid.getTilePosition(tile);
    };

    switch (where) {

    case InitWhere.Seed:
      return seeds[0]; // TODO round robin all seeds?
    case InitWhere.RandSeed:
      return seeds[Math.floor(Math.random()*seeds.length)];

    case InitWhere.RandPrior: return choosePrior();
    case InitWhere.RandVoid:  return chooseVoid();
    case InitWhere.RandAny:
        const nVoid  = this.grid.queryTiles({tag: ['particle', 'void']}).length;
        const nPrime = this.grid.queryTiles({tag: ['particle', 'prime']}).length;
        const total  = nVoid + nPrime;
        const sVoid  = Math.pow(Math.random(), nVoid  - total * (1 - initAnyBalance));
        const sPrime = Math.pow(Math.random(), nPrime - total *      initAnyBalance);
        return sPrime >= sVoid ? choosePrior() : chooseVoid();

    default:
      throw new Error(`invalid initWhere value ${where}`);
    }
  }

  spawn():HTMLElement|null {
    const ghost = this.grid.queryTile({
      tag: 'ghost',
      id: '^particle-',
    });
    if (!ghost && this.particleID >= this.particleLimit()) return null;

    const {initBase, initArc} = DLA.settings;
    const pos = this.initPlace();
    const heading = Math.PI * (initBase + (Math.random() - 0.5) * initArc);
    const kind = this.anyCell(pos) ? 'prime' : 'void';
    const spec = {
      tag: ['particle', 'live', kind],
      pos,
      text: '*',
      data: {heading},
    };
    if (ghost)
      return this.grid.updateTile(ghost, spec);
    return this.grid.createTile(`particle-${++this.particleID}`, spec);
  }

  stepLimit():number {
    const {bounds, stepLimit} = DLA.settings;
    if (stepLimit > 0) return stepLimit;
    return bounds.w + bounds.h;
  }

  particleLimit():number {
    const {bounds, particleLimit} = DLA.settings;
    if (particleLimit > 0) {
      if (particleLimit > 1) return particleLimit;
      return (bounds.w * bounds.h)*particleLimit;
    }
    return (bounds.w * bounds.h)/2;
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
      bounds,
      turnLeft, turnRight,
      ordinalMoves,
    } = DLA.settings;

    const havePlayer = !!this.grid.queryTile({tag: 'keyMove'});

    const rate = havePlayer ? playRate : genRate;
    this.elapsed += dt
    const n = Math.floor(this.elapsed / rate);
    if (!n) return;
    this.elapsed -= n * rate;
    let ps = this.grid.queryTiles({tag: ['particle', 'live']});

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

        // modulo bounds
        let wrapped = false;
        while (p2.x < bounds.x)            p2.x += bounds.w, wrapped = true;
        while (p2.x > bounds.x + bounds.w) p2.x -= bounds.w, wrapped = true;
        while (p2.y < bounds.y)            p2.y += bounds.h, wrapped = true;
        while (p2.y > bounds.y + bounds.h) p2.y -= bounds.h, wrapped = true;

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
              tag: ['particle', 'prime'],
              pos: p4,
              text: '·',
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
            if (!wrapped) {
              this.grid.updateTile(p, {
                tag: ['particle', 'void'],
                pos: p3,
                text: '·',
              });
              continue;
            } else if (at4.length) {
              this.grid.updateTile(p, {
                pos: p1,
                tag: ['ghost'],
              });
              continue;
            }
          }
        }

        this.grid.moveTileTo(p, p2);

        // increment step counter, and leave a ghost if limit met or exceeded
        if (steps >= this.stepLimit()) {
          this.grid.updateTile(p, {
            tag: ['ghost'],
            pos: p1,
          });
        }
      }
    }
  }

  digSeq = new Map<string, number>()

  consumeInput(presses: Array<[string, number]>):void {
    const movers = this.grid.queryTiles({tag: 'keyMove'});
    if (!movers.length) return;
    if (movers.length > 1) throw new Error(`ambiguous ${movers.length}-mover situation`);
    const actor = movers[0];

    let {have, move} = coalesceMoves(presses);
    if (!have) return;

    const pos = this.grid.getTilePosition(actor);
    const targ = {x: pos.x + move.x, y: pos.y + move.y};

    // solid actors subject to collison
    if (actor.classList.contains('solid')) {
      const hits = this.grid.tilesAt(targ);

      if (!hits.length) {
        // // TODO bring back this power
        // // place particles in the void
        // const aid = actor.id;
        // const did = (this.digSeq.get(aid) || 0) + 1;
        // this.digSeq.set(aid, did);
        // this.grid.createTile(`particle-placed-${aid}-${did}`, {
        //   tag: ['particle'],
        //   pos: targ,
        //   fg: 'var(--dla-player)',
        //   text: '·',
        // });
        return;
      } else {
        // can only move there if have particle support
        if (!hits.some((h) => h.classList.contains('particle'))) return;
      }
    }

    this.grid.moveTileTo(actor, targ);
    this.grid.nudgeViewTo(targ, DLA.nudgeBy);
  }

  running = false

  run(
    readKeys:() => Array<[string, number]>,
    update?:(dt:number) => void,
  ) {

    this.running = true;
    everyFrame(schedule(
      () => this.running,

      {every: DLA.inputRate, then: () => {
        this.consumeInput(readKeys());
        return true;
      }},

      // TODO hoist dynamic tick rate into into anim.schedule
      // {every: () => this.rate, then: (dn) => {
      // }),

      (dt:number) => {
        this.update(dt);
        if (update) update(dt);
        return true;
      },
    ));
  }
}

// injected DOM parts
interface Bindings extends UIBindings {
  menu: HTMLElement,
  grid: HTMLElement,
  status: HTMLElement,
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
}
export const state:Partial<State> = {};

function onInsepcted({pos: {x, y}, tiles}:TileInspectEvent) {
  if (bound.inspectorAt) {
    bound.inspectorAt.innerText = `${isNaN(x) ? 'X' : Math.floor(x)},${isNaN(y) ? 'Y' : Math.floor(y)}`;
  }
  if (bound.inspector) {
    // TODO a <select> might be neat, but would need more than an ephemeral
    // "hold space" interaction mode
    const lines = tiles.map(t => {
      let line = `id=${t.id}`
      line += ` tag=[${Array.from(t.classList).filter(n => n !== 'tile').join(', ')}]`;
      return line;
    });
    bound.inspector.value = lines.join('\n');
    bound.inspector.rows = lines.length;
    bound.inspector.cols = lines.reduce((max, line) => Math.max(max, line.length), 0);
  }
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

    if (!state.world?.running) return false;
    return !ev.altKey && !ev.ctrlKey && !ev.metaKey;
  });

  bound.run?.addEventListener('click', playPause);
  bound.reset?.addEventListener('click', () => {
    if (state.world) state.world.running = false;
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
    data: DLA.settings,
    getInput: (name:string) => bound.menu?.querySelector(`input[name="${name}"]`) || null,
    getSelect: (name:string) => bound.menu?.querySelector(`select[name="${name}"]`) || null,
  });

  showUI(bound, false, false);
}

function playPause() {
  if (!state.grid) return;

  showUI(bound, true, !state.world?.running);

  if (!state.world) {
    state.world = new DLA(state.grid);
    if (bound.dropPlayer) bound.dropPlayer.disabled = false;
    if (bound.reset) bound.reset.disabled = false;
  }

  const {world, keys} = state;
  if (world.running) world.running = false;
  else world.run(
    () => keys?.consumePresses() || [],
    () => bound.status && render(html`
        <label for="particleID">Particles:</label>
        <span id="particleID">${world.particleID}</span>
      `, bound.status));
}
