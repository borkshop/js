/**
 * @typedef {(
 *   | "up"
 *   | "right"
 *   | "down"
 *   | "left"
 *   | "stay"
 * )} Move */

/**
 * @typedef {object} Shard
 * @prop {(deadline?: number) => void} update
 */

/**
 * @typedef {object} ShardCtl
 * @prop {number} time
 * @prop {Rect} bounds
 * @prop {(bounds: Rect) => ShardView} makeView
 * @prop {CreatedEntity} root
 * @prop {(spec?: TypeSpec) => IterableIterator<CreatedEntity>} entities
 * @prop {Creator} create
 */

/**
 * @typedef {object} ShardView
 * @prop {Rect} bounds
 * @prop {(p: Point) => Entity|null} at
 * @prop {() => string} toString
 */

/**
 * @typedef {object} Point
 * @prop {number} x
 * @prop {number} y
 */

/**
 * @typedef {object} Rect
 * @prop {number} x
 * @prop {number} y
 * @prop {number} w
 * @prop {number} h
 */

/**
 * @typedef {object} TypeSpec
 * @prop {boolean} [isSolid]
 * @prop {boolean} [isVisible]
 * @prop {boolean} [canInteract]
 * @prop {boolean} [hasMind]
 * @prop {boolean} [hasInput]
 */

/**
 * @callback Input
 * @param {InputCtl|null} ctl
 * @returns {void}
 */

/**
 * @typedef {object} InputCtl
 * @prop {Entity} entity
 * @prop {(code: string) => void} queueInput
 * @prop {() => IterableIterator<Readonly<Event>>} events
 *
 * TODO per-input views; however we probably want to have those replace/consume
 *      the events stream, rather than expose it raw; such view would be
 *      canonically to entity memory/mind, and not necessarily transfer
 *      through Input recall; i.e. revoking a ctl should also revoke its view
 */

/**
 * @typedef {object} CreateSpec
 * @prop {boolean} [isSolid]
 * @prop {boolean} [isVisible]
 * @prop {boolean} [canInteract]
 * @prop {boolean} [hasMind]
 * @prop {Input} [input]
 * @prop {number|string} [glyph]
 * @prop {Point} [location]
 * @prop {number} [zIndex]
 * @prop {string} [name]
 */

/**
 * @typedef {object} Entity
 * @prop {() => string} toString
 * @prop {boolean} isSolid
 * @prop {boolean} isVisible
 * @prop {boolean} canInteract
 * @prop {boolean} hasMind
 * @prop {boolean} hasInput
 * @prop {number} glyph
 * @prop {Point} location
 * @prop {number} zIndex
 * @prop {string} name
 */

/** @typedef {(spec: CreateSpec) => CreatedEntity} Creator */

/** @typedef {Entity & CreateEntity} CreatedEntity */

/**
 * @typedef {object} CreateEntity
 * @prop {Creator} create
 * @prop {() => void} destroy
 */

/** @typedef {HitEvent|HitByEvent|MoveEvent|InspectEvent|InputEvent} Event */

/**
 * @typedef {object} HitEvent
 * @prop {"hit"} type
 * @prop {number} time
 * @prop {number} target
 */

/**
 * @typedef {object} HitByEvent
 * @prop {"hitBy"} type
 * @prop {number} time
 * @prop {number} actor
 */

/**
 * @typedef {object} MoveEvent
 * @prop {"move"} type
 * @prop {number} time
 * @prop {Point} from
 * @prop {Point} to
 * @prop {number[]} interactables
 */

/**
 * @typedef {object} InspectEvent
 * @prop {"inspect"} type
 * @prop {number} time
 * @prop {number[]} interactables
 */

/**
 * @typedef {object} InputEvent
 * @prop {"input"} type
 * @prop {string} code
 */

/**
 * @callback Builder
 * @param {CreatedEntity} root
 * @param {Creator} create
 * TODO pass an at(Point) => ...CreatedEntity
 * @returns void
 */

/**
 * @param {object} options
 * @param {Builder} options.build
 * @param {(ctl: ShardCtl) => void} [options.control]
 * @param {number} [options.moveRate]
 * @param {() => number} [options.now]
 * @param {number} [options.defaultTimeout]
 * @param {number} [options.size]
 * @returns {Shard}
 */
