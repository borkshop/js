import 'core-js/stable';
import 'regenerator-runtime/runtime';
import {html, render, TemplateResult} from 'lit-html';

interface Point {
  x: number,
  y: number,
}

interface TileSpec {
  text?: string
  pos?: Point
  tag?: string|string[]
  fg?: string
  bg?: string
}

class TileGrid {
  el : HTMLElement

  constructor(el:HTMLElement) {
    this.el = el;
    // TODO handle resize events
  }

  get tileSize(): Point {
    // TODO use an invisible ghost tile? cache?
    for (const tile of this.el.querySelectorAll('.tile')) {
      const h = tile.clientHeight;
      return {x: h, y: h};
    }
    return {x: 0, y: 0};
  }

  tileID(id:string) {
    return `${this.el.id}${this.el.id ? '-': ''}tile-${id}`;
  }

  createTile(id: string, spec:TileSpec):HTMLElement {
    let tile = this.getTile(id);
    if (!tile) {
      tile = document.createElement('div');
      this.el.appendChild(tile)
      tile.id = this.tileID(id)
    }
    return this.updateTile(tile, spec) as HTMLElement;
  }

  updateTile(elOrID:HTMLElement|string, spec:TileSpec) {
    const tile = this.getTile(elOrID);
    if (!tile) return null;
    if (spec.text) tile.innerText = spec.text;
    if (spec.fg) tile.style.color = spec.fg;
    if (spec.bg) tile.style.backgroundColor = spec.bg;
    if (spec.tag) {
      tile.className = 'tile';
      if (typeof spec.tag === 'string') tile.classList.add(spec.tag);
      else if (Array.isArray(spec.tag)) for (const tag of spec.tag) tile.classList.add(tag);
    } else if (!tile.className) tile.className = 'tile';
    if (spec.pos) this.moveTileTo(tile, spec.pos);
    return tile;
  }

  getTile(elOrID:HTMLElement|string):HTMLElement|null {
    if (typeof elOrID === 'string') {
      return this.el.querySelector('#' + this.tileID(elOrID));
    }
    return elOrID;
  }

  queryTiles(selector?:string) {
    const res : HTMLElement[] = [];
    for (const el of this.el.querySelectorAll(`.tile${selector || ''}`))
      res.push(el as HTMLElement);
    return res;
  }

  clear() {
    while (this.el.firstChild) this.el.removeChild(this.el.firstChild);
  }

  getTilePosition(elOrID:HTMLElement|string) {
    const tile = this.getTile(elOrID);
    if (!tile) return {x: NaN, y: NaN};
    const x = parseFloat(tile.style.getPropertyValue('--x')) || 0;
    const y = parseFloat(tile.style.getPropertyValue('--y')) || 0;
    return {x, y};
  }

  moveTileTo(elOrID:HTMLElement|string, {x, y}:Point) {
    const tile = this.getTile(elOrID);
    if (!tile) return {x: NaN, y: NaN};
    tile.style.setProperty('--x', x.toString());
    tile.style.setProperty('--y', y.toString());
    return {x, y};
  }

  moveTileBy(elOrID:HTMLElement|string, {x: dx, y: dy}:Point) {
    const tile = this.getTile(elOrID);
    if (!tile) return {x: NaN, y: NaN};
    let {x, y} = this.getTilePosition(tile);
    x += dx, y += dy;
    return this.moveTileTo(tile, {x, y});
  }

  tilesAt(at:Point, selector?:string) {
    const res : HTMLElement[] = [];
    // TODO :shrug: spatial index
    for (const other of this.el.querySelectorAll(`.tile${selector || ''}`)) {
      const el = other as HTMLElement;
      const pos = this.getTilePosition(el);
      if (pos.x === at.x && pos.y === at.y) res.push(el);
    }
    return res
  }

  get viewOffset() {
    const x = parseFloat(this.el.style.getPropertyValue('--xlate-x')) || 0;
    const y = parseFloat(this.el.style.getPropertyValue('--xlate-y')) || 0;
    return {x, y};
  }

  get viewport() {
    const
      tileSize = this.tileSize,
      {x, y} = this.viewOffset,
      width = this.el.clientWidth  / tileSize.x,
      height = this.el.clientHeight / tileSize.y;
    return {x, y, width, height};
  }

  moveViewTo({x, y}:Point) {
    this.el.style.setProperty('--xlate-x', x.toString());
    this.el.style.setProperty('--xlate-y', y.toString());
    return {x, y};
  }

  moveViewBy({x: dx, y: dy}:Point) {
    const {x, y} = this.viewOffset;
    return this.moveViewTo({x: x + dx, y: y + dy});
  }

