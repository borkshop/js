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

// TODO rebuild task system once we get a working evaluator core
// TODO do we need a pathological "first until completion" executor?
// TODO compute budget accounting and management

// TODO boolean expressions

/**
 * @template {number} N
 * @typedef {N
 *   | {neg: Numeric<N>}
 *   | {add: Numeric<N>[]}
 *   | {sub: Numeric<N>[]}
 *   | {mul: Numeric<N>[]}
 *   | {div: Numeric<N>[]}
 *   | {pow: Numeric<N>[]}
 *   | {mod: [Numeric<N>, Numeric<N>]}
 * } Numeric
 */

/**
 * @template {number} N
 *
 * @param {Numeric<N>} expr
 * @returns {number}
 */
export function evaluateNumeric(expr) {
    return term(expr);

    /**
     * @param {Numeric<N>} expr
     * @returns {number}
     */
    function term(expr) {
        if (typeof expr == 'number') return expr;
        if (typeof expr == 'object') {
            if ('neg' in expr) return -term(expr.neg);
            if ('add' in expr) return binop(expr.add, (a, b) => a + b);
            if ('sub' in expr) return binop(expr.sub, (a, b) => a - b);
            if ('mul' in expr) return binop(expr.mul, (a, b) => a * b);
            if ('div' in expr) return binop(expr.div, (a, b) => a / b);
            if ('pow' in expr) return binop(expr.pow, (a, b) => Math.pow(a, b));
            if ('mod' in expr) {
                const [a, b] = expr.mod;
                return term(a) % term(b);
            }
        }
        assertNever(expr, 'invalid numeric expression');
    }

    /**
     * @param {Numeric<N>[]} terms
     * @param {(a: number, b: number) => number} op
     * @returns {number}
     */
    function binop(terms, op) {
        if (!terms.length) return NaN;
        let value = term(terms[0]);
        for (let i = 1; i < terms.length; ++i)
            value = op(value, term(terms[i]));
        return value;
    }
}

// TODO evaluation within an extension universe

/**
 * @param {never} _
 * @param {string} [mess]
 * @returns {never}
 */
function assertNever(_, mess) {
    throw new Error(mess);
}
