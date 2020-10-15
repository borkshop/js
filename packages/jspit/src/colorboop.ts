import type {Point, TileSpec, TileGrid} from './tiles';
import {coalesceMoves} from './input';
import {everyFrame, schedule} from './anim';

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
    let action = {actor, pos, targ, ok: true};

    // solid tiles collide
    if (action.actor.classList.contains('solid')) {
      const hits = this.grid.tilesAt(action.targ, 'solid');
      if (!(action.ok = !hits.length)) for (const hit of hits)
        if (hit.classList.contains('swatch')) {
          const spec : TileSpec = {};
          if      (hit.classList.contains('fg')) spec.fg = hit.style.color;
          else if (hit.classList.contains('bg')) spec.bg = hit.style.backgroundColor;
          this.grid.updateTile(action.actor, spec)
        }
      if (!action.ok) return false;
    }

    this.grid.moveTileTo(action.actor, action.targ);
    this.grid.nudgeViewTo(action.targ, ColorBoop.nudgeBy);
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

// TODO move into tiles module?

export interface TileInspectEvent {
  pos:Point
  tiles:HTMLElement[]
}

export class TileInspector {
  grid: TileGrid
  handler: (ev:TileInspectEvent)=>void

  constructor(
    grid:TileGrid,
    handler:(ev:TileInspectEvent)=>void,
  ) {
    this.grid = grid;
    this.handler = handler;
    this.grid.el.addEventListener('mousemove', this.mouseMoved.bind(this));
  }

  #inspectingIDs:string = ''

  mouseMoved(ev:MouseEvent) {
    const tiles = this.grid.tilesAtPoint(ev.clientX, ev.clientY);
    const ids = tiles.map(({id}) => id).join(';');
    if (this.#inspectingIDs === ids) return;
    this.#inspectingIDs = ids;
    const pos = this.grid.getTilePosition(tiles[0]);
    this.handler({pos, tiles});
  }
}
