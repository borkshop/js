// @ts-check

/** @typedef {import('./index.js').Card} Card */

import {
  smithDeck,
} from './index.js';

// /**
//  * @param {EventTarget} target
//  * @param {string} type
//  * @returns {Promise<Event>}
//  */
// function once(target, type) {
//   return new Promise(resolve => target.addEventListener(type, resolve, {once: true}))
// }

/**
 * @param {EventTarget} target
 * @param {string[]} types
 * @returns {Promise<Event>}
 */
function once(target, ...types) {
  switch (types.length) {
  case 0:
    return Promise.reject(new Error('no types given'));
  case 1:
    const [type] = types;
    return new Promise(resolve => target.addEventListener(type, resolve, {once: true}));
  }
  return new Promise(resolve => {
    /** @param {Event} ev */
    const handle = ev => {
      resolve(ev);
      cancel();
    };
    const cancel = () => {
      for (const type of types)
        target.removeEventListener(type, handle);
    };
    for (const type of types)
      target.addEventListener(type, handle, {once: true});
  });
}

/**
 * @template T
 * @param {Iterable<T>|IterableIterator<T>} ita
 * @returns {IterableIterator<T>}
 */
function iter(ita) {
  const it = ita[Symbol.iterator]();
  return {
    [Symbol.iterator]() { return this },
    next() { return it.next() }
  };
}

/** @param {string} title */
function definite(title) {
  return title.toLowerCase().startsWith('the ')
    ? title
    : `the ${title}`;
}

/** @param {number} n */
function ordinal(n) {
  switch (n) {
    case 0: return '0th';
    case 1: return '1st';
    case 2: return '2nd';
    case 3: return '3rd';
    default: return `${n}th`;
  }
}

/**
 * @param {RegExp} pattern
 * @param {(match: RegExpExecArray) => void} then
 * @returns {(part: string) => boolean}
 */
function when(pattern, then) {
  return part => {
    const match = pattern.exec(part)
    if (!match) return false;
    then(match);
    return true;
  }
}

/**
 * @param {HTMLElement} el
 * @param {Iterable<string>} parts
 */
function promptdown(el, parts) {
  /** @type {null|HTMLElement} */
  let cur = null;
  for (let i=el.childNodes.length - 1; i >= 0; i--) {
    const node = el.childNodes[i];
    if (node instanceof HTMLElement) cur = node;
  }

  // cur = el.lastElementChild

  const doc = el.ownerDocument;
  /** @type {Array<(part: string) => boolean>} */
  const rules = [
    // ATX heading
    when(/^(#{1-6})\s+(.+)/, match => {
      cur = doc.createElement(`h${match[1].length}`);
      cur.appendChild(doc.createTextNode(match[2])); // TODO render inline
      el.appendChild(cur);
    }),

    // any hash-tagged line, that is not an ATX heading, is new state
    when(/^#[^#\s]/, match => {
      el.dataset['state'] = match[0];
      const tagNames = new Set(['input', 'textarea', 'select', 'button', 'datalist']);
      for (let i=el.childNodes.length - 1; i >= 0; i--) {
        const node = el.childNodes[i];
        if (node instanceof Element &&
            tagNames.has(node.tagName.toLowerCase()))
          el.removeChild(node);
      }
    }),

    // TODO fences
    // TODO blockquote
    // TODO lists

    // TODO rulers
    // TODO setext headers

    // breaks
    part => {
      part = part.trim();
      if (part.length) return false;
      if (cur?.tagName.toLowerCase() == 'p')
        cur = cur.parentElement;
      return true;
    },

    // content content
    part => {
      seek: while (cur) {
        switch (cur.tagName.toLowerCase()) {
          case 'p':
          case 'pre':
            break seek;

          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6':
            cur = cur.parentElement;
            break;

          default:
            cur = cur.appendChild(doc.createElement('p'));
            break seek;
        }
      }
      if (!cur) cur = el.appendChild(doc.createElement('p'));
      cur.appendChild(doc.createTextNode(part));
      return true;
    },
  ];

  for (const part of parts) for (const rule of rules)
    if (rule(part)) break;

  // TODO input event hookup
}

// el => {
//   while (el.childNodes.length)
//     el.removeChild(el.childNodes[0]);
// }

class DeckWorld {
  /**
   * @typedef {Object} DeckCardState
   * @prop {boolean} reversed
   */

  /** @typedef {Card & DeckCardState} DeckCard */

  /**
   * @param {Iterable<Card>} cards
   */
  constructor(cards) {
    // TODO
    // /** @type {Array<null|DeckCard>} */
    // this.table = [];

    this.piles = [
      Array.from(cards).map(card => ({
        ...card,
        reversed: false,
      })),
    ];

    /** @type {null|DeckCard|DeckCard[]} */
    this.hand = null;
  }

