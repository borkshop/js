export class KeyCtl extends Map<string, number> {
  target: EventTarget
  #handler: (ev:Event)=>void

  #counting: boolean = false
  get counting() { return this.#counting; }
  set counting(enabled:boolean) {
    this.#counting = enabled;
    this.clear();
  }

  on: {
    code: {[name: string]: undefined|((keyEvent:KeyboardEvent)=>void)},
    key: {[name: string]: undefined|((keyEvent:KeyboardEvent)=>void)},
  } = {code: {}, key: {}}

  constructor(target: EventTarget) {
    super();
    this.#handler = this.handleEvent.bind(this);
    this.target = target;
    this.target.addEventListener('keydown', this.#handler);
    this.target.addEventListener('keyup', this.#handler);
  }

  handleEvent(event:Event) {
    if (event.type !== 'keyup' && event.type !== 'keydown') return;
    const keyEvent = event as KeyboardEvent;
    const on = this.on.code[keyEvent.code] || this.on.key[keyEvent.key];
    if      (on)             on(keyEvent);
    else if (this.#counting) this.countKey(keyEvent);
    else                     return;
    event.stopPropagation();
    event.preventDefault();
  }

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

function parseMoveKey(key:string) {
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

export function coalesceMoves(presses:Array<[string, number]>) {
  return presses
    .map(([key, _count]) => parseMoveKey(key))
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
