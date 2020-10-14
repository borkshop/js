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

// mortonSpread inserts a 0 bit after each of 26 the low bits of x, masking
// away any higher bits; this is the best we can do in JavaScript since integer
// precision maxes out at 53 bits.
function mortonSpread1(x:number):number {
  x =  x             & 0x00000002ffffff; // x = ---- ----  ---- ----  ---- ----  ---- --98  7654 3210  fedc ba98  7654 3210
  x = (x ^ (x << 8)) & 0x0200ff00ff00ff; // x = ---- --98  ---- ----  7654 3210  ---- ----  fedc ba98  ---- ----  7654 3210
  x = (x ^ (x << 4)) & 0x020f0f0f0f0f0f; // x = ---- ----  ---- 7654  ---- 3210  ---- fedc  ---- ba98  ---- 7654  ---- 3210
  x = (x ^ (x << 2)) & 0x02333333333333; // x = ---- --98  --76 --54  --32 --10  --fe --dc  --ba --98  --76 --54  --32 --10
  x = (x ^ (x << 1)) & 0x05555555555555; // x = ---- -9-8  -6-6 -5-4  -3-2 -1-0  -f-e -d-c  -b-a -9-8  -7-6 -5-4  -3-2 -1-0
  return x;
}

// mortonKey returns the Z-order curve index for a Point, aka its "Morton code"
// https://en.wikipedia.org/wiki/Z-order_curve
function mortonKey({x, y}:Point):number {
  return mortonSpread1(x) | mortonSpread1(y)<<1;
}

interface TileSpatialIndex {
  update(ids:string[], pos:Point[]):void
  tilesAt(at:Point):Set<string>|undefined
  // TODO range query
}

class TileMortonIndex {
  #fore = new Map<number, Set<string>>();
  #back = new Map<string, number>();

  update(ids:string[], pos:Point[]) {
    for (const [i, id] of ids.entries()) {
      const pt = pos[i];
      const key = mortonKey(pt);
      const prior = this.#back.get(id);
      if (prior !== undefined) this.#fore.get(prior)?.delete(id);
      const at = this.#fore.get(key);
      if (at) at.add(id);
      else this.#fore.set(key, new Set([id]));
      this.#back.set(id, key);
    }
  }

  tilesAt(at:Point) {
    return this.#fore.get(mortonKey(at));
  }
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
      const x = tile.clientWidth;
      const y = tile.clientHeight;
      return {x, y};
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

