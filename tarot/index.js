// @ts-check

/**
 * @param {Element} el
 * @returns {string}
 */
function elementIdSpace(el) {
  let space = '';
  for (const name of el.classList) {
    if (name.indexOf('-') >= 0) continue;
    if (space) space += '-';
    space += name;
  }
  return space;
}

/**
 * @param {DataTransfer|null} dt
 * @param {string} type
 * @param {Object<string,any>} dat
 */
function setTypedData(dt, type, dat) {
  if (!dt) return;
  const json = JSON.stringify({...dat, type});
  dt.setData('text/uri-list', `data:application/json;base64,${btoa(json)}`);
  dt.setData(`application/json;type=${type}`, json);
}

/**
 * @param {DataTransfer|null} dt
 * @returns {string}
 */
function hasTypedData(dt) {
  if (!dt) return '';
  for (const type of dt.types) {
    const match = /application\/json;type=([^,;]+)/.exec(type);
    if (match) return match[1]
  }
  for (const json of typedDataBlobs(dt)) {
    try {
      const data = JSON.parse(json);
      if (typeof data == 'object' && data?.type == 'string')
        return data.type;
    } catch(error) {
      continue;
    }
  }
  return '';
}

/**
 * @param {DataTransfer} dt
 * @param {string[]} types
 * @returns {IterableIterator<string>}
 */
function* typedDataBlobs(dt, ...types) {
  for (const type of types) {
    const json = dt.getData(`application/json;type=${type}`);
    if (typeof json == 'string' && json) yield json;
  }

  const json = dt.getData('application/json');
  if (typeof json == 'string' && json) yield json;

  const url = dt.getData('URL');
  if (typeof url == 'string' && url) {
    const match = /data:application\/json(;base64)?,(.+)/.exec(url);
    if (match) yield match[1] ? atob(match[2]) : match[2];
  }
}

/**
 * @param {DataTransfer|null} dt
 * @param {string[]} types
 * @returns {null|{type: string} & Object<string,any>}
 */
function getTypedData(dt, ...types) {
  if (!dt) return null;
  console.log('? get json', dt.types);

  /** @type {null|{type: string} & Object<string, any>} */
  let fallback = null;
  for (const json of typedDataBlobs(dt, ...types)) {
    let data = null;
    try {
      data = JSON.parse(json);
    } catch(error) {
      fallback = fallback || {type: 'error', error};
      continue;
    }

    // must have an object
    if (typeof data != 'object' || !data) {
      fallback = fallback || {type: 'error', error: 'json data is not an object'};
      continue;
    }

    // with a type string
    if (data.type != 'string') {
      if (!types.length && !fallback) fallback = data;
      continue;
    }

    // that matches any given type arg
    if (types.length && !types.includes(data.type)) continue;

    return data;
  }
  if (fallback) return fallback;

  const url = dt?.getData('URL');
  const text = dt?.getData('text/plain');

  if (typeof url == 'string' && url) return {type: 'link', text, url};
  if (typeof text == 'string' && text) return {type: 'text', text};

  return null;
}

/**
 * @param {Element} el
 * @returns {Object<string, any>|null}
 */
function getCardData(el) {
  let dat = null
  if (el instanceof HTMLElement && el.dataset['card']) {
    try {
      dat = JSON.parse(atob(el.dataset['card']));
    } catch(e) {
    }
    if (typeof dat != 'object' || Array.isArray(dat)) dat = null;
  }
  return dat;
}

/**
 * @typedef {Object} Card
 * @property {string} id
 * @property {string} title
 */

export const smithDeck = {
  cards: [
    {id: 'ar00', title: 'The Fool'},
    {id: 'ar01', title: 'The Magician'},
    {id: 'ar02', title: 'The High Priestess'},
    {id: 'ar03', title: 'The Empress'},
    {id: 'ar04', title: 'The Emperor'},
    {id: 'ar05', title: 'The Hierophant'},
    {id: 'ar06', title: 'The Lovers'},
    {id: 'ar07', title: 'The Chariot'},
    {id: 'ar08', title: 'Strength'},
    {id: 'ar09', title: 'The Hermit'},
    {id: 'ar10', title: 'Wheel of Fortune'},
    {id: 'ar11', title: 'Justice'},
    {id: 'ar12', title: 'The Hanged Man'},
    {id: 'ar13', title: 'Death'},
    {id: 'ar14', title: 'Temperance'},
    {id: 'ar15', title: 'The Devil'},
    {id: 'ar16', title: 'The Tower'},
    {id: 'ar17', title: 'The Star'},
    {id: 'ar18', title: 'The Moon'},
    {id: 'ar19', title: 'The Sun'},
    {id: 'ar20', title: 'Judgement'},
    {id: 'ar21', title: 'The World'},
  ].concat(...[
    ['cu', `Cups`],
    ['pe', 'Pentacles'],
    ['sw', `Swords`],
    ['wa', 'Cups'],
  ].map(([idSpace, suit]) => [
    {id: `${idSpace}ac`, title: `Ace of ${suit}`},
    {id: `${idSpace}02`, title: `Two of ${suit}`},
    {id: `${idSpace}03`, title: `Three of ${suit}`},
    {id: `${idSpace}04`, title: `Four of ${suit}`},
    {id: `${idSpace}05`, title: `Five of ${suit}`},
    {id: `${idSpace}06`, title: `Six of ${suit}`},
    {id: `${idSpace}07`, title: `Seven of ${suit}`},
    {id: `${idSpace}08`, title: `Eight of ${suit}`},
    {id: `${idSpace}09`, title: `Nine of ${suit}`},
    {id: `${idSpace}10`, title: `Ten of ${suit}`},
    {id: `${idSpace}pa`, title: `Page of ${suit}`},
    {id: `${idSpace}kn`, title: `Knight of ${suit}`},
    {id: `${idSpace}qu`, title: `Queen of ${suit}`},
    {id: `${idSpace}ki`, title: `King of ${suit}`},
  ])),
  className: 'rws',
  /** @param {Card} card */
  buildCardFront: ({id, title}) => `<img class="card-front" draggable="false" alt="${title}" src="www.sacred-texts.com/tarot/pkt/img/${id}.jpg">`,
  buildCardBack: () => '<img class="card-back" draggable="false" src="www.sacred-texts.com/tarot/pkt/img/verso.jpg">',
  // icon: `www.sacred-texts.com/tarot/pkt/tn/${id}.jpg`,
};

/**
 * @typedef {object} Deck
 * @property {Card[]} cards
 * @property {string} className
 * @property {(card: Card) => string} buildCardFront
 * @property {(card: Card) => string} buildCardBack
 * @property {(card: Card, i: number, cards: Card[]) => string} buildCard
 */

/**
 * @param {Deck} deck
 */
export function buildCards({
  cards,
  className,
  buildCardFront=() => '<div class="card-front"></div>',
  buildCardBack=() => '<div class="card-back"></div>',
  buildCard=(card, i) => `
    <div class="card ${className} ${className}-${card.id}" data-card="${btoa(JSON.stringify({...card, index: i}))}" draggable="true" style="--flip: 0deg">
      ${buildCardFront(card)}${buildCardBack(card)}
    </div>
  `,
}) {
  return `<div class="card-pile">${
    cards.map(buildCard).join('')
  }</div>`;
}

/**
 * @param {Element} el
 * @param {(el: Element) => boolean} where
 * @returns {Element|null}
 */
function root(el, where) {
  /** @type {Element|null} */
  let last = null;
  /** @type {Node|null} */
  let node = el;
  for (; node; node=node.parentNode)
    if (node instanceof Element && where(node)) last = node;
  return last;
}

/**
 * @param {Element} el
 * @param {Object<string, string>} typedSelectors
 * @returns {null|{type: string, el: Element}}
 */
