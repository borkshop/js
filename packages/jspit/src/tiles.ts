export interface Point {
  x: number,
  y: number,
}

export interface TileQuery {
  className?: string|string[]

  // NOTE may start with ^ $ or * to encode a startsWith/endsWith/contains match
  id?: string

  // NOTE matches on the JOSN representation of a TileDatum; may also start
  // with ^ $ or * like id above
  data?: {[name: string]: string}
}

export interface TileSpec {
  pos?: Point
  className?: string|string[]
  text?: string
  style?: Partial<CSSStyleDeclaration>
  data?: TileData
}

type TileDatum =
  | string
  | number
  | TileDatum[]
  | TileData

interface TileData {
  [name: string]: TileDatum
}

// mortonSpread1 inserts a 0 bit after each of 26 the low bits of x, masking
// away any higher bits; this is the best we can do in JavaScript since integer
// precision maxes out at 53 bits.
export function mortonSpread1(x:number):number {
  x =  x             & 0x00000002ffffff; // x = ---- ----  ---- ----  ---- ----  ---- --98  7654 3210  fedc ba98  7654 3210
  x = (x ^ (x << 8)) & 0x0200ff00ff00ff; // x = ---- --98  ---- ----  7654 3210  ---- ----  fedc ba98  ---- ----  7654 3210
  x = (x ^ (x << 4)) & 0x020f0f0f0f0f0f; // x = ---- ----  ---- 7654  ---- 3210  ---- fedc  ---- ba98  ---- 7654  ---- 3210
  x = (x ^ (x << 2)) & 0x02333333333333; // x = ---- --98  --76 --54  --32 --10  --fe --dc  --ba --98  --76 --54  --32 --10
  x = (x ^ (x << 1)) & 0x05555555555555; // x = ---- -9-8  -6-6 -5-4  -3-2 -1-0  -f-e -d-c  -b-a -9-8  -7-6 -5-4  -3-2 -1-0
  return x;
}

// mortonCompact1 is the inverse of mortonSpread1, removing half (the even
// ones) of the lowerv 53 bits from x.
export function mortonCompact1(x:number):number {
  x =  x             & 0x05555555555555;
  x = (x ^ (x >> 1)) & 0x02333333333333;
  x = (x ^ (x >> 2)) & 0x020f0f0f0f0f0f;
  x = (x ^ (x >> 4)) & 0x0200ff00ff00ff;
  x = (x ^ (x >> 8)) & 0x00000002ffffff;
  return x;
}

