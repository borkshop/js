// @ts-check

// TODO replace set allocation with pre-allocated array and co-array, as with
// the implementation of Dijkstra's algorithm.

/**
 * Fills a region with the distances from a set of starting points.
 *
 * @param {number} area The length of the region array.
 * @param {{[index: number]: number}} region Cells to explore.
 * @param {{[index: number]: number}} seen Cells to avoid if non-zero.
 * @param {Iterable<number>} start Cells to march out from.
 * @param {(point:number) => Iterable<number>} neighbors Produces
 * a stencil of all the neighbors of a given point.
 * @param {Object} [options]
 * @param {number} [options.weight] initial weight
 * @param {number} [options.see] what to set on seen when encountering an
 * index.
 */
export function computeDistancesBreadthFirst(area, region, seen, start, neighbors, options = {}) {
  let { weight = 1 } = options;
  const { see = 1 } = options;
  let next = new Set();
  let prev = new Set(start);
  while (prev.size) {
    for (const index of prev) {
      region[index] = weight;
      seen[index] = see;
    }

    for (const index of prev) {
      for (const neighbor of neighbors(index)) {
        if (neighbor >= 0 && neighbor < area && !seen[neighbor]) {
          next.add(neighbor);
        }
      }
    }

    prev.clear();
    [next, prev] = [prev, next];
    weight++;
  }
}
