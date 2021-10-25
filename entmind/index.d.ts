// A domain opener is the primary integration injected from a simulation specific world.
//
// It is responsible for generating zero or more domains that need to be executed
//
// All domains generated by one call to an opener SHOULD have the same time and
// SHOULD contain at least one live entity.
//
// An executor MAY decide to execute multiple domains concurrently, or it MAY
// decide to execute them in serial, closing each one before advancing the
// opened generator.
type DomainOpener <
    DomainTask extends Task<DomainTime>,
    DomainTime extends number = number,
    ID extends string|number = string,
>= () => Generator<Domain<DomainTask, DomainTime, ID>>;

// An opened domain for a round of entity task execution, bound to a subset of
// the world and a point in time.
//
// Simple worlds may not use proper subset domains, and may instead execute the
// entire world within one domain each tick.
type Domain<
    DomainTask extends Task,
    DomainTime extends number = number,
    ID extends string|number = string,
> = {
    // the world time/tick during which entity execution is occurring
    time: DomainTime;

    // closes the domain, applying any deferred mutations to the wold, and
    // allowing time to advance (arbitrarily!) until the next opened domain.
    //
    // Executors MUST always call this method, or risk loosing execution state
    //
    // Domain implementations SHOULD queue all world/entity mutations until
    // closed to ensure transactional consistency. This includes things like
    // action taking and internal entity memory mutations (of which task
    // assignment itself is a primary note in an entity's memory).
    close(): void;

    // generates all alive entity IDs for execution within a round
    //
    // NOTE executors MUST eagerly consume this generator into some kind of
    // internal storage before beginning to iterate, load, and execute tasks.
    ids(): Generator<ID>;

    // loads the task currently assigned to a subject entity, or generates a
    // domain-specific default task.
    //
    // NOTE domain implementations MUST save any generated default back to
    // their internal storage; executors MAY NOT be expected to call saveTask.
    loadTask(id: ID): DomainTask;

    // saves a given task back to a subject entity or clears such storage.
    saveTask(id: ID, task: DomainTask|null): void;

    // executes domain-specific tasks, like actions and world-specific thoughts
    //
    // NOTE this MAY or MAY NOT have immediate mutative effect on the domain's
    // world. In other words, domains may choose to queue actions taken withing
    // a round, or may choose to just first-wins apply actions during execution.
    execTask(id: ID, task: DomainTask, /* TODO pass exectutor context? */): Result;
};

type Task<
    Time extends number = number,
    Duration extends number = number,
> =
    | SleepTask<Time, Duration>
    | TimeoutTask<Duration>
    | DeadlineTask<Time>
    // TODO ChooseTask
    // TODO FirstTask, AnyTask, AllTask, etc
    // TODO WhileTask, UntilTask, DoWhileTask, DoUntilTask, etc ; needs Predicate
    // TODO TimedTask
    // TODO SearchTask ... needs some sort of domain hook for "available tasks"
    ;

// A task that yields until a time in the future.
//
// Initial execution of a {delay: ...} task replaces itself with a computed
// deadline task like {until: domain.time + delay}.
type SleepTask<
    Time extends number = number,
    Duration extends number = number,
> = {
    sleep: 
    | {until: Time}
    | {delay: Duration}
    | Duration // convenient alias for {delay: ...}
};

// A timeout task immediately replaces itself with a DeadlineTask with a
// computed deadline: domain.time + timeout, and the same sub-task.
type TimeoutTask<
    Time extends number = number,
    Duration extends number = number,
> = {
    timeout: Duration;
    task: Task<Time, Duration>;
};

// A deadline task immediately fails when executed withing any domain.time >
// deadline, otherwise executing its sub-task.
//
// Any continuation task (ContResult) will replace the sub-task, inheriting the deadline.
//
// On the other hand any terminal task (TermResult or FailResult) will replace
// the deadline task itself, effectively clearing any execution deadline.
//
// NOTE DeadlineTask itself must propagate result type out of its execution to
// correctly clear a stack of nested deadlines.
type DeadlineTask<
    Time extends number = number,
    Duration extends number = number,
> = {
    deadline: Time;
    task: Task<Time, Duration>;
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
type Result =
    | FailResult
    | TermResult
    | ContResult
    | YieldResult
    ;

// Task has failed, with an explanation, and optional replacement.
//
// An executor must not re-execute this task ever again and may execute any
// replacement immediately.
type FailResult = {
    ok: false;
    reason: string;
    next?: Task;
};

// Task has succeeded, with an optional replacement.
//
// An executor must not re-execute this task ever again and may execute any
// replacement immediately.
type TermResult = {
    ok: true;
    done: true;
    next?: Task;
    reason?: string;
};

// Task soft yields, its replacement continues executing immediately.
//
// An executor may execute the replacement task immediately.
type ContResult = {
    ok: true;
    done: false;
    next: Task;
    reason?: string;
};

// Task hard yields, it will continue executing in the next round.
//
// An executor must not re-execute this task within the same round.
type YieldResult = {
    ok: true;
    done: false;
    reason?: string;
};
