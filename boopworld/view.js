/** @typedef {import('./index.js').Point} Point */
/** @typedef {import('./index.js').Rect} Rect */
/** @typedef {import('./index.js').Event} Event */
/** @typedef {import('./index.js').ROEntity} ROEntity */
/** @typedef {import('./index.js').EntityRef} EntityRef */

/**
 * @template {{[name: string]: unknown}} Datum
 * @typedef {object} Viewport
 * @prop {ViewportRead<Datum>} view
 * @prop {ViewportUpdate<Datum>} update
 */

/**
 * @template {{[name: string]: unknown}} Datum
 * @typedef {object} ViewportRead
 * @prop {() => Rect} bounds
 * @prop {(p: Point) => boolean} contains
 * @prop {(p: Point) => ViewportDatum<Datum>|undefined} at
 * @prop {() => IterableIterator<[Point, ViewportDatum<Datum>]>} entries
 * @prop {() => string} toString
 */

/**
 * @template {{[name: string]: unknown}} Datum
 * @typedef {{glyph: number} & Omit<Datum, "glyph">} ViewportDatum
 */

/**
 * @template {{[name: string]: unknown}} Datum
 * @typedef {object} ViewportUpdate
 * @prop {() => void} clear
 * @prop {(bounds: Rect, virtual?: number) => void} resize
 * @prop {(pos: Point, dat: ViewportDatum<Datum>) => void} set
 * @returns {void}
 */

/** @returns {Viewport<{ref?: EntityRef}>} */
export function makeBasicViewport() {
    /** @type {Map<number, EntityRef>} */
    const refAt = new Map();
    return makeViewport({
        alloc() { },
        clear() {
            refAt.clear();
        },
        load(i) {
            const ref = refAt.get(i);
            return {ref};
        },
        stor(i, dat) {
            const ref = dat.ref;
            if (ref == undefined) refAt.delete(i);
            else refAt.set(i, ref);
        },
    });
}

/** @typedef {ReturnType<makeViewMemory>} ViewMemory */

export function makeViewMemory() {
    const
        cellKnown = 0x01,
        cellBlocked = 0x02,
        cellReacts = 0x03;

    /**
     * @typedef {object} viewMemDatum
     * @prop {number} lastSeen
     * @prop {EntityRef} [ref]
     * @prop {string} [name]
     * @prop {boolean} known
     * @prop {boolean} blocked
     * @prop {boolean} canInteract
     */

    function makeDeps() {
        // TODO rework this around a linear quadtree of tiles instead of one massive tile

        const data = {
            lastSeen: new Uint32Array(0),
            cellProps: new Uint8Array(0),

            /** @type {Map<number, string>} */
            nameOf: new Map(),

            /** @type {Map<string, number>} */
            byName: new Map(),

            /** @type {Map<number, EntityRef>} */
            refAt: new Map(),
        };

        /** @type {ViewportDeps<viewMemDatum>} */
        const deps = Object.freeze({
            alloc(size) {
                data.lastSeen = new Uint32Array(size);
                data.cellProps = new Uint8Array(size);
            },
            clear() {
                data.lastSeen.fill(0);
                data.cellProps.fill(0);
                data.nameOf.clear();
                data.byName.clear();
                data.refAt.clear();
            },
            load(i) {
                const props = data.cellProps[i];
                return {
                    lastSeen: data.lastSeen[i],
                    known: props & cellKnown ? true : false,
                    blocked: props & cellBlocked ? true : false,
                    canInteract: props & cellReacts ? true : false,
                    name: data.nameOf.get(i),
                    ref: data.refAt.get(i),
                };
            },
            stor(i, dat) {
                let props = 0;
                if (dat?.known) props |= cellKnown;
                if (dat?.blocked) props |= cellBlocked;
                if (dat?.canInteract) props |= cellReacts;
                data.lastSeen[i] = dat?.lastSeen || 0;
                data.cellProps[i] = props;

                const name = dat?.name;
                if (!name) {
                    const prior = data.nameOf.get(i);
                    if (prior) data.byName.delete(prior);
                    data.nameOf.delete(i);
                } else {
                    data.nameOf.set(i, name);
                    data.byName.set(name, i);
                }

                const ref = dat?.ref;
                if (ref === undefined) data.refAt.delete(i);
                else data.refAt.set(i, ref);
            },
        });

        return {data, deps};
    }

    let {data, deps} = makeDeps();
    let {view, update} = makeViewport(deps);

    /** @param {Rect} bounds */
    function growTo(bounds) {
        const
            {x: tox1, y: toy1, w: tow, h: toh} = bounds,
            tox2 = tox1 + tow,
            toy2 = toy1 + toh;

        let {x: x1, y: y1, w, h} = view.bounds(), changed = false;
        const x2 = x1 + w, y2 = y1 + h;

        if (x1 > tox1) w += x1 - tox1, x1 = tox1, changed = true;
        if (y1 > toy1) h += y1 - toy1, y1 = toy1, changed = true;
        if (tox2 > x2) w += tox2 - x2, changed = true;
        if (toy2 > y2) h += toy2 - y2, changed = true;

        if (changed) {
            let {data: newData, deps: newDeps} = makeDeps();
            let {view: newView, update: newUpdate} = makeViewport(newDeps);
            newUpdate.resize({x: x1, y: y1, w, h});
            for (const [pos, dat] of view.entries())
                newUpdate.set(pos, dat);
            data = newData, deps = newDeps, view = newView, update = newUpdate;
        }

        // TODO a resize that copies/preserves data internally would be nice
    }

    /**
     * @typedef {object} EventCtx
     * @prop {number} time
     * @prop {(ref: EntityRef) => ROEntity|null} deref
     */

    /**
     * @param {ViewportRead<{ref?: EntityRef}>} seenView
     * @param {EventCtx} ctx
     */
    function integrateSeenView(seenView, {time, deref}) {
        growTo(seenView.bounds());
        for (const [pos, {glyph, ref}] of seenView.entries()) {
            const ent = ref != undefined ? deref(ref) : undefined;
            if (ent) {
                update.set(pos, {
                    glyph,
                    lastSeen: time,
                    ref,
                    known: true,
                    name: ent.name,
                    blocked: ent.isSolid,
                    canInteract: ent.canInteract,
                });
            } else if (glyph != 0x20) {
                const prior = view.at(pos);
                const known = prior?.known && glyph == prior.glyph || false;
                update.set(pos, {
                    glyph,
                    lastSeen: time,
                    known,
                    name: known ? prior?.name : undefined,
                    blocked: known && prior?.blocked || false,
                    canInteract: known && prior?.canInteract || false,
                });
            }
        }
    }

    /** @type {ViewportRead<viewMemDatum>} */
    const viewFacet = {
        bounds() { return view.bounds() },
        contains(p) { return view.contains(p) },
        at(p) { return view.at(p) },
        *entries() { yield* view.entries() },
        toString() { return view.toString() },
    };

    return Object.freeze({
        // indirection for when we re-allocate view
        ...viewFacet,

        /**
         * @param {IterableIterator<Readonly<Event>>} events
         * @param {EventCtx} ctx
         */
        integrateEvents(events, ctx) {
            // any refs stored last time are now invalid
            data.refAt.clear();
            for (const event of events) switch (event.type) {

                case 'view':
                    integrateSeenView(event.view, ctx);
                    break;

                // case 'hitBy': TODO we could remember hit-by counts

                // case 'move': TODO we could remember additional event.here details

            }
        },

        // TODO data query facet
        // TODO byName() analog of at() requires either point lookup to use at, or indexed accessor

    });
}

