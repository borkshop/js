function isThing(obj) {
  return !!obj && (typeof obj === 'object' || typeof obj === 'function');
}
function isAcceptor(obj) { return isThing(obj) && typeof obj.accept === 'function'; }
function isInvoker(obj) { return isThing(obj) && typeof obj.invoke === 'function'; }
function isGenerator(obj) { return isThing(obj) && typeof obj.next === 'function'; }

class Acceptor {
  static either(a, b) {
    if (isAcceptor(a)) {
      const ack = a.accept(b);
      if (ack !== undefined) return ack;
    }
    if (isAcceptor(b)) {
      const ack = b.accept(a);
      if (ack !== undefined) return ack;
    }
    return undefined;
  }
}

function* starMap(xs, f) {
  for (const x of xs) {
    const y = f(x);
    if (isGenerator(y) || Array.isArray(y)) yield* y;
    else yield y;
  }
}

function resolve(frontier, value) {
  if (value === undefined || value === null)
    return undefined;
  frontier = Array
    .from(starMap(frontier, item => Acceptor.either(item, value)))
    .filter(x => x != null);
  if (frontier.length == 0) return null;
  if (frontier.length > 1) return frontier;
  value = frontier[0];
  if (isInvoker(value)) value = value.invoke();
  return value != null ? [value] : null;
}

function withElements(selectors, f) {
  return {
    selectors,
    elements: [],
    *accept(value) {
      const selector = this.selectors[this.elements.length];
      if (selector) {
        if (value instanceof Event)
          value = value.target;
        for (let el = value; el && el instanceof Element; el = el.parentNode)
          if (el.matches(selector)) {
            const elements = this.elements.concat([el]);
            const invoke = elements.length >= this.selectors.length && (() => f(elements));
            yield {...this, elements, invoke};
          }
      }
    },
  }
}


