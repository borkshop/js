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
  dt.setData('application/json', json);
}

/**
 * @param {DataTransfer|null} dt
 * @returns {{type: string} & Object<string,any>|null}
 */
function getTypedData(dt) {
  if (!dt) return null;
  let parseErr = null;

  const json = dt.getData('application/json');
  if (typeof json == 'string' && json) {
    try {
      return JSON.parse(json);
    } catch(error) {
      parseErr = {type: 'error', error};
    }
  }

  const url = dt.getData('URL');
  if (typeof url == 'string' && url) {
    const match = /data:application\/json(;base64)?,(.+)/.exec(url);
    if (!match) return {type: 'link', url};
    const json = match[1] ? atob(match[2]) : match[2];
    try {
      return JSON.parse(json);
    } catch(error) {
      parseErr = parseErr || {type: 'error', error};
    }
  }

  if (parseErr) return parseErr;

  const text = dt.getData('text/plain');
  if (typeof text == 'string' && text) {
    return {type: 'text', text};
  }

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
        if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
        ev.preventDefault();
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

        const pileEl = root(target, el => el.classList?.contains('card-pile'));
        if (pileEl) return this.clickPile(ev, pileEl);

        const cardEl = root(target, el => el.classList?.contains('card'));
        if (cardEl) return this.clickCard(ev, cardEl);
        break;

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
    const elementId = this.elId(target);
    const {offsetX: x, offsetY: y} = ev;
    const dragOffset = {x, y};
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
  handleDrop(target, dt, ev) {
    const data = getTypedData(dt);
    if (data?.type == 'card') {
      let {elementId, dragOffset} = data;
      const dropEl = typeof elementId == 'string' && document.getElementById(elementId);
      if (!dropEl) return false;

      // TODO if target is card, convert to singleton pile
      // TODO if target is pile, insert at top
      // TODO if target is place, occupy

      // TODO maybe with grid snap
      const {offsetX: x, offsetY: y} = ev;
      const dx = typeof dragOffset?.x == 'number' ? dragOffset.x : 0;
      const dy = typeof dragOffset?.y == 'number' ? dragOffset.y : 0;
      // TDOD offset seems a little off

      // TODO update ex-parent: decrement pile depth; maybe erase if singleton
      dropEl.parentNode?.removeChild(dropEl);

      target.appendChild(dropEl);
      dropEl.style.left = `${x-dx}px`;
      dropEl.style.top = `${y-dy}px`;

      if (dropEl.matches('.card') &&
          getComputedStyle(dropEl).getPropertyValue('--flip')?.trim() == '0deg')
        setTimeout(() => this.flipCard(dropEl), 0);

      return true;
    }
    return false;
  }

  /**
   * @param {MouseEvent} ev
   * @param {Element} el
   */
  clickPile(ev, el) {
    if (el instanceof HTMLElement) {
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