  queryTiles(...tag:string[]) {
    const res : HTMLElement[] = [];
    for (const el of this.el.querySelectorAll(`.tile${tag.map(t => `.${t}`).join('')}`))
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

  moveTileTo(elOrID:HTMLElement|string, pt:Point):Point {
    const tile = this.getTile(elOrID);
    if (!tile) return {x: NaN, y: NaN};
    tile.style.setProperty('--x', pt.x.toString());
    tile.style.setProperty('--y', pt.y.toString());
    // TODO decouple/batch these with a mutation observer?
    this.spatialIndex.update([tile.id], [pt]);
    return pt;
  }

  moveTileBy(elOrID:HTMLElement|string, {x: dx, y: dy}:Point) {
    const tile = this.getTile(elOrID);
    if (!tile) return {x: NaN, y: NaN};
    let {x, y} = this.getTilePosition(tile);
    x += dx, y += dy;
    return this.moveTileTo(tile, {x, y});
  }

  spatialIndex:TileSpatialIndex = new TileMortonIndex()

  tilesAt(at:Point, ...tag:string[]):HTMLElement[] {
    let tiles : HTMLElement[] = [];
    const ids = this.spatialIndex.tilesAt(at);
    if (!ids) return tiles;
    for (const id of ids) {
      const el = this.el.querySelector(`#${id}`);
      if (el) tiles.push(el as HTMLElement);
    }
    if (tag.length) tiles = tiles
      .filter(el => tag.every(t => el.classList.contains(t)));
    return tiles;
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
    x = Math.floor(x);
    y = Math.floor(y);
    this.el.style.setProperty('--xlate-x', x.toString());
    this.el.style.setProperty('--xlate-y', y.toString());
    return {x, y};
  }

  moveViewBy({x: dx, y: dy}:Point) {
    const {x, y} = this.viewOffset;
    return this.moveViewTo({x: x + dx, y: y + dy});
  }

  centerViewOn({x, y}:Point) {
    const {width, height} = this.viewport;
    x -= width / 2, y -= height / 2;
    return this.moveViewTo({x, y});
  }

  nudgeViewTo({x, y}:Point, nudge:Point|number) {
    let {x: vx, y: vy, width, height} = this.viewport;
    let nx = width, ny = height;
    if (typeof nudge === 'number') nx *= nudge,   ny *= nudge;
    else                           nx  = nudge.x, ny  = nudge.y;
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
  addCtl(tmpl:TemplateResult|null):HTMLElement
  showModal(tmpl:TemplateResult|null):void
  setStatus(tmpl:TemplateResult|null):void
  grid : TileGrid
  reboot():void
}

interface Scenario {
  setup(ctx:Context): void
  update?(ctx:Context, dt:number): void
  act?(ctx:Context, action:SimAction): SimAction
  inspect?(ctx:Context, pos:Point, tiles:HTMLElement[]):void
  showMenu?(ctx:Context):void
}

interface ScenarioCons {
  demoName : string
  demoTitle : string

  new(): Scenario
}

function make(tagName:string, className?:string):HTMLElement {
  const el = document.createElement(tagName);
  if (className) el.className = className;
  return el;
}

type Nullable<T> = { [P in keyof T]: T[P] | null };

class Sim {
  modal : HTMLElement
  grid : TileGrid
  keys : KeyMap
  head : HTMLElement
  foot : HTMLElement

  cons : ScenarioCons
  scen : Scenario

  constructor(
    cons : ScenarioCons,
    el : HTMLElement,
    options?:Partial<Nullable<{
      modal : HTMLElement,
      grid : HTMLElement,
      head : HTMLElement,
      foot : HTMLElement,
      keysOn : HTMLElement,
    }>>
  ) {
    this.head = options?.head
      || el.querySelector('header')
      || el.appendChild(make('header'));
    this.modal = options?.modal
      || el.querySelector('.modal')
      || el.appendChild(make('aside', 'modal'));
    this.grid = new TileGrid(options?.grid
      || el.querySelector('.grid')
      || el.appendChild(make('div', 'grid')));
    this.foot = options?.foot
      || el.querySelector('footer')
      || el.appendChild(make('footer'));

    this.keys = new KeyMap();
    this.keys.filter = this.filterKeys.bind(this);
    this.keys.register(options?.keysOn || this.grid.el);
    this.#origGridClassname = this.grid.el.className;

    this.cons = cons;
    this.scen = new this.cons();
    this.reset();
    this.init();
  }

  #origGridClassname:string

  filterKeys(event:KeyboardEvent) {
    if (event.key === 'Escape') {
      if (this.scen.showMenu) {
        this.scen.showMenu(this)
      } else {
        this.reboot();
      }
      return false;
    }
    if (this.modal.style.display !== 'none') return false;
    return !event.altKey && !event.ctrlKey && !event.metaKey;
  }

  reset() {
    this.grid.clear();
    this.grid.el.className = this.#origGridClassname;
    this.clearCtls();
    this.setStatus(null);
    this.modal.style.display = 'none';
    if (this.#boundMouseMoved) this.grid.el.removeEventListener('mousemove', this.#boundMouseMoved);
  }

  reboot() {
    this.reset();
    this.scen = new this.cons();
    this.init();
  }

  init() {
    this.scen.setup(this);
    if (this.scen.inspect) {
      if (!this.#boundMouseMoved) this.#boundMouseMoved = this.mouseMoved.bind(this)
      this.grid.el.addEventListener('mousemove', this.#boundMouseMoved);
      this.grid.el.classList.add('inspectable');
    }
  }

  #boundMouseMoved?:any
  #inspectingIDs?:string
  mouseMoved(ev:MouseEvent) {
    const tiles = document
      .elementsFromPoint(ev.clientX, ev.clientY)
      .filter(el => el.classList.contains('tile')) as HTMLElement[];
    if (!this.scen || !this.scen.inspect) return;

    const ids = tiles.map(({id}) => id).join(';');
    if (this.#inspectingIDs === ids) return;
    this.#inspectingIDs = ids;

    // TODO would be nice to be able to just translate event coordinates into
    // tile space
    const pos = this.grid.getTilePosition(tiles[0]);
    this.scen.inspect(this, pos, tiles);
  }

  clearCtls() {
    for (const el of this.head.querySelectorAll('.ctl.scen'))
      if (el.parentNode) el.parentNode.removeChild(el);
  }

  addCtl(tmpl:TemplateResult|null):HTMLElement {
    const ctl = this.head.appendChild(make('div', 'ctl scen'));
    render(tmpl, ctl);
    return ctl;
  }

  showModal(tmpl:TemplateResult|null) {
    render(tmpl, this.modal);
    this.modal.style.display = tmpl ? '' : 'none';
  }

  setStatus(tmpl:TemplateResult|null) {
    render(tmpl, this.foot);
  }

  inputRate = 100 // rate at which to coalesce and process movement input
  nudgeBy = 0.2   // proportion to scroll viewport by when at goes outside

  running = false
  async run() {
    this.running = true;
    let last = await nextFrame();
    let dt = 0;
    while (this.running) {
      this.update(dt);
      const next = await nextFrame();
      dt = next - last, last = next;
    }
  }

  halt() {
    this.running = false;
  }

  lastInput = 0
  update(dt:number):void {
    if ((this.lastInput += dt / this.inputRate) >= 1) {
      this.consumeInput();
      this.lastInput = this.lastInput % 1;
    }

    if (this.scen && this.scen.update &&
      this.modal.style.display === 'none')
      this.scen.update(this, dt);
  }

  consumeInput() {
    const presses = this.keys.consumePresses();
    if (!this.scen) return;

    const movers = this.grid.queryTiles('keyMove');
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
      this.grid.nudgeViewTo(action.targ, this.nudgeBy);
    }
  }
}

class Hello {
  static demoName = 'Hello'
  static demoTitle = 'Welcome screen'

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
        <a href="//github.com/borkshop/js/tree/main/packages/jspit">Github</a>
        |
        <a href="//github.com/borkshop/js/blob/main/packages/jspit/stream.md">Dev log</a>
      </section>
    `);
  }
}

class ColorBoop {
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

function readHashFrag():string|null {
  const parts = window.location.hash.split(';');
  const frag = parts.shift();
  return frag ? frag.replace(/^#+/, '') : null;
}

function setHashFrag(frag:string) {
  const parts = window.location.hash.split(';');
  const expected = '#' + frag;
  if (parts.length && parts[0] === expected) return;
  window.location.hash = expected;
}

function readHashVar(name:string):string|null {
  const parts = window.location.hash.split(';');
  parts.shift();
  const prefix = name + '=';
  for (const part of parts) if (part.startsWith(prefix))
    return unescape(part.slice(prefix.length));
  return null;
}

function setHashVar(name:string, value:string|null) {
  const parts = window.location.hash.split(';');
  const frag = parts.shift() || '#;';
  const prefix = name + '=';
  let res = [frag];
  let found = false;
  for (const part of parts)
    if (!part.startsWith(prefix)) {
      res.push(part);
    } else if (value !== null && !found) {
      res.push(prefix + escape(value));
      found = true;
    }
  if (value !== null && !found)
    res.push(prefix + escape(value));
  window.location.hash = res.join(';');
}

class DLA {
  static demoName = 'DLA'
  static demoTitle = 'Diffusion Limited Aggregation'

  particleID = 0

  rate = 5
  turnLeft = 0.5
  turnRight = 0.5
  stepLimit = 50

  setup(ctx:Context):void {
    ctx.grid.createTile(`particle-${++this.particleID}`, {
      tag: ['particle', 'init'],
      bg: 'var(--black)',
      fg: 'var(--dark-grey)',
      text: '.',
    });
    ctx.grid.centerViewOn({x: 0, y: 0});
    for (const name of ['rate', 'turnLeft', 'turnRight'])
      this.updateSetting(name, readHashVar(name));
    this.showMenu(ctx);
  }

  updateSetting(name:string, value:string|null) {
    switch (name) {
      case 'turnLeft':
      case 'turnRight':
      case 'rate':
        const given = value !== null;
        if (!given) value = this[name].toString();
        setHashVar(name, value);
        if (given) this[name] = parseFloat(value || '');
    }
  }

  #ctls: HTMLElement[] = []

  showMenu(ctx:Context):void {
    this.#ctls = this.#ctls.filter(ctl => {
      ctl.parentNode?.removeChild(ctl);
      return false;
    });

    const change = (ev:Event) => {
      const {name, value} = ev.target as HTMLInputElement;
      this.updateSetting(name, value);
      this.showMenu(ctx);
    };

    ctx.showModal(html`
      <section>
        <h1>Diffusion Limited Aggregation</h1>

        <p>
          This implementation fires particles from the origin with random
          initial radial heading. Each move proceeds by randomly perturbing the
          heading up to the turning radius set below, and advancing forward
          orthogonally along the greatest projected axis.
        </p>

        <fieldset><legend>Settings</legend><dl>
          <dt>Turns upto</dt>
          <dd><label for="dla-turnLeft">Left: Math.PI *</label>
            <input id="dla-turnLeft" name="turnLeft" type="number" min="0" max="1" step="0.2" value="${this.turnLeft}" @change=${change}>
          </dd>
          <dd><label for="dla-turnRight">Right: Math.PI *</label>
            <input id="dla-turnRight" name="turnRight" type="number" min="0" max="1" step="0.2" value="${this.turnRight}" @change=${change}>
          </dd>

          <dt>Particles Move</dt><dd>
            1 <!-- TODO -->
            step <!-- TODO -->
            <label for="dla-rate">every</label>
            <input id="dla-rate" name="rate" type="number" min="1" max="100" value="${this.rate}" @change=${change}>ms
          </dd>
        </dl></fieldset>

        <button @click=${() => {
          ctx.showModal(null);
          const drop = ctx.addCtl(html`
            <button @click=${() => {
              drop?.parentNode?.removeChild(drop);
              this.dropPlayer(ctx);
              this.rate = 100;
            }}>Drop Player</button>
          `);
          this.#ctls.push(drop);
        }}>Run</button>
      </section>

      <section>

        Inspired by
        <a href="//web.archive.org/web/20151003181050/http://codepen.io/DonKarlssonSan/full/BopXpq/">2015-10 codepen by DonKarlssonSan</a>
        <br>
        <br>

        Other resources:
        <ul>
          <li><a href"https://roguelike.club/event2020.html">Roguecel 2020 talk by Herbert Wolverson</a> demonstrated DLA among other techniques</li>
          <li><a href="//www.roguebasin.com/index.php?title=Diffusion-limited_aggregation">Roguebasin DLA article</a></li>
          <li><a href="//en.wikipedia.org/wiki/Diffusion-limited_aggregation">WikiPedia on the wider topic</a></li>
          <li><a href="//paulbourke.net/fractals/dla/">Paul Boruke, reference from DonKarlssonSan</a></li>
        </ul>

      </section>
    `);
  }

  elapsed = 0

  dropPlayer(ctx:Context) {
    ctx.grid.createTile('at', {
      text: '@',
      tag: ['solid', 'mind', 'keyMove'],
      fg: 'var(--orange)',
      pos: {x: 0, y: 0},
    });
  }

  update(ctx:Context, dt:number): void {
    this.elapsed += dt
    const n = Math.min(this.stepLimit, Math.floor(this.elapsed / this.rate));
    if (!n) return;
    this.elapsed -= n * this.rate;
    let ps = ctx.grid.queryTiles('particle', 'live');
    const spawn = () => {
      const p = ctx.grid.createTile(`particle-${++this.particleID}`, {
        tag: ['particle', 'live'],
        fg: 'var(--green)',
        text: '*',
      });
      ctx.setStatus(html`
        <label for="particleID">Particels:</label>
        <span id="particleID">${this.particleID}</span>
      `);
      ps.push(p);
    };
    for (let i = 0; i < n; ++i) {
      ps = ps.filter(p => p.classList.contains('live'));
      if (!ps.length) {
        spawn();
        continue;
      }

      for (const p of ps) {
        let heading = (p.dataset.heading && parseFloat(p.dataset.heading)) || 0;
        const adj = Math.random() * (this.turnLeft + this.turnRight) - this.turnLeft;
        heading += Math.PI * adj;
        heading %= 2 * Math.PI;
        p.dataset.heading = heading.toString();

        const dx = Math.cos(heading);
        const dy = Math.sin(heading);
        const pos = ctx.grid.getTilePosition(p);
        if (Math.abs(dy) > Math.abs(dx)) {
          if (dy < 0) pos.y--;
          else pos.y++;
        } else {
          if (dx < 0) pos.x--;
          else pos.x++;
        }

        if (!ctx.grid.tilesAt(pos, 'particle').length) {
          delete p.dataset.heading;
          ctx.grid.updateTile(p, {
            tag: ['particle'],
            bg: 'var(--black)',
            fg: 'var(--grey)',
            text: '.',
            pos,
          });
        } else {
          ctx.grid.moveTileTo(p, pos);
          if (!ctx.grid.queryTiles('keyMove').length) ctx.grid.nudgeViewTo(pos, 0.2);
        }
      }
    }
  }

  digSeq = new Map<string, number>()
  act(ctx:Context, action:SimAction): SimAction {
    if (!action.actor.classList.contains('solid')) return action;

    const hits = ctx.grid.tilesAt(action.targ);

    if (!hits.length) {
      const aid = action.actor.id;
      const did = (this.digSeq.get(aid) || 0) + 1;
      this.digSeq.set(aid, did);
      ctx.grid.createTile(`particle-placed-${aid}-${did}`, {
        tag: ['particle'],
        bg: 'var(--black)',
        fg: 'var(--orange)',
        text: '.',
        pos: action.targ,
      });
    } else if (!hits.some((h) => h.classList.contains('particle'))) {
      action.ok = false;
    }

    return action;
  }
}

export class DemoApp {
  demos = [
    Hello,
    ColorBoop,
    DLA,
  ]

  main: HTMLElement
  head: HTMLElement
  foot: HTMLElement
  sel: HTMLSelectElement
  sim: Sim|null = null

  constructor(options:Partial<Nullable<{
    main: HTMLElement,
    head: HTMLElement,
    foot: HTMLElement,
  }>>) {
    if (!options.main) {
      this.main = make('main');
      document.body.appendChild(this.main);
    } else {
      this.main = options.main;
    }

    if (!options.head) {
      this.head = make('header');
      this.main.parentNode?.insertBefore(this.head, this.main);
    } else {
      this.head = options.head;
    }

    if (!options.foot) {
      this.foot = make('footer');
      if (this.main.nextSibling) {
        this.main.parentNode?.insertBefore(this.foot, this.main.nextSibling);
      } else {
        this.main.parentNode?.appendChild(this.foot);
      }
    } else {
      this.foot = options.foot;
    }

    for (const ctl of this.head.querySelectorAll('.ctl.demo'))
      this.head.removeChild(ctl);

    const demoOption = ({demoName, demoTitle}:ScenarioCons) => html`
      <option value="${demoName}" title="${demoTitle}">${demoName}</option>`;

    render(html`
      <select id="demo" title="Simulation Scenario" @change=${() => {
        this.change(this.sel.value);
        this.sel.blur();
      }}>${this.demos.map(demoOption)}</select>
    `, this.head.appendChild(make('div', 'ctl demo right')));
    render(html`
      <button @click=${() => this.sim?.reboot()} title="Reboot Scenario <Escape>">Reboot</button>
    `, this.head.appendChild(make('div', 'ctl demo right')));
    this.sel = this.head.querySelector('#demo') as HTMLSelectElement;

    this.change(readHashFrag() || '');
  }

  change(name:string) {
    let cons = this.demos[0];
    for (const d of this.demos) if (d.name === name) {
      cons = d;
      break;
    }

    if (this.sim) this.sim.halt();
    setHashFrag(cons.demoName);
    this.sel.value = cons.demoName;

    this.sim = new Sim(cons, this.main, {
      head: this.head,
      foot: this.foot,
      keysOn: document.body,
    });
    this.sim.run();
  }
}

async function main() {
  await once(window, 'DOMContentLoaded');
  new DemoApp({
    main: document.querySelector('main'),
    head: document.querySelector('header'),
    foot: document.querySelector('footer'),
  });
}
main();

// vim:set ts=2 sw=2 expandtab:
