import {frameDeltas} from 'domkit/anim';
import {mustFind} from 'domkit/wiring';

import * as boopworld from 'boopworld';

const {
  makeInput,
  makeShard,
  behavior,
  thunkWait,
  build: {
    makeLexicon,
    // TODO procedures like like rect, first, where, hallCreator,
    fromString, // ... rather than (just) pictoral loading
  },
} = boopworld;

const
  viewel = mustFind('#view'),
  spinel = mustFind('#spinner'),
  blabel = mustFind('#blabla');

const player = makeInput();
document.body.addEventListener('keypress', ({key}) => player.provide({key}));

const playerMind = behavior.all(
  behavior.updateView,

  // TODO would be nice to have this integrated into that standard view
  // updating thunk, or some such...
  ({time, memory: {view}}) => {
    viewel.innerText = view.toString();
    return thunkWait({time: time+1});
  },

  behavior.inputParser(/* NOTE: may pass a custom mapper here, default is WASD */),
);

/** @param {boopworld.ShardCtl} ctl */
function build(ctl) {
  const {root} = ctl;

  const lexicon = makeLexicon();

  lexicon.define(root.create({
    glyph: '·', // ·⦁⦂⦙⦚ etc other fences in misc math syms
    zIndex: 1,
    isVisible: true,
    isSolid: false,
  }));
  lexicon.define(root.create({
    glyph: '#',
    zIndex: 8,
    isVisible: true,
    isSolid: true,
  }), '·');

  /** @type {boopworld.Interaction} */
  function doorBoop({subject}) {
    const closed = subject.isSolid;
    subject.isSolid = !closed;
    subject.glyph = closed ? '-' : '+';
  };

  const door = root.create({
    glyph: '+',
    zIndex: 9,
    isVisible: true,
    isSolid: true,
    interact: doorBoop,
  });
  lexicon.define(door, '·');
  lexicon.define(door.create({glyph: '-', isSolid: false}), '·');

  const char = root.create({
    glyph: 'X',
    zIndex: 16,
    isVisible: true,
    isSolid: true,
  });
  lexicon.define(char, '·');

  // build world from string literal
  fromString(lexicon.create, {x: 0, y: 0}, [

    //   '0123456789abcdef0123456789
    /*0*/'########',
    /*1*/'#······#',
    /*2*/'#······#',
    /*3*/'#······##########',
    /*4*/'#······+········#',
    /*5*/'#······########·#',
    /*6*/'#······#·#### #·#',
    /*7*/'########····###·#',
    /*8*/'       ###···##·#',
    /*9*/'      ##···#··#·#',
    /*a*/'     ##··## ###+########',
    /*b*/'     #····# #··········#',
    /*c*/'     #····# #··········#',
    /*d*/'     ##··## #··········#',
    /*e*/'      ####  ############',

  ].join('\n'));

  // modify a couple walls to be hidden doors
  for (const p of [
    {x: 7, y: 6},
    {x: 13, y: 10},
  ]) for (const ent of ctl.at(p))
    if (ent.glyph == '#') ent.interact = doorBoop;

  char.create({
    location: {x: 1, y: 1},
    name: "player",
    glyph: '@',
    input: player.bind,
    mind: playerMind,
  });

  char.create({
    location: {x: 22, y: 13},
    name: "antagonist",
    glyph: 'D',
    mind: behavior.wander,
  });

  lexicon.destroy();
}

/** @typedef {{[name: string]: boopworld.ViewportRead<any>}} logViews */
/** @typedef {{[name: string]: boopworld.Event[]}} logEvents */

/**
 * @typedef {(
 *   | {events: logEvents}
 *   | {views: logViews}
 * )} logEntry
 * // TODO entry to capture view state
 */

/** @type {null|{time: number, json: string}[]} */
let log = null;

/**
 * @param {number} time
 * @param {logEntry[]} ents
 */
function appendLogEntries(time, ...ents) {
  if (log)
    for (const ent of ents)
      log.push({time, json: JSON.stringify(ent)});
}

function startRecording() {
  if (log) return;

  blabel.querySelectorAll('details').forEach(el => { el.open = false });
  spinel.classList.add('record');
  spinel.addEventListener('click', stopRecording);

  log = [
    // TODO capture starting state in an initial entry; requires shard serialization
  ];
}