  nudgeViewTo({x, y}:Point, {x: nx, y: ny}:Point) {
    let {x: vx, y: vy, width, height} = this.viewport;
    while (true) {
      const dx = x < vx ? -1 : x > vx + width ? 1 : 0;
      const dy = y < vy ? -1 : y > vy + height ? 1 : 0;
      if      (dx < 0) vx -= nx;
      else if (dx > 0) vx += nx;
      else if (dy < 0) vy -= ny;
      else if (dy > 0) vy += ny;
      else             return this.moveViewTo({x: vx, y: vy});
    }
  }
}

const nextFrame = () => new Promise<number>(resolve => requestAnimationFrame(resolve));

const once = (target:EventTarget, name:string) => new Promise<Event>(resolve => {
  const handler = (event:Event) => {
    target.removeEventListener(name, handler);
    resolve(event);
  };
  target.addEventListener(name, handler);
});

class KeyMap extends Map<string, number> {
  countKey({altKey, ctrlKey, metaKey, shiftKey, key}:KeyboardEvent) {
    const name = `${
      altKey ? 'A-' : ''}${
      ctrlKey ? 'C-' : ''}${
      metaKey ? 'M-' : ''}${
      shiftKey ? 'S-' : ''}${
      key}`;
    const n = this.get(name) || 0;
    this.set(name, n+1);
  }

  enabled = true
  filter? : (keyEvent:KeyboardEvent) => boolean

  handleEvent(event:Event) {
    if (!this.enabled) return;
    if (event.type !== 'keyup' && event.type !== 'keydown') return;
    const keyEvent = event as KeyboardEvent;
    if (this.filter && !this.filter(keyEvent)) return;
    this.countKey(keyEvent);
    event.stopPropagation();
    event.preventDefault();
  }

  register(target:EventTarget) {
    const handler = this.handleEvent.bind(this);
    target.addEventListener('keydown', handler);
    target.addEventListener('keyup', handler);
  }

  consumePresses() {
    const presses :Array<[string, number]> = [];
    for (const [name, count] of Array.from(this.entries())) {
      const n = Math.floor(count / 2);
      if (n > 0) {
        const d = count % 2;
        if (d == 0) this.delete(name);
        else        this.set(name, 1);
        presses.push([name, n]);
      }
    }
    return presses;
  }
}

interface Move {
  x: number,
  y: number,
}

function parseMoveKey(key:string, _count:number): Move|null {
  switch (key) {
    // arrow keys + stay
    case 'ArrowUp':    return {x:  0, y: -1};
    case 'ArrowRight': return {x:  1, y:  0};
    case 'ArrowDown':  return {x:  0, y:  1};
    case 'ArrowLeft':  return {x: -1, y:  0};
    case '.':          return {x:  0, y:  0};
    default:           return null;
  }
}

function coalesceKeys(presses:Array<[string, number]>) {
  return presses
    .map(([key, count]) => parseMoveKey(key, count))
    .reduce((acc, move) => {
      if (move) {
        acc.move.x += move.x;
        acc.move.y += move.y;
        acc.have = true
      }
      return acc;
    }, {
      have: false,
      move: {x: 0, y: 0},
    });
}

interface SimAction {
  actor: HTMLElement,
  pos: Point,
  targ: Point,
  ok: boolean,
}

interface Context {
  showModal(tmpl:TemplateResult|null):void
  grid : TileGrid
}

interface Scenario {
  setup(ctx:Context): void
  status?(ctx:Context): string
  act?(ctx:Context, action:SimAction): SimAction
}

interface ScenarioCons {
  new(): Scenario
}

class Sim {
  scen : Scenario | null = null
  modal : HTMLElement
  grid : TileGrid
  keys : KeyMap
  foot? : HTMLElement
  cont? : HTMLElement

  constructor(
    modal : HTMLElement,
    view : HTMLElement,
    foot? : HTMLElement,
    cont? : HTMLElement,
  ) {
    this.modal = modal;
    this.grid = new TileGrid(view);
    this.keys = new KeyMap();
    this.foot = foot;
    this.cont = cont;
    this.keys.filter = this.filterKeys.bind(this);
    this.keys.register(this.cont || this.grid.el);
  }

  filterKeys(event:KeyboardEvent) {
    if (this.modal.style.display !== 'none') return false;
    return !event.altKey && !event.ctrlKey && !event.metaKey;
  }
 
  showModal(tmpl:TemplateResult|null) {
    render(tmpl, this.modal);
    this.modal.style.display = tmpl ? '' : 'none';
  }

  change(scen:Scenario|null) {
    this.grid.clear();
    this.scen = scen;
    if (this.scen) this.scen.setup(this);
    this.updateFooter();
  }

  updateFooter() {
    if (this.foot) this.foot.innerText =
      (this.scen && this.scen.status && this.foot)
      ? this.scen.status(this) : '';
  }

