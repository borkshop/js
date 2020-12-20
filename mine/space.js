// @ts-check

/** @typedef { import("cdom/tiles").Point } Point */

export class Space {
  /**
   * @param {Point} size
   */
  constructor(size) {
    this.size = size;
  }

  /**
   * @param {Point} point
   * @returns {number}
   */
  index(point) {
    if (
      point.x >= this.size.x ||
      point.x < 0 ||
      point.y >= this.size.y ||
      point.y < 0
    ) {
      return -1;
    }
    return point.y * this.size.x + point.x;
  }

  /**
   * @param {number} index
   * @returns {Point}
   */
  point(index) {
    const y = Math.floor(index / this.size.x);
    const x = index - y * this.size.x;
    return {x, y};
  }

  /**
   * @param {Iterable<Point>} points
   * @yields {number}
   */
  *indexes(points) {
    for (const point of points) {
      yield this.index(point);
    }
  }

  /**
   * @param {Iterable<number>} indexes
   * @yields {Point}
   */
  *points(indexes) {
    for (const index of indexes) {
      yield this.point(index);
    }
  }
}

