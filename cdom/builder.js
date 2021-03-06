// @ts-check

/** @typedef { import("./tiles").Point } Point */
/** @typedef { import("./tiles").Rect } Rect */
/** @typedef { import("./tiles").TileSpec } TileSpec */
/** @typedef { import("./tiles").NewTileSpec } NewTileSpec */

/**
 * A shader is a function that gets called over many points, and is expected to
 * build tiles at each point.
 *
 * The simplest shader will call grid.buildTile({pos, kind, ...}) once;
 * however a shader may:
 * - query for and destroy any prior tiles
 * - create many stacked tiles
 * - decline to create any tiles, maybe after destroying any priors, to discard
 *   portions of a larger structure being built
 *
 * @template {any} S - build shape type, e.g. Rect
 * @callback Shader
 * @param {Context} grid - the grid being built within; this is an abstracted subset of TileGrid
 * @param {Point} pos - current position to build
 * @param {S} shape - build shape, e.g. rectangle position and size
 */

/**
 * Shaders get called under this abstracted Context context.
 *
 * @typedef {object} Context
 * @prop {(spec: NewTileSpec) => HTMLElement} buildTile
 * @prop {(pos: Point, ...className: string[]) => HTMLElement|null} tileAt
 * @prop {(pos: Point, ...className: string[]) => Iterable<HTMLElement>} tilesAt
 */

/**
 * Converts constant tile spec values into shader functions, passing through
 * any user-given shader function.
 *
 * @template {any} S
 * @param {string|NewTileSpec|Shader<S>|null|undefined} shader
 * @param {string} [defaultKind]
 * @returns {Shader<S>}
 */
export function toShader(shader, defaultKind) {
  if (typeof shader === 'function') return shader;
  const spec = toSpec(shader, defaultKind);
  if (!spec) return _ => {};
  return (grid, pos) => grid.buildTile({pos, ...spec});
}

/**
 * @param {string|NewTileSpec|null|undefined} spec
 * @param {string} [defaultKind]
 * @returns {NewTileSpec|null|undefined}
 */
export function toSpec(spec, defaultKind) {
  return typeof spec === 'string'
    ? spec.startsWith('.')
    ? {kind: spec.slice(1)}
    : defaultKind ? {text: spec, kind: defaultKind} : null
    : spec;
}

/**
 * Shades a tile at every position within the given rectangle.
 *
 * @param {Context} grid
 * @param {Rect} rect
 * @param {string|NewTileSpec|Shader<Rect>} shader
 */
export function fillRect(grid, rect, shader) {
  shader = toShader(shader);
  const {x, y, w, h} = rect;
  for (let i=0; i<w; i++) for (let j=0; j<h; j++)
    shader(grid, {x: x + i, y: y + j}, rect);
}

/**
 * Shades a tile at every position along the perimeter of the given rectangle.
 *
 * @param {Context} grid
 * @param {Rect} rect
 * @param {string|NewTileSpec|Shader<Rect>} shader
 */
export function strokeRect(grid, rect, shader) {
  shader = toShader(shader);
  const {x, y, w, h} = rect;
  for (let i=0; i<w; i++) {
    shader(grid, {x: x + i, y: y}, rect);
    shader(grid, {x: x + i, y: y + h-1}, rect);
  }
  for (let j=0; j<h; j++) {
    shader(grid, {x: x + 0, y: y + j}, rect);
    shader(grid, {x: x + w-1, y: y + j}, rect);
  }
}

/**
 * Creates a rectangular shader that build tiles only along the perimeter of a
 * rectangle.
 *
 * @param {string|NewTileSpec|null} top
 * @param {string|NewTileSpec|null} [right] - defaults to top if not given
 * @param {string|NewTileSpec|null} [bottom] - defaults to top if not given
 * @param {string|NewTileSpec|null} [left] - defaults to right if not given
 * @returns {Shader<Rect>} - a shader that builds a tile along the rectangle's
 * perimeter, skipping any interior position; therefore may be used under
 * fillRect as well as strokeRect.
 */
export function borderShader(top, right, bottom, left) {
  if (right === undefined) right = top;
  if (bottom === undefined) bottom = top;
  if (left === undefined) left = right;
  /** @type {(NewTileSpec|null)[]} */
  const specs = [top, right, bottom, left].map(a => toSpec(a) || null);
  /**
   * @param {Point} pos
   * @param {Rect} rect
   * @returns {NewTileSpec|null}
   */
  const choose = (pos, rect) => {
    const bi = borderIndex(pos, rect);
    const spec = specs[bi];
    if (spec) return spec;
    if (bi !== 0 && bi !== 2) return null;
    if (pos.x === rect.x)          return specs[3];
    if (pos.x === rect.x+rect.w-1) return specs[1];
    return null;
  }
  return (grid, pos, rect) => {
    const spec = choose(pos, rect);
    if (spec) grid.buildTile({pos, ...spec});
  }
}

