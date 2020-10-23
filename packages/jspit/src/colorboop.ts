import {TileGrid, processMoves} from './tiles';
import {KeyCtl, coalesceMoves} from './input';
import {everyFrame, schedule} from './anim';

function setup(grid:TileGrid) {
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
      style: {
        color: `var(--${color})`,
      },
    });
    grid.createTile(`bg-swatch-${color}`, {
      pos: {x: 15, y: i},
      text: '$',
      className: ['solid', 'swatch', 'bg'],
      style: {
        backgroundColor: `var(--${color})`,
      },
    });
  });
  grid.viewPoint = {x: 10, y: 10};

  if (bound.reset) bound.reset.disabled = false;
}

// injected DOM parts
interface Bindings {
  ui: HTMLElement,
  grid: HTMLElement,
  keys: HTMLElement
  run: HTMLButtonElement
  reset: HTMLButtonElement
}
export const bound:Partial<Bindings> = {};

// simulation / "game" state and dependencies
interface State {
  grid: TileGrid,
  keys: KeyCtl,
  running: boolean,
}
export const state:Partial<State> = {};

export function init(bind:Bindings) {
  Object.assign(bound, bind);

  if (bound.ui) {
    bound.ui.classList.toggle('showUI', true);
    bound.ui.classList.toggle('running', !!state.running);
  }

  if (bound.grid) {
    state.grid = new TileGrid(bound.grid);
    setup(state.grid);
  }

  if (bound.keys) {
    state.keys = new KeyCtl(bound.keys);
    state.keys.on.code['Escape'] = (ev:KeyboardEvent) => {
      if (ev.type === 'keydown') playPause();
    };
  }

  bound.run?.addEventListener('click', playPause);
  bound.reset?.addEventListener('click', () => {
    if (state.grid) setup(state.grid);
  });
}

function definedStyles(style:CSSStyleDeclaration) {
  return Object.fromEntries(Object.entries(style)
    .filter(([k, v]) => !!v && parseInt(k).toString() !== k));
}

function thenInput():boolean {
  const {keys, grid} = state;
  if (!grid || !keys) return false;

  let {have, move} = coalesceMoves(keys.consumePresses());
  if (have) for (const mover of grid.queryTiles({className: ['mover', 'input']}))
    grid.setTileData(mover, 'move', move);
  processMoves({grid, kinds: {
    // solid tiles collide, leading to interaction
    solid: ({grid, mover, at}) => {
      const hits = at.filter(h => h.classList.contains('solid'));
      if (hits.length) {
        for (const hit of hits) if (hit.classList.contains('swatch'))
          grid.updateTile(mover, {style: definedStyles(hit.style)});
        return false;
      }
      return true;
    },
  }});
  for (const mover of grid.queryTiles({className: ['mover', 'input']})) {
    const {x, y} = grid.getTilePosition(mover);
    const {x: vx, y: vy, w, h} = grid.viewport;
    if (x < vx || y < vy || x >= vx + w || y >= vy + h)
      grid.viewPoint = {x, y};
  }
  return true;
}

function playPause() {
  if (!state.grid) return;
  if (state.running) stop(); else run();
  if (bound.ui) bound.ui.classList.toggle('running', !!state.running);
}

function stop() {
  state.running = false;
  if (state.keys) state.keys.counting = false;
}

function run() {
  if (state.keys) state.keys.counting = true;
  state.running = true;
  everyFrame(schedule(
    () => !!state.running,
    {every: 100, then: thenInput},
  ));
}
