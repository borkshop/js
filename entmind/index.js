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

/**
 * @template U
 * @typedef {(
 *   | Numeric<number|U>
 *   | LogicExpression<U>
 * )} Expression
 */

/**
 * @template U
 * @typedef {Logic<boolean|U|Comparison<Numeric<number|U>>>} LogicExpression
 * FIXME exclude numbers
 */

/**
 * @template N
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
 * @returns {number|boolean}
 */
export function evaluate(expr, resolve) {
    return term(expr);

    /**
     * @param {Expression<U>} expr
     * @returns {number|boolean}
     */
    function term(expr) {
        if (typeof expr == 'number') return expr;
        if (typeof expr == 'boolean') return expr;
        if (typeof expr == 'object') {
            // Numeric<...>
            if ('neg' in expr) return -term(expr.neg);
            if ('add' in expr) return binop(expr.add, (a, b) => a + b);
            if ('sub' in expr) return binop(expr.sub, (a, b) => a - b);
            if ('mul' in expr) return binop(expr.mul, (a, b) => a * b);
            if ('div' in expr) return binop(expr.div, (a, b) => a / b);
            if ('pow' in expr) return binop(expr.pow, (a, b) => Math.pow(a, b));
            if ('mod' in expr) {
                const [a, b] = expr.mod;
                return numericTerm(a) % numericTerm(b);
            }

            // Comparison<...>
            if ('eq' in expr) {
                const [a, b] = expr.eq;
                return numericTerm(a) === numericTerm(b);
            }
            if ('neq' in expr) {
                const [a, b] = expr.neq;
                return numericTerm(a) !== numericTerm(b);
            }
            if ('lt' in expr) {
                const [a, b] = expr.lt;
                return numericTerm(a) < numericTerm(b);
            }
            if ('gt' in expr) {
                const [a, b] = expr.gt;
                return numericTerm(a) > numericTerm(b);
            }
            if ('lte' in expr) {
                const [a, b] = expr.lte;
                return numericTerm(a) <= numericTerm(b);
            }
            if ('gte' in expr) {
                const [a, b] = expr.gte;
                return numericTerm(a) >= numericTerm(b);
            }

            // Logic<...>
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
        }
        return resolve(/**
            @type {Exclude<U, number|boolean>} by the first two typeof cases above
            FIXME why is this cast necessary? why can't typescript narrow expr's type?
        */(expr));
    }

    /**
     * @param {Numeric<number|U>[]} terms
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

    /** @type {(sub: Numeric<number|U>) => number} */
    function numericTerm(sub) {
        const subVal = term(sub);
        if (typeof subVal == 'number') return subVal;
        throw new Error('boolean value used in numeric expression');
    }

    /** @type {(sub: Logic<boolean|U|Comparison<Numeric<number|U>>>) => boolean} */
    function booleanTerm(sub) {
        const subVal = term(sub);
        if (typeof subVal == 'boolean') return subVal;
        throw new Error('numeric value used in boolean expression');
    }
}
