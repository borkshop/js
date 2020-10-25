import {
  Point, TileGrid,
  TileInspector, dumpTiles,
  moveTiles, TileMoverProc,
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

export class DOMgeon extends EventTarget {
  grid: TileGrid
  ui: HTMLElement
  keys: KeyCtl

  inputRate: number
  running: boolean = false

  moveProcs: {[kind: string]: TileMoverProc} = {
    solid: ({at}):boolean => {
      // can only move there if have particle support
      if (!at.some(h => h.classList.contains('floor'))) return false;

      // may not move there if occupied by another solid
      if (at.some(h => h.classList.contains('solid'))) return false;

      return true;
    },
  }

  constructor(params: HTMLElement|Partial<{
    grid: HTMLElement
    ui: HTMLElement
    keys: HTMLElement
    inputRate: number
  }>) {
    super();
    if (params instanceof HTMLElement) params = {grid: params};
    if (!params.grid) throw new Error('must provide a DOMgeon grid element');

    const {
      // element bindings
      grid,

      // TODO should the default be more like ownerDocument.body?
      keys = grid,

      // TODO this should be wholly optional or dropped entirely now that we
      // provide start/stop events
      ui = grid,

      // config
      inputRate = 100,
    } = params;
    this.ui = ui;
    this.inputRate = inputRate;

    this.grid = new TileGrid(grid);
    this.grid.viewPoint = centroid(this.grid.queryTiles({className: ['mover', 'input']})
      .map(input => this.grid.getTilePosition(input)));

    this.keys = new KeyCtl(keys);
    this.keys.on.code['Escape'] = (ev:KeyboardEvent) => {
      if (ev.type !== 'keyup') return;
      if (this.running) this.stop(); else this.start();
    };

    this.ui.classList.toggle('showUI', true);
  }

  stop() {
    this.running = false;
  }

  async start() {
    this.running = true;
    this.ui.classList.toggle('running', true);
    this.keys.counting = true;
    this.dispatchEvent(new Event('start'));
    await everyFrame(schedule(
      () => !!this.running,
      {every: this.inputRate, then: () => { this.processInput(); return true }},
      // TODO other updates for things like particle system
    ));
    this.dispatchEvent(new Event('stop'));
    this.keys.counting = false;
    this.ui.classList.toggle('running', false);
  }

  processInput() {
    let {have, move} = coalesceMoves(this.keys.consume());
    if (have) for (const mover of this.grid.queryTiles({className: ['mover', 'input']})) {
      this.grid.setTileData(mover, 'move', move);
    }

    moveTiles({grid: this.grid, kinds: this.moveProcs});

    // ensure viewport centered on player input(s)
    const c = centroid(this.grid.queryTiles({className: ['mover', 'input']})
      .map(input => this.grid.getTilePosition(input)));
    const {x: vx, y: vy, w, h} = this.grid.viewport;
    if (c.x <= vx || c.y <= vy || c.x+1 >= vx + w || c.y+1 >= vy + h)
      this.grid.viewPoint = c;
  }
}

export class DOMgeonInspector extends TileInspector {
  el: HTMLElement
  dmg: DOMgeon

  constructor(dmg: DOMgeon, el: HTMLElement) {
    const txt = el.querySelector('textarea');
    const at = el.querySelector('[data-for="pos"]') as HTMLElement|null;
    super(dmg.grid, ({pos: {x, y}, tiles}) => {
      if (at) at.innerText = `${isNaN(x) ? 'X' : Math.floor(x)},${isNaN(y) ? 'Y' : Math.floor(y)}`;
      if (txt) dumpTiles({tiles, into: txt});
    });

    this.el = el;
    this.dmg = dmg;
    this.dmg.addEventListener('stop', () => this.dmg.grid.el.classList.toggle('inspectable', true));
    this.dmg.addEventListener('start', () => this.dmg.grid.el.classList.toggle('inspectable', false));
    this.dmg.grid.el.classList.toggle('inspectable', !this.dmg.running);
  }
}
