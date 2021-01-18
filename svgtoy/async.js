// @ts-check

import './types.js';

/**
 * @return {Promise<number>}
 */
export function animationFrame() {
  return new Promise(resolve => requestAnimationFrame(resolve));
}

/*
 * @template T
 * @return {Deferred<T>}
 */
export function defer() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  if (resolve === undefined || reject === undefined) {
    throw new Error('The type system, it deceived us!');
  }
  /** @type {Deferred<T>} */
  return { promise, resolve, reject };
}

/**
 * @param {number} ms
 * @return {Promise<void>}
 */
export function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
