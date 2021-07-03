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

// /**
//  * @template T
//  * @param {Iterator<T>} it
//  * @param {null|T} [dflt]
//  * @returns {null|T}
//  */
// function next(it, dflt=null) {
//   const res = it.next();
//   if (!res.done) return res.value;
//   return dflt;
// }

/**
 * @typedef {object} IMPromptContext
 * @prop {(mess: string) => void} say
 * @prop {(option: string) => boolean} have
 * @prop {(mess: string) => boolean} read
 */

class IMPromptor {
  /** @param {string[]} inputs */
  constructor(inputs) {
    if (inputs.length > 0 && inputs[0].startsWith('#')) {
      const [tag, ...rest] = inputs;
      this.under = tag.slice(1).split('_').map(s => parseInt(s))
      this.reboot(...rest);
    } else {
      this.reboot(...inputs);
    }
  }

  /** @param {string[]} inputs */
  reboot(...inputs) {
    console.log('reboot', inputs);
    const [input, ...extra] = inputs;
    this.input = input || '';
    this.extra = extra;
    this.consumed = false;
    this.reset()
  }

  reset() {
    this.id = 0;
    this.desc = '';
    this.pending = false;
    this.reid.splice(0);
    this.options.splice(0);
    this.candidates.splice(0);
  }

  input = ''
  consumed = false
  pending = false

  /** @type {string[]} */
  extra = []

  /** @type {number[]} */
  under = []
  underi = 0

  id = 0
  desc = ''

  /** @type {number[]} */
  reid = []

  /** @type {string[]} */
  candidates = []

  /** @type {string[]} */
  options = []

  /**
   * @param {string} expect -- programmed expectation
   * @param {string} given -- user given input
   */
  matches(expect, given) {
    if (expect.toLowerCase().startsWith(given.toLowerCase())) return true;
    const es = expect.split(/\s+/);
    const gs = given.split(/\s+/);
    let i=0, j=0;
    for (; i<es.length && j<gs.length; i++) {
      if (gs[j].length && es[i].toLowerCase().startsWith(gs[j].toLowerCase()))
        j++; // consume part of given input
      i++; // skip unmatched expectation tokens
    }
    return i >= es.length && j >= gs.length;
  }

  /** @param {string} option */
  have(option) {
    this.id++;

    if (this.under[this.underi] == this.id) {
      this.reid.push(this.id);
      this.underi++;
    } else {
      this.options.push(option);

      const trimmed = this.input.trim();
      if (this.consumed || trimmed != option) {
        console.log('have-not', {
          id: this.under.concat([this.id]).join('_'),
          option,
          input: this.input,
          options: this.options,
        });
        if (trimmed.length && this.matches(option, trimmed))
          this.candidates.push(option);
        this.pending = true;
        return false;
      }

      this.consumed = true;
      this.reid.push(this.id);
    }

    this.pending = false;
    this.options.splice(0);
    this.candidates.splice(0);
    console.log('have', {
      id: this.under.concat([this.id]).join('_'),
      option,
      input: this.input,
      options: this.options,
    });
    return true;
  }

  /**
   * @param {string} mess
   */
  read(mess) {
    if (!this.consumed) {
      this.consumed = true;
      return true;
    }
    this.say(mess);
    this.pending = true;
    return false;
  }

  /** @param {string} mess */
  say(mess) {
    // TODO better handling of ln breaks
    this.desc = this.desc ? `${this.desc}. ${mess}` : mess;
  }

  /**
   * @param {(ctx: IMPromptContext) => boolean} body
   * @returns {Generator<string>}
   */
  *run(body) {
    while (body(this)) {
      console.log('re-run');
      this.reset();
    }

    if (!this.consumed && this.candidates.length) {
      if (this.candidates.length == 1) {
        this.reboot(this.candidates[0], ...this.extra);
        yield* this.run(body);
        return;
      }
      // TODO disambiguation advice
    }

    // TODO auto-invoke singular options?

    console.log({
      pending: this.pending,
      reid_length: this.reid.length,
    });

    if (this.pending && this.reid.length)
      yield `#${this.reid.join('_')}`;
    yield this.desc || 'A void and empty world...'
    yield* this.options;
  }
}

/**
 * @param {string[]} inputs
 * @param {(ctx: IMPromptContext) => boolean} body
 * @returns {Generator<string>}
 */
function* imprompt(inputs, body) {
  yield* new IMPromptor(inputs).run(body);
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
