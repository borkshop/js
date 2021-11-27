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

const player = makeInput();
document.body.addEventListener('keypress', ({key}) => player.provide(key));

const playerMind = behavior.all(
  behavior.updateView,

  // TODO would be nice to have this integrated into that standard view
  // updating thunk, or some such...
  ({time, memory: {view}}) => {
    const viewTo = document.getElementById('view');
    if (viewTo) viewTo.innerText = view.toString();
    return thunkWait({time: time+1});
  },

  behavior.inputParser(/* NOTE: may pass a custom mapper here, default is WASD */),
);

/** @param {boopworld.ShardCtl} ctl */
function buildWorld(ctl) {
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
  const doorBoop = ctx => {
    const {subject} = ctx;
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

const shard = makeShard({
  seed: 0xdeadbeef,
  build(ctl) { buildWorld(ctl) },

  // TODO control(ctl) can do things like:
  // - debug hooks / inspection / hacking
  // - dump reaps
  // - introspect mind state

});

async function main() {
  const spin = spinner(
    ...bounce(['⟢', '⟡', '⟣'], 7, {rate: 4}),
    // ...bounce(['⬖', '⬗', '⬘', '⬙'], 7, {rate: 3}),
    // ...bounce(['⠂', '⠈', '⠂', '⠠', '⠠'], 7, {rate: 3}),
  );

  const frameTimeout = 10;
  while (await nextFrame()) {
    shard.update(Date.now() + frameTimeout);

    const view = document.getElementById('view');
    if (!view) return;

    const spinel = document.getElementById('spinner');
    if (spinel) spinel.innerText = spin.next().value;
  }
}

main();

/** @return {Promise<number>} */
function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(resolve));
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