function rootify(el, typedSelectors) {
  for (const [type, selector] of Object.entries(typedSelectors)) {
    const rootEl = root(el, e => e.matches(selector));
    if (rootEl) return {type, el: rootEl};
  }
  return null;
}

/**
 * @param {Node} n
 * @returns {boolean}
 */
function isEmpty(n) {
  if (!n.childNodes.length) return true;
  for (const cn of n.childNodes) {
    if (cn.nodeType == cn.COMMENT_NODE) continue;
    if (cn.nodeType != cn.TEXT_NODE) return false;
    if (cn.textContent?.trim().length) return false;
  }
  return true;
}

export class Controller {
  /**
   * @param {HTMLElement} root
   * @param {Deck} deck
   */
  constructor(root, deck) {
    this.root = root;
    this.deck = deck;
    for (const eventType of [
      'click',
      'dragstart',
      // 'drag',
      // 'dragend',
      // 'dragenter',
      // 'dragleave',
      'dragover',
      'drop',
    ]) this.root.addEventListener(eventType, this);
    this.root.innerHTML = buildCards(this.deck);
  }

  /** @type {Map<string, number>} */
  idCounter = new Map()

  /**
   * @param {Element} el
   */
  elId(el) {
    if (!el.id) {
      const idSpace = elementIdSpace(el);
      const n = (this.idCounter.get(idSpace) || 0) + 1;
      this.idCounter.set(idSpace, n)
      el.id = `${idSpace}_${n}`;
    }
    return el.id;
  }

  /**
   * @param {Event} ev
   */
  handleEvent(ev) {
    if (ev instanceof DragEvent) {
      const {type, target} = ev;
      if (!(target instanceof Element)) return;
      switch (type) {

      case 'dragstart':
        if (!ev.dataTransfer || !this.startDrag(target, ev.dataTransfer, ev))
          ev.preventDefault();
        break;

      case 'dragover':
        if (ev.dataTransfer && this.mayDrop(target, ev.dataTransfer, ev)) {
          ev.dataTransfer.dropEffect = 'move';
          ev.preventDefault();
        }
        break;

      case 'drop':
        if (!ev.dataTransfer || !this.handleDrop(target, ev.dataTransfer, ev))
          ev.preventDefault();
        break;
      }
      return;
    }

    if (ev instanceof MouseEvent) {
      switch (ev.type) {

      case 'click':
        const {target} = ev;
        if (!(target instanceof Element)) return;

        const root = rootify(target, {
          pile: '.card-pile',
          card: '.card',
        });
        switch (root?.type) {
        case 'pile': return this.clickPile(ev, root.el);
        case 'card': return this.clickCard(ev, root.el);
        }

        break;

      default:
        console.log('wat mouse', ev.type, ev);
      }
      return;
    }
  }

  /**
   * @param {Element} target
   * @param {DataTransfer} dt
   * @param {MouseEvent} ev
   * @returns {boolean}
   */
  startDrag(target, dt, ev) {

    const {offsetX: x, offsetY: y} = ev;
    const dragOffset = {x, y};

    const pile = root(target, el => el.matches('.card-pile'));
    if (pile) {
      /** @type {Element[]} */
      const cards = (Array.from(pile.childNodes)
        .filter(n => n instanceof Element && n.matches('.card')));
      const {offsetX, offsetY} = ev;
      const {clientWidth, clientHeight} = target;
      const p = Math.max(offsetX / clientWidth, offsetY / clientHeight);
      const n = Math.max(1, Math.round(p * cards.length));
      const take = cards.slice(0, n);
      setTypedData(dt, 'pile', {
        cards: take.map(el => getCardData(el)),
        elementIds: take.map(el => this.elId(el)),
        dragOffset,
      });
      return true;
    }


    const elementId = this.elId(target);
    const cardData = getCardData(target);
    if (cardData) {
      setTypedData(dt, 'card', {card: cardData, elementId, dragOffset});
      if (typeof cardData.title == 'string' && cardData.title)
        dt.setData('text/plain', cardData.title);
    } else {
      setTypedData(dt, 'element', {elementId, dragOffset});
    }

    return true;
  }

