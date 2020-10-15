export interface Point {
  x: number,
  y: number,
}

export interface TileSpec {
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

export class TileGrid {
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

  tilesAtPoint(clientX:number, clientY:number) {
    return document
      .elementsFromPoint(clientX, clientY)
      .filter(el => el.classList.contains('tile')) as HTMLElement[];
  }

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
