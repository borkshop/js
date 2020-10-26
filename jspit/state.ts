export function readHashFrag():string|null {
  const parts = window.location.hash.split(';');
  const frag = parts.shift();
  return frag ? frag.replace(/^#+/, '') : null;
}

export function setHashFrag(frag:string) {
  const parts = window.location.hash.split(';');
  const expected = '#' + frag;
  if (parts.length && parts[0] === expected) return;
  window.location.hash = expected;
}

export function readHashVar(name:string):string|null {
  const parts = window.location.hash.split(';');
  parts.shift();
  const prefix = name + '=';
  for (const part of parts) if (part.startsWith(prefix))
    return unescape(part.slice(prefix.length));
  return null;
}

export function setHashVar(name:string, value:string|null) {
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
