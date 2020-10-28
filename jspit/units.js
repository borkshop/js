/**
 * @typedef {{value:number, unit:string}} ParsedUnit
 * @param {string} s
 * @param {string[]} units
 * @return {ParsedUnit|null}
 */
export function parseUnit(s, ...units) {
  for (const unit of units) if (!unit || s.endsWith(unit)) {
    const value = parseFloat(s);
    return {value, unit}
  }
  return null;
}
/**
 * @param {string} s
 * @return {ParsedUnit|null}
 */
export function parseAngle(s) {
  return parseUnit(s, 'deg', 'grad', 'rad', 'turn');
}

/**
 * @param {ParsedUnit|null} angle
 * @return {number}
 */
export function toRad(angle) {
  switch (angle?.unit) {
    case 'rad':  return angle.value;
    case 'turn': return angle.value * Math.PI * 2;
    case 'deg':  return angle.value / 180 * Math.PI;
    case 'grad': return angle.value / 200 * Math.PI;
  }
  return NaN;
}

/**
 * @param {string} s
 * @return {number}
 */
export function parsePercent(s) {
  const u = parseUnit(s, '%', '');
  if (!u) return NaN;
  if (u.unit === '%') return u.value / 100;
  return u.value;
}

