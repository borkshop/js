export * as build from './build.js';

import {
  makeMortonMap,
  shadowField,
} from 'morty-mc-fov';

/** @template ID @typedef {import('morty-mc-fov').PointQuery<ID>} PointQuery */

import {
  generateRandoms,
  makeRandom,
} from 'xorbig';

import {
  makeBasicViewport,
  makeViewMemory,
} from './view.js';
/** @template {{[name: string]: unknown}} Datum
 * @typedef {import('./view.js').ViewportRead<Datum>} ViewportRead */
/** @typedef {import('./view.js').ViewMemory} ViewMemory */


export * as behavior from './behavior.js';

/**
 * @callback Interaction
 * @param {InteractCtx} ctx
 * @returns {void}
 */

/**
 * @typedef {object} InteractCtx
 * @prop {Entity} self
 * @prop {Entity} subject
 * @prop {number} time
 * @prop {(self: Event, subject: Event) => void} queueEvents
 */

/** @type {Interaction} */
function defaultInteraction(ctx) {
  const { self, subject } = ctx;
  ctx.queueEvents(
    { type: "hit", target: subject.ref },
    { type: "hitBy", entity: self.ref },
  );
}

/**
 * @callback Thunk
 * @param {ThunkCtx} ctx
 * @returns {ThunkRes}
 */

/**
 * @template Ext
 * @callback ThunkExt
 * @param {ThunkCtx} ctx
 * @param {Ext} ext
 * @returns {ThunkRes}
 */

/** @typedef {(
 *   | {ok: true, reason: string, waitFor?: ThunkWaitFor, next?: Thunk}
 *   | {ok: false, reason: string, waitFor?: ThunkWaitFor, next?: Thunk}
 * )} ThunkRes */

/** @param {string} [reason] @returns {ThunkRes} */
export function thunkDone(reason = 'done') { return { ok: true, reason } }

/**
 * @param {string} reason
 * @param {Thunk} [next]
 * @returns {ThunkRes}
 */
export function thunkFail(reason, next) { return { ok: false, reason, next } }

/**
 * @param {Thunk} next
 * @returns {ThunkRes}
 */
export function thunkContinue(next, reason = 'continue') { return { ok: true, next, reason } }

/**
 * @param {ThunkWaitFor} waitFor
 * @param {Thunk} [next]
 * @returns {ThunkRes}
 */
export function thunkWait(waitFor, next, reason = 'wait') { return { ok: true, waitFor, next, reason } }

/**
 * @typedef {(
 *   | EventType
 *   | "input"
 *   | {time: number}
 *   | {any: ThunkWaitFor[]}
 *   | {all: ThunkWaitFor[]}
 * )} ThunkWaitFor */

/**
 * @typedef {object} ThunkCtx
 * @prop {number} time
 * @prop {number} tick
 * @prop {(ref: EntityRef) => ROEntity|null} deref
 * @prop {Entity} self
 * @prop {(waitFor: ThunkWaitFor) => boolean} isReady
 * @prop {ThunkMemory} memory
 * @prop {() => number} random
 * @prop {() => IterableIterator<Readonly<Event>>} events
 * @prop {IterableIterator<InputDatum>} [input]
 * @prop {Move|undefined} move
 */

/**
 * @typedef {object} ThunkMemory
 * @prop {ViewMemory} view
 * @prop {(key: string) => any} get
 * @prop {(key: string, value: any) => void} set
 */

/** @param {ThunkRes} res */
function resultContinues(res) {
  const { next, waitFor } = res;
  return next || waitFor;
}

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
 * @prop {number} tick
 * @prop {Entity} root
 * @prop {(spec?: TypeSpec) => IterableIterator<Entity>} entities
 * @prop {(p: Point) => IterableIterator<Entity>} at
 * @prop {(r: Rect) => IterableIterator<[Point, Iterable<Entity>]>} within
 * @prop {() => IterableIterator<[Entity, Event]>} events
 * @prop {() => IterableIterator<[Entity, Move]>} moves
 * @prop {() => IterableIterator<{entity: Entity, remnant: RemnantCtx}>} reap
 * @prop {(ref: EntityRef) => Entity|null} deref
 * @prop {(name: string) => Entity|null} byName
 */

/**
 * @typedef {object} MindState
 * @prop {Thunk} thunk
 * @prop {ThunkCtx} ctx
 * @prop {ThunkWaitFor|undefined} waitFor
 * @prop {number|undefined} tick
 */

/**
 * @typedef {object} RemnantCtx
 * @prop {boolean} done
 * @prop {boolean} ok
 * @prop {string} [reason]
 * @prop {Thunk} thunk
 * @prop {ThunkWaitFor} [waitFor]
 * @prop {number} time
 * @prop {Move} [move]
 * @prop {Readonly<Event>[]} events
 * TODO provide frozen view
 * @prop {{
 *   keys: () => IterableIterator<string>,
 *   get: (key: string) => any,
 * }} memory
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
 * @callback InputBinder
 * @param {((dat: InputDatum) => void)|null} consumer
 */

/** @typedef {ReturnType<makeInput>} Input */

export function makeInput() {
  /** @type {((dat: InputDatum) => void)|null} */
  let consume = null;

  return Object.freeze({
    /** @type {InputBinder} */
    bind(consumer) { consume = consumer },

    /** @param {InputDatum} dat */
    provide(dat) {
      if (!consume) return false;
      consume(dat);
      return true;
    },
  });
}

