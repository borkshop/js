import { frameDeltas } from 'domkit/anim';
import { mustFind } from 'domkit/wiring';
import { KeyChorder, KeyChordEvent } from 'domkit/input';

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
  spinel = mustFind('#spinner');

const player = makeInput();
const keyChord = new KeyChorder();
document.addEventListener('keydown', keyChord);
document.addEventListener('keyup', keyChord);
keyChord.addEventListener('keychord', ev => {
  if (!(ev instanceof KeyChordEvent)) return;
  const keys = ev.keys.filter(k => k != 'Shift');
  if (keys.length == 1) {
    const [key] = keys;
    const shifted = ev.keys.includes('Shift');
    if (!shifted) player.provide({ key });
    else if (key.length > 1) player.provide({ key: `Shift-${key}` });
    else player.provide({ key: `Shift-${key.toLowerCase()}` });
  }
});

const playerMind = behavior.all(
  behavior.updateView,

  // TODO would be nice to have this integrated into that standard view
  // updating thunk, or some such...
  ({ time, memory: { view } }) => {
    viewel.innerText = view.toString();
    return thunkWait({ time: time + 1 });
  },

  behavior.inputParser(/* NOTE: may pass a custom mapper here, default is WASD */),
);

/** @param {boopworld.ShardCtl} ctl */
function build(ctl) {
  const { root } = ctl;

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
  function doorBoop({ subject }) {
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
  lexicon.define(door.create({ glyph: '-', isSolid: false }), '·');

  const char = root.create({
    glyph: 'X',
    zIndex: 16,
    isVisible: true,
    isSolid: true,
  });
  lexicon.define(char, '·');

  // build world from string literal
  fromString(lexicon.create, { x: 0, y: 0 }, [

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
    { x: 7, y: 6 },
    { x: 13, y: 10 },
  ]) for (const ent of ctl.at(p))
      if (ent.glyph == '#') ent.interact = doorBoop;

  char.create({
    location: { x: 1, y: 1 },
    name: "player",
    glyph: '@',
    input: player.bind,
    mind: playerMind,
  });

  char.create({
    location: { x: 22, y: 13 },
    name: "antagonist",
    glyph: 'D',
    mind: behavior.wander,
  });

  lexicon.destroy();
}

import * as zop from 'zop';

/**
 * @param {string} mark
 * @returns {Promise<void>}
 */
function spinMark(mark) {
  return new Promise(resolve => {
    spinel.classList.add(mark);
    spinel.addEventListener('click', done);
    function done() {
      spinel.removeEventListener('click', done);
      spinel.classList.remove(mark);
      resolve();
    }
  });
}

/** @type {null|ReturnType<zop.makeLogger>} */
let logger = null;

/** @type {null|(() => void)} */
let flushLogs = null;

async function recordLog({ toConsole = false }) {
  logger = null, flushLogs = null;

  let { flush, sink } = zop.makeBuffer();
  flushLogs = () => {
    const blob = new Blob(flush(), { type: 'application/x-ndjson' });
    return blob;
  };

  if (toConsole)
    sink = zop.teeSink(sink, zop.intoLog(console.log));

  logger = zop.makeLogger(sink);
  // TODO capture starting state in an initial entry; requires shard serialization

  await spinMark('record');
  if (flushLogs) {
    window.location.href = URL.createObjectURL(flushLogs());
    // TODO if we capture init state when starting, and if we ever make this
    // non-terminal, re-record current state checkpoint here after flush to
    // start off a new recording session
    logger = null, flushLogs = null;
  }
}

/** @type {Set<string>} */
const loggingNames = new Set();

/**
 * @param {zop.Logger} logger
 * @returns {(ctl: boopworld.ShardCtl) => void}
 */
function logTracer(logger) {

  /** @type {Map<string, {time: number, eventTypes: string[]}>} */
  const last = new Map();

  return ctl => {
    const { time, tick } = ctl;
    const logNow = logger.with({ time, tick });

    for (const name of loggingNames) {
      const ent = ctl.byName(name);
      if (!ent) continue;

      const { mindState: mind } = ent;
      if (!mind) continue;
      const { ctx: { events: mindEvents, memory: { view } } } = mind;

      const events = Array.from(mindEvents());
      const eventTypes = events.map(({ type }) => type);
      const {
        time: lastTime = NaN,
        eventTypes: lastEventTypes = /** @type {string[]} */([]),
      } = last.get(name) || {};
      const skipEvents = time == lastTime
        ? sharedPrefixSize(eventTypes, lastEventTypes)
        : 0;
      last.set(name, { time, eventTypes });

      const theirLog = logNow.with({ name });
      for (const event of events.slice(skipEvents))
        theirLog.log({ event });
      theirLog.log({ view });

    }
  };
}

async function main() {
  const hash = new Map(hashEntries());

  if (hash.has('record')) {
    loggingNames.add(hash.get('record') || 'player');
    recordLog({ toConsole: hash.has('log') });
  } else if (hash.has('log')) {
    loggingNames.add(hash.get('log') || 'player');
    logger = zop.makeLogger(zop.intoLog(console.log));
  }

  const shard = makeShard({
    seed: 0xdeadbeef,
    build,

    trace: logger ? logTracer(logger) : undefined,

    // TODO control things like:
    // - live edit / hacking
    // - dump reaps

  });

  const spin = spinner(
    ...bounce(['⟢', '⟡', '⟣'], 7, { rate: 4 }),
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
function* hashEntries() {
  for (const token of hashTokens()) {
    const match = /^([^=]+)=(.*)$/.exec(unescape(token));
    const [key, val] = match || [token, ''];
    yield [key, val];
  }
}

function* hashTokens() {
  const { location: { hash } } = window;
  if (!hash.startsWith('#')) return;
  for (const match of hash.slice(1).matchAll(/[;&]?([^;&]*)/g))
    if (match[1].length) yield unescape(match[1]);
}

/** @param {string[]} parts */
function spinner(...parts) {
  let i = 0;
  const self = Object.freeze({
    /** @returns {IteratorYieldResult<string>} */
    next() {
      i = (i + 1) % parts.length;
      const value = parts[i];
      return { value };
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
function* bounce(bit, width, {
  pad = ' ',
  rate = 1,
} = {}) {
  if (typeof bit == 'string') bit = forever(bit);
  let it = bit[Symbol.iterator]();
  function nextBit() {
    for (let sanity = 2; sanity-- > 0;) {
      const res = it.next();
      if (!res.done) return res.value;
      it = bit[Symbol.iterator]();
    }
    return '';
  }
  for (let loc = 0; loc < width; loc++)
    for (let i = 0; i < rate; i++)
      yield `${pad.repeat(loc)}${nextBit()}${pad.repeat(width - loc)}`
  for (let loc = width - 1; loc >= 0; loc--)
    for (let i = 0; i < rate; i++)
      yield `${pad.repeat(loc)}${nextBit()}${pad.repeat(width - loc)}`
}

/** @template T @param {T} value @returns {Generator<T>} */
function* forever(value) { for (; ;) yield value }

/**
 * @template T
 * @param {T[]} as
 * @param {T[]} bs
 */
function sharedPrefixSize(as, bs) {
  let i = 0;
  for (; i < as.length && i < bs.length; i++)
    if (as[i] !== bs[i]) break;
  return i;
}
