// @ts-check

/**
 * @return {Promise<number>} - resolves to the current high-res time at the
 * start of the next browser animation frame
 */
export function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(resolve));
}

/**
 * @callback Part - an animation part: a function of elapsed time
 * @param {number} dt - the amount of time elapsed since the last time this callback was called
 * @return {boolean} - true if the animation loop should continue, false to stop it
 */

/**
 * Runs an animate-able function until it stops (returns false).
 * @param {Part} update - an animation function
 */
export async function everyFrame(update) {
  let last = await nextFrame();
  let dt = 0;
  while (update(dt)) {
    const next = await nextFrame();
    dt = next - last, last = next;
  }
}

/**
 * @typedef {Object} TickedPart - an animation part that runs on an internal unit of time ticks
 * @prop {number|(()=>number)} every - specified time tick unit; may be a function to implement a dynamic rate
 * @prop {Part} then - part callback, will be passed an integer number of elapsed ticks
 */

/**
 * @typedef {Part|TickedPart} SchedulePart
 * @param {SchedulePart[]} parts - one or more animation parts, optionally with their own internal tick rate
 * @return {Part} - a compound part that will run all of the given parts
 */
export function schedule(...parts) {
  if (!parts.length) return () => false;
  const every = parts.map(part => typeof part === 'function' ? 0    : part.every);
  const then  = parts.map(part => typeof part === 'function' ? part : part.then);
  const last  = every.map(()   => 0);
  return (dt) => {
    for (let i = 0; i < every.length; ++i) {
      let n = dt;
      const evry = every[i];
      const rate = typeof evry === 'number' ? evry : evry();
      if (rate > 0) {
        last[i] += dt / rate;
        if (n = Math.floor(last[i])) last[i] -= n;
      }
      if (n && !then[i](n)) return false;
    }
    return true;
  }
}