export function makeShard({
    build,
    control,
    moveRate=1,
    now=Date.now,
    defaultTimeout=100,
    size=64,
}) {
    //// type system definitions and setup
    const
        maxShardSize = 64 * 1024

    // types contains two fields per entity
    // the first value is a generation counter
    // which both alloc and destroy increment
    // so its low bit serves as an allocated bit flag
      , typeAlloc    = 0x01

    // the second value is the component bit field
      , typeVisible  = 0x01
      , typeSolid    = 0x02
      , typeMind     = 0x04
      , typeInput    = 0x08
      , typeInteract = 0x10

      ;

    /** @type {Map<number, (id: number) => void>} */
    const typeAllocs = new Map();

    /** @type {Map<number, (id: number) => void>} */
    const typeDestroys = new Map();

    /** @type {Map<number, Set<number>>} */
    const typeIndex = new Map();

    let types = new Uint8Array(2 * size);

    //// dense components
    let locs = new Int16Array(3 * size);
    let glyphs = new Uint32Array(size);

    //// movement component init 
    /** @type {Map<number, Move>} */
    const moves = new Map();
    let nextMove = 1;
    typeIndex.set(typeSolid, new Set()); // TODO replace this with a location index

    //// events component init
    /** @type {Map<number, Event[]>} */
    const events = new Map();

    //// input component init
    /** @type {Map<number, {input: Input, revokes: (() => void)[]}>} */
    const inputs = new Map();
    typeDestroys.set(typeInput, id => {
        const inputEntry = inputs.get(id);
        if (!inputEntry) return;
        const {input, revokes} = inputEntry;
        input(null);
        for (const revoke of revokes) revoke();
        inputs.delete(id);
    });
    typeIndex.set(typeInput, new Set());

    //// mind component init
    /** @type {Map<number, Map<string, string>>} */
    const memories = new Map();
    typeDestroys.set(typeMind, id => memories.delete(id));
    typeIndex.set(typeMind, new Set());

    /**
     * @typedef {object} execState
     * @prop {Map<number, number>} ticks
     */

    /** @type {null|execState} */
    let exec = null;

    //// shard init
    let time = 0;

    // mark the root/zero entity as allocated, and setup some fallbacks
    if (alloc() != 0) throw new Error('inconceivable root allocation');
    glyphs[0] = 0x20; // ascii <space>

    // build all entities at time=0
    build(createEntity(0), makeCreator());

    return freeze({
        update(deadline=now() + defaultTimeout) {
            runEntities(deadline);

            // NOTE: deadline oblivious, always call user control
            if (control) control(makeCtl());
        },
    });

    /** @returns {ShardCtl} */
    function makeCtl() {
        return freeze(guard({
            get time() { return time },

            get bounds() {
                let minx = NaN, miny = NaN, maxx = NaN, maxy = NaN;
                for (const id of ids(typeVisible)) {
                    const {x, y} = getLoc(id);
                    if (isNaN(minx) || x < minx) minx = x;
                    if (isNaN(maxx) || x > maxx) maxx = x;
                    if (isNaN(miny) || y < miny) miny = y;
                    if (isNaN(maxy) || y > maxy) maxy = y;
                }
                return freeze({x: minx, y: miny, w: maxx-minx+1, h: maxy-miny+1});
            },

            makeView,

            get root() { return createEntity(0) },

            *entities(spec={}) {
                const {
                    isSolid = false,
                    isVisible = false,
                    canInteract = false,
                    hasMind = false,
                    hasInput = false,
                } = spec;
                const typeFilter = 0
                    | (isSolid ? typeSolid : 0)
                    | (isVisible ? typeVisible : 0)
                    | (canInteract ? typeInteract : 0)
                    | (hasMind ? typeMind : 0)
                    | (hasInput ? typeInput : 0);
                for (const id of ids(typeFilter))
                    yield createEntity(id);
            },

            create: makeCreator(),
        }, makeTimeGuard('ShardCtl')));
    }

    /**
     * @param {Rect} bounds
     * @returns {ShardView}
     */
    function makeView(bounds) {
        let {x, y, w, h} = bounds;
        let stride = w + 1;        // +1 for a newline terminator
        let size = stride * h - 1; // except on the final line
        let zBuffer = new Uint8Array(size);
        let idAt = new Uint16Array(size);
        let glyphCache = new Uint32Array(size);
        /** @type {null|string} */
        let stringCache = null;
        let lastUpdate = NaN;

        return freeze({
            get bounds() { return freeze({x, y, w, h}) },
            set bounds(bounds) {
                ({x, y, w, h} = bounds);
                stride = w + 1;        // +1 for a newline terminator
                size = stride * h - 1; // except on the final line
                if (size != zBuffer.length) {
                    zBuffer = new Uint8Array(size);
                    idAt = new Uint16Array(size);
                    glyphCache = new Uint32Array(size);
                }
                lastUpdate = NaN;
            },

            at({x: px, y: py}) {
                update();
                const i = stride * py + px;
                if (i < 0 || i >= idAt.length) return null;
                const id = idAt[i];
                return id ? freezeEntity(id, entity(id)) : null;
            },

            toString() {
                update();
                if (stringCache != null) return stringCache;
                glyphCache.fill(0x20); // ascii space TODO maybe fill with "A" in dev mode
                for (let i = 0; i < idAt.length; ++i) {
                    const n = (i % stride) + 1;
                    glyphCache[i] = n < stride
                        ? glyphs[idAt[i]] // rows of view glyphs...
                        : 0x0a;           // ...terminated by ascii nl
                }
                return stringCache = String.fromCodePoint(...glyphCache);
            },
        });

        function update() {
            if (lastUpdate == time) return;
            zBuffer.fill(0);
            idAt.fill(0);
            for (const id of ids(typeVisible)) {
                const vx = getX(id) - x;
                if (vx < 0 || vx > w) continue;
                const vy = getY(id) - y;
                if (vy < 0 || vy > h) continue;
                const z = getZ(id);
                const i = stride * vy + vx;
                if (idAt[i] && z < zBuffer[i]) continue; // last z-tie wins
                idAt[i] = id;
                zBuffer[i] = z;
            }
            lastUpdate = time;
            stringCache = null;
        }
    }

    /** @returns {Creator} */
    function makeCreator() {
        const createGuard = makeEntityGuard(0, ' creator');
        return spec => {
            createGuard();
            return createSpec(0, spec);
        };
    }

    /** @param {number} _deadline */
    function runMinds(_deadline) {
        // minds don't run in prehistory
        if (time <= 0) return true;

        // TODO generalize this into some sort of entmind.Executor
        if (!exec) {
            const minds = Array.from(ids(typeMind));
            exec = {
                ticks: new Map(),
            };
            for (const id of minds) {
                exec.ticks.set(id, 0);
            }
        }

        // not done if any mind hasn't had at least once tick
        for (const ticks of exec.ticks.values())
            if (ticks < 1) return false;

        // done if every mind has had at least one tick
        return true;
    }

    /**
     * @param {number} id
     * @param {string} key
     * @returns {any}
     */
    function memoryGet(id, key) {
        const meme = memoryRead(id, key);
        return meme ? JSON.parse(meme) : null;
    }

    /**
     * @param {number} id
     * @param {string} key
     * @returns {string|undefined}
     */
    function memoryRead(id, key) {
        const memory = memories.get(id);
        return memory && memory.get(key);
    }

    // TODO rebuild minds
    // /**
    //  * @param {number} id
    //  * @param {string} key
    //  * @param {any} value
    //  */
    // function memorySet(id, key, value) {
    //     let memory = memories.get(id);
    //     if (!memory) memories.set(id, memory = new Map());
    //     if (value == null) memory.delete(key);
    //     else memory.set(key, JSON.stringify(value));
    // }

    /** @param {number} deadline */
    function runEntities(deadline) {
        // run entity minds while waiting for the next move
        if (nextMove > time) {
            // thoughts and moves may only start at time=1
            if (time <= 0) {
                moves.clear();
            } else {
                // wait for every mind to execute at least once
                if (!runMinds(deadline)) return;

                let ready = true;
                let thinking = false;
                for (const id of ids(typeInput)) {
                    if (!moves.has(id)) ready = false;
                }

                // wait for all input-able entities to choose a move
                if (!ready) {
                    // reboot minds if all inputs have yielded for input
                    if (!thinking) {
                        events.clear();
                        exec = null;
                    }
                    return; // wait for sufficient input
                }
            }

            // clear execution state and events then advance time
            events.clear();
            exec = null;
            time++;

            // wait for nextMove
            if (nextMove > time) return;
        }

        // TODO groupwise conflict resolution or at least hacked via initiative
        for (const [id, move] of moves.entries()) {
            if (now() > deadline) return;

            moves.delete(id);

            const {x, y} = getLoc(id);
            switch (move) {
                // TODO interact with
                case 'up':
                    moveTo(x, y-1);
                    break;
                case 'right':
                    moveTo(x+1, y);
                    break;
                case 'down':
                    moveTo(x, y+1);
                    break;
                case 'left':
                    moveTo(x-1, y);
                    break;
                case 'stay':
                    inspect();
                    break;
                default:
                    throw new Error(`invalid move ${JSON.stringify(move)}`); 
            }

            /**
             * @param {number} tox
             * @param {number} toy
             */
            function moveTo(tox, toy) {
                const hit =
                    hasType(id, typeSolid) ? Array.from(at(typeSolid, tox, toy))
                    : [];
                if (hit.length) {
                    hit.sort((a, b) => getZ(b) - getZ(a));
                    const hitId = hit[0];
                    queueEvent(id, {type: "hit", time, target: hitId});
                    queueEvent(hitId, {type: "hitBy", time, actor: id});
                } else {
                    setLoc(id, {x: tox, y: toy});
                    queueEvent(id, {
                        type: "move", time,
                        from: {x, y},
                        to: {x: tox, y: toy},
                        interactables: Array
                            .from(at(typeInteract, tox, toy))
                            .filter(here => here != id),
                    });
                }
            }

            function inspect() {
                queueEvent(id, {
                    type: "inspect", time,
                    interactables: Array
                        .from(at(typeInteract, x, y))
                        .filter(here => here != id),
                });
            }

        }

        // advance nextMove timer
        nextMove += moveRate;
    }

    // TODO rebuild minds
    // /**
    //  * @param {number} id
    //  * @param {Move|null} move
    //  * @returns {void}
    //  */
    // function setMove(id, move) {
    //     if (move) moves.set(id, move);
    //     else moves.delete(id);
    // }

    /**
     * @param {number} id
     * @param {Event} event
     * @returns {void}
     */
    function queueEvent(id, event) {
        let queue = events.get(id);
        if (!queue) events.set(id, queue = []);
        queue.push(event);
    }

    /**
     * @param {number} typeFilter
     * @param {number} x
     * @param {number} y
     * @returns {Generator<number>}
     */
    function* at(typeFilter, x, y) {
        for (const id of ids(typeFilter))
            if (getX(id) == x && getY(id) == y)
                yield id;
    }

    /**
     * @template {Entity} E
     * @param {number} id
     * @param {E} e
     * @returns {E}
     */
    function freezeEntity(id, e) {
        return freeze(guard(e,
            makeTimeGuard('Entity'),
            makeEntityGuard(id)));
    }

    /**
     * @param {string} desc
     * @returns {() => void}
     */
    function makeTimeGuard(desc) {
        const asof = time;
        return () => {
            if (time > asof) throw new Error(`Cannot access obsolete ${desc}`);
        };
    }

    /**
     * @param {number} id
     * @returns {() => void}
     */
    function makeEntityGuard(id, suffix='') {
        const guardGen = getTypeGen(id);
        return () => {
            const gen = getTypeGen(id);
            if (!(gen & typeAlloc)) throw new Error(`Cannot access destroyed Entity${suffix}`);
            if (gen != guardGen) throw new Error(`Cannot access reallocated Entity${suffix}`);
        };
    }

    /**
     * @param {number} id
     * @returns {Entity}
     */
    function entity(id) {
        return {
            toString() {
                const gen = getTypeGen(id);
                const {x, y} = getLoc(id), z = getZ(id);
                const glyph = String.fromCodePoint(glyphs[id]);

                /** @type {string[]} */
                const tags = [];
                for (const [t, tag] of /** @type {[number, string][]} */ ([
                    [typeSolid, 'SOLID'],
                    [typeVisible, 'VISIBLE'],
                    [typeInteract, 'INTERACT'],
                    [typeMind, 'MIND'],
                    [typeInput, 'INPUT'],
                ])) if (hasType(id, t)) tags.push(tag);

                const name = memoryGet(id, 'name');
                return `Entity<${name ? `name:${name} ` : ''}id:${id} gen:${gen >> 1} @${x},${y},${z} [${tags.join(' ')}] glyph:${JSON.stringify(glyph)}>`;
            },

            get isSolid() { return hasType(id, typeSolid) },
            get isVisible() { return hasType(id, typeVisible) },
            get canInteract() { return hasType(id, typeInteract) },
            get hasMind() { return hasType(id, typeMind) },
            get hasInput() { return hasType(id, typeInput) },
            get glyph() { return glyphs[id] },
            get location() { return getLoc(id) },
            get zIndex() { return getZ(id) },
            get name() { return memoryGet(id, 'name') }
        };
    }

    /** @template {object} T, S
     * @param {T} obj
     * @param {S} ext
     * @returns {T & S}
     */
    function extendObject(obj, ext) {
        const props = Object.getOwnPropertyDescriptors(ext);
        return /** @type {T & S} */ (Object.defineProperties(obj, props));
    }

    /** @template {object} T
     * @param {number} id
     * @param {T} ext
     * @returns {Entity & T}
     */
    function extendedEntity(id, ext) {
        return freezeEntity(id, extendObject(entity(id), ext));
    }

    /**
     * @param {number} proto
     * @param {CreateSpec} spec
     * @returns {CreatedEntity}
     */
    function createSpec(proto, spec) {
        const protoType = getType(proto);
        const {
            isSolid = !!(protoType & typeSolid),
            isVisible = !!(protoType & typeVisible),
            canInteract = !!(protoType & typeInteract),
            hasMind = !!(protoType & typeMind),
            input: input,
            location: {x, y} = {x: 0, y: 0},
            zIndex: z = getZ(proto),
            glyph = glyphs[proto],
            name,
        } = spec;

        const id = alloc();
        setType(id, 0
            | (isSolid ? typeSolid : 0)
            | (isVisible ? typeVisible : 0)
            | (canInteract ? typeInteract : 0)
            | (hasMind ? typeMind : 0)
            | (input ? typeInput : 0)
        );
        setLoc(id, {x, y});
        setZ(id, z);
        glyphs[id] = typeof glyph == 'string' ? (glyph.codePointAt(0) || 0xfffd) : glyph;

        const memory = new Map();

        // TODO consider promoting name to a first class sparse component outside of memory
        if (name) memory.set('name', JSON.stringify(name));

        if (memory.size) memories.set(id, memory);
        else memories.delete(id);

        const created = createEntity(id);

        if (input) {
            /** @type {(() => void)[]} */
            const revokes = [];
            inputs.set(id, {input, revokes});
            const {proxy: ctl, revoke} = Proxy.revocable(({
                get entity() { return freezeEntity(id, entity(id)) },

                /** @param {string} code */
                queueInput(code) {
                    // TODO should the InputCtl just be guarded on this rather than revocable?
                    if (!hasType(id, typeInput)) throw new Error('entity does not accept input');
                    queueEvent(id, {type: 'input', code});
                },

                *events() {
                    const q = events.get(id);
                    if (q) for (const event of q)
                        yield freeze(event);
                },
            }), {});
            input(freeze(ctl));
            revokes.push(revoke);
        }

        return created;
    }

    /**
     * @param {number} id
     * @returns {CreatedEntity}
     */
    function createEntity(id) {
        return extendedEntity(id, /** @type {CreateEntity} */({
            create(spec) { return createSpec(id, spec); },
            destroy() {
                if (id == 0) throw new Error('Cannot destroy root entity');
                destroy(id);
            },
        }));
    }

    /** @returns {number} */
    function alloc() {
        let i = 0;
        for (; i < types.length; i+=2)
            if (!(types[i] & typeAlloc)) break;
        if (i >= types.length) {
            const size = types.length / 2;
            if (size >= maxShardSize)
                throw new Error('shard full');

            const newSize = Math.min(maxShardSize, types.length < 4096
                ? 2 * types.length
                : types.length + types.length/4);
            const newTypes = new Uint8Array(2 * newSize);
            const newLocs = new Int16Array(3 * newSize);
            const newGlyphs = new Uint32Array(newSize);

            newTypes.set(types);
            newLocs.set(locs);
            newGlyphs.set(glyphs);

            types = newTypes;
            locs = newLocs;
            glyphs = newGlyphs;
        }

        types[i]++;
        types[i+1] = 0;
        return i/2;
    }

    /** @param {number} id */
    function destroy(id) {
        if (!(types[2 * id] & typeAlloc)) return;
        setType(id, 0); // to run any component destructors
        types[2 * id]++;
    }

    /**
     * @param {number} typeFilter
     * @returns {Generator<number>}
     */
    function* ids(typeFilter) {
        const idx = typeIndex.get(typeFilter);
        if (idx) {
            yield *idx;
            return;
        }
        for (let i = 0; i <types.length; i += 2) {
            if (!(types[i] & typeAlloc)) continue;
            if (typeFilter && !(types[i+1] & typeFilter)) continue;
            yield i/2;
        }
    }

    /** @param {number} id @param {number} t */
    function hasType(id, t) {
        if (!(types[2 * id] & typeAlloc)) return false;
        if (!(types[2 * id + 1] & t)) return false;
        return true;
    }

    /** @param {number} id */
    function getTypeGen(id) { return types[2 * id] }

    /** @param {number} id */
    function getType(id) { return types[2 * id + 1] }

    /** @param {number} id @param {number} t */
    function setType(id, t) {
        const ot = types[2 * id + 1];
        types[2 * id + 1] = t;

        for (const [typeFilter, typeAlloc] of typeAllocs.entries()) {
            const was = ot & typeFilter;
            const is = t & typeFilter;
            if (is && !was) typeAlloc(id);
        }

        for (const [typeFilter, idx] of typeIndex.entries()) {
            const was = ot & typeFilter;
            const is = t & typeFilter;
            if (was && !is) idx.delete(id);
            if (is && !was) idx.add(id);
        }

        for (const [typeFilter, typeDestroy] of typeDestroys.entries()) {
            const was = ot & typeFilter;
            const is = t & typeFilter;
            if (was && !is) typeDestroy(id);
        }
    }

    /** @param {number} id */
    function getLoc(id) { return {x: locs[3 * id], y: locs[3 * id + 1]} }

    /** @param {number} id @param {Point} p */
    function setLoc(id, p) { ({
        x: locs[3 * id],
        y: locs[3 * id + 1]
    } = p) }

    /** @param {number} id */
    function getX(id) { return locs[3 * id] }

    /** @param {number} id */
    function getY(id) { return locs[3 * id + 1] }

    /** @param {number} id */
    function getZ(id) { return locs[3 * id + 2]; }

    /** @param {number} id @param {number} z */
    function setZ(id, z) { locs[3 * id + 2] = z; }
}

