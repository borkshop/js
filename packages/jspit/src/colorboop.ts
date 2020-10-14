import {html, render} from 'lit-html';
import type {Point, TileSpec} from './tiles';
import type {Context, SimAction} from './sim';

export class ColorBoop {
  static demoName = 'ColorBoop'
  static demoTitle = 'Boop a color, get a color'

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

  #viewer?:HTMLElement|null

  inspect?(_ctx:Context, pos:Point, tiles:HTMLElement[]):void {
    if (this.#viewer) render(tiles.length
      ? html`@${pos.x},${pos.y} ${tiles.map(({id}) => id)}`
      : html`// mouse-over a tile to inspect it`,
      this.#viewer
    )
  }

  setup(ctx:Context) {
    this.#viewer = ctx.addCtl(html`// mouse-over a tile to inspect it`);

    ctx.showModal(html`
      <section>
        <h1 align="center">Welcome traveler</h1>
        <p>
          Boop a color, get a color!
        </p>
        <p>
          This is the first and simplest example of jspit's <code>TileGrid</code>.
        </p>
        <p>
          <button @click=${() => ctx.showModal(null)}>Ok!</button>
        </p>
      </section>
    `);

    ctx.grid.createTile('at', {
      text: '@',
      tag: ['solid', 'mind', 'keyMove'],
      pos: {x: 10, y: 10},
    });
    this.colors.forEach((color, i) => {
      ctx.grid.createTile(`fg-swatch-${color}`, {
        fg: `var(--${color})`,
        tag: ['solid', 'swatch', 'fg'],
        text: '$',
        pos: {x: 5, y: i},
      });
      ctx.grid.createTile(`bg-swatch-${color}`, {
        bg: `var(--${color})`,
        tag: ['solid', 'swatch', 'bg'],
        text: '$',
        pos: {x: 15, y: i},
      });
    });
      
    ctx.grid.centerViewOn({x: 10, y: 10});
  }

  act(ctx:Context, action:SimAction): SimAction {
    if (!action.actor.classList.contains('solid')) return action;
    const hits = ctx.grid.tilesAt(action.targ, 'solid');
    if (!(action.ok = !hits.length)) for (const hit of hits)
      if (hit.classList.contains('swatch')) {
        const spec : TileSpec = {};
        if      (hit.classList.contains('fg')) spec.fg = hit.style.color;
        else if (hit.classList.contains('bg')) spec.bg = hit.style.backgroundColor;
        ctx.grid.updateTile(action.actor, spec)
      }
    return action;
  }

  update(ctx:Context, _dt:number) {
    const {x, y} = ctx.grid.getTilePosition('at');
    const {x: w, y: h} = ctx.grid.tileSize;
    const {x: vx, y: vy, width: vw, height: vh} = ctx.grid.viewport;
    ctx.setStatus(html`player@${x},${y}+${w}+${h} view@${vx},${vy}+${Math.floor(vw)}+${Math.floor(vh)}`);
  }
}