/**
 * Creates a rectangular room shader, that will build floors, walls, and
 * optionally doors.
 *
 * @param {object} [params]
 * @param {string|NewTileSpec|Shader<Rect>} [params.floors]
 * @param {string|NewTileSpec|Shader<Rect>} [params.walls]
 * @param {string|NewTileSpec|Shader<Rect>} [params.doors]
 * @param {(pos:Point, rect:Rect) => boolean} [params.doorsAt] - a convenience mask for
 * where to call the door shader; mostly useful when you don't want to
 * implement a fully custom door shader
 * @returns {Shader<Rect>}
 */
export function roomShader(params) {
  const {
    floors = '·',
    walls = '#',
    doors,
    doorsAt,
  } = params || {};
  const floorShader = toShader(floors, 'floor');
  const wallShader = toShader(walls, 'wall');
  const doorShader = maskedShader(doorsAt, toShader(doors ? doors : doorsAt ? '+' : undefined, 'door'));
  const spy = new buildSpy();

  return (grid, pos, rect) => {
    floorShader(grid, pos, rect);

    // call the wall shader on the perimeter in corners and where ever the door
    // shader declines to build
    const bi = borderIndex(pos, rect);
    if (bi >= 0) {
      if (!isCorner(bi, pos, rect) &&
          spy.under(grid, (grid) => doorShader(grid, pos, rect)).length)
        return;

      wallShader(grid, pos, rect);
    }
  }
}

/**
 * @template {any} C
 * @param {((pos:Point, ctx:C) => boolean)|undefined} mask
 * @param {Shader<C>} shader
 * @returns {Shader<C>}
 */
function maskedShader(mask, shader) {
  if (!mask) return shader;
  return (grid, pos, ctx) => {
    if (mask(pos, ctx)) shader(grid, pos, ctx);
  };
}

/**
 * @param {Point} pos
 * @param {Rect} rect
 * @returns {number} - border index in clockwise-up order if pos is on rect's
 * border or -1 otherwise; prioritizes top/bottom over left/right in corner cases.
 */
function borderIndex(pos, rect) {
  if (pos.y === rect.y)          return 0; // top
  if (pos.y === rect.y+rect.h-1) return 2; // bottom
  if (pos.x === rect.x)          return 3; // left
  if (pos.x === rect.x+rect.w-1) return 1; // right
  return -1;
}

/**
 * @param {number} bi
 * @param {Point} pos
 * @param {Rect} rect
 * @returns {boolean}
 */
function isCorner(bi, pos, rect) {
  if (bi !== 0 && bi !== 2) return false;     // must be top or bottom
  if (pos.x === rect.x)          return true; // and left
  if (pos.x === rect.x+rect.w-1) return true; // or right
  return false;
}

class buildSpy {
  /** @type {Context|null} */
  ctx = null

  /** @type {TileSpec|null} */
  spec = null

  /** @type {HTMLElement[]} */
  built = []

  /**
   * @param {Context} ctx
   * @param {(ctx:Context) => void} fun
   * @returns {HTMLElement[]}
   */
  under(ctx, fun) {
    try {
      this.ctx = ctx;
      this.built = [];
      fun(this);
      return this.built;
    } finally {
      this.ctx = null;
      this.built = [];
    }
  }

  /**
   * @param {NewTileSpec} spec
   * @returns {HTMLElement}
   */
  buildTile(spec) {
    if (!this.ctx) throw new Error('cannot build tile: no context given');
    const tile = this.ctx.buildTile({...spec, ...this.spec});
    this.built.push(tile);
    return tile;
  }

  /**
   * @param {Point} pos
   * @param {string[]} className
   * @returns {HTMLElement|null}
   */
  tileAt(pos, ...className) {
    if (!this.ctx) return null;
    return this.ctx.tileAt(pos, ...className);
  }

  /**
   * @param {Point} pos
   * @param {string[]} className
   * @returns {Iterable<HTMLElement>}
   */
  tilesAt(pos, ...className) {
    if (!this.ctx) return [];
    return this.ctx.tilesAt(pos, ...className);
  }
}

// TODO line
// TODO polygon
// TODO circle
// TODO flood