/**
 * deep object freeze that avoids the Readonly<{set foo()}> trap, and avoids
 * needing to pull in something heavier like harden()
 *
 * @template {object} O
 * @param {O} o
 * @returns {O}
 */
export function freeze(o) {
    // freeze the object first to break any cycles if we re-encounter this
    // object in the loop below (or any recursive sub-loop thereof)
    Object.freeze(o);

    for (const [_key, {value}] of Object.entries(Object.getOwnPropertyDescriptors(o))) {
        // skip accessor properties
        if (value === undefined) continue;

        // skip primitives
        if (typeof value !== 'object') continue;

        // skip already frozen objects
        if (Object.isFrozen(value)) continue;

        freeze(value);
    }
    // NOTE: this intentionally discards the Readonly<T> wrapper
    return o;
}

/** guard wraps all of an object's methods and accessors (and those of any
 * sub-objects) with any number of guard functions.
 *
 * Users should also freeze the object to prevent guard removal via property
 * mutation of redefinition.
 *
 * Guards may check the object passed to them, or ambient state available to
 * them, and should throw an error if the guarded object should no longer be
 * used.
 *
 * NOTE: an "obvious" next step would be to pass key/access info along to the
 *       guards, allowing for more granular policy; however such use case has
 *       not presented in boopworld yet, anticipated only by this comment ;-)
 *
 * @template {object} O
 * @param {O} o
 * @param {((o: O) => void)[]} guards
 * @returns {O}
 */
export function guard(o, ...guards) {
    const once = new WeakSet();
    walk(o);
    return o;

    /** @param {O} o */
    function walk(o, desc='') {
        if (once.has(o)) return;
        try {
            once.add(o);
        } catch(e) {
            throw new Error(`${e} in ${desc}`);
        }
        for (const [key, desc] of Object.entries(Object.getOwnPropertyDescriptors(o))) {
            const {value, get, set} = desc;
            if (typeof value === 'object' && desc.writable) {
                walk(value, `${desc}.${key}`);
                continue;
            }

            let dirty = false;
            if (typeof value === 'function') {
                desc.value = /** @param {any[]} args */ (...args) => {
                    for (const guard of guards) guard(o);
                    return value(...args);
                };
                dirty = true;
            }
            if (get) {
                desc.get = () => {
                    for (const guard of guards) guard(o);
                    return get();
                };
                dirty = true;
            }
            if (set) {
                desc.set = v => {
                    for (const guard of guards) guard(o);
                    set(v);
                };
                dirty = true;
            }
            if (dirty) Object.defineProperty(o, key, desc);
        }
    }
}