/** @typedef {number} EntityRef */

/**
 * @typedef {object} Entity
 * @prop {EntityRef} ref
 * @prop {string} [name]
 * @prop {() => string} toString
 * @prop {Point} location
 * @prop {number} zIndex
 * @prop {number|string} glyph
 * @prop {boolean} isSolid
 * @prop {boolean} isVisible
 *
 * @prop {Interaction} [interact]
 * @prop {Thunk} [mind]
 * @prop {MindState} [mindState]
 * @prop {InputBinder} [input]
 * @prop {(spec: EntitySpec) => Entity} create
 * @prop {() => void} destroy
 */

/**
 * @typedef {object} ROEntity
 * @prop {EntityRef} ref
 * @prop {string} [name]
 * @prop {() => string} toString
 * @prop {Point} location
 * @prop {number} zIndex
 * @prop {number|string} glyph
 * @prop {boolean} isSolid
 * @prop {boolean} isVisible
 * @prop {boolean} canInteract
 */

/** @typedef {Partial<Omit<Entity, "ref" | "toString">>} EntitySpec */

/** @typedef {(
 *   | {key: string}
 * )} InputDatum
 */

/** @typedef {(
 *   | {type: "hit", target: EntityRef}
 *   | {type: "hitBy", entity: EntityRef}
 *   | {type: "move", from: Point, to: Point, here: EntityRef[]}
 *   | {type: "inspect", here: EntityRef[]}
 *   | {type: "view", view: ViewportRead<{ref?: EntityRef}>}
 *   | {type: "input", input: InputDatum}
 * )} Event
 */

/** @typedef {Event["type"]} EventType */

/**
 * @callback Builder
 * @param {ShardCtl} ctl
 * @returns void
 */

/** @param {(s: string) => boolean} choose */
function untitledNameGen(choose) {
  const name = 'untitled';
  let nom = name, count = 1;
  while (!choose(nom))
    nom = `${name} (${++count})`;
}

/**
 * @param {object} options
 * @param {Builder} options.build
 * @param {(ctl: ShardCtl) => void} [options.control]
 * @param {number} [options.moveRate]
 * @param {() => number} [options.now]
 * @param {number} [options.defaultTimeout]
 * @param {number} [options.size]
 * @param {number|bigint|string} [options.seed]
 * @param {(choose: (s: string) => boolean, ent: ROEntity) => void} [options.chooseName]
 * @param {TypeSpec} [options.updateWaitsFor]
 * @returns {Shard}
 */
