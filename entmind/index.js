// TODO implement incoming world events? or is that sufficiently up to any
// given domain/scope?
//
// So a perhaps very important kind of thought is responding to world events.
// This could be sensory input, or it could be feedback (error or otherwise)
// from last round's actions. Examples:
// - internal events like "I'm hungry" or "I've learned a new ability"... the
//   former bleeds into status effects, at least their edge triggers ...
// - external like "I've been hit" or "receive a message from another entity"
// - feedback like "last turn's move succeeded" or "last turn's move failed"
//   (maybe with hit info)
//
// So however you represent events, a very important part of each round's
// thought could be integrating input and adapting (or just replacing) the
// current task.
//
// While nothing in the current type system below points this way, it's totally
// possible to:
// - keep a per-scope-entity log of such events
// - additionally populate those logs with edge events from status effects
// - implement a scope.loadTask that wraps any current task with an additional
//   domain-specific task that encodes those events, and whose execution will
//   Do Something with the joint state of events and prior task. Such a type
//   might look like {events: [...], task: loadedTask} Such task execution
//   could even handle initial task generation, by making its task field
//   optional, degenerating such a loadTaks's default task to just {events},
//   possibly with an empty array
//
// Another interesting avenue here would be to add some Result variant that
// means "waiting for external event X". This could be used to inject input
// into a player entity, whose thoughts would be purely about parsing and
// dispatching such input. Additionally, world sensing events could be
// processed by updating some view state bound to the player entity.
//
// This would allow us to interleave and smear entity AI between infrequent
// player input over time between simulation tick updates with an executor that
// is hooked up to incoming player input, and only advances world time once all
// entities have yield AND the player entity is not waiting for input... (or
// some large-sih real time has elapsed for something like an action RLite)
//
// Perhaps most compelling about this entire regime is how it starts to
// resemble event sourcing, and would allow automated simulation testing with
// faked or recorded events...

// TODO task executor over a range of taskable entities

export const TaskDone = 0;
export const TaskFail = 1;
export const TaskContinue = 2;
export const TaskYield = 3;

/**
 * @template {object} U, E
 * @typedef {(
 *   | DoneResult<U, E>
 *   | FailResult<U, E>
 *   | ContinueResult<U, E>
 *   | YieldResult<U, E>
 * )} TaskResult
 */

/**
 * @template {object} U, E
 * @typedef {object} DoneResult
 * @prop {TaskDone} code
 * @prop {string} [reason]
 * @prop {Task<U, E>} [next]
 */

/**
 * @template {object} U, E
 * @typedef {object} FailResult
 * @prop {TaskFail} code
 * @prop {string} reason
 * @prop {Task<U, E>} [next]
 */

/**
 * @template {object} U, E
 * @typedef {object} ContinueResult
 * @prop {TaskContinue} code
 * @prop {string} [reason]
 * @prop {Task<U, E>} [next]
 */

/**
 * @template {object} U, E
 * @typedef {object} YieldResult
 * @prop {TaskYield} code
 * @prop {string} reason
 * @prop {Task<U, E>} [next]
 */

/**
 * @template {object} U, E
 * @typedef {U
 *   | ControlTask<U, E>
 *   | TerminalTask<U, E>
 * } Task
 */

/**
 * @template {object} U, E
 * @typedef {(
 *   | {sub: Task<U, E>, then: Task<U, E>, else?: Task<U, E>}
 *   | {check: Boolic<E>, then?: Task<U, E>, else?: Task<U, E>}
 *   | SwitchTask<U, E>
 * )} ControlTask
 */

/**
 * @template {object} U, E
 * @typedef {object} SwitchTask
 * @prop {Expression<E>} switch
 * @prop {[Expression<E>, Task<U, E>][]} cases
 * @prop {Task<U, E>} [then]
 * @prop {Task<U, E>} [else]
 */

/**
 * @template {object} U, E
 * @typedef {(
 *   | {halt: string, then?: Task<U, E>}  // generates a DoneResult
 *   | {fail: string, then?: Task<U, E>}  // generates a FailResult
 *   | {continue: Task<U, E>}             // generates a ContinueResult
 *   | {yield: string, then?: Task<U, E>} // generates a YieldResult
 * )} TerminalTask
 */

/**
 * @template {object} U, E
 * @typedef {object} TaskDomain
 * @prop {(u: U) => TaskResult<U, E>} execute
 * @prop {(e: E) => number|boolean} resolve
 * TODO other domain facilities like random() and time()
 */

/**
 * @template {object} U, E
 * @param {Task<U, E>} task
 * @param {TaskDomain<U, E>} domain
 * @returns {TaskResult<U, E>}
 */
