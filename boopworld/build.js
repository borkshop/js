/** @typedef {import('./index.js').Rect} Rect */
/** @typedef {import('./index.js').Entity} Entity */
/** @typedef {import('./index.js').EntitySpec} EntitySpec */

/**
 * @template Ctx
 * @callback Creator
 * @param {EntitySpec} spec
 * @param {Ctx} ctx
 * @returns {Entity|null}
 */

/**
 * @param {Rect} rect
 * @param {Creator<Rect>} create
 */
export function rect(rect, create) {
    const {x: minx, y: miny, w, h} = rect
    const maxx = minx + w - 1;
    const maxy = miny + h - 1;
    for (let y=miny; y <= maxy; y++)
        for (let x=minx; x <= maxx; x++)
            create({location: {x, y}}, rect);
}

/**
 * @param {Creator<Rect>} fill
 * @param {Creator<Rect>} [stroke]
 * @param {Creator<Rect>} [corner]
 * @returns {Creator<Rect>}
 */
export function rectCreator(fill, stroke, corner) {
    return (spec, r) => {
        const {location} = spec;
        if (location) {
            const {x, y} = location;
            const {x: minx, y: miny, w, h} = r;
            const maxx = minx + w - 1;
            const maxy = miny + h - 1;
            const edgey = y == miny || y  == maxy;
            const edgex = (x == minx || x == maxx);

            if (edgex && edgey) {
                if (corner) return corner(spec, r);
                if (stroke) return stroke(spec, r);
            }

            else if (edgex || edgey) {
                if (stroke) return stroke(spec, r);
            }
        }
        return fill(spec, r);
    }
}
