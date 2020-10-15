import {TileGrid, TileInspector, TileSpec} from './tiles';
import {KeyMap, coalesceMoves} from './input';
import {everyFrame, schedule} from './anim';
import {show as showUI, Bindings as UIBindings} from './ui';

export class ColorBoop {
  static demoName = 'ColorBoop'
  static demoTitle = 'Boop a color, get a color'

  // rate at which to coalesce and process movement input
  static inputRate = 100

  // proportion to scroll viewport by when at goes outside
  static nudgeBy = 0.2

  colors = [
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
  ]

  grid : TileGrid

  constructor(grid:TileGrid) {
    this.grid = grid;
    this.grid.clear();
    this.grid.createTile('at', {
      text: '@',
      tag: ['solid', 'mind', 'keyMove'],
      pos: {x: 10, y: 10},
    });
    this.colors.forEach((color, i) => {
      this.grid.createTile(`fg-swatch-${color}`, {
        fg: `var(--${color})`,
        tag: ['solid', 'swatch', 'fg'],
        text: '$',
        pos: {x: 5, y: i},
      });
      this.grid.createTile(`bg-swatch-${color}`, {
        bg: `var(--${color})`,
        tag: ['solid', 'swatch', 'bg'],
        text: '$',
        pos: {x: 15, y: i},
      });
    });
    this.grid.centerViewOn({x: 10, y: 10});
  }

  consumeInput(presses: Array<[string, number]>):boolean {
    const movers = this.grid.queryTiles('keyMove');
    if (!movers.length) return false;
    if (movers.length > 1) throw new Error(`ambiguous ${movers.length}-mover situation`);
    const actor = movers[0];

    let {have, move} = coalesceMoves(presses);
    if (!have) return false;

    const pos = this.grid.getTilePosition(actor);
    const targ = {x: pos.x + move.x, y: pos.y + move.y};

    // solid tiles collide
    if (actor.classList.contains('solid')) {
      const hits = this.grid.tilesAt(targ, 'solid');
      if (hits.length) {
        for (const hit of hits) if (hit.classList.contains('swatch')) {
          const spec : TileSpec = {};
          if      (hit.classList.contains('fg')) spec.fg = hit.style.color;
          else if (hit.classList.contains('bg')) spec.bg = hit.style.backgroundColor;
          this.grid.updateTile(actor, spec)
        }
        return true;
      }
    }

    this.grid.moveTileTo(actor, targ);
    this.grid.nudgeViewTo(targ, ColorBoop.nudgeBy);
    return true;
  }

  running = false

  run(
    readKeys:() => Array<[string, number]>,
    updated:(grid:TileGrid)=>void,
  ) {
    if (this.running) return;
    this.running = true;
    everyFrame(schedule(
      () => this.running,
      {every: ColorBoop.inputRate, then: () => {
        if (this.consumeInput(readKeys())) updated(this.grid);
        return true;
      },
    }));
  }
}

// injected DOM parts
interface Bindings extends UIBindings {
  keys: HTMLElement
  run: HTMLButtonElement
  reset: HTMLButtonElement
  inspect: HTMLElement
}
export const bound:Partial<Bindings> = {};

// simulation / "game" state and dependencies
interface State {
  grid: TileGrid,
  keys: KeyMap,
  world: ColorBoop,
}
export const state:Partial<State> = {};

import {html, render} from 'lit-html';

export function init(bind:Bindings) {
  Object.assign(bound, bind);

  if (bound.grid) {
    state.grid = new TileGrid(bound.grid);
    new TileInspector(state.grid, ({pos, tiles}) => {
      if (bound.inspect) render(tiles.length
        ? html`@${pos.x},${pos.y} ${tiles.map(({id}) => id)}`
        : html`// mouse-over a tile to inspect it`,
        bound.inspect)
    });
  }

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
}

function playPause() {
  if (!state.grid) return;

  showUI(bound, true, !state.world?.running);

  if (!state.world) {
    state.world = new ColorBoop(state.grid);
    if (bound.reset) bound.reset.disabled = false;
  }

  const {world, grid, keys} = state;
  if (world.running) world.running = false;
  else world.run(
    () => keys?.consumePresses() || [],
    () => {
      if (!grid || !bound.foot) return;
      const {x, y} = grid.getTilePosition('at');
      const {x: w, y: h} = grid.tileSize;
      const {x: vx, y: vy, width: vw, height: vh} = grid.viewport;
      render(html`
        player@${x},${y}+${w}+${h} view@${vx},${vy}+${Math.floor(vw)}+${Math.floor(vh)}
      `, bound.foot);
    });
}
