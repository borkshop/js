// @ts-check

/**
 * @template T
 * @param {{[index: number]: T}} region
 * @param {Iterable<number>} indexes
 * @param {T} value
 */
export function fill(region, indexes, value) {
  for (const index of indexes) {
    region[index] = value;
  }
}

/**
 * @param {number} length
 * @param {{[index: number]: number}} region
 * @param {{[index: number]: number}} paths
 * @param {Iterable<number>} start
 * @param {(point:number) => Iterable<number>} neighbors
 * @param {number} value
 */
export function flood(length, region, paths, start, neighbors, value) {
  let todo = new Set(start);
  for (const index of todo) {
    region[index] = value;
    for (const neighbor of neighbors(index)) {
      if (
        neighbor >= 0 &&
        neighbor < length &&
        region[neighbor] !== value &&
        paths[neighbor]
      ) {
        todo.add(neighbor);
      }
    }
  }
}

