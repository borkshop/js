// @ts-check

import {coswap, heapup, heapdown} from './heap.js';

const mathRandom = () => Math.random();

/**
 * @param {number} area The area of the zone to explore, and consequently the
 * length of the following arrays.
 * @param {{[index: number]: number}} distances Where to write the distances
 * from the start points to each point in the region. Must be pre-initialized
 * to the infinity for this area.
 * The distances will be the sum of the path weights leading to that position
 * multiplied by the area of the region, plus the index of the cell itself to
 * ensure a total order of the heap.
 * @param {{[index: number]: number}} heap Every point number, to be used as a
 * priority heap for the algorithm's frontier. Must be pre-initialized with
 * every index in ascending order.
 * @param {{[index: number]: number}} coheap Maps a point number to its
 * corresponding index in the heap. Must be initialized with every index in
 * ascending order.
 * @param {(from:number, to:number) => number} weights The weight to transit
 * each edge.
 * @param {(point:number) => Iterable<number>} neighbors Produces
 * a stencil of all the neighbors of a given point.
 * index.
 * @param {Iterable<number>} start
 */
export function computeDistancesDijkstra(
  area,
  distances,
  heap,
  coheap,
  weights,
  neighbors,
  start,
) {
  let length = area;

  for (const index of start) {
    distances[index] = 0;
    coswap(heap, coheap, length, coheap[index]);
    heapup(heap, coheap, distances, length);
  }

  while (length > 0) {
    const index = heap[0];
    // Remove the candidate from the heap.
    length--;
    coswap(heap, coheap, 0, length);
    heapdown(length, heap, coheap, distances, 0);

    for (const neighbor of neighbors(index)) {
      // If the neighbor is still in the priority queue:
      if (coheap[neighbor] < length) {
        // Relax distance to neighbor.
        const distance = distances[index] + weights(index, neighbor);
        // If the new distance is shorter:
        if (distance < distances[neighbor]) {
          distances[neighbor] = distance;
          // Increase the node priority.
          heapup(heap, coheap, distances, coheap[neighbor]);
        }
      }
    }
  }
}

/**
 * @param {number} length
 * @param {{[index: number]: number}} distances
 * @param {(index: number) => Iterable<number>} neighbors
 * @param {Iterable<number>} ends
 * @param {() => number} random
 * @yields {number}
 */
export function *trace(length, distances, neighbors, ends, random = mathRandom) {

  /**
   * @param {Array<number>} indexes
   * @returns {number} index
   */
  function choose(indexes) {
    console.log(indexes);
    const min = Math.min(...indexes.map(index => distances[index]));
    const options = indexes.filter(index => distances[index] === min);
    const choice = options[Math.floor(random() * options.length)];
    return choice;
  }

  // let ttl = length;
  // let index = choose(Array.from(ends));
  let index = choose(Array.from(ends));
  yield index;

  let ttl = length;
  while (distances[index] > 0 && distances[index] !== Infinity && ttl > 0 ) {
    index = choose(Array.from(neighbors(index)));
    yield index;
    ttl--;
  }
}
