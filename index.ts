import "core-js/stable";
import "regenerator-runtime/runtime";

interface Point {
  x: number,
  y: number,
}

interface TileSpec {
  id: string
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

  createTile(spec:TileSpec):HTMLElement {
    let tile = this.getTile(spec.id);
    if (!tile) {
      tile = document.createElement('div');
      this.el.appendChild(tile)
      tile.id = this.tileID(spec.id)
    }
    return this.updateTile(tile, spec) as HTMLElement;
  }

  updateTile(elOrID:HTMLElement|string, spec:TileSpec) {
    const tile = this.getTile(elOrID);
    if (!tile) return null;
    const colorOrVar = (c:string|null) => !c ? '' : c.startsWith('--') ? `var(${c})` : c;
    tile.innerText = spec.text || ' ';
    tile.style.color = colorOrVar(spec.fg || null);
    tile.style.backgroundColor = colorOrVar(spec.bg || null);
    tile.className = 'tile';
    if (typeof spec.tag === 'string') tile.classList.add(spec.tag);
    else if (Array.isArray(spec.tag)) for (const tag of spec.tag) tile.classList.add(tag);
    if (spec.pos) this.moveTileTo(tile, spec.pos);
    return tile;
  }

  getTile(elOrID:HTMLElement|string):HTMLElement|null {
    if (typeof elOrID === 'string') {
      return this.el.querySelector(this.tileID(elOrID));
    }
    return elOrID;
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

async function main() {
  await once(window, 'DOMContentLoaded');

  const main = document.querySelector('main');
  if (!main) throw new Error('no <main> element');

  const head = document.querySelector('header');
  if (!head) throw new Error('no <header> element');

  const foot = document.querySelector('footer');
  if (!foot) throw new Error('no <footer> element');

  const keys = new KeyMap();
  keys.filter = (event:KeyboardEvent) => !event.altKey && !event.ctrlKey && !event.metaKey;
  keys.register(document.body);

  const grid = new TileGrid(main);

  // proportion to scroll viewport by when at goes outside
  const nudgeBy = 0.2;
  const nudgeViewTo = ({x, y}:Point) => {
    const {width, height} = grid.viewport;
    const nudge = {x: Math.floor(width * nudgeBy), y: Math.floor(height * nudgeBy)};
    grid.nudgeViewTo({x, y}, nudge);
  };

  grid.createTile({
    id: 'at',
    text: '@',
    pos: {x: 10, y: 10},
  });

  const updateFooter = () => {
    const {x, y} = grid.getTilePosition('at');
    const {x: w, y: h} = grid.tileSize;
    const {x: vx, y: vy, width: vw, height: vh} = grid.viewport;
    foot.innerText = `player@${x},${y}+${w}+${h} view@${vx},${vy}+${Math.floor(vw)}+${Math.floor(vh)}`;
  }

  let last = await nextFrame();
  updateFooter();
  let dt = 0;

  // coalesce and process key input every t frames
  let input = 0;
  const inputRate = 100;

  while (true) {

    if ((input += dt / inputRate) >= 1) {
      const {have, move} = coalesceKeys(keys.consumePresses());
      if (have) {
        nudgeViewTo(grid.moveTileBy('at', move));
        updateFooter();
      }
      input = input % 1;
    }

    const next = await nextFrame();
    dt = next - last, last = next;
  }
}
main();

// vim:set ts=2 sw=2 expandtab:
