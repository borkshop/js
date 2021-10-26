// TODO this is a little awkward due to needing to pass around the
// Time/Duration/Value type triple everywhere. Haven't been able to find a
// better way yet, without dropping type specificity on time/duration... if
// there were some way to extract type parameters back out of Value, that may
// do...

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

// An opened scope for a round of entity task execution, bound to a subset of
// the world and a point in time.
//
// Simple worlds may not use proper subset scopes, and may instead execute the
// entire world within one scope each tick.
type Scope<
    DomainTask extends Task<DomainTask, DomainTime, DomainDuration, DomainValue>,
    DomainTime extends number = number,
    DomainDuration extends number = number,
    DomainValue extends TaskValue<DomainTime, DomainDuration> = TaskValue<DomainTime, DomainDuration>,
    ID extends string|number = string,
> = {
    // the world time/tick during which entity execution is occurring
    time: DomainTime;

    // scope-specific random number source, may or may not be entity-specific
    // and/or deterministic withing a scope.
    //
    // NOTE nothing in entmind itself should care if random() is
    // non-deterministic per-scope-entity, but simulated worlds generally
    // benefit from having determinism at such a granularity
    random(id: ID): number;

    // closes the scope, applying any deferred mutations to the world, and
    // allowing time to advance (arbitrarily!) until the next time this scope
    // is opened again.
    //
    // Executors SHOULD call this method once done executing all entities
    // within a scope, and MUST NOT continue execution after a close.
    //
    // Scope implementations MUST NOT mutate the world until close, and MUST
    // maintain sufficient state within a scope (through methods like change
    // queueing or some form of lazy copying) to achieve transactional
    // consistency.
    close(): void;

    // generates all alive entity IDs for execution within a round
    //
    // NOTE executors MUST eagerly consume this generator into some kind of
    // internal storage before beginning to iterate, load, and execute tasks.
    ids(): Generator<ID>;

    // loads the task currently assigned to a subject entity, or generates a
    // scope-specific default task.
    //
    // NOTE scope implementations MUST save any generated default back to
    // their internal storage; executors MAY NOT be expected to call saveTask.
    loadTask(id: ID): DomainTask;

    // saves a given task back to a subject entity or clears such storage.
    saveTask(id: ID, task: DomainTask|null): void;

    // executes scope-specific tasks, like actions and world-specific thoughts.
    //
    // MUST NOT immediately mutate the entity or world as discussed above
    exec(
        ctx: ExecutorContext<DomainTask, DomainTime, DomainDuration, DomainValue, ID>,
        id: ID, task: DomainTask,
    ): Result<DomainTask>;

    // evaluates scope specific expressions, like loading properites of the
    // current entity, or reading values from the world
    //
    // MUST NOT have any side effect on the scope's transactional world change
    //
    // Executors MAY cache returned values per-scope-entity
    eval(
        ctx: EvaluatorContext<DomainTask, DomainTime, DomainDuration, DomainValue, ID>,
        id: ID, expr: TaskExpression<DomainValue>,
    ): DomainValue;

    // TODO named routine dictionary(ies)
};

// Context passed to domain specific executors
type ExecutorContext<
    DomainTask extends Task<DomainTask, DomainTime, DomainDuration, DomainValue>,
    DomainTime extends number = number,
    DomainDuration extends number = number,
    DomainValue extends TaskValue<DomainTime, DomainDuration> = TaskValue<DomainTime, DomainDuration>,
    ID extends string|number = string,
> = {
    // provides access to base level task execution
    exec(id: ID, task: Task<DomainTask, DomainTime, DomainDuration, DomainValue>): Result<DomainTask>;

    // provides entry to expression evaluation to executor code
    eval(
        scope: Scope<DomainTask, DomainTime, DomainDuration, DomainValue, ID>,
        id: ID, expr: TaskExpression<DomainValue>,
    ): DomainValue;
};

// Context passed to domain specific evaluators
type EvaluatorContext<
    DomainTask extends Task<DomainTask, DomainTime, DomainDuration, DomainValue>,
    DomainTime extends number = number,
    DomainDuration extends number = number,
    DomainValue extends TaskValue<DomainTime, DomainDuration> = TaskValue<DomainTime, DomainDuration>,
    ID extends string|number = string,
> = {
    // provides access to base level expression evaluation, callable by domain specific evaluators
    eval(id: ID, expr: TaskExpression<DomainValue>): DomainValue;
};

type Task<
    NextTask extends Task<NextTask, Time, Duration, Value>,
    Time extends number = number,
    Duration extends number = number,
    Value extends TaskValue = TaskValue<Time, Duration>,
> = (
    | SleepTask<Time, Duration>
    | TimeoutTask<NextTask, Time, Duration>
    | DeadlineTask<NextTask, Time>
    | SubTask<NextTask>
    | LoopTask<Value>
    // TODO CallTask
    // TODO FirstTask, AnyTask, AllTask, etc
    // TODO ChooseTask ... or can that be a more general SwitchTask over a {choice: ...} expr
    // TODO TimedTask
    // TODO SearchTask ... needs some sort of scope hook for "available tasks"
) & {
    // a subsequent task to execute after this one finishes successfully and
    // ONLY IF NO replacement task resulted.
    then?: NextTask;

    // a subsequent task to execute after this one fails successfully and
    // ONLY IF NO replacement task resulted.
    else?: NextTask;
};

