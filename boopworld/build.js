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
 * @param {number} walls
 * @param {Creator<Rect>} wall
 * @param {object} [params]
 *
 * @param {Creator<Rect>} [params.wallNorth]
 * @param {Creator<Rect>} [params.wallEast]
 * @param {Creator<Rect>} [params.wallSouth]
 * @param {Creator<Rect>} [params.wallWest]
 *
 * @param {Creator<Rect>} [params.corner]
 * @param {Creator<Rect>} [params.cornerNW]
 * @param {Creator<Rect>} [params.cornerNE]
 * @param {Creator<Rect>} [params.cornerSW]
 * @param {Creator<Rect>} [params.cornerSE]
 *
 * @returns {Creator<Rect>}
 */
export function hallCreator(walls, wall, {
    wallNorth,
    wallEast,
    wallSouth,
    wallWest,

    corner,
    cornerNW,
    cornerNE,
    cornerSW,
    cornerSE,
}={}) {
    return (spec, r) => {
        // NOTE: branch structure below:
        //   if (is) {
        //     if (should) {
        //       if (specific) return specific(...);
        //       return wall(...);
        //     }
        //   }

        const {location} = spec;
        if (location) {
            const {x, y} = location;
            const {x: minx, y: miny, w, h} = r;
            const maxx = minx + w - 1;
            const maxy = miny + h - 1;
            const north = y == miny, south = y == maxy;
            const west = x == minx, east = x == maxx;

            if (north && west) {
                if (!(walls & hallCreator.SansCorners)) {
                    if (cornerNW) return cornerNW(spec, r);
                    if (corner) return corner(spec, r);
                    if (wallNorth) return wallNorth(spec, r);
                    return wall(spec, r);
                }
            }

            else if (north && east) {
                if (!(walls & hallCreator.SansCorners)) {
                    if (cornerNE) return cornerNE(spec, r);
                    if (corner) return corner(spec, r);
                    if (wallNorth) return wallNorth(spec, r);
                    return wall(spec, r);
                }
            }

            else if (south && west) {
                if (!(walls & hallCreator.SansCorners)) {
                    if (cornerSW) return cornerSW(spec, r);
                    if (corner) return corner(spec, r);
                    if (wallSouth) return wallSouth(spec, r);
                    return wall(spec, r);
                }
            }

            else if (south && east) {
                if (!(walls & hallCreator.SansCorners)) {
                    if (cornerSE) return cornerSE(spec, r);
                    if (corner) return corner(spec, r);
                    if (wallSouth) return wallSouth(spec, r);
                    return wall(spec, r);
                }
            }

            else if (north) {
                if (walls & hallCreator.WallNorth) {
                    if (wallNorth) return wallNorth(spec, r);
                    return wall(spec, r);
                }
            }

            else if (east) {
                if (walls & hallCreator.WallEast) {
                    if (wallEast) return wallEast(spec, r);
                    return wall(spec, r);
                }
            }

            else if (south) {
                if (walls & hallCreator.WallSouth) {
                    if (wallSouth) return wallSouth(spec, r);
                    return wall(spec, r);
                }
            }

            else if (west) {
                if (walls & hallCreator.WallWest) {
                    if (wallWest) return wallWest(spec, r);
                    return wall(spec, r);
                }
            }

        }
        return null;
    }
}

hallCreator.WallNorth   = 0x01;
hallCreator.WallEast    = 0x02;
hallCreator.WallSouth   = 0x04;
hallCreator.WallWest    = 0x08;
hallCreator.SansCorners = 0x10;

hallCreator.WallsNE = hallCreator.WallNorth | hallCreator.WallEast;
hallCreator.WallsNW = hallCreator.WallNorth | hallCreator.WallWest;
hallCreator.WallsSE = hallCreator.WallSouth | hallCreator.WallEast;
hallCreator.WallsSW = hallCreator.WallSouth | hallCreator.WallWest;
hallCreator.WallsNS = hallCreator.WallNorth | hallCreator.WallSouth;
hallCreator.WallsEW = hallCreator.WallWest  | hallCreator.WallEast;

