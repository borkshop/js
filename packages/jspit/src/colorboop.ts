import {TileGrid, TileSpec, processMoves} from './tiles';
import {KeyMap, coalesceMoves} from './input';
import {everyFrame, schedule} from './anim';
import {show as showUI, Bindings as UIBindings} from './ui';

function setup(grid:TileGrid) {
  showUI(bound, true, !!state.running);

  grid.clear();
  grid.createTile('at', {
    text: '@',
    className: ['solid', 'mover', 'input'],
    pos: {x: 10, y: 10},
  });

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
  colors.forEach((color, i) => {
    grid.createTile(`fg-swatch-${color}`, {
      pos: {x: 5, y: i},
      text: '$',
      className: ['solid', 'swatch', 'fg'],
      fg: `var(--${color})`,
    });
    grid.createTile(`bg-swatch-${color}`, {
      pos: {x: 15, y: i},
      text: '$',
      className: ['solid', 'swatch', 'bg'],
      bg: `var(--${color})`,
    });
  });
  grid.centerViewOn({x: 10, y: 10});

  if (bound.reset) bound.reset.disabled = false;
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
  running: boolean,
}
export const state:Partial<State> = {};

export function init(bind:Bindings) {
  Object.assign(bound, bind);

  if (bound.grid) {
    state.grid = new TileGrid(bound.grid);
    setup(state.grid);
  }

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
    if (state.grid) setup(state.grid);
  });
}

function thenInput():boolean {
  const {keys, grid} = state;
  if (!grid || !keys) return false;

  let {have, move} = coalesceMoves(keys.consumePresses());
  if (have) for (const mover of grid.queryTiles({className: ['mover', 'input']}))
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
  for (const mover of grid.queryTiles({className: ['mover', 'input']}))
    grid.nudgeViewTo(grid.getTilePosition(mover), 0.2);
  return true;
}

function playPause() {
  if (!state.grid) return;

  if (state.running) state.running = false; else {
    state.running = true;
    everyFrame(schedule(
      () => !!state.running,
      {every: 100, then: thenInput},
    ));
  }

  showUI(bound, true, !!state.running);
}