export function execute(task, domain) {
    //// controls

    if ('sub' in task) {
        const {sub, ...rest} = task;
        const {code, next, reason} = execute(sub, domain);
        switch (code) {
            case TaskDone: return next
                ? {code: TaskContinue,
                   next: {sub: next, ...rest},
                   reason: 'sub task continues'}
                : {code: TaskContinue,
                   next: task.then,
                   reason: 'sub task done'};
            case TaskFail: return next
                ? {code: TaskContinue,
                   next: {sub: next, ...rest},
                   reason: 'sub task failed'}
                : task.else
                    ? {code: TaskContinue,
                       next: task.else,
                       reason: reason || 'sub task failed'}
                    : {code: TaskFail, reason: reason || 'sub task failed'};
            case TaskContinue: return {
                code: TaskContinue,
                next: next && {sub: next, ...rest},
                reason: 'sub task continues'};
            case TaskYield: return {
                code: TaskYield,
                next: next && {sub: next, ...rest},
                reason: 'sub task yields'};
            default:
                assertNever(code, 'invalid result code');
        }
    }

    if ('switch' in task) {
        const {switch: expr, cases} = task;
        const actual = evaluate(expr, domain.resolve);
        for (const [expr, match] of cases) {
            const expect = evaluate(expr, domain.resolve);
            if (expect == actual) return {
                code: TaskContinue,
                next: task.then ? {sub: match, then: task.then} : match,
                reason: 'switch case matched'};
        }
        return task.else
            ? {code: TaskContinue, next: task.else, reason: 'switch case unmatched'}
            : {code: TaskFail, reason: 'switch case unmatched'};
    }

    if ('check' in task) {
        const {check, then: pass, else: fail} = task;
        const value = evaluate(check, domain.resolve);
        // TODO require boolean
        if (!value) {
            if (fail) return {
                code: TaskContinue, next: fail,
                reason: 'check continues in false branch',
            };
            return {code: TaskFail, reason: 'check failed'};
        }
        // else value
        if (pass) return {
            code: TaskContinue, next: pass,
            reason: 'check continues in true branch',
        };
        return {code: TaskDone, reason: 'check passed'};
    }

    // TODO other control primitives like sub

    // TODO loop tasks (while, until)
    // TODO timing tasks (sleep, timeout, deadline)
    // TODO random choice task?
    // TODO defined routine calling

    //// terminals

    if ('halt' in task) {
        const {halt: reason, then: next} = task;
        return {code: TaskDone, reason, next};
    }

    if ('fail' in task) {
        const {fail: reason, then: next} = task;
        return {code: TaskFail, reason, next};
    }

    if ('continue' in task) {
        const {continue: next} = task;
        return {code: TaskContinue, next};
    }

    if ('yield' in task) {
        const {yield: reason, then: next} = task;
        return {code: TaskYield, reason, next};
    }

    //// domain specific task
    return domain.execute(task);
}

/**
 * @template U
 * @typedef {(
 *   | U
 *   | Numeric<U>
 *   | Boolic<U>
 *   | Textic<U>
 * )} Expression
 */

/**
 * @template U
 * @typedef {(
 *   | number
 *   | {neg: Numeric<U>}
 *   | {add: Numeric<U>[]}
 *   | {sub: Numeric<U>[]}
 *   | {mul: Numeric<U>[]}
 *   | {div: Numeric<U>[]}
 *   | {mod: [Numeric<U>, Numeric<U>]}
 *   | {charCodeAt: Numeric<U>, in: Textic<U>}
 *   | {codePointAt: Numeric<U>, in: Textic<U>}
 *   | {indexOf: Textic<U>, in: Textic<U>, position?: Numeric<U>}
 *   | {lastIndexOf: Textic<U>, in: Textic<U>, position?: Numeric<U>}
 * )} Numeric
 */

/**
 * @template U
 * @typedef {Logic<LogicTerm<U>>} Boolic
 */

/**
 * @template U
 * @typedef {(
 *   | U
 *   | boolean
 *   | Comparison<Numeric<U>>
 *   | Comparison<Textic<U>>
 *   | TextBools<U>
 * )} LogicTerm
 */

/**
 * @template U
 * @typedef {(
 *   | {includes: Textic<U>, in: Textic<U>, position?: Numeric<U>}
 *   | {endsWith: Textic<U>, in: Textic<U>, position?: Numeric<U>}
 *   | {startsWith: Textic<U>, in: Textic<U>, position?: Numeric<U>}
 * )} TextBools
 */

