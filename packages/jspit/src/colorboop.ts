import {TileGrid, TileSpec, processMoves} from './tiles';
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
      tag: ['solid', 'mover', 'input'],
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
}

// injected DOM parts
interface Bindings extends UIBindings {
  grid: HTMLElement,
  keys: HTMLElement
  run: HTMLButtonElement
  reset: HTMLButtonElement
}
export const bound:Partial<Bindings> = {};

// simulation / "game" state and dependencies
interface State {
  grid: TileGrid,
  keys: KeyMap,
  world: ColorBoop,
  running: boolean,
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

  showUI(bound, false, false);
}

function thenInput():boolean {
  const {keys, grid} = state;
  if (!grid || !keys) return false;

  let {have, move} = coalesceMoves(keys.consumePresses());
  if (have) for (const mover of grid.queryTiles({tag: ['mover', 'input']}))
    grid.setTileData(mover, 'move', move);
  processMoves(grid, 'mover', {
    // solid tiles collide, leading to interaction
    solid: (grid: TileGrid, mover: HTMLElement, at: HTMLElement[]) => {
      const hits = at.filter(h => h.classList.contains('solid'));
      if (hits.length) {
        for (const hit of hits) if (hit.classList.contains('swatch')) {
          const spec : TileSpec = {};
          if      (hit.classList.contains('fg')) spec.fg = hit.style.color;
          else if (hit.classList.contains('bg')) spec.bg = hit.style.backgroundColor;
          grid.updateTile(mover, spec);
        }
        return false;
      }
      return true;
    },
  });
  for (const mover of grid.queryTiles({tag: ['mover', 'input']}))
    grid.nudgeViewTo(grid.getTilePosition(mover), ColorBoop.nudgeBy);
  return true;
}

function playPause() {
  if (!state.grid) return;

  showUI(bound, true, !state.running);

  if (!state.world) {
    state.world = new ColorBoop(state.grid);
    if (bound.reset) bound.reset.disabled = false;
  }

  if (state.running) state.running = false; else {
    state.running = true;
    everyFrame(schedule(
      () => !!state.running,
      {every: ColorBoop.inputRate, then: thenInput},
    ));
  }
}
