import {
  Point, TileGrid,
  TileInspector, dumpTiles,
  processMoves,
} from './tiles';
import {KeyCtl, coalesceMoves} from './input';
import {everyFrame, schedule} from './anim';

function centroid(ps: Point[]):Point {
  switch (ps.length) {
    case 0: return {x: NaN, y: NaN};
    case 1: return ps[0];
  }
  return ps.slice(1).reduce(({x, y}, p) => {
    x += p.x, y += p.y;
    x /= 2, y /= 2;
    return {x, y};
  }, ps[0]);
}

// injected DOM parts
interface Bindings {
  ui: HTMLElement,
  grid: HTMLElement,
  keys: HTMLElement,
  inspector: HTMLElement,
}
export const bound:Partial<Bindings> = {};

// simulation / "game" state and dependencies
interface State {
  grid: TileGrid,
  inspector: TileInspector,
  keys: KeyCtl,
  running: boolean
}
export const state:Partial<State> = {};

const keyCodeMap = {
  'Escape': (ev:KeyboardEvent) => {
    if (ev.type === 'keydown') {
      if (state.running) stop(); else run();
    }
  },
};

function processInput(keys:KeyCtl, grid:TileGrid) {
  let {have, move} = coalesceMoves(keys.consumePresses());
  if (have) for (const mover of grid.queryTiles({className: ['mover', 'input']})) {
    grid.setTileData(mover, 'move', move);
  }

  processMoves({grid, kinds: {
    solid: ({at}):boolean => {
      // can only move there if have particle support
      if (!at.some(h => h.classList.contains('floor'))) return false;

      // may not move there if occupied by another solid
      if (at.some(h => h.classList.contains('solid'))) return false;

      return true;
    },
  }});

  // ensure viewport centered on player input(s)
  const c = centroid(grid.queryTiles({className: ['mover', 'input']})
    .map(input => grid.getTilePosition(input)));
  const {x: vx, y: vy, w, h} = grid.viewport;
  if (c.x <= vx || c.y <= vy || c.x+1 >= vx + w || c.y+1 >= vy + h)
    grid.viewPoint = c;
}

export function init(bind:Bindings) {
  Object.assign(bound, bind);

  if (bound.keys) {
    state.keys = new KeyCtl(bound.keys);
    Object.assign(state.keys.on.code, keyCodeMap);
  }

  if (bound.grid) {
    const grid = state.grid = new TileGrid(bound.grid);

    if (bound.inspector) {
      const txt = bound.inspector.querySelector('textarea');
      const at = bound.inspector.querySelector('[data-for="pos"]') as HTMLElement|null;
      state.inspector = new TileInspector(grid, ({pos: {x, y}, tiles}) => {
        if (at) at.innerText = `${isNaN(x) ? 'X' : Math.floor(x)},${isNaN(y) ? 'Y' : Math.floor(y)}`;
        if (txt) dumpTiles({tiles, into: txt});
      });
    }

    grid.viewPoint = centroid(grid.queryTiles({className: ['mover', 'input']})
      .map(input => grid.getTilePosition(input)));
  }

  if (bound.ui) bound.ui.classList.toggle('showUI', true);

  stop();
}

function stop() {
  if (state.keys) state.keys.counting = false;
  state.running = false;
  if (bound.ui) bound.ui.classList.toggle('running', false);
  if (state.grid) state.grid.el.classList.toggle('inspectable', true);
}

function run() {
  const {keys, grid} = state;
  if (!keys || !grid) return;

  state.running = true;
  keys.counting = true;
  if (bound.ui) bound.ui.classList.toggle('running', true);
  if (state.grid) state.grid.el.classList.toggle('inspectable', false);

  everyFrame(schedule(
    () => !!state.running,
    {every: 100, then: () => { processInput(keys, grid); return true }},
    // TODO other updates for things like particle system
  ));
}
