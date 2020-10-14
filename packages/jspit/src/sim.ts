import {render, TemplateResult} from 'lit-html';
import {Point, TileGrid} from './tiles';

type Nullable<T> = { [P in keyof T]: T[P] | null };

function nextFrame() {
  return new Promise<number>(resolve => requestAnimationFrame(resolve));
}

function make(tagName:string, className?:string):HTMLElement {
  const el = document.createElement(tagName);
  if (className) el.className = className;
  return el;
}

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

export interface Move {
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

export interface SimAction {
  actor: HTMLElement,
  pos: Point,
  targ: Point,
  ok: boolean,
}

export interface Context {
  addCtl(tmpl:TemplateResult|null):HTMLElement
  showModal(tmpl:TemplateResult|null):void
  setStatus(tmpl:TemplateResult|null):void
  grid : TileGrid
  reboot():void
}

export interface Scenario {
  setup(ctx:Context): void
  update?(ctx:Context, dt:number): void
  act?(ctx:Context, action:SimAction): SimAction
  inspect?(ctx:Context, pos:Point, tiles:HTMLElement[]):void
  showMenu?(ctx:Context):void
}

export interface ScenarioCons {
  demoName : string
  demoTitle : string

  new(): Scenario
}

export class Sim {
  modal : HTMLElement
  grid : TileGrid
  keys : KeyMap
  el : HTMLElement
  head : HTMLElement
  foot : HTMLElement
  keysOn : HTMLElement

  cons : ScenarioCons
  scen : Scenario

  constructor(
    options:{
      cons : ScenarioCons,
      el : HTMLElement,
    }&Partial<Nullable<{
      modal : HTMLElement,
      grid : HTMLElement,
      head : HTMLElement,
      foot : HTMLElement,
      keysOn : HTMLElement,
    }>>
  ) {
    this.el = options.el;
    this.head = options?.head
      || this.el.querySelector('header')
      || this.el.appendChild(make('header'));
    this.modal = options?.modal
      || this.el.querySelector('.modal')
      || this.el.appendChild(make('aside', 'modal'));
    this.grid = new TileGrid(options?.grid
      || this.el.querySelector('.grid')
      || this.el.appendChild(make('div', 'grid')));
    this.foot = options?.foot
      || this.el.querySelector('footer')
      || this.el.appendChild(make('footer'));
    this.keysOn = options.keysOn || this.grid.el;

    this.keys = new KeyMap();
    this.keys.filter = this.filterKeys.bind(this);
    this.keys.register(this.keysOn);
    this.#origGridClassname = this.grid.el.className;

    this.cons = options.cons;
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
