// @ts-check

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
  buildCard=(card, i, cards) => `
    <div class="card ${className} ${className}-${card.id}" style="--flip: 0deg; z-index: ${cards.length - i++}">
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
   * @param {Event} ev
   */
  handleEvent(ev) {
    if (ev.type == 'click' && ev instanceof MouseEvent) {
      const {target} = ev;
      if (!(target instanceof Element)) return;

      const cardEl = root(target, el => el.classList?.contains('card'));
      if (cardEl) return this.clickCard(ev, cardEl);
    }
  }

  /**
   * @param {MouseEvent} _ev
   * @param {Element} cardEl
   */
  clickCard(_ev, cardEl) {
    if (cardEl instanceof HTMLElement) {
      const style = getComputedStyle(cardEl);
      const value = style.getPropertyValue('--flip')?.trim();
      cardEl.style.setProperty('--flip', value == '180deg' ? '0deg' : '180deg');
    }
  }
}
