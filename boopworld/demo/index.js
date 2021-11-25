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
    if (viewTo) viewTo.innerText = trimLines(view.toString());
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

  fromString(lexicon.create, {x: 0, y: 0}, [
    //   '0123456789abdef0123467890
    /*0*/'########',
    /*1*/'#······#',
    /*2*/'#······#',
    /*3*/'#······##########',
    /*4*/'#······+········#',
    /*5*/'#······########·#',
    /*6*/'#······#.#### #·#',
    /*7*/'########....###·#',
    /*8*/'       ###...##·#',
    /*9*/'      ##...#..#·#',
    /*a*/'     ##..## ###+########',
    /*b*/'     #....# #··········#',
    /*c*/'     #....# #··········#',
    /*d*/'     ##..## #··········#',
    /*e*/'      ####  ############',

  ].join('\n'));
  for (const p of [
    {x: 6, y: 7},
    {x: 14, y: 10},
  ]) for (const ent of ctl.at(p))
    if (ent.glyph == '#')
      ent.interact = doorBoop;

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

/** @return {Promise<number>} */
function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(resolve));
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
  const spins = [
    "⠂       ",
    "⠈       ",
    " ⠂      ",
    " ⠠      ",
    "  ⡀     ",
    "  ⠠     ",
    "   ⠂    ",
    "   ⠈    ",
    "    ⠂   ",
    "    ⠠   ",
    "     ⡀  ",
    "     ⠠  ",
    "      ⠂ ",
    "      ⠈ ",
    "       ⠂",
    "       ⠠",
    "       ⡀",
    "      ⠠ ",
    "      ⠂ ",
    "     ⠈  ",
    "     ⠂  ",
    "    ⠠   ",
    "    ⡀   ",
    "   ⠠    ",
    "   ⠂    ",
    "  ⠈     ",
    "  ⠂     ",
    " ⠠      ",
    " ⡀      ",
    "⠠       "
  ];
  let spini = 0;

  const frameTimeout = 10;
  while (await nextFrame()) {
    shard.update(Date.now() + frameTimeout);

    const view = document.getElementById('view');
    if (!view) return;

    const spinner = document.getElementById('spinner');
    if (spinner) spinner.innerText = spins[spini = (spini + 1) % spins.length];
  }
}

main();

/** @param {string} s */
function trimLines(s) {
    let lines = s.split(/\n/);

    // trim header
    for (let i=0; i < lines.length; i++)
        if (!/^ *$/.test(lines[i])) {
            lines.splice(0, i);
            break;
        }

    // trim footer
    for (let i=lines.length-1; i >= 0; i--)
        if (!/^ *$/.test(lines[i])) {
            lines.splice(i+1);
            break;
        }

    // trim left margin
    const pre = lines.map(line => {
        const a = /^ +/.exec(line);
        const pre = a ? a[0].length : 0;
        return pre;
    }).reduce((a, b) => Math.min(a, b));
    if (pre > 0) lines = lines.map(line => line.slice(pre));

    // trim right margin
    const post = lines.map(line => {
        const b = / +$/.exec(line);
        const post = b ? b[0].length : 0;
        return post;
    }).reduce((a, b) => Math.min(a, b));
    if (post > 0) lines = lines.map(line => line.slice(0, -post));

    return lines.join('\n');
}