hallCreator.WallsNEW = hallCreator.WallNorth | hallCreator.WallEast  | hallCreator.WallWest;
hallCreator.WallsNSW = hallCreator.WallNorth | hallCreator.WallSouth | hallCreator.WallWest;
hallCreator.WallsESW = hallCreator.WallEast  | hallCreator.WallSouth | hallCreator.WallWest;
hallCreator.WallsNES = hallCreator.WallNorth | hallCreator.WallEast  | hallCreator.WallSouth;

hallCreator.AllWalls = hallCreator.WallsNS | hallCreator.WallsEW;

/**
 * @param {Creator<{content: string}>} create
 * @param {Point} at
 * @param {string} content
 */
export function fromString(create, {x, y}, content) {
    const x1 = x;
    for (const unit of content) switch (unit) {
        case ' ':
            x++;
            continue;
        case '\n':
            x = x1, y++;
            continue;
        default:
            create({location: {x, y}, glyph: unit}, {content});
            x++;
    }
}

export function makeLexicon() {
    /** @type {Map<number, Creator<any>>} */
    const defines = new Map();

    /** @type {Set<{destroy: () => void}>} */
    const destroyables = new Set();

    /** @param {number|string} glyph */
    function lookup(glyph) {
        const code = typeof glyph == 'string' ? glyph.codePointAt(0) : glyph;
        return code == undefined ? undefined : defines.get(code);
    }

    /** @param {number|string} glyph */
    function mustLookup(glyph) {
        const def = lookup(glyph);
        if (!def) throw new Error(`Undefined term ${JSON.stringify(glyph)}`);
        return def;
    }

    /**
     * @template Ctx
     * @typedef {Creator<Ctx>|{create: Creator<Ctx>, destroy: () => void}} Term
     */

    /**
     * @template Ctx
     * @param {number|string|{glyph: number|string, create: Creator<Ctx>, destroy: () => void}} glyphOrTerm
     * @param {Array<number|string|Term<Ctx>>} terms
     * @returns {Creator<Ctx>}
     */
    function define(glyphOrTerm, ...terms) {
        /** @type {number|string} */
        let glyph;
        /** @type {Creator<Ctx>} */
        let create;
        /** @type {Array<{destroy: () => void}>} */
        const subDestroyables = [];

        if (typeof glyphOrTerm == 'number' ||
            typeof glyphOrTerm == 'string') {
            glyph = glyphOrTerm;
            if (!terms.length) throw new TypeError('Must provide at least one term');
            const [term, ...rest] = terms;
            if (typeof term == 'function') {
                create = term;
            } else if (typeof term == 'number' || typeof term == 'string') {
                create = mustLookup(term);
            } else {
                ({create} = term);
                subDestroyables.push(term);
            }
            terms = rest;
        } else {
            ({glyph, create} = glyphOrTerm);
            subDestroyables.push(glyphOrTerm);
        }

        const code = typeof glyph == 'string' ? glyph.codePointAt(0) : glyph;
        if (code == undefined) throw new Error('Invalid lexicon entry, cannot decode glyph');
        if (defines.has(code)) throw new Error(`Duplicate lexicon entry, glyph:${JSON.stringify(glyph)}`);

        if (terms.length) create = underlay(create, ...terms.map(r => {
            if (typeof r == 'number' || typeof r == 'string')
                return mustLookup(r);
            if (typeof r == 'function')
                return r;
            subDestroyables.push(r);
            return r.create;
        }));

        for (const da of subDestroyables) destroyables.add(da);
        defines.set(code, create);
        return create;
    }

    return Object.freeze({
        define,
        lookup,
        mustLookup,

        /**
         * @param {EntitySpec} spec
         * @param {any} ctx
         */
        create(spec, ctx) {
            const {glyph} = spec;
            if (glyph) {
                const code = typeof glyph == 'string' ? glyph.codePointAt(0) : glyph;
                const create = code != undefined ? defines.get(code) : undefined;
                if (create) return create(spec, ctx);
            }
            return null;
        },

        destroy() {
            defines.clear();
            for (const da of destroyables)
                da.destroy();
            destroyables.clear();
        },
    });
}