function stopRecording() {
  if (!log) return;

  spinel.removeEventListener('click', stopRecording);
  spinel.classList.remove('record');

  const logged = new File(Array.from(starmap(
    ({time, json}) => [`{"time":${time},`, json.slice(1, -1), '}\n'],
    log,
  )), 'shard_log.ndjson', {
    type: 'application/x-ndjson',
  });
  log = null;

  window.location.href = URL.createObjectURL(logged);
}

/** @param {boopworld.ShardCtl} ctl */
function collectLogEntries(ctl) {
  if (!log) return;

  const {time} = ctl;
  const lastTime = log[log.length-1]?.time;
  if (lastTime >= time) return;

  /** @type {logEvents} */
  const events = {};
  for (const [ent, ev] of ctl.events()) {
    const {name} = ent;
    if (!name) continue;
    const evs = name in events ? events[name] : events[name] = [];
    evs.push(ev);
  }

  /** @type {logViews} */
  const views = {};
  for (const ent of ctl.entities({hasMind: true})) {
    const {name} = ent;
    if (!name) continue;
    const mind = ent.mindState;
    if (!mind) continue;
    views[name] = mind.ctx.memory.view;
  }

  appendLogEntries(time, {events}, {views});
}

async function main() {
  const hash = new Map(hashEntries());
  if (hash.has('record')) startRecording();

  const shard = makeShard({
    seed: 0xdeadbeef,
    build,

    control: log ? collectLogEntries : undefined,
    // TODO other control things like:
    // - live edit / hacking
    // - dump reaps
    // - introspect mind state

  });

  const spin = spinner(
    ...bounce(['⟢', '⟡', '⟣'], 7, {rate: 4}),
    // ...bounce(['⬖', '⬗', '⬘', '⬙'], 7, {rate: 3}),
    // ...bounce(['⠂', '⠈', '⠂', '⠠', '⠠'], 7, {rate: 3}),
  );

  const frameTimeout = 10;
  for await (const _dt of frameDeltas()) {
    shard.update(performance.now() + frameTimeout);
    spinel.innerText = spin.next().value;
  }
}

main();

/** @returns {Generator<[string, string]>} */
function *hashEntries() {
  for (const token of hashTokens()) {
    const match = /^([^=]+)=(.*)$/.exec(unescape(token));
    const [key, val] = match || [token, ''];
    yield [key, val];
  }
}

function *hashTokens() {
  const {location: {hash}} = window;
  if (!hash.startsWith('#')) return;
  for (const match of hash.slice(1).matchAll(/[;&]?([^;&]*)/g))
    if (match[1].length) yield unescape(match[1]);
}

/**
 * @template T, V
 * @param {(t: T) => Iterable<V>} f
 * @param {Iterable<T>} items
 * @returns {Generator<V>}
 */
function *starmap(f, items) {
  for (const item of items)
    yield* f(item);
}

/** @param {string[]} parts */
function spinner(...parts) {
  let i = 0;
  const self = Object.freeze({
    /** @returns {IteratorYieldResult<string>} */
    next() {
      i = (i + 1) % parts.length;
      const value = parts[i];
      return {value};
    },
    [Symbol.iterator]() { return self },
  });
  return self;
}

/**
 * @param {string|Iterable<string>} bit
 * @param {number} width
 * @param {object} [params]
 * @param {string} [params.pad]
 * @param {number} [params.rate]
 */
function *bounce(bit, width, {
  pad=' ',
  rate=1,
}={}) {
  if (typeof bit == 'string') bit = forever(bit);
  let it = bit[Symbol.iterator]();
  function nextBit() {
    for (let sanity = 2; sanity-->0;) {
      const res = it.next();
      if (!res.done) return res.value;
      it = bit[Symbol.iterator]();
    }
    return '';
  }
  for (let loc = 0; loc < width; loc++)
    for (let i=0; i<rate; i++)
      yield `${pad.repeat(loc)}${nextBit()}${pad.repeat(width-loc)}`
  for (let loc = width-1; loc >= 0; loc--)
    for (let i=0; i<rate; i++)
      yield `${pad.repeat(loc)}${nextBit()}${pad.repeat(width-loc)}`
}

/** @template T @param {T} value @returns {Generator<T>} */
function *forever(value) { for (;;) yield value }
