/**
 * @template T
 * @param {{[i: number]: T}} array
 * @param {number} length
 * @param {T} value
 */
function search(array, length, value) {
  var first = 0;
  var last = length - 1;
  while (first <= last) {
    var middle = (first + last) >> 1; // Math.floor( / 2)
    // first <= middle < last
    if (value < array[middle]) {
      last = middle - 1;
    } else {
      return middle;
    }
  }
  return first;
}

