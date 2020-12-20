// @ts-check

/**
 * @param {{[index: number]: number}} array
 * @param {{[index: number]: number}} coarray
 * @param {number} i
 * @param {number} j
 */
export function coswap(array, coarray, i, j) {
  const [ci, cj] = [array[i], array[j]];
  [array[i], array[j]] = [array[j], array[i]];
  [coarray[ci], coarray[cj]] = [j, i];
}

/**
 * @param {{[index: number]: number}} heap
 * @param {{[index: number]: number}} coheap
 * @param {{[index: number]: number}} values
 * @param {number} index
 */
export function heapup(heap, coheap, values, index) {
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if (values[heap[index]] < values[heap[parent]]) {
      coswap(heap, coheap, index, parent);
      index = parent;
    } else {
      return;
    }
  }
}

/**
 * @param {number} length
 * @param {{[index: number]: number}} heap
 * @param {{[index: number]: number}} coheap
 * @param {{[index: number]: number}} values
 * @param {number} index
 */
export function heapdown(length, heap, coheap, values, index) {
  for (;;) {
    const left = (2 * index) + 1;
    if (left >= length) {
      return index;
    }

    const right = left + 1;
    let child = left;
    if (right < length &&
      values[heap[left]] > values[heap[right]]) {
      child = right;
    }

    if (values[heap[child]] < values[heap[index]]) {
      coswap(heap, coheap, index, child);
      index = child;
    } else {
      return index;
    }
  }
}