/**
 * @template U
 * @typedef {U
 *   | string
 *   | {fromCodePoint: Numeric<U>[]}
 *   | {concat: Textic<U>[]}
 *   | {join: Expression<U>[], with?: Textic<U>}
 *   | {lower: Textic<U>, locale?: Textic<U>}
 *   | {upper: Textic<U>, locale?: Textic<U>}
 *   | {slice: Textic<U>, start?: Numeric<U>}
 *   | {slice: Textic<U>, start?: Numeric<U>, end: Numeric<U>}
 *   | {slice: Textic<U>, start?: Numeric<U>, length: Numeric<U>}
 *   | {repeat: Textic<U>, count: Numeric<U>}
 *   | {replace: Textic<U>, in: Textic<U>, with: Textic<U>, all?: true}
 *   | {charAt: Numeric<U>, in: Textic<U>}
 *   | {trim: Textic<U>}
 *   | {trimEnd: Textic<U>}
 *   | {trimStart: Textic<U>}
 *   | {padStart: Textic<U>, length: Numeric<U>, fill?: Textic<U>}
 *   | {padEnd: Textic<U>, length: Numeric<U>, fill?: Textic<U>}
 * } Textic
 */

/**
 * @template U
 * @typedef {(
 *   | {eq: [U, U]}
 *   | {neq: [U, U]}
 *   | {lt: [U, U]}
 *   | {gt: [U, U]}
 *   | {lte: [U, U]}
 *   | {gte: [U, U]}
 * )} Comparison
 */

/**
 * @template B
 * @typedef {B
 *   | boolean
 *   | {not: Logic<B>}
 *   | {or: Logic<B>[]}
 *   | {and: Logic<B>[]}
 * } Logic -- so named because "Boolean" is a global
 *
 * NOTE: the primary use case for this type is control flow predicates, so
 *       we've intentionally elided any {xor: ...} construct, as that's likely
 *       better served by a higher level switch/case construct.
 */

/**
 * @template U
 * @param {Expression<U>} expr
 * @param {(u: Exclude<U, number|boolean>) => number|boolean} resolve
 * @returns {number|boolean|string}
 */