  /**
   * @param {Element} target
   * @param {DataTransfer} dt
   * @param {MouseEvent} ev
   * @returns {boolean}
   */
  mayDrop(target, dt, ev) {
    // TODO target X type filter

    // const root = rootify(target, {
    //   pile: '.card-pile',
    //   card: '.card',
    // });
    // switch (root?.type) {
    // case 'pile': return this.clickPile(ev, root.el);
    // case 'card': return this.clickCard(ev, root.el);
    // }

    const type = hasTypedData(dt);
    console.log('drop', type);
    return true;
  }

  /**
   * @param {Element} target
   * @param {DataTransfer} dt
   * @param {MouseEvent} ev
   * @returns {boolean}
   */
  handleDrop(target, dt, ev) {
    const {type, ...data} = getTypedData(dt) || {type: 'undefined'};

    const dropEl = function() {
      switch (type) {

        case 'card':
          const {elementId} = data;
          if (typeof elementId != 'string') return null;

          const el = document.getElementById(elementId);
          if (!el) return null;

          // TODO update ex-parent: decrement pile depth; maybe erase if singleton
          el.parentNode?.removeChild(el);

          return el;

        case 'pile':
          let {elementIds} = data;
          if (!Array.isArray(elementIds)) return null;

          /** @type {HTMLElement[]} */
          const els = [];
          /** @type {Set<Node>} */
          const pars = new Set();
          for (const elementId of elementIds) {
            if (typeof elementId != 'string') return null;
            const el = document.getElementById(elementId);
            if (!el) return null;
            els.push(el);
            if (el.parentNode) pars.add(el.parentNode);
          }

          // TODO use a deck builder function?
          const pile = document.createElement('div');
          pile.className = 'card-pile';

          for (const el of els) {
            el.parentNode?.removeChild(el);
            pile.appendChild(el);
          }

          for (const par of pars)
            if (isEmpty(par)) par.parentNode?.removeChild(par);

          return pile;

        default:
          console.log('TODO handle drop', type, data, target);
          return null;

      }
    }();
    if (!dropEl) return false;

    // TODO if target is card, convert to singleton pile
    // TODO if target is pile, insert at top
    // TODO if target is place, occupy
    target.appendChild(dropEl);

    const {dragOffset} = data;
    const dx = typeof dragOffset?.x == 'number' ? dragOffset.x : 0;
    const dy = typeof dragOffset?.y == 'number' ? dragOffset.y : 0;

    // TODO maybe with grid snap
    const {offsetX: x, offsetY: y} = ev;
    // TDOD offset seems a little off

    dropEl.style.left = `${x-dx}px`;
    dropEl.style.top = `${y-dy}px`;

    if (dropEl.matches('.card') &&
        getComputedStyle(dropEl).getPropertyValue('--flip')?.trim() == '0deg')
      setTimeout(() => this.flipCard(dropEl), 0);

    return true;
  }

  /**
   * @param {MouseEvent} ev
   * @param {Element} el
   */
  clickPile(ev, el) {
    if (el instanceof HTMLElement) {
      // if (ev.shiftKey) return this.flipPile(el);
      const card = el.querySelector('.card');
      if (card) return this.clickCard(ev, card);
    }
  }

  /**
   * @param {MouseEvent} _ev
   * @param {Element} el
   */
  clickCard(_ev, el) {
    if (el instanceof HTMLElement) return this.flipCard(el);
  }

  /**
   * @param {HTMLElement} card
   */
  flipCard(card) {
    const style = getComputedStyle(card);
    const value = style.getPropertyValue('--flip')?.trim();
    card.style.setProperty('--flip', value == '180deg' ? '0deg' : '180deg');
  }
}
