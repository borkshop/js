import "core-js/stable";
import "regenerator-runtime/runtime";

const nextFrame = () => new Promise<number>(resolve => requestAnimationFrame(resolve));

const once = (target:EventTarget, name:string) => new Promise<Event>(resolve => {
    const handler = (event:Event) => {
      target.removeEventListener(name, handler);
      resolve(event);
    };
    target.addEventListener(name, handler);
  }
);

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

function parseKey(key:string, _count:number): null | Move {
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
    .map(([key, count]) => parseKey(key, count))
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

  interface Point {x: number, y:number};

  const viewXlate = () => ({
    x: parseFloat(main.style.getPropertyValue('--xlate-x')) || 0,
    y: parseFloat(main.style.getPropertyValue('--xlate-y')) || 0,
  });

  const moveViewBy = (dx:number, dy:number) => {
    const {x, y} = viewXlate();
    main.style.setProperty('--xlate-x', (x + dx).toString());
    main.style.setProperty('--xlate-y', (y + dy).toString());
  };
  const viewSize = (tileSize:Point) => ({
    x: main.clientWidth  / tileSize.x,
    y: main.clientHeight / tileSize.y,
  });
  const viewGrid = (tileSize:Point) => {
    const {x, y} = viewXlate();
    const {x: w, y: h} = viewSize(tileSize);
    return {x, y, w, h};
  };

  // proportion to scroll viewport by when at goes outside
  const scrollP = 0.2;

  const at = document.createElement('div');
  at.className = 'tile';
  main.appendChild(at)
  at.innerText = '@';

  const updateFooter = () => {
    const tileSize = {x: at.clientHeight, y: at.clientHeight};
    const {x: w, y: h} = tileSize;
    const x = parseFloat(at.style.getPropertyValue('--x')) || 0;
    const y = parseFloat(at.style.getPropertyValue('--y')) || 0;
    const {x: vx, y: vy, w: vw, h: vh} = viewGrid(tileSize);
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
      let moved = false;
      if (have) {
        const tileSize = {x: at.clientHeight, y: at.clientHeight};
        const {x: vx, y: vy, w, h} = viewGrid(tileSize);
        const ax = (parseFloat(at.style.getPropertyValue('--x')) || 0) + move.x;
        const ay = (parseFloat(at.style.getPropertyValue('--y')) || 0) + move.y;
        const dx = ax < vx ? -1 : ax > vx + w ? 1 : 0;
        const dy = ay < vy ? -1 : ay > vy + h ? 1 : 0;
        if      (dx < 0) moveViewBy(-Math.floor(w * scrollP), 0);
        else if (dx > 0) moveViewBy( Math.floor(w * scrollP), 0);
        else if (dy < 0) moveViewBy(0, -Math.floor(h * scrollP));
        else if (dy > 0) moveViewBy(0,  Math.floor(h * scrollP));
        at.style.setProperty('--x', (ax).toString());
        at.style.setProperty('--y', (ay).toString());
        moved = true;
      }

      if (moved) updateFooter();

      input = input % 1;
    }

    const next = await nextFrame();
    dt = next - last, last = next;
  }
}
main();

// vim:set ts=2 sw=2 expandtab:
