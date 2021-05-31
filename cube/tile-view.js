// @ts-check

/**
 * @callback TouchEntityFn
 * @param {number} tile
 */

/**
 * @typedef {Object} TileView
 * @prop {TouchEntityFn} enter
 * @prop {TouchEntityFn} exit
 */

const noop = () => {};

/**
 * @template Element
 * @callback AppendChildFn
 * @param {Element} child
 */

/**
 * @template Element
 * @callback RemoveChildFn
 * @param {Element} child
 */

/**
 * @template Element
 * @typedef {Object} ParentElement
 * @prop {AppendChildFn<Element>} appendChild
 * @prop {RemoveChildFn<Element>} removeChild
 */

/**
 * @template Element
 * @param {ParentElement<Element>} $context
 * @param {(tile: number) => Element} createElement
 * @param {(tile: number) => void} [collectElement]
 * @return {TileView}
 */
export function makeTileView($context, createElement, collectElement = noop) {
  const $tiles = new Map();

  /**
   * @param {number} t
   */
  function enter(t) {
    const $tile = createElement(t);
    $context.appendChild($tile);
    $tiles.set(t, $tile);
  }

  /**
   * @param {number} t
   */
  function exit(t) {
    const $tile = $tiles.get(t);
    if ($tile == null) throw new Error(`Assertion failed: cannot remove absent tile ${t}`);
    $context.removeChild($tile);
    collectElement(t);
  }

  return {enter, exit};
}