export function evaluate(expr, resolve) {
    return term(expr);

    /**
     * @param {Expression<U>} expr
     * @returns {number|boolean|string}
     */
    function term(expr) {
        if (typeof expr == 'number') return expr;
        if (typeof expr == 'boolean') return expr;
        if (typeof expr == 'string') return expr;
        if (typeof expr == 'object') {

            //// Numeric<...>
            if ('neg' in expr) return -term(expr.neg);
            if ('add' in expr) return binop(expr.add, (a, b) => a + b);
            if ('sub' in expr) return binop(expr.sub, (a, b) => a - b);
            if ('mul' in expr) return binop(expr.mul, (a, b) => a * b);
            if ('div' in expr) return binop(expr.div, (a, b) => a / b);
            if ('mod' in expr) {
                const [a, b] = expr.mod;
                return numericTerm(a) % numericTerm(b);
            }
            if ('charCodeAt' in expr) {
                const s = stringTerm(expr.in);
                const i = numericTerm(expr.charCodeAt);
                return s.charCodeAt(i);
            }
            if ('codePointAt' in expr) {
                const s = stringTerm(expr.in);
                const i = numericTerm(expr.codePointAt);
                return s.codePointAt(i) || 0xfffd;
            }
            if ('indexOf' in expr) {
                const s = stringTerm(expr.in);
                const search = stringTerm(expr.indexOf);
                const pos = expr.position && numericTerm(expr.position);
                return s.indexOf(search, pos);
            }
            if ('lastIndexOf' in expr) {
                const s = stringTerm(expr.in);
                const search = stringTerm(expr.lastIndexOf);
                const pos = expr.position && numericTerm(expr.position);
                return s.lastIndexOf(search, pos);
            }

            //// Comparison<...>
            if ('eq' in expr) {
                const [a, b] = expr.eq;
                return term(a) === term(b);
            }
            if ('neq' in expr) {
                const [a, b] = expr.neq;
                return term(a) !== term(b);
            }
            if ('lt' in expr) {
                const [a, b] = expr.lt;
                return term(a) < term(b);
            }
            if ('gt' in expr) {
                const [a, b] = expr.gt;
                return term(a) > term(b);
            }
            if ('lte' in expr) {
                const [a, b] = expr.lte;
                return term(a) <= term(b);
            }
            if ('gte' in expr) {
                const [a, b] = expr.gte;
                return term(a) >= term(b);
            }

            //// Logic<...>
            if ('not' in expr) return !booleanTerm(expr.not);
            if ('or' in expr) {
                for (const sub of expr.or)
                    if (booleanTerm(sub)) return true;
                return false;
            }
            if ('and' in expr) {
                for (const sub of expr.and)
                    if (!booleanTerm(sub)) return false;
                return true;
            }

            //// TextBools<...>
            if ('includes' in expr) {
                const search = stringTerm(expr.includes);
                const s = stringTerm(expr.in);
                const pos = expr.position && numericTerm(expr.position);
                return s.includes(search, pos);
            }
            if ('endsWith' in expr) {
                const search = stringTerm(expr.endsWith);
                const s = stringTerm(expr.in);
                const pos = expr.position && numericTerm(expr.position);
                return s.endsWith(search, pos);
            }
            if ('startsWith' in expr) {
                const search = stringTerm(expr.startsWith);
                const s = stringTerm(expr.in);
                const pos = expr.position && numericTerm(expr.position);
                return s.startsWith(search, pos);
            }

            //// Textic<...>
            if ('fromCodePoint' in expr) {
                const codePoints = expr.fromCodePoint.map(ne => numericTerm(ne));
                return String.fromCodePoint(...codePoints);
            }
            if ('concat' in expr) {
                const ss = expr.concat.map(se => stringTerm(se));
                if (!ss.length) return '';
                const [s, ...rest] = ss;
                return s.concat(...rest);
            }
            if ('join' in expr) {
                const values = expr.join.map(e => term(e));
                const sep = expr.with && stringTerm(expr.with);
                return values.join(sep);
            }
            if ('lower' in expr) {
                const s = stringTerm(expr.lower);
                return expr.locale
                    ? s.toLocaleLowerCase(stringTerm(expr.locale))
                    : s.toLowerCase();
            }
            if ('upper' in expr) {
                const s = stringTerm(expr.upper);
                return expr.locale
                    ? s.toLocaleUpperCase(stringTerm(expr.locale))
                    : s.toUpperCase();
            }
            if ('slice' in expr) {
                const s = stringTerm(expr.slice);
                const start = expr.start && numericTerm(expr.start);
                const end =
                    'end' in expr
                    ? numericTerm(expr.end)
                    : 'length' in expr
                    ? (start || 0) + numericTerm(expr.length)
                    : undefined;
                return s.slice(start, end);
            }
            if ('repeat' in expr) {
                const s = stringTerm(expr.repeat);
                const n = numericTerm(expr.count);
                return s.repeat(n);
            }
            if ('replace' in expr) {
                const search = stringTerm(expr.replace);
                const s = stringTerm(expr.in);
                const replace = stringTerm(expr.with);
                return expr.all
                    ? s.replaceAll(search, replace)
                    : s.replace(search, replace);
            }
            if ('charAt' in expr) {
                const n = numericTerm(expr.charAt);
                const s = stringTerm(expr.in);
                return s.charAt(n);
            }
            if ('trim' in expr) return stringTerm(expr.trim).trim();
            if ('trimEnd' in expr) return stringTerm(expr.trimEnd).trimEnd();
            if ('trimStart' in expr) return stringTerm(expr.trimStart).trimStart();
            if ('padStart' in expr) {
                const s = stringTerm(expr.padStart);
                const fill = expr.fill && stringTerm(expr.fill);
                const n = numericTerm(expr.length);
                return s.padStart(n, fill);
            }
            if ('padEnd' in expr) {
                const s = stringTerm(expr.padEnd);
                const fill = expr.fill && stringTerm(expr.fill);
                const n = numericTerm(expr.length);
                return s.padEnd(n, fill);
            }

        }
        return resolve(/**
            @type {Exclude<U, number|boolean>} by the first two typeof cases above
            FIXME why is this cast necessary? why can't typescript narrow expr's type?
        */(expr));
    }

    /**
     * @param {Numeric<U>[]} terms
     * @param {(a: number, b: number) => number} op
     * @returns {number}
     */
    function binop(terms, op) {
        if (!terms.length) return NaN;
        let value = numericTerm(terms[0]);
        for (let i = 1; i < terms.length; ++i)
            value = op(value, numericTerm(terms[i]));
        return value;
    }

    /** @type {(sub: Numeric<U>) => number} */
    function numericTerm(sub) {
        const subVal = term(sub);
        if (typeof subVal == 'number') return subVal;
        throw new Error('boolean value used in numeric expression');
    }

    /** @type {(sub: Logic<LogicTerm<U>>) => boolean} */
    function booleanTerm(sub) {
        const subVal = term(sub);
        if (typeof subVal == 'boolean') return subVal;
        throw new Error('numeric value used in boolean expression');
    }

    /** @type {(sub: Textic<U>) => string} */
    function stringTerm(sub) {
        const subVal = term(sub);
        return typeof subVal == 'string' ? subVal : '' + subVal;
    }
}

/**
 * @param {never} _
 * @param {string} [mess]
 * @returns {never}
 */
function assertNever(_, mess) {
    throw new Error(mess);
}