  /**
   * @param {string[]} input
   * returns {IterableIterator<string>}
   * @returns {Generator<string>}
   */
  *prompt(...input) {
    yield* imprompt(input, ctx => {
      // TODO table state

      switch(this.piles.length) {
      case 0:
        break;

      case 1:
        if (this.hand == null && ctx.have('Pull a card')) {
          const card = this.piles[0].shift() || null;
          if (!card) {
            ctx.say('Nothing to pull?');
          } else {
            this.hand = card;
            ctx.say(`Pulled ${definite(card.title)} card`);
            return true;
          }
        }

        // TODO for cutting ctx.read()

        ctx.say(`The deck contains ${this.piles[0].length} cards`);
        break;

      default:
        ctx.say(`The deck has been split into ${this.piles.length} piles containing ${this.piles.map(pile => pile.length)} cards each`);
        break;

      }

      if (Array.isArray(this.hand)) {
        ctx.say(`Holding a pile of ${this.hand.length} cards`);
      } else if (this.hand) {
        const {title} = this.hand;
        ctx.say(`Holding ${definite(title)} card`);

        if (ctx.have('Return card...')) {
          ctx.say(`Return ${definite(title)} card to...`);
          // TODO table places

          if (this.piles.length > 1) {
            for (let i=0; i<this.piles.length; i++) {
              if (ctx.have(i == 0
                ? `${i+1}. The Deck (${ordinal(i+1)} pile)`
                : `${i+1}. ${ordinal(i+1)} pile`
              )) {
                this.piles[i].unshift(this.hand);
                this.hand = null;
                ctx.say(`Returned ${definite(title)} card to the ${ordinal(i+1)} pile`);
                break;
              }
            }
          } else if (ctx.have('The Deck')) {
            if (this.piles[0]) {
              this.piles[0].unshift(this.hand);
              ctx.say(`Returned ${definite(title)} card to the deck`);
            } else {
              this.piles[0] = [this.hand];
              ctx.say(`Started deck with ${definite(title)} card`);
            }
            this.hand = null;
          }
        }

      }
      return false;
    })
  }
}

/**
 * @param {Element} cont
 */
export async function main(cont) {
  const doc = cont.ownerDocument;

  cont.appendChild(doc.createElement('h1')).innerText = 'Log';
  const log = cont.appendChild(doc.createElement('ol'));

  cont.appendChild(doc.createElement('h1')).innerText = 'Prompt';
  const prompt = cont.appendChild(doc.createElement('div'));
  const options = cont.appendChild(doc.createElement('ul'));

  const inl = cont.appendChild(doc.createElement('input'));
  inl.type = 'text';
  inl.size = 80;
  inl.value = '';

  function* read() {
    const state = prompt.dataset['state'];
    if (state) yield state;
    yield inl.value;
  }

  /** @param {Iterable<string>} parts */
  function display(parts) {
    console.group('display');
    const it = iter(parts);
    let haveState = false;
    let haveMess = false;
    for (const part of it) {
      if (part.startsWith('#') && !haveState) {
        prompt.dataset['state'] = part;
        console.log('state:', part);
        haveState = true;
        continue;
      }
      prompt.innerText = part;
      console.log('mess:', part);
      haveMess = true;
      break;
    }
    if (!haveState) delete prompt.dataset['state'];
    if (!haveMess) prompt.innerText = '???';
    while (options.childNodes.length)
      options.removeChild(options.childNodes[0]);
    for (const part of it) {
      console.log('option:', part);
      const item = doc.createElement('li');
      item.appendChild(doc.createTextNode(part));
      options.appendChild(item)
    }
    console.groupEnd();
  }

  /** @param {string[]} prior */
  function record(...prior) {
    if (!prompt.textContent && !options.childNodes.length) return;
    const ent = doc.createElement('li');
    for (const value of prior) {
      if (value) ent.appendChild(
        value.startsWith('#')
          ? doc.createTextNode(value)
          : doc.createTextNode(`> ${value}`)
      );
      ent.appendChild(doc.createElement('br'));
    }
    if (prompt.textContent) {
      ent.appendChild(doc.createTextNode(prompt.textContent));
    }
    if (options.childNodes.length) {
      const opts = ent.appendChild(doc.createElement('ul'));
      while (options.childNodes.length)
        opts.appendChild(options.removeChild(options.childNodes[0]));
    }
    log.appendChild(ent);
  }

  const world = new DeckWorld(smithDeck.cards);

  /** @type {string[]} */
  const ins = [];
  for(;;) {
    record(...ins);
    ins.splice(0);
    ins.push(...read());
    display(world.prompt(...ins));
    // TODO better handling wrt inl.type
    inl.value = '';
    inl.focus();
    await once(inl, 'change');
  }
}
