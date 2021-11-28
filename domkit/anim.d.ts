/** @return {Promise<number>} - resolves to the current high-res time at the
 * start of the next browser animation frame */
export function nextFrame(): Promise<number>;
/** @returns {AsyncGenerator<number>} - a stream of elapsed time deltas between
  * animation frames, starting with 0 on the first frame */
export function frameDeltas(): AsyncGenerator<number>;
