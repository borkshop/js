import test from 'ava';

import {mortonKey, mortonPoint} from './index.js';

[
  {x: 0, y: 0, k: 0x0000_0000_0000_0000n},
  {x: 1, y: 0, k: 0x0000_0000_0000_0001n},
  {x: 0, y: 1, k: 0x0000_0000_0000_0002n},
  {x: 1, y: 1, k: 0x0000_0000_0000_0003n},
  {x: 2, y: 0, k: 0x0000_0000_0000_0004n},
  {x: 0, y: 2, k: 0x0000_0000_0000_0008n},
  {x: 2, y: 2, k: 0x0000_0000_0000_000cn},
  {x: 0xffff_ffff, y: 0, k: 0x5555_5555_5555_5555n},
  {x: 0, y: 0xffff_ffff, k: 0xaaaa_aaaa_aaaa_aaaan},
  {x: 0xffff_ffff, y: 0xffff_ffff, k: 0xffff_ffff_ffff_ffffn},
].forEach(({x, y, k}) => test(test.macro({
  /** @param {number} x @param {number} y @param {bigint} key */
  exec(t, x, y, key) {
    t.is(mortonKey({x, y}), key, 'there');
    t.deepEqual(mortonPoint(key), {x, y}, 'back again');
  },
  title(providedTitle='', x, y) {
    return `${providedTitle} mortonKey(${x},${y})`;
  }
}), x, y, k));

[
  {x: -1, y:  0},
  {x:  0, y: -1},
  {x: -1, y: -1},
  {x: -2, y:  0},
  {x:  0, y: -2},
  {x: -2, y: -2},
  {x: 0x1_ffff_ffff, y: 0},
  {x: 0, y: 0x1_ffff_ffff},
].forEach(({x, y}) => test(test.macro({
  /** @param {number} x @param {number} y */
  exec(t, x, y) { t.throws(
    () => mortonKey({x, y}),
    {message: 'Number not within acceptable 32-bit range'},
  ) },
  title(providedTitle='', x, y) {
    return `${providedTitle} !mortonKey(${x},${y})`;
  }
}), x, y));

import {makeMortonMap} from './index.js';

/** @typedef {import('./index.js').Point} Point */
/** @typedef {import('./index.js').Rect} Rect */

/** @template ID @typedef {import('./index.js').ROMortonMap<ID>} ROMortonMap */

test('morton map', t => {
  /* this is the intended full-up use of how the morton map is currently factored:
   * - an underlying system with positioned entities
   * - whose position data is lazily indexed on demand primarily by queries,
   *   but sometimes by transactional reads if necessary
   */

  const world = makeTestWorld();
  t.is(world.spatial.size, 0, 'should start out empty');

  world.create('alice', {x: 2, y: 1, glyph: 0x41});
  world.create('bob', {x: 8, y: 1, glyph: 0x42});
  world.create('candice', {x: 8, y: 5, glyph: 0x43});
  world.create('doug', {x: 2, y: 5, glyph: 0x44});

  // god exists to be unseen (outside of render viewport bounds) to increase
  // test branch coverage
  world.create('god', {x: 42, y: 42, glyph: 0x47});

  const view = makeViewport({x: 0, y: 0, w: 10, h: 7});
  const render = () => {
    view.clear();
    for (const [p, ids] of world.spatial.within(view.bounds))
      view.update(p, prior => {
        for (const id of ids) {
          const glyph = world.glyphs.get(id) || 0xfffd;
          if (prior != 0x20)
            throw new Error(`glyph collision @${p.x},${p.y} ${ucode(prior)} <=> ${ucode(glyph)}`);
          prior = glyph;
        }
        return prior;
      });
    return view.toString();
  };

  // load and inspect
  t.is(world.spatial.size, world.scene.size, 'should have scene things');
  for (const id of world.scene.keys())
      t.true(world.spatial.has(id), `has ${id}`);

  t.deepEqual(
      Object.fromEntries(world.spatial.entries()),
      Object.fromEntries(world.scene), 'get initial scene back');
  t.is(render(), [
    '           ',
    '  A     B  ',
    '           ',
    '           ',
    '           ',
    '  D     C  ',
    '           ',
  ].join('\n'), 'initial scene');

  // bob challenges
  t.deepEqual(world.spatial.get('bob'), {x: 8, y: 1});
  t.deepEqual(
    [...world.spatial.at({x: 5, y: 3})],
    [],
    'nothing in mid');
  world.move('bob', {x: 5, y: 3})
  t.deepEqual(world.spatial.get('bob'), {x: 5, y: 3});
  t.deepEqual(
    [...world.spatial.at({x: 5, y: 3})],
    ['bob'],
    'bob in mid');
  t.is(render(), [
    '           ',
    '  A        ',
    '           ',
    '     B     ',
    '           ',
    '  D     C  ',
    '           ',
  ].join('\n'), 'bob move');

  // unseen god move for more coverage
  world.move('god', {x: 5});

  // doug accepts
  world.move('doug', {x: 4, y: 3})
  t.is(render(), [
    '           ',
    '  A        ',
    '           ',
    '    DB     ',
    '           ',
    '        C  ',
    '           ',
  ].join('\n'), 'doug move');

  // unseen god move for more coverage
  world.move('god', {x: 42, y: 3});

  // doug wins
  world.move('doug', {x: 5, y: 3})
  t.deepEqual(
    [...world.spatial.at({x: 5, y: 3})],
    ['bob', 'doug'],
    'bob and doug collide in mid');

  // because this implementation has no z-buffering or other way to visually
  // resolve the conflict, this is an expected unrenderable state
  t.throws(
    () => render(),
    {message: 'glyph collision @5,3 U+0042 <=> U+0044'},
    'collision cannot be rendered');

  world.delete('bob');

  t.is(render(), [
    '           ',
    '  A        ',
    '           ',
    '     D     ',
    '           ',
    '        C  ',
    '           ',
  ].join('\n'), 'doug win');

  // kill god for yet more branch coverage
  t.is(world.spatial.size, 4, 'with god');
  t.deepEqual(world.spatial.get('god'), {x: 42, y: 3});
  world.delete('god');
  t.is(world.spatial.size, 3, 'sans god');
  t.is(world.spatial.get('god'), undefined);

  // apocalypse
  world.clear();
  t.is(world.spatial.size, 0, 'should be empty after clear');

  for (const id of Object.keys(world.scene))
    t.false(world.spatial.has(id), `has ${id}`);
});