export function makeShard({
  build,
  control,
  moveRate = 1,
  now = () => performance.now(),
  defaultTimeout = 100,
  size = 64,
  seed = 0,
  chooseName = untitledNameGen,
  updateWaitsFor = { hasInput: true },
}) {

  //// random number generator generator
  const randoms = generateRandoms(seed);
  function nextRandom() {
    const res = randoms.next();
    if (res.done) throw new Error('exhausted infinite supply of rngs'); // inconceivable
    return res.value;
  }

  //// type system definitions and setup
  const
    maxShardSize = 64 * 1024

    // types contains two fields per entity
    // the first value is a generation counter
    // which both alloc and destroy increment
    // so its low bit serves as an allocated bit flag
    , typeAlloc = 0x01

    // the second value is the component bit field
    , typeVisible = 0x01
    , typeSolid = 0x02
    , typeMind = 0x04
    , typeInput = 0x08
    , typeInteract = 0x10

    ;

  //// shard init
  let time = 0;
  let tick = 0;
  const turnRefs = makeEntityRefScope();

  /** @type {Map<number, Set<number>>} */
  const typeIndex = new Map();

  /** @type {Map<number, (id: number) => void>} */
  const typeDestroys = new Map();

  let types = new Uint8Array(2 * size);

  //// dense components
  let locs = new Int16Array(3 * size);
  let glyphs = new Uint32Array(size);
  /** @type {Set<number>} */
  const locInvalid = new Set(); // TODO this would probably be better as an id list that we insort into
  const { at: locAt, within: locWithin } = /** @type {PointQuery<number>} */ (makeMortonMap(() => ps => {
    for (const id of locInvalid) {
      if (!(getTypeGen(id) & typeAlloc)) {
        ps.delete(id);
        continue;
      }

      // translate from int16 loc space to uint32 index space
      const { x, y } = getLoc(id);
      ps.set(id, {
        x: x + 0x7fff,
        y: y + 0x7fff,
      });
    }
    locInvalid.clear();
  }));

  /** narrowed and translated location index query facet
   * @type {PointQuery<number>} */
  const locQuery = Object.freeze({
    /** @param {Point} pos */
    *at({ x, y }) { yield* locAt({ x: x + 0x7fff, y: y + 0x7fff }) },
    /** @param {Rect} r */
    *within({ x, y, w, h }) {
      const qr = { x: x + 0x7fff, y: y + 0x7fff, w, h };
      for (const [{ x, y }, it] of locWithin(qr))
        yield [{ x: x - 0x7fff, y: y - 0x7fff }, it];
    },
  });

  /**
   * @param {Point} at
   * @param {number} r
   */
  function clampedViewBox({ x, y }, r) {
    x -= r, y -= r;
    let w = 2 * r, h = 2 * r;
    if (x < -0x7fff) {
      w -= -0x7fff - x;
      x = -0x7fff;
    }
    if (x + w > 0x7fff) {
      w -= x + w - 0x7fff
      x = 0x7fff;
    }
    if (y < -0x7fff) {
      h -= -0x7fff - y;
      y = -0x7fff;
    }
    if (y + h > 0x7fff) {
      h -= y + h - 0x7fff
      y = 0x7fff;
    }
    return { x, y, w, h };
  }

  //// name component init

  /** @type {Map<number, string>} */
  const names = new Map();

  /** @type {Map<string, number>} */
  const byName = new Map();

  //// movement component init 
  /** @type {Map<number, Move>} */
  const moves = new Map();
  let nextMove = 1;
  let nextSense = 1;
  typeIndex.set(typeSolid, new Set()); // TODO replace this with a location index

  //// events component init
  /** @type {Map<number, Event[]>} */
  const events = new Map();

  //// input component init
  /** @typedef {{has: () => boolean} & IterableIterator<InputDatum>} InputStream */

  /** @type {Map<number, InputStream>} */
  const inputs = new Map();

  /** @type {Map<number, () => void>} */
  const inputRevokes = new Map();

  /** @type {Map<number, InputBinder>} */
  const inputBinds = new Map();

  typeIndex.set(typeInput, new Set());
  typeDestroys.set(typeInput, id => {
    const bind = inputBinds.get(id);
    if (bind) bind(null);
    const revoke = inputRevokes.get(id);
    if (revoke) revoke();
    inputs.delete(id);
    inputRevokes.delete(id);
    inputBinds.delete(id);
  });

  //// interaction component init

  /** @type {Map<number, Interaction>} */
  const interacts = new Map();

  //// mind component init

  /** @type {Map<number, () => void>} */
  const execRevoke = new Map();

  /** @type {Map<number, Thunk>} */
  const execThunk = new Map();

  /** @type {Map<number, Map<string, string>>} */
  const memories = new Map();

  /** @type {Map<number, ViewMemory>} */
  const views = new Map();

  /** @type Map<number, RefScope> */
  const execRefs = new Map();

  /** @type {Map<number, ThunkCtx>} */
  const execCtx = new Map();

  /** @type {Map<number, number>} */
  const execTick = new Map();

  /** @type {Map<number, ThunkWaitFor>} */
  const execWait = new Map();

  typeDestroys.set(typeMind, id => {
    const revoke = execRevoke.get(id);
    if (revoke) revoke();
    execRevoke.delete(id);
    execThunk.delete(id);
    memories.delete(id);
    execCtx.delete(id);
    execTick.delete(id);
    execWait.delete(id);
  });

  // turn ready() is gated by this filter so make sure it's indexed
  const updateWaitsForType = typeSpecFilter(updateWaitsFor);
  if (!typeIndex.has(updateWaitsForType))
    typeIndex.set(updateWaitsForType, new Set());

  /**
   * @typedef {object} Remnant
   * @prop {boolean} done
   * @prop {boolean} ok
   * @prop {string} [reason]
   * @prop {number} time
   * @prop {number} tick
   * @prop {Thunk} thunk
   * @prop {ThunkWaitFor} [waitFor]
   * @prop {Event[]} events
   * @prop {Move} [move]
   * @prop {Map<string, string>} memory]
   */

  /** @type {Map<number, Remnant>} */
  const remnants = new Map();

  // mark the root/zero entity as allocated, and setup some fallbacks
  if (alloc() != 0) throw new Error('inconceivable root allocation');
  glyphs[0] = 0x20; // ascii <space>

  // build all entities at time=0
  build(makeCtl());

  return freeze({
    update(deadline = now() + defaultTimeout) {
      if (
        nextMove > time &&  // after movement has been processed
        nextSense > time && // after sensory input has been processed
        runMinds(deadline)  // run minds until ready for next turn
      ) {

        // start next time slice
        time++, tick = 0;
        events.clear(); // clear mind event sources
        for (const id of execTick.keys()) // reset running tick counts
          execTick.set(id, tick);

        // revoke all issued EntityRefs
        turnRefs.clear();
        for (const refs of execRefs.values())
          refs.clear();

      }

      if (
        time >= nextMove &&    // once time has advanced far enough
        processMoves(deadline) // process moves
      ) {
        nextMove = time + moveRate;
        moves.clear();
      }

      if (
        nextMove > time &&      // after movement has been processed
        time >= nextSense &&    // and if we haven't done so yet this turn
        processSenses(deadline) // process sensory input
      ) {
        nextSense = nextMove;
      }

      // call user control between moves
      if (control) {
        // will happen at the start of each new turn
        // and after each round of interstitial thought

        // NOTE: deadline oblivious, always call user control
        if (nextMove > time) control(makeCtl());
      }

    },
  });

  /** @param {TypeSpec} spec */
  function typeSpecFilter(spec) {
    const {
      isSolid = false,
      isVisible = false,
      canInteract = false,
      hasMind = false,
      hasInput = false,
    } = spec;
    return 0
      | (isSolid ? typeSolid : 0)
      | (isVisible ? typeVisible : 0)
      | (canInteract ? typeInteract : 0)
      | (hasMind ? typeMind : 0)
      | (hasInput ? typeInput : 0);
  }

  /** @returns {ShardCtl} */
  function makeCtl() {
    return freeze(guard({
      get time() { return time },
      get tick() { return tick },

      get root() { return fullEntity(0) },

      *entities(spec = {}) {
        for (const id of ids(typeSpecFilter(spec)))
          yield fullEntity(id);
      },

      *at(p) {
        for (const id of locQuery.at(p))
          yield fullEntity(id);
      },

      *within(r) {
        for (const [pos, ids] of locQuery.within(r)) {
          const ents = [];
          for (const id of ids)
            ents.push(fullEntity(id));
          yield [pos, ents];
        }
      },

      *events() {
        for (const [id, es] of events.entries()) {
          const ent = fullEntity(id);
          for (const event of es)
            yield [ent, freeze(event)];
        }
      },

      *moves() {
        for (const [id, move] of moves) {
          const ent = fullEntity(id);
          yield [ent, move];
        }
      },

      *reap() {
        for (const [id, remnant] of remnants.entries()) {
          remnants.delete(id);
          const {
            done, ok, reason,
            thunk, waitFor,
            time, move, events,
            memory,
          } = remnant;
          yield freeze({
            entity: fullEntity(id),
            remnant: {
              done, ok, reason,
              thunk, waitFor,
              time, move, events,
              memory: {
                keys() { return memory.keys() },
                get(key) {
                  const json = memory.get(key);
                  return json && JSON.parse(json);
                },
              },
            },
          });
        }
      },

      deref(ref) {
        const id = turnRefs.deref(ref);
        return id == null ? null : fullEntity(id);
      },

      byName(name) {
        const id = byName.get(name);
        return id === undefined ? null : fullEntity(id);
      },
    }, makeTimeGuard('ShardCtl')));
  }

  /** @param {number} deadline */
  function runMinds(deadline) {
    wakeMinds();
    while (stepMinds(deadline)) {
      tick++;
      if (ready()) return true;
    }
    return ready();
  }

  /** @param {number} deadline */
  function stepMinds(deadline) {
    if (!execTick.size) return false;
    for (const [id, t] of execTick)
      if (t <= tick) {
        stepMind(id);
        if (now() > deadline) return false;
      }
    return true;
  }

  /**
   * @param {number} id
   * @param {object} params
   * @param {boolean} params.done
   * @param {boolean} params.ok
   * @param {string} [params.reason]
   * @param {Thunk} [params.thunk]
   * @param {number} [params.tick]
   * @param {ThunkCtx} [params.ctx]
   * @param {Map<string, string>} [params.memory]
   */
  function reapMind(id, {
    done, ok, reason,
    thunk = execThunk.get(id),
    tick = execTick.get(id) || 0,
    ctx = execCtx.get(id),
    memory = memories.get(id),
  }) {
    if (!thunk || !ctx) return;

    const { time, move } = ctx;
    const events = [...ctx.events()];

    remnants.set(id, freeze({
      // reap note
      done, ok, reason,

      // thunk state
      thunk,
      tick,
      waitFor: execWait.get(id),

      // ctx state
      time,
      events,
      move,
      // TODO view state

      // TODO proxy memory to lazily parse gotten keys
      memory: new Map(memory ? memory.entries() : []),
    }));
    updateType(id, t => t & ~typeMind);
  }

  /**
   * @param {number} id
   * @param {ThunkWaitFor} waitFor
   * @returns {boolean}
   */
  function execRunnable(id, waitFor) {
    if (typeof waitFor == 'string') switch (waitFor) {
      case 'input':
        return inputs.get(id)?.has() || false;

      default:
        const es = events.get(id);
        if (!es) return false;
        return es.some(({ type }) => type == waitFor);
    }
    if ('any' in waitFor) return waitFor.any.some(w => execRunnable(id, w));
    if ('all' in waitFor) return waitFor.all.every(w => execRunnable(id, w));
    if ('time' in waitFor) return time >= waitFor.time;
    assertNever(waitFor, 'invalid ThunkWaitFor');
    return false;
  }

  function ready() {
    // vacuously ready in pre-history
    if (time <= 0) return true;

    // wait for all runnable minds to have executed at least one tick
    for (const tick of execTick.values())
      if (tick < 1) return false;

    // wait for all specified entities to choose a move
    for (const id of ids(updateWaitsForType))
      if (!moves.has(id)) return false;

    return true;
  }

  /** @param {number} deadline */
  function processMoves(deadline) {
    // TODO groupwise conflict resolution or at least hacked via initiative
    for (const [id, move] of moves.entries()) {
      if (now() > deadline) return false;
      const refs = getExecRefs(id);

      moves.delete(id);

      const { x, y } = getLoc(id);
      switch (move) {
        // TODO interact with
        case 'up':
          moveTo(x, y - 1);
          break;
        case 'right':
          moveTo(x + 1, y);
          break;
        case 'down':
          moveTo(x, y + 1);
          break;
        case 'left':
          moveTo(x - 1, y);
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
        const hit = hasType(id, typeSolid)
          ? Array.from(at(typeSolid, tox, toy))
          : [];
        if (!hit.length) {
          setLoc(id, { x: tox, y: toy });
          queueEvent(id, {
            type: "move",
            from: { x, y },
            to: { x: tox, y: toy },
            here: Array
              .from(at(typeInteract, tox, toy))
              .filter(here => here != id)
              .map(refs.ref),
          });
          return;
        }

        else hit.sort((a, b) => getZ(b) - getZ(a));
        const hitId = hit[0];

        let done = false;
        const { proxy: ctx, revoke } = Proxy.revocable(/** @type {InteractCtx} */({
          self: fullEntity(id, refs),
          subject: fullEntity(hitId, refs),
          time,
          queueEvents(self, subject) {
            queueEvent(id, self);
            if (hasType(hitId, typeMind))
              queueEvent(hitId, subject);
            done = true;
          },
        }), {});

        const interact = interacts.get(hitId);
        if (interact) interact(ctx);
        if (!done) defaultInteraction(ctx);
        revoke();
      }

      function inspect() {
        queueEvent(id, {
          type: "inspect",
          here: Array
            .from(at(typeInteract, x, y))
            .filter(here => here != id)
            .map(refs.ref),
        });
      }
    }
    return true;
  }

  /** @param {number} deadline */
  function processSenses(deadline) {
    // NOTE: currently sight is the only sense, which is automatically
    // granted to every minded entity, an "obvious" generalization would be
    // to make it multi-modal and/or independently granted to entities
    for (const id of execThunk.keys()) {
      if (now() > deadline) return false;
      const loc = getLoc(id);
      const refs = getExecRefs(id);

      // NOTE: we could also vary these threshold per entity
      const idThreshold = .1;
      const seeThreshold = .001;

      // NOTE: currently everything is fully lit all the time, so field
      // depth is the only thing that matters; really this should be
      // "light present, attenuated by field depth"
      const maxIDDepth = Math.floor(Math.sqrt(1 / idThreshold));
      const maxGlyphDepth = Math.floor(Math.sqrt(1 / seeThreshold));

      const { view, update } = makeBasicViewport();
      update.resize(clampedViewBox(loc, maxGlyphDepth));
      for (const entry of shadowField(loc, {
        bounds: {
          x: -0x7fff, y: -0x7fff,
          w: 0xffff, h: 0xffff,
        },
        maxDepth: maxGlyphDepth,
        query(pos, depth) {
          if (!view.contains(pos)) return null;

          const ids = [...locQuery.at(pos)];
          const blocked = ids.some(atID => hasType(atID, typeSolid) && atID != id);
          const visible = ids.filter(atID => hasType(atID, typeVisible));

          // NOTE: here's the point where we could stratify things into layers,
          // a good approach would be to filter visible into several z-range
          // buckets, and take the max-z within each; although, one could
          // imagine other bucket compositors, e.g. to dynamically create
          // ground tiles from parts
          const see = visible.length
            ? visible[bestIndex(visible.map(getZ), (a, b) => a > b)]
            : 0;

          return {
            blocked,
            at: {
              glyph: glyphs[see],
              id: depth > maxIDDepth ? 0 : see,
            },
          };
        },
      })) {
        const { pos, at: { glyph, id } } = entry;
        const ref = refs.ref(id);
        update.set(pos, { glyph, ref });
      }

      queueEvent(id, { type: 'view', view });
    }
    return true;
  }

  /**
   * @param {number} id
   * @param {Move|null} move
   * @returns {void}
   */
  function setMove(id, move) {
    if (move) moves.set(id, move);
    else moves.delete(id);
  }

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
   * @template {Entity|ROEntity} E
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
    const asof = time, asofTick = tick;
    return () => {
      if (time > asof || tick > asofTick)
        throw new Error(`Cannot access obsolete ${desc}`);
    };
  }

  /**
   * @param {number} id
   * @returns {() => void}
   */
  function makeEntityGuard(id, suffix = '') {
    const guardGen = getTypeGen(id);
    return () => {
      const gen = getTypeGen(id);
      if (!(gen & typeAlloc)) throw new Error(`Cannot access destroyed Entity${suffix}`);
      if (gen != guardGen) throw new Error(`Cannot access reallocated Entity${suffix}`);
    };
  }

  /**
   * @param {number} id
   * @returns {ROEntity}
   */
  function roEntity(id, scope = turnRefs) {
    return freezeEntity(id, {
      toString() { return entityString(id) },
      get ref() { return scope.ref(id) },
      get name() { return names.get(id) || '' },
      get glyph() { return String.fromCodePoint(glyphs[id]) },
      get zIndex() { return getZ(id) },
      get location() { return getLoc(id) },
      get isSolid() { return hasType(id, typeSolid) },
      get isVisible() { return hasType(id, typeVisible) },
      get canInteract() { return interacts.has(id) },
    });
  }

  /** @param {number} id */
  function entityString(id) {
    const gen = getTypeGen(id);
    const { x, y } = getLoc(id), z = getZ(id);
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
    const name = names.get(id);
    return `Entity<${name ? `name:${name} ` : ''}id:${id} gen:${gen >> 1} @${x},${y},${z} [${tags.join(' ')}] glyph:${JSON.stringify(glyph)}>`;
  }

  /** @typedef {ReturnType<makeEntityRefScope>} RefScope */

  /**
   * @param {object} [params]
   * @param {() => number} [params.randomInt]
   * @param {(ref: number, to: number) => void} [params.publish]
   * @param {(ref: number) => boolean} [params.defined]
   */
  function makeEntityRefScope({
    randomInt = nextRandom().randomInt,
    publish = () => { },
    defined = () => false,
  } = {}) {
    /** @type {Map<number, EntityRef>} */
    const idToRef = new Map();

    /** @type {Map<EntityRef, EntityRef>} */
    const refToRef = new Map();

    return Object.freeze({

      /**
       * @param {object} [params]
       * @param {() => number} [params.randomInt]
       */
      sub({
        randomInt = nextRandom().randomInt,
      } = {}) {
        return makeEntityRefScope({
          randomInt,
          publish(ref, to) {
            refToRef.set(ref, to);
            publish(ref, to);
          },
          defined(ref) {
            return refToRef.has(ref) || defined(ref);
          },
        });
      },

      clear() {
        idToRef.clear();
        refToRef.clear();
      },

      /**
       * @param {number} id
       * @returns {EntityRef}
       */
      ref(id) {
        let ref = idToRef.get(id);
        if (ref == undefined) {
          // generate a random ref
          do {
            ref = randomInt();
          } while (ref == 0 || refToRef.has(ref) || defined(ref));

          // store packed ref
          const to = id << 8 | getTypeGen(id);
          refToRef.set(ref, to);
          publish(ref, to);

          // save the random token
          idToRef.set(id, ref);
        }
        return ref;
      },

      /**
       * @param {EntityRef} ref
       * @returns {number|null}
       */
      deref(ref) {
        if (ref == 0) return null;

        // ref invalid or revoked (via clear)
        const rr = refToRef.get(ref);
        if (rr == undefined) return null;
        ref = rr;

        // unpack stored ref and validate
        const id = ref >> 8;
        const refGen = ref & 0xff;

        // should be rare, since this would mean we ref()ed a deallocated id
        if (!(refGen & typeAlloc)) return null;

        // this is the primary thing we're protecting against: id reuse
        const gen = getTypeGen(id);
        if (gen != refGen) return null;

        return id;
      },

    });
  }

  /**
   * @param {number} proto
   * @param {EntitySpec} spec
   * @returns {Entity}
   */
  function createSpec(proto, spec, scope = turnRefs) {
    const {
      isSolid = hasType(proto, typeSolid),
      isVisible = hasType(proto, typeVisible),
      location,
      zIndex = getZ(proto),
      glyph = glyphs[proto],
      interact = interacts.get(proto),
    } = spec;
    const ent = fullEntity(alloc(), scope);
    ent.isSolid = isSolid;
    ent.isVisible = isVisible;
    if (location) ent.location = location;
    ent.zIndex = zIndex;
    ent.glyph = glyph;
    ent.interact = interact;
    ent.name = spec.name;
    ent.mind = spec.mind;
    ent.input = spec.input;
    // TODO copy memories
    return ent;
  }

  /** @param {number} id */
  function assignName(id, scope = turnRefs) {
    if (!names.has(id)) {
      const ent = roEntity(id, scope);
      chooseName(name => setName(id, name), ent);
    }
    if (!names.has(id)) untitledNameGen(name => setName(id, name));
    const name = names.get(id);
    if (!name) throw new Error('Failed to assign a name');
    return name;
  }

  /**
   * @param {number} id
   * @returns {Entity}
   */
  function fullEntity(id, scope = turnRefs) {
    return freezeEntity(id, {
      create(spec) { return createSpec(id, spec, scope); },
      destroy() {
        if (id == 0) throw new Error('Cannot destroy root entity');
        destroy(id);
      },

      toString() { return entityString(id) },
      get ref() { return scope.ref(id) },

      get name() { return names.get(id) || '' },
      set name(name) {
        let nom = name, count = 1;
        while (!setName(id, nom))
          nom = `${name} (${++count})`;
      },

      get isSolid() { return hasType(id, typeSolid) },
      set isSolid(is) {
        updateType(id, t => is
          ? t | typeSolid
          : t & ~typeSolid
        )
      },

      get isVisible() { return hasType(id, typeVisible) },
      set isVisible(is) {
        updateType(id, t => is
          ? t | typeVisible
          : t & ~typeVisible
        )
      },

      get location() { return getLoc(id) },
      set location(loc) { setLoc(id, loc) },

      get zIndex() { return getZ(id) },
      set zIndex(z) { setZ(id, z) },

      get glyph() { return String.fromCodePoint(glyphs[id]) },
      set glyph(glyph) { setGlyph(id, glyph) },

      get interact() { return interacts.get(id) },
      set interact(interact) {
        updateType(id, t => interact
          ? t | typeInteract
          : t & ~typeInteract);
        if (interact) interacts.set(id, interact);
      },

      get mind() { return execThunk.get(id) },
      set mind(mind) {
        updateType(id, t => mind
          ? t | typeMind
          : t & ~typeMind);
        if (mind) {
          // NOTE: any prior memories remain
          // TODO add optional memory init param
          const revoke = execRevoke.get(id);
          if (revoke) revoke();
          execRevoke.delete(id);
          execCtx.delete(id);
          execTick.delete(id);
          execWait.set(id, time < 1 ? { time: 1 } : { time });
          execThunk.set(id, mind);
          assignName(id, scope)
        }
      },

      get mindState() {
        const thunk = execThunk.get(id);
        if (!thunk) return undefined;
        return freeze({
          thunk,
          ctx: getExecCtx(id),
          tick: execTick.get(id),
          waitFor: execWait.get(id),
        });
      },

      get input() { return inputBinds.get(id) },
      set input(bind) {
        updateType(id, t => bind
          ? t | typeInput
          : t & ~typeInput);
        if (bind) {
          const oldBind = inputBinds.get(id);
          const oldRevoke = inputRevokes.get(id);
          if (oldBind) oldBind(null);
          if (oldRevoke) oldRevoke();
          const { revoke, give, ...input } = makeInputQueue(id);
          inputs.set(id, Object.freeze(input));
          inputRevokes.set(id, revoke);
          inputBinds.set(id, bind);
          bind(give);
        }
      },

    });
  }

  /** @param {number} id */
  function makeInputQueue(id) {
    let revoked = false;

    /** @type {InputDatum[]} */
    const buffer = [];

    /** @type {IterableIterator<InputDatum>} */
    const it = Object.freeze({
      [Symbol.iterator]() { return it },
      next() {
        const value = buffer.shift();
        if (!value) return { done: true, value };
        queueEvent(id, { type: 'input', input: value });
        return { value };
      },
    });

    return {
      revoke() { revoked = true },

      /** @param {InputDatum} dat */
      give(dat) {
        if (revoked) throw new Error('Cannot provide to revoked input');
        buffer.push(dat);
      },

      has() { return buffer.length > 0 },
      ...it,
    };
  }

  /** @returns {number} */
  function alloc() {
    let i = 0;
    for (; i < types.length; i += 2)
      if (!(types[i] & typeAlloc)) break;
    if (i >= types.length) {
      const size = types.length / 2;
      if (size >= maxShardSize)
        throw new Error('shard full');

      const newSize = Math.min(maxShardSize, types.length < 4096
        ? 2 * types.length
        : types.length + types.length / 4);
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
    types[i + 1] = 0;

    const id = i / 2;

    // TODO base alloc notification for systems that don't care about a particular type
    locInvalid.add(id);

    return id;
  }

  /** @param {number} id */
  function destroy(id) {
    if (!(types[2 * id] & typeAlloc)) return;
    setType(id, 0); // to run any component destructors

    // TODO base destroy notification for systems that don't care about a particular type
    locInvalid.add(id);

    types[2 * id]++;
  }

  /**
   * @param {number} typeFilter
   * @returns {Generator<number>}
   */
  function* ids(typeFilter) {
    const idx = typeIndex.get(typeFilter);
    if (idx) {
      yield* idx;
      return;
    }
    for (let i = 0; i < types.length; i += 2) {
      if (!(types[i] & typeAlloc)) continue;
      if (typeFilter && !(types[i + 1] & typeFilter)) continue;
      yield i / 2;
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

  /** @param {number} id @param {(t: number) => number} up */
  function updateType(id, up) {
    const oldType = types[2 * id + 1];
    const newType = up(oldType);
    if (newType != oldType) {
      types[2 * id + 1] = newType;
      notifyType(id, oldType, newType);
    }
  }

  /** @param {number} id @param {number} newType */
  function setType(id, newType) {
    const oldType = types[2 * id + 1];
    types[2 * id + 1] = newType;
    notifyType(id, oldType, newType);
  }

  /** @param {number} id @param {number} oldType @param {number} newType */
  function notifyType(id, oldType, newType) {
    // NOTE: intentionally provides no allocation notification
    // - systems should instead be designed to deal with zero/missing component data
    //   - e.g. how defaultInteraction is resolved on demand
    // - heritage all the way up from the root entity should suffice
    //   - e.g. how default glyph=" " flows through

    for (const [typeFilter, idx] of typeIndex.entries()) {
      const was = oldType & typeFilter;
      const is = newType & typeFilter;
      if (was && !is) idx.delete(id);
      if (is && !was) idx.add(id);
    }

    for (const [typeFilter, typeDestroy] of typeDestroys.entries()) {
      const was = oldType & typeFilter;
      const is = newType & typeFilter;
      if (was && !is) typeDestroy(id);
    }
  }

  /** @param {number} id */
  function getLoc(id) { return { x: locs[3 * id], y: locs[3 * id + 1] } }

  /** @param {number} id @param {Point} p */
  function setLoc(id, p) {
    ({
      x: locs[3 * id],
      y: locs[3 * id + 1]
    } = p);
    locInvalid.add(id);
  }

  /** @param {number} id */
  function getX(id) { return locs[3 * id] }

  /** @param {number} id */
  function getY(id) { return locs[3 * id + 1] }

  /** @param {number} id */
  function getZ(id) { return locs[3 * id + 2]; }

  /** @param {number} id @param {number} z */
  function setZ(id, z) { locs[3 * id + 2] = z; }

  /** @param {number} id @param {number|string} glyph */
  function setGlyph(id, glyph) {
    glyphs[id] = typeof glyph == 'string' ? (glyph.codePointAt(0) || 0xfffd) : glyph;
  }

  /** @param {number} id @param {string} [name] */
  function setName(id, name) {
    if (name) {
      if (byName.has(name)) return false;
      names.set(id, name);
      byName.set(name, id);
    } else {
      const prior = names.get(id);
      names.delete(id);
      if (prior) byName.delete(prior);
    }
    return true;
  }

  /** @param {number} id */
  function stepMind(id) {
    const res = stepThunk(id);
    const { ok, reason, next, waitFor } = res;
    if (next) execThunk.set(id, next);
    if (waitFor && !execRunnable(id, waitFor)) {
      if (typeof waitFor == 'object') freeze(waitFor);
      execWait.set(id, waitFor);
      execTick.delete(id);
      return false;
    }
    if (!resultContinues(res)) {
      reapMind(id, { done: true, ok, reason });
      return false;
    }
    return true;
  }

  function wakeMinds() {
    for (const [id, waitFor] of execWait)
      if (execRunnable(id, waitFor))
        wakeMind(id);
  }

  /** @param {number} id */
  function wakeMind(id) {
    execWait.delete(id);
    execTick.set(id, tick);
  }

  /** @param {number} id */
  function stepThunk(id) {
    const thunk = execThunk.get(id);
    if (!thunk) {
      execTick.delete(id);
      return thunkFail('no thunk defined');
    }
    const ctx = getExecCtx(id);
    const tick = (execTick.get(id) || 0) + 1;
    execTick.set(id, tick);
    return thunk(ctx);
  }

  /** @param {number} id */
  function getExecCtx(id) {
    const prior = execCtx.get(id);
    if (prior) return prior;
    const { ctx, revoke } = makeExecCtx(id);
    execRevoke.set(id, revoke);
    execCtx.set(id, ctx);
    return ctx;
  }

  /** @param {number} id */
  function getExecRefs(id) {
    let scope = execRefs.get(id);
    if (!scope) {
      scope = turnRefs.sub();
      execRefs.set(id, scope);
    }
    return scope;
  }

  /** @param {number} id */
  function makeExecCtx(id) {
    const refs = getExecRefs(id);

    /** @type {ReturnType<makeRandom>|null} */
    let rng = null;

    function getRNG() {
      if (!rng) {
        const seed = memoryGet(id, 'rngState');
        rng = seed != null ? makeRandom(seed) : nextRandom();
      }
      return rng;
    }

    const { proxy: memory, revoke: revokeMemory } = Proxy.revocable(/** @type {ThunkMemory} */({
      get view() {
        let view = views.get(id);
        if (!view) views.set(id, view = makeViewMemory());
        return view;
      },

      get(key) {
        switch (key) {
          case 'rngState':
            return getRNG().toString();
          default:
            return memoryGet(id, key);
        }
      },
      set(key, value) {
        switch (key) {
          case 'rngState':
            rng = makeRandom(value);
            memorySet(id, 'rngState', rng);
            break;
          default:
            memorySet(id, key, value);
        }
      },
    }), {});

    const input = inputs.get(id);

    const { proxy: ctx, revoke: revokeCtx } = Proxy.revocable(
      freeze(guard(/** @type {ThunkCtx} */({
        get time() { return time },
        get tick() { return tick },

        deref(ref) {
          const id = refs.deref(ref);
          return id ? roEntity(id, refs) : null;
        },

        get self() { return fullEntity(id, refs) },

        isReady(waitFor) { return execRunnable(id, waitFor) },

        memory,

        random() { return getRNG().random() },

        *events() {
          const q = events.get(id);
          if (q) for (const event of q)
            yield freeze(event);
        },

        input,

        get move() { return moves.get(id) },
        set move(m) { setMove(id, m || null) },

      }), makeEntityGuard(id))),
      {});

    return {
      ctx,
      revoke() {
        revokeCtx();
        revokeMemory();
        if (rng) memorySet(id, 'rngState', rng);
      },
    };

    /** @param {number} id @param {string} key */
    function memoryGet(id, key) {
      const memory = memories.get(id);
      const meme = memory && memory.get(key);
      return meme ? JSON.parse(meme) : null;
    }

    /** @param {number} id @param {string} key @param {any} value */
    function memorySet(id, key, value) {
      let memory = memories.get(id);
      if (!memory) memories.set(id, memory = new Map());
      if (value == null) memory.delete(key);
      else memory.set(key, JSON.stringify(value));
    }

  }
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

  for (const [_key, { value }] of Object.entries(Object.getOwnPropertyDescriptors(o))) {
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
  function walk(o, path = '') {
    if (Object.isFrozen(o))
      throw new Error(`cannot guard frozen object${path}`);

    if (once.has(o)) return;
    try {
      once.add(o);
    } catch (e) {
      throw new Error(`${e} in ${path}`);
    }
    for (const [key, desc] of Object.entries(Object.getOwnPropertyDescriptors(o))) {
      const { value, get, set } = desc;
      if (typeof value === 'object' && desc.writable && !Object.isFrozen(value)) {
        walk(value, `${path}.${key}`);
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

/**
 * @template T
 * @param {T[]} data
 * @param {(a: T, b: T) => boolean} prefer
 */
function bestIndex(data, prefer) {
  if (!data.length) return NaN;
  let i = 0;
  for (let j = 1; j < data.length; j++)
    if (prefer(data[j], data[i])) i = j;
  return i;
}

/**
 * @param {never} _
 * @param {string} desc
 */
function assertNever(_, desc) {
  throw new Error(desc);
}