// Expression type needed by some types like branches
type TaskExpression<
    Value extends TaskValue,
> = Expression<
    | Value
    | "time"
    | "random"
    | {random: [min: number, max: number]}
    | {randint: [min: number, max: number]}
    | {choice: Expression<Value>[]}
>;

// Concrete value resulting from evaluating a TaskExpression.
type TaskValue<
    Time extends number = number,
    Duration extends number = number,
> =
    | number
    | Time
    | Duration
    ;

// A task that yields until a time in the future.
//
// Initial execution of a {delay: ...} task replaces itself with a computed
// deadline task like {until: scope.time + delay}.
type SleepTask<
    Time extends number = number,
    Duration extends number = number,
> = {
    sleep: (
        | {until: Time}
        | {delay: Duration}
        | Duration // convenient alias for {delay: ...}
    );
};

// A timeout task immediately replaces itself with a DeadlineTask with a
// computed deadline: scope.time + timeout, and the same sub-task.
type TimeoutTask<
    SubTask extends Task<SubTask, Time, Duration>,
    Time extends number = number,   
    Duration extends number = number,   
> = {
    timeout: Duration;
    task: SubTask;
};

// A deadline task immediately fails when executed withing any scope.time >
// deadline, otherwise executing its sub-task.
//
// Any continuation task will replace the sub-task, inheriting the deadline.
//
// On the other hand any terminal result task will replace the deadline task
// itself, effectively clearing any execution deadline.
//
// NOTE DeadlineTask itself must propagate result type out of its execution to
// correctly clear a stack of nested deadlines.
type DeadlineTask<
    SubTask extends Task<SubTask, Time>,
    Time extends number = number,
> = {
    deadline: Time;
    task: SubTask;
};

// A control task that executes its then task while its predicate evaluates to
// true or until it evaluates to false. Once the predicate condition no longer
// passes, task execution continues to any else task.
type LoopTask<
    Value extends TaskValue,
    Predicate extends BooleanExpression<Value> = BooleanExpression<Value>
> = (
    | {while: Predicate}
    | {until: Predicate}
);

// A control task that executes a sub task of an initiating task, deferred in
// the task's then field; e.g. used to instantiate LoopTask bodies that may
// take longer than one round of execution.
type SubTask<SubTask extends Task<SubTask>> = {
    sub: SubTask;
};

// Result of executing an entity task.
//
// All results have an ok: boolean field, that is false only if execution failed.
//
// Non-failed results have a done: boolean field that indicates if the task is
// done, or merely yielding execution.
//
// All results may have a next: Task field, which passes a replacement task back
// to an executor.
//
// When an executor receives ok: false or done: true, it MUST NOT execute that
// same task again.
//
// When an executor receives next: Task, it MUST NOT execute the former subject
// task again, and MUST instead execute the replacement next task. An executor
// MAY decide to execute a replacement task within the same round of task
// execution, or defer execution to an arbitrarily distant future round at its
// discretion.
type Result<DomainTask extends Task<DomainTask>> = (

    // Task has failed, with an explanation, and optional replacement.
    //
    // An executor must not re-execute this task ever again and may execute any
    // replacement immediately.
    | {
        ok: false;
        reason: string;
        next?: DomainTask;
    }

    // Task has succeeded, with an optional replacement.
    //
    // An executor must not re-execute this task ever again and may execute any
    // replacement immediately.
    | {
        ok: true;
        done: true;
        next?: DomainTask;
        reason?: string;
    }

    // Task soft yields, its replacement continues executing immediately.
    //
    // An executor may execute the replacement task immediately.
    | {
        ok: true;
        done: false;
        next: DomainTask;
        reason?: string;
    }

    // Task hard yields, it will continue executing in the next round.
    //
    // An executor must not re-execute this task within the same round.
    | {
        ok: true;
        done: false;
        reason?: string;
    }

);

/// general maths

type Expression<T> =
    | T
    | Arithmetic<T>
    | BooleanExpression<T>
    ;

type BooleanExpression<T> =
    | Relation<Arithmetic<T>>
    | BooleanAlgebra<Relation<Arithmetic<T>>>
    ;

type Relation<T> =
    | {eq: [T, T]}
    | {neq: [T, T]}
    | {lt: [T, T]}
    | {lte: [T, T]}
    | {gte: [T, T]}
    | {gt: [T, T]}
    ;

type Arithmetic<T> =
    | T
    | {neg: Arithmetic<T>}
    | {add: Arithmetic<T>[]}
    | {sub: Arithmetic<T>[]}
    | {mul: Arithmetic<T>[]}
    | {div: Arithmetic<T>[]}
    | {mod: [Arithmetic<T>, Arithmetic<T>]}
    | {pow: [Arithmetic<T>, Arithmetic<T>]}
    ;

type BooleanAlgebra<T> =
    | T
    | BooleanAlgebra<T>[]
    | {or: BooleanAlgebra<T>[]}
    | {not: BooleanAlgebra<T>[]}
    ;