import {shadowField} from './index.js';

test('shadowField', t => {
  /**
   * @typedef {object} EntDef
   * @prop {string} kind
   * @prop {boolean} solid
   */

  /** @type {Map<string, EntDef>} */
  const lexicon = new Map([
    ['#', {kind: 'wall', solid: true}],
    ['·', {kind: 'floor', solid: false}],
    ['+', {kind: 'door', solid: true}],
    ['-', {kind: 'door', solid: false}],
    ['@', {kind: 'player', solid: true}],
    ['X', {kind: 'npc', solid: true}],
  ]);

  const world = makeTestWorld();

  build({x: 0, y: 0}, [
    '##########',
    '#········#     #####',
    '#········#######X··#',
    '#··@·X··X+··X··+···#',
    '#········#######X··#',
    '#········#     #####',
    '##########',
  ].join('\n'));

  t.deepEqual(
    world.scene.get('player1'),
    {x: 3, y: 3},
    'player start');

  // TODO render with shadow field

  const view = makeViewport({x: 0, y: 0, w: 20, h: 7});

  /**
   * @param {Point} p
   * @param {number} _depth
   * @param {string|Point} pov
   */
  function shadeWorldGlyphs(p, _depth, pov) {
    const ids = [...world.spatial.at(p)];
    const show = ids.length > 0 ? ids[ids.length-1] : undefined;
    const at = show ? world.glyphs.get(show) || 0xfffd : 0x20;
    const defs = ids
      .map(id => world.glyphs.get(id))
      .map(glyph => glyph ? lexicon.get(String.fromCodePoint(glyph)) : undefined);
    const blocked = defs.some((def, i) => def?.solid && ids[i] != pov);
    return {blocked, at};
  }

  /**
   * @param {string|Point} pov
   * @param {(p: Point, depth: number, pov: string|Point) => number|{blocked?: boolean, at: number}} shader
   */
  const render = (pov, shader=shadeWorldGlyphs) => {
    view.clear();
    const origin = typeof pov == 'string' ? world.scene.get(pov) : pov;
    if (origin) for (const {pos, at} of shadowField(origin, {
      query(p, depth) {
        if (!view.has(p)) return null;
        const res = shader(p, depth, pov);
        const {blocked=false, at} = typeof res == 'number' ? {at: res} : res;
        return {blocked, at};
      },
    })) view.set(pos, at);
    return view.toString();
  }

  t.is(render('player1', (_, depth) => 0x40 + depth), [
    'CCCCCCCDEFGHIJKLMNOPQ',
    'CBBBBBCDEFGHIJKLMNOPQ',
    'CBAAABCDEFGHIJKLMNOPQ',
    'CBA@ABCDEFGHIJKLMNOPQ',
    'CBAAABCDEFGHIJKLMNOPQ',
    'CBBBBBCDEFGHIJKLMNOPQ',
    'CCCCCCCDEFGHIJKLMNOPQ',
  ].join('\n'), 'depth coding');

  t.is(render('player1'), [
    '##########           ',
    '#········#           ',
    '#·······             ',
    '#··@·X               ',
    '#·······             ',
    '#········#           ',
    '##########           ',
  ].join('\n'), '#player1 view');

  t.is(render('npc1'), [
    '                     ',
    '               ##### ',
    '               #X··# ',
    '               +···# ',
    '               #X··# ',
    '                 ### ',
    '                     ',
  ].join('\n'), '#npc1 view');

  t.is(render('npc4'), [
    '                     ',
    '                     ',
    '         #######     ',
    '         +··X··+     ',
    '         #######     ',
    '                     ',
    '                     ',
  ].join('\n'), '#npc4 view');

  t.is(render({x: 6, y: 0}), [
    '      #              ',
    '                     ',
    '                     ',
    '                     ',
    '                     ',
    '                     ',
    '                     ',
  ].join('\n'), 'stuck in a wall view (origin blocked)');

  t.is(render({x: 42, y: 42}), [
    '                     ',
    '                     ',
    '                     ',
    '                     ',
    '                     ',
    '                     ',
    '                     ',
  ].join('\n'), 'view from outside (origin not supported)');

  /**
   * @param {Point} at
   * @param {string} content
   */
  function build({x, y}, content) {
    /** @type {Map<string, number>} */
    const kindCounts = new Map();

    const initX = x;

    for (const unit of content) switch (unit) {

      case ' ':
        x++;
        continue;

      case '\n':
        x = initX, y++;
        continue;

      default:
        const def = lexicon.get(unit)
        if (!def) throw new Error(`undefined content unit ${JSON.stringify(unit)}`);
        const id = nextID(def.kind);
        const glyph = unit.codePointAt(0) || 0xfffd;
        world.create(id, {glyph, x, y});
        x++;
        continue;

    }

    /** @param {string} kind */
    function nextID(kind) {
      let count = kindCounts.get(kind) || 1;
      let id = `${kind}${count}`;
      while (world.scene.has(id))
        id = `${kind}${++count}`;
      kindCounts.set(kind, count);
      return id;
    }

  }

});