/**
 * @template {{[name: string]: unknown}} Datum
 * @typedef {object} ViewportDeps
 * @prop {(size: number) => void} alloc
 * @prop {() => void} clear
 * @prop {(i: number, dat: ViewportDatum<Datum>) => void} stor
 * @prop {(i: number) => Datum} load
 */

/**
 * @template {{[name: string]: unknown}} Datum
 * @param {ViewportDeps<Datum>} deps
 * @returns {Viewport<Datum>}
 */
export function makeViewport(deps) {
    let x = 0, y = 0, w = 0, h = 0,
        stride = w,
        size = stride * h,
        glyphAt = new Uint32Array(size);

    /** @param {Point} p */
    function loc({x: px, y: py}) {
        if (px < x || px > x + w) return NaN;
        if (py < y || py > y + h) return NaN;
        const vx = px - x;
        const vy = py - y;
        return stride * vy + vx;
    }

    function clear() {
        deps.clear();
        glyphAt.fill(0x20);
        // fill in line terminators if extra room has been left after each row
        if (stride > w)
            for (let i = stride-1; i < glyphAt.length; i += stride)
                glyphAt[i] = 0x0a;
    }

    return {

        // read facet
        view: Object.freeze({
            bounds() { return Object.freeze({x, y, w, h}) },
            toString() { return String.fromCodePoint(...glyphAt) },
            contains(pos) { return !isNaN(loc(pos)) },
            *entries() {
                const x2 = x + w, y2 = y + h;
                for (let j = 0, py = y; py < y2; j++, py++) {
                    for (let i = stride * j, px = x; px < x2; i++, px++) {
                        const glyph = glyphAt[i];
                        const dat = deps.load(i)
                        yield [{x: px, y: py}, {...dat, glyph}];
                    }
                }
            },
            at(pos) {
                const i = loc(pos);
                if (isNaN(i)) return undefined;
                const glyph = glyphAt[i];
                const dat = deps.load(i);
                return {...dat, glyph};
            },
        }),

        // update facet
        update: Object.freeze({
            clear,
            resize(bounds, virtual=1) {
                ({x, y, w, h} = bounds);
                stride = w + virtual;
                if (size < stride * h) {
                    size = stride * h;
                    glyphAt = new Uint32Array(size);
                    deps.alloc(size);
                }
                clear();
            },
            set(pos, dat) {
                const i = loc(pos);
                if (!isNaN(i)) {
                    glyphAt[i] = dat.glyph || 0xfffd;
                    deps.stor(i, dat);
                }
            },
        }),

    };
}
