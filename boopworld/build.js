/** @typedef {import('./index.js').Point} Point */
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
 * @template Ctx
 * @param {Array<[Point, Creator<Ctx>]>} features
 * @returns {Creator<Ctx>}
 */
export function where(...features) {
    return (spec, ctx) => {
        const {location} = spec;
        if (location) {
            const {x, y} = location;
            for (const [{x: fx, y: fy}, feat] of features)
                if (fx == x && fy == y)
                    return feat(spec, ctx);
        }
        return null;
    };
}

/**
 * @template Ctx
 * @param {Array<Creator<Ctx>>} creators
 * @returns {Creator<Ctx>}
 */
export function first(...creators) {
    return (spec, ctx) => {
        for (const creat of creators) {
            const ent = creat(spec, ctx);
            if (ent) return ent;
        }
        return null;
    };
}

/**
 * @template Ctx
 * @param {Creator<Ctx>} prime
 * @param {Array<Creator<Ctx>>} under
 * @returns {Creator<Ctx>}
 */
export function underlay(prime, ...under) {
    return (spec, ctx) => {
        const ent = prime(spec, ctx);
        const {location} = spec;
        for (const creat of under) creat({location}, ctx);
        return ent;
    };
}

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