function makeTestWorld() {
  /** @type {Map<string, Point>} */
  const scene = new Map();

  /** @type {Map<string, number>} */
  const glyphs = new Map();

  /** @type {Set<string>} */
  const mmInvalid = new Set();

  /** @type {ROMortonMap<string>} */
  const spatial = makeMortonMap(() => /*
    * NOTE: can do any initial load here, but this application has been
    * designed to not need any since the index is constructed before any entity
    * creation
    */
    sm => {
      // NOTE: the init function also gets sm, and the freshener could just
      // close over that reference, but it also gets it passed for convenience

      if (!scene.size) {
        sm.clear();
      } else for (const id of mmInvalid) {
        const p = scene.get(id);
        if (p == undefined)
          sm.delete(id);
        else
          sm.set(id, p);
      }
      mmInvalid.clear();
    });

  return Object.freeze({
    // data exposure for test access, normally this shouldn't be here
    scene,
    spatial,
    glyphs,

    /**
     * @param {string} id
     * @param {object} spec
     * @param {number} spec.glyph
     * @param {number} spec.x
     * @param {number} spec.y
     */
    create(id, {glyph, x, y}) {
      scene.set(id, {x, y});
      glyphs.set(id, glyph);
      mmInvalid.add(id);
    },

    /** @param {string} id */
    delete(id) {
      scene.delete(id);
      glyphs.delete(id);
      mmInvalid.add(id);
    },

    clear() {
      scene.clear();
      glyphs.clear();
    },

    /**
     * @param {string} id
     * @param {Partial<Point>} to
     */
    move(id, to) {
      const {x: px=0, y: py=0} = scene.get(id) || {};
      const {x=px, y=py} = to;
      scene.set(id, {x, y});
      mmInvalid.add(id);
    },

  });
}

/// TODO utilities to move into an import able module

/** @param {Rect} r */
function makeViewport({x: atx, y: aty, w, h}) {
  let stride = w + 2;
  let codes = new Uint32Array(h * stride - 1);
  clear();

  function clear() {
    codes.fill(0x20);
    for (let i = stride-1; i < codes.length; i += stride)
      codes[i] = 0x0a;
  }

  /** @param {Point} p */
  function loc({x, y}) {
    x -= atx, y -= aty;
    if (x < 0 || x > w) return NaN;
    if (y < 0 || y > h) return NaN;
    return y * stride + x;
  }

  return Object.freeze({
    get bounds() { return {x: atx, y: aty, w, h} },
    set bounds(r) {
      const oldSize = w * h;
      ({x: atx, y: aty, w, h} = r);
      const newSize = w * h;
      if (newSize != oldSize) {
        stride = w + 2;
        codes = new Uint32Array(h * stride - 1);
      }
      clear();
    },

    clear,
    toString() { return String.fromCodePoint(...codes) },

    /** @param {Point} p */
    has(p) { return !isNaN(loc(p)) },

    /** @param {Point} p */
    get(p) {
      const i = loc(p);
      return isNaN(i) ? undefined : codes[i];
    },

    /** @param {Point} p @param {number} code */
    set(p, code) {
      const i = loc(p);
      if (!isNaN(i)) codes[i] = code;
    },

    /** @param {Point} p @param {(prior: number) => number} f */
    update(p, f) {
      const i = loc(p);
      if (!isNaN(i)) codes[i] = f(codes[i]);
    },

  });
}

/** @param {number} code */
function ucode(code) {
    return `U+${code.toString(16).padStart(4, '0')}`;
}