  inputRate = 100 // rate at which to coalesce and process movement input
  nudgeBy = 0.2   // proportion to scroll viewport by when at goes outside

  lastInput = 0
  update(dt:number):void {
    if ((this.lastInput += dt / this.inputRate) >= 1) {
      this.consumeInput();
      this.lastInput = this.lastInput % 1;
    }
  }

  consumeInput() {
    const presses = this.keys.consumePresses();
    if (!this.scen) return;

    const movers = this.grid.queryTiles('.keyMove');
    if (!movers.length) return;
    if (movers.length > 1) throw new Error(`ambiguous ${movers.length}-mover situation`);
    const actor = movers[0];

    let {have, move} = coalesceKeys(presses);
    if (!have) return;

    const pos = this.grid.getTilePosition(actor);
    const targ = {x: pos.x + move.x, y: pos.y + move.y};
    let action = {actor, pos, targ, ok: true};

    if (this.scen.act) action = this.scen.act(this, action);

    if (action.ok) {
      this.grid.moveTileTo(action.actor, action.targ);
      const {width, height} = this.grid.viewport;
      const nudge = {x: Math.floor(width * this.nudgeBy), y: Math.floor(height * this.nudgeBy)};
      this.grid.nudgeViewTo(action.targ, nudge);
    }

    this.updateFooter();
  }
}

class Hello {
  setup(ctx:Context) {
    ctx.showModal(html`
      <section>
        <p>
          Welcome to the Pits of JavaScript, where we experiment our way towards
          a "game", spinning demos and other pieces of interest as the spirit
          moves...
        </p>

        <p>
          To get started, just pick a demo from the header dropdown.
        </p>
      </section>

      <section align="center">
        <a href="//github.com/jcorbin/jspit">Github</a>
        |
        <a href="//github.com/jcorbin/jspit/blob/main/stream.md">Dev log</a>
      </section>
    `);
  }
}

class ColorBoop {
  setup(ctx:Context) {
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
    [ 'black',
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
    ].forEach((color, i) => {
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
    })
  }

  act(ctx:Context, action:SimAction): SimAction {
    if (!action.actor.classList.contains('solid')) return action;
    const hits = ctx.grid.tilesAt(action.targ, '.solid');
    if (!(action.ok = !hits.length)) for (const hit of hits)
      if (hit.classList.contains('swatch')) {
        const spec : TileSpec = {};
        if      (hit.classList.contains('fg')) spec.fg = hit.style.color;
        else if (hit.classList.contains('bg')) spec.bg = hit.style.backgroundColor;
        ctx.grid.updateTile(action.actor, spec)
      }
    return action;
  }

  status(ctx:Context) {
    const {x, y} = ctx.grid.getTilePosition('at');
    const {x: w, y: h} = ctx.grid.tileSize;
    const {x: vx, y: vy, width: vw, height: vh} = ctx.grid.viewport;
    return `player@${x},${y}+${w}+${h} view@${vx},${vy}+${Math.floor(vw)}+${Math.floor(vh)}`;
  }
}

const demos:ScenarioCons[] = [
  Hello,
  ColorBoop,
];

function setupDemoSelector(sel:HTMLSelectElement, change:(scen:Scenario|null)=>void) {
  for (const demo of demos) {
    const opt = document.createElement('option');
    opt.value = demo.name;
    opt.innerText = demo.name; // TODO description?
    sel.appendChild(opt);
  }
  const changed = () => {
    let demo = null;
    for (const d of demos) if (d.name === sel.value) {
      demo = new d();
      break;
    }
    if (!demo) sel.value = 'hello';
    change(demo || new Hello());
    sel.blur();
  };
  sel.addEventListener('change', changed);
  changed();
}

async function main() {
  await once(window, 'DOMContentLoaded');

  const main = document.querySelector('main');
  if (!main) throw new Error('no <main> element');

  const modal = main.querySelector('.modal');
  if (!modal) throw new Error('no <main> .modal')

  const demoSel = document.querySelector('select#demo');
  if (!demoSel) throw new Error('no <select#demo> element');

  const mainGrid = main.querySelector('.grid');
  if (!mainGrid) throw new Error('no <main> .grid element');

  const foot = document.querySelector('footer');
  if (!foot) throw new Error('no <footer> element');

  const sim = new Sim(
    modal as HTMLElement,
    mainGrid as HTMLElement,
    foot,
    document.body,
  );

  setupDemoSelector(demoSel as HTMLSelectElement, sim.change.bind(sim));

  let last = await nextFrame();

  let dt = 0;
  while (true) {
    sim.update(dt);
    const next = await nextFrame();
    dt = next - last, last = next;
  }
}
main();

// vim:set ts=2 sw=2 expandtab:
