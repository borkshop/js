import {html, render} from 'lit-html';
import {readHashVar, setHashVar} from './state';
import {TileGrid} from './tiles';
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

  static dropAfter = 0
  static rate      = 5
  static initBase  = 0
  static initArc   = 2.0
  static turnLeft  = 0.5
  static turnRight = 0.5
  static stepLimit = 50

  static clampMoves     = false
  static trackClampDebt = true

  static inputs:{[name: string]: HTMLInputElement} = {}

  static bindSettings(getInput:(name:string)=>HTMLInputElement|null) {
    DLA.bindSetting('dropAfter',     getInput('dropAfter'));
    DLA.bindSetting('initBase',      getInput('initBase'));
    DLA.bindSetting('initArc',       getInput('initArc'));
    DLA.bindSetting('turnLeft',      getInput('turnLeft'));
    DLA.bindSetting('turnRight',     getInput('turnRight'));
    DLA.bindSetting('rate',          getInput('rate'));
    DLA.bindSetting('stepLimit',     getInput('stepLimit'));
    DLA.bindToggle('clampMoves',     getInput('clampMoves'));
    DLA.bindToggle('trackClampDebt', getInput('trackClampDebt'));
  }

  static bindToggle(name:'clampMoves'|'trackClampDebt', input:HTMLInputElement|null) {
    if (input) DLA.inputs[name] = input;
    const update = (enabled:boolean):boolean => {
      setHashVar(name, enabled ? 'true' : 'false');
      DLA[name] = enabled;
      return enabled;
    };
    const value = update((readHashVar(name) || DLA[name].toString()).toLowerCase() === 'true');
    if (input) {
      input.checked = value;
      input.addEventListener('change', () => update(input.checked));
    }
  }

  static bindSetting(name:'dropAfter'|'initBase'|'initArc'|'turnLeft'|'turnRight'|'rate'|'stepLimit', input:HTMLInputElement|null) {
    if (input) DLA.inputs[name] = input;
    const update = (value:string|null):string|null => {
      const given = value !== null;
      if (!given) value = DLA[name].toString();
      setHashVar(name, value);
      if (given) DLA[name] = parseFloat(value || '');
      return value;
    };
    const value = update(readHashVar(name));
    if (input) {
      input.value = value || '';
      input.addEventListener('change', () => input.value = update(input.value) || '');
    }
  }

  particleID = 0

  grid: TileGrid

  constructor(grid:TileGrid) {
    this.grid = grid;
    this.grid.clear();
    this.grid.createTile(`particle-${++this.particleID}`, {
      tag: ['particle', 'init'],
      bg: 'var(--particle-bg)',
      fg: 'var(--particle-dead)',
      text: '.',
    });
    this.grid.centerViewOn({x: 0, y: 0});
  }

  elapsed = 0

  dropPlayer() {
    this.grid.createTile('at', {
      text: '@',
      tag: ['solid', 'mind', 'keyMove'],
      fg: 'var(--dla-player)',
      pos: {x: 0, y: 0},
    });
    // TODO ideally this would be an instanced setting
    if (DLA.inputs.rate) {
      DLA.inputs.rate.value = '100';
      DLA.inputs.rate.dispatchEvent(new InputEvent('change'));
    } else {
      DLA.rate = 100;
    }
  }

  update(dt:number): void {
    if (DLA.dropAfter && this.particleID > DLA.dropAfter && 
        !this.grid.queryTiles('keyMove').length) this.dropPlayer();

    this.elapsed += dt
    const n = Math.min(DLA.stepLimit, Math.floor(this.elapsed / DLA.rate));
    if (!n) return;
    this.elapsed -= n * DLA.rate;
    let ps = this.grid.queryTiles('particle', 'live');
    const spawn = () => {
      const heading = Math.PI * (DLA.initBase + (Math.random() - 0.5) * DLA.initArc);

      const p = this.grid.createTile(`particle-${++this.particleID}`, {
        tag: ['particle', 'live'],
        fg: 'var(--particle-live)',
        text: '*',
        data: {heading},
      });
      ps.push(p);
    };
    for (let i = 0; i < n; ++i) {
      ps = ps.filter(p => p.classList.contains('live'));
      if (!ps.length) {
        spawn();
        continue;
      }

      for (const p of ps) {
        let heading = this.grid.getTileData(p, 'heading');
        if (typeof heading !== 'number') heading = 0;

        const adj = Math.random() * (DLA.turnLeft + DLA.turnRight) - DLA.turnLeft;
        heading += Math.PI * adj;
        heading %= 2 * Math.PI;
        this.grid.setTileData(p, 'heading', heading);

        let dx = Math.cos(heading);
        let dy = Math.sin(heading);
        const pos = this.grid.getTilePosition(p);

        if (DLA.clampMoves) {
          if (DLA.trackClampDebt) {
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

          if (DLA.trackClampDebt)
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
            bg: 'var(--particle-bg)',
            fg: 'var(--particle-dead)',
            text: '.',
            pos,
            data: {},
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
          bg: 'var(--particle-bg)',
          fg: 'var(--dla-player)',
          text: '.',
          pos: targ,
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
    if (bound.menu?.style.display !== 'none') return false;
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

  DLA.bindSettings((name:string) => bound.menu?.querySelector(`input[name="${name}"]`) || null);
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
    () => bound.foot && render(html`
        <label for="particleID">Particles:</label>
        <span id="particleID">${world.particleID}</span>
      `, bound.foot));
}
