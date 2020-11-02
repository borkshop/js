/**
 * @returns {string|null}
 */
export function readHashFrag() {
  const parts = window.location.hash.split(';');
  const frag = parts.shift();
  return frag ? frag.replace(/^#+/, '') : null;
}

/**
 * @param {string} frag
 * @returns {void}
 */
export function setHashFrag(frag) {
  const parts = window.location.hash.split(';');
  const expected = '#' + frag;
  if (parts.length && parts[0] === expected) return;
  window.location.hash = expected;
}

/**
 * @param {string} name
 * @returns {string|null}
 */
export function readHashVar(name) {
  const parts = window.location.hash.split(';');
  parts.shift();
  const prefix = name + '=';
  for (const part of parts) if (part.startsWith(prefix))
    return unescape(part.slice(prefix.length));
  return null;
}

/**
 * @param {string} name
 * @param {string|null} value
 * @returns {void}
 */
export function setHashVar(name, value) {
  const parts = window.location.hash.split(';');
  const frag = parts.shift() || '#;';
  const prefix = name + '=';
  let res = [frag];
  let found = false;
  for (const part of parts)
    if (!part.startsWith(prefix)) {
      res.push(part);
    } else if (value !== null && !found) {
      res.push(prefix + escape(value));
      found = true;
    }
  if (value !== null && !found)
    res.push(prefix + escape(value));
  window.location.hash = res.join(';');
}
