import {html, render} from 'lit-html';
import {bindVars} from './config';
import {Point, TileGrid} from './tiles';
import {KeyMap, coalesceMoves} from './input';
import {everyFrame, schedule} from './anim';
import {show as showUI, Bindings as UIBindings} from './ui';

export class DLA {
  static demoName = 'DLA'
  static demoTitle = 'Diffusion Limited Aggregation'

  // rate at which to coalesce and process movement input
  static inputRate = 100

  // proportion to scroll viewport by when at goes outside
  static nudgeBy = 0.2

  static settings = {
    dropAfter: 0,

    genRate:   1,
    playRate:  100,

    seeds: [
      {x: 0, y: 0},
    ],

    initBase: 0,
    initArc:  2.0,

    turnLeft:  0.5,
    turnRight: 0.5,

    stepLimit: 50,

    clampMoves:     false,
    trackClampDebt: true,
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
    const {seeds} = DLA.settings;
    return seeds[0];
  }

  spawn() {
    const {initBase, initArc} = DLA.settings;
    const pos = this.initPlace();
    const heading = Math.PI * (initBase + (Math.random() - 0.5) * initArc);
    return this.grid.createTile(`particle-${++this.particleID}`, {
      tag: ['particle', 'live'],
      pos,
      text: '*',
      data: {heading},
    });
  }

  update(dt:number): void {
    const {
      dropAfter,
      genRate, playRate,
      stepLimit,
      turnLeft, turnRight,
      clampMoves, trackClampDebt,
    } = DLA.settings;

    const havePlayer = !!this.grid.queryTiles('keyMove').length;

    if (dropAfter && this.particleID > dropAfter && !havePlayer) this.dropPlayer();

    const rate = havePlayer ? playRate : genRate;
    this.elapsed += dt
    const n = Math.min(stepLimit, Math.floor(this.elapsed / rate));
    if (!n) return;
    this.elapsed -= n * rate;
    let ps = this.grid.queryTiles('particle', 'live');

    for (let i = 0; i < n; ++i) {
      ps = ps.filter(p => p.classList.contains('live'));
      if (!ps.length) {
        ps.push(this.spawn());
        continue;
      }

      for (const p of ps) {
        let heading = this.grid.getTileData(p, 'heading');
        if (typeof heading !== 'number') heading = 0;

        const adj = Math.random() * (turnLeft + turnRight) - turnLeft;
        heading += Math.PI * adj;
        heading %= 2 * Math.PI;
        this.grid.setTileData(p, 'heading', heading);

        let dx = Math.cos(heading);
        let dy = Math.sin(heading);
        const pos = this.grid.getTilePosition(p);

        if (clampMoves) {
          if (trackClampDebt) {
            const prior = this.grid.getTileData(p, 'prior');
            if (prior !== null && typeof prior === 'object' && !Array.isArray(prior)) {
              if (typeof prior.x === 'number') dx += prior.x;
              if (typeof prior.y === 'number') dy += prior.y;
            }
          }

          if (Math.abs(dy) > Math.abs(dx)) {
            if (dy < 0) pos.y++, dy++;
            else        pos.y--, dy--;
          } else {
            if (dx < 0) pos.x++, dx++;
            else        pos.x--, dx--;
          }

          if (trackClampDebt)
            this.grid.setTileData(p, 'prior', {x: dx, y: dy});
        } else {
          // particles move smoothly, taking fractional positions
          pos.x += dx;
          pos.y += dy;
        }

        if (!this.grid.tilesAt(pos, 'particle').length) {
          pos.x = Math.floor(pos.x);
          pos.y = Math.floor(pos.y);
          this.grid.updateTile(p, {
            tag: ['particle'],
            pos,
            text: '·',
          });
        } else {
          this.grid.moveTileTo(p, pos);
          if (!this.grid.queryTiles('keyMove').length) this.grid.nudgeViewTo(pos, 0.2);
        }
      }
    }
  }

  digSeq = new Map<string, number>()

  consumeInput(presses: Array<[string, number]>):void {
    const movers = this.grid.queryTiles('keyMove');
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
        // place particles in the void
        const aid = actor.id;
        const did = (this.digSeq.get(aid) || 0) + 1;
        this.digSeq.set(aid, did);
        this.grid.createTile(`particle-placed-${aid}-${did}`, {
          tag: ['particle'],
          pos: targ,
          fg: 'var(--dla-player)',
          text: '·',
        });
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
}
export const bound:Partial<Bindings> = {};

// simulation / "game" state and dependencies
interface State {
  grid: TileGrid,
  keys: KeyMap,
  world: DLA,
}
export const state:Partial<State> = {};

export function init(bind:Bindings) {
  Object.assign(bound, bind);

  if (bound.grid) state.grid = new TileGrid(bound.grid);
  if (bound.keys) state.keys = new KeyMap(bound.keys, (ev:KeyboardEvent):boolean => {
    if (ev.key === 'Escape') {
      if (ev.type === 'keydown') playPause();
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