// mortonKey returns the Z-order curve index for a Point, aka its "Morton code"
// https://en.wikipedia.org/wiki/Z-order_curve
export function mortonKey({x, y}:Point):number {
  return mortonSpread1(Math.floor(x)) | mortonSpread1(Math.floor(y))<<1;
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
    for (let i = 0; i < ids.length; ++i) {
      const id = ids[i];
      const key = mortonKey(pos[i]);
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

export class TileGrid {
  el : HTMLElement

  idspace = 'tile' // TODO autogen this

  #obs : ResizeObserver

  constructor(el:HTMLElement) {
    this.el = el;
    this.#obs = new ResizeObserver(() => this._updateSize());
    this.#obs.observe(this.el);
    const tiles = this.queryTiles();
    this.spatialIndex.update(
      tiles.map(tile => tile.id),
      tiles.map(tile => this.getTilePosition(tile)),
    );
  }

  get tileSize(): Point {
    // TODO use an invisible measurement tile? cache?
    for (const tile of this.el.querySelectorAll('.tile')) {
      const x = tile.clientWidth;
      const y = tile.clientHeight;
      return {x, y};
    }
    return {x: 0, y: 0};
  }

  get viewOffset() {
    const x = parseFloat(this.el.style.getPropertyValue('--xlate-x')) || 0;
    const y = parseFloat(this.el.style.getPropertyValue('--xlate-y')) || 0;
    return {x, y};
  }

  set viewOffset({x, y}:Point) {
    this.el.style.setProperty('--xlate-x', Math.floor(x).toString());
    this.el.style.setProperty('--xlate-y', Math.floor(y).toString());
  }

  get viewSize() {
    const {clientWidth, clientHeight} = this.el,
          {x, y} = this.tileSize;
    return {w: clientWidth / x, h: clientHeight / y};
  }

  get viewport() {
    return {...this.viewOffset, ...this.viewSize};
  }

  get viewPoint():Point {
    const {x: vx, y: vy, w, h} = this.viewport;
    const x = vx + w / 2, y = vy + h / 2;
    return {x, y};
  }

  set viewPoint({x, y}:Point) {
    this.#viewPoint = {x, y};
    this._updateSize();
  }

  #viewPoint?: Point

  _updateSize() {
    if (!this.#viewPoint) return;
    const {x, y} = this.#viewPoint;
    const {w, h} = this.viewSize;
    this.viewOffset = {x: x - w / 2, y: y - h / 2};
  }

  tileID(id:string) {
    return `${this.el.id}${this.el.id ? '-': ''}${this.idspace}-${id}`;
  }

  createTile(id: string, spec:TileSpec):HTMLElement {
    let tile = this.getTile(id);
    if (!tile) {
      tile = this.el.ownerDocument.createElement('div');
      this.el.appendChild(tile)
      tile.id = this.tileID(id)
    }
    if (!spec.pos) spec.pos = {x: 0, y: 0};
    return this.updateTile(tile, spec) as HTMLElement;
  }

  updateTile(tile:HTMLElement, spec:TileSpec) {
    if (spec.pos) this.moveTileTo(tile, spec.pos);
    if (spec.text) tile.innerText = spec.text;
    if (spec.className) {
      tile.className = 'tile';
      if (typeof spec.className === 'string') tile.classList.add(spec.className);
      else if (Array.isArray(spec.className))
        for (const name of spec.className) tile.classList.add(name);
    } else if (!tile.className) tile.className = 'tile';
    Object.assign(tile.style, spec.style);
    if (spec.data) {
      for (const name in tile.dataset)
        if (!(name in spec.data))
          delete tile.dataset[name];
      for (const name in spec.data)
        tile.dataset[name] = JSON.stringify(spec.data[name]);
    }
    return tile;
  }

  getTile(elOrID:HTMLElement|string):HTMLElement|null {
    if (typeof elOrID === 'string') {
      return this.el.querySelector('#' + this.tileID(elOrID));
    }
    return elOrID;
  }

  getTileData(tile:HTMLElement, name:string):TileDatum|null {
    const sval = tile?.dataset[name];
    if (!sval) return null;
    try {
      return JSON.parse(sval);
    } catch(e) {
    }
    return null;
  }

  setTileData(tile:HTMLElement, name:string, value:TileDatum|null) {
    if (!tile) return;
    if (value === null) delete tile.dataset[name];
    else                       tile.dataset[name] = JSON.stringify(value);
  }

  tileQuerySelector(query?:TileQuery) {
    const parseMatcher = (s:string) => {
      switch (s[0]) {
        case '^':
        case '$':
        case '*':
          return {match: s[0], value: s.slice(1)};
        default:
          return {match: '', value: s.slice(1)};
      }
    };

    const attrs: string[] = [];
    const addAttr = (name:string, match:string, value:string) => attrs.push(`${name}${match}=${value}`);

    if (query?.id) {
      let {match, value} = parseMatcher(query.id);
      if (!match || match === '^') value = `${this.idspace}-${value}`;
      addAttr('id', match, value);
    }

    if (query?.data) for (const name in query.data) {
      const {match, value} = parseMatcher(query.data[name]);
      addAttr(`data-${name}`, match, value);
    }

    // TODO how to support className negation
    const tagClasses = typeof query?.className === 'string'
      ? `.${query.className}` : Array.isArray(query?.className)
      ? query?.className.map(t => `.${t}`).join('')
      : '';

    return `.tile${tagClasses}${attrs.map(attr => `[${attr}]`).join('')}`;
  }

  queryTile(query?:TileQuery) {
    return this.el.querySelector(this.tileQuerySelector(query)) as HTMLElement|null;
  }

  queryTiles(query?:TileQuery) {
    const res : HTMLElement[] = [];
    for (const el of this.el.querySelectorAll(this.tileQuerySelector(query)))
      res.push(el as HTMLElement);
    return res;
  }

  clear() {
    for (const tile of this.queryTiles())
      this.el.removeChild(tile);
  }

  getTilePosition(tile:HTMLElement) {
    const x = parseFloat(tile.style.getPropertyValue('--x')) || 0;
    const y = parseFloat(tile.style.getPropertyValue('--y')) || 0;
    return {x, y};
  }

  moveTileTo(tile:HTMLElement, pt:Point):Point {
    tile.style.setProperty('--x', pt.x.toString());
    tile.style.setProperty('--y', pt.y.toString());
    // TODO decouple/batch these with a mutation observer?
    this.spatialIndex.update([tile.id], [pt]);
    return pt;
  }

  spatialIndex:TileSpatialIndex = new TileMortonIndex()

  tilesAtPoint(clientX:number, clientY:number) {
    return this.el.ownerDocument
      .elementsFromPoint(clientX, clientY)
      .filter(el => el.classList.contains('tile')) as HTMLElement[];
  }

  tilesAt(at:Point, ...className:string[]):HTMLElement[] {
    let tiles : HTMLElement[] = [];
    const ids = this.spatialIndex.tilesAt(at);
    if (!ids) return tiles;
    for (const id of ids) {
      const el = this.el.querySelector(`#${id}`);
      if (el) tiles.push(el as HTMLElement);
    }
    if (className.length) tiles = tiles
      .filter(el => className.every(t => el.classList.contains(t)));
    return tiles;
  }
}

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
    this.enabled = true;
  }

  #listener?: (ev:MouseEvent) => void

  get enabled():boolean {
    return !!this.#listener
  }

  set enabled(is:boolean) {
    if (is) {
      if (this.#listener) return;
      this.#listener = this.mouseMoved.bind(this);
      this.grid.el.addEventListener('mousemove', this.#listener);
    } else {
      if (!this.#listener) return;
      this.grid.el.removeEventListener('mousemove', this.#listener);
      this.#listener = undefined;
    }
    this.#lastHandlid = '';
    this.handler({pos: {x: NaN, y: NaN}, tiles: []});
  }

  #lastHandlid:string = ''

  mouseMoved(ev:MouseEvent) {
    let pos: Point|null = null;
    const tiles = this.grid.tilesAtPoint(ev.clientX, ev.clientY);

    if (tiles.length) {
      pos = this.grid.getTilePosition(tiles[0]);
    } else {
      let {x, y} = this.grid.viewOffset;
      const gridRect = this.grid.el.getBoundingClientRect();
      const {x: w, y: h} = this.grid.tileSize;
      x += (ev.clientX - gridRect.left) / w;
      y += (ev.clientY - gridRect.top) / h;
      pos = {x, y};
    }

    const handlid = `${pos.x},${pos.y}[${tiles.map(({id}) => id).join(';')}]`;
    if (this.#lastHandlid !== handlid) {
      this.#lastHandlid = handlid;
      this.handler({pos, tiles});
    }
  }
}

export function dumpTiles({tiles, into, dump}:{
  tiles: HTMLElement[],
  into: HTMLTextAreaElement,
  dump?: (tile: HTMLElement)=>string
}) {
  if (!dump) dump = t => {
    let line = `id=${t.id}`
    line += ` class=[${Array.from(t.classList).filter(n => n !== 'tile').join(', ')}]`;
    return line;
  };

  if (!tiles.length) {
    into.style.display = 'none';
  } else {
    into.style.display = '';
    const lines = tiles.map(dump);
    into.value = lines.join('\n');
    into.rows = lines.length;
    into.cols = lines.reduce((max, line) => Math.max(max, line.length), 0);
  }
}

// TODO support grouped resolution and/or priority...

export type TileMoverProc = (req:{
  grid: TileGrid,
  mover: HTMLElement,
  at: HTMLElement[],
  pos: Point,
  to: Point,
}) => boolean

export function moveTiles({
  grid,
  moverClass = 'mover',
  kinds,
}:{
  grid: TileGrid,
  moverClass?: string,
  kinds: {[kind: string]: TileMoverProc},
}):void {
  for (const kind in kinds)
    moveTileClass({grid, moverClass, kind, may: kinds[kind]});
  if (!('' in kinds)) moveTileClass({grid, moverClass});
}

export function moveTileClass({grid, moverClass='mover', kind='', may}:{
  grid: TileGrid,
  moverClass?: string,
  kind?: string,
  may?: TileMoverProc,
}):void {
  for (const mover of grid.queryTiles({
    className: kind ? [moverClass, kind] : moverClass,
  })) {
    const move = grid.getTileData(mover, 'move');
    if (!move || typeof move !== 'object') continue;
    if (!(
      'x' in move && typeof move.x === 'number' &&
      'y' in move && typeof move.y === 'number'
    )) continue;
    const pos = grid.getTilePosition(mover);
    const to = {x: pos.x + move.x, y: pos.y + move.y};
    const at = grid.tilesAt(to);
    if (!may || may({grid, mover, at, pos, to}))
      grid.moveTileTo(mover, to);
    grid.setTileData(mover, 'move', null);
  }
}
