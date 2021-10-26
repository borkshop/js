// see index.d.ts for definitions and the bulk of documentation

// TODO do we need a pathological "first until completion" executor?
// TODO compute budget accounting and management

/**
  * @template {Task<DomainTask, DomainTime, DomainDuration, DomainValue>} DomainTask
  * @template {number} DomainTime = number
  * @template {number} DomainDuration = number
  * @template {TaskValue<DomainTime, DomainDuration>} DomainValue TaskValue<DomainTime, DomainDuration>
  * @template {string|number} ID = string
  *
  * @param {Scope<DomainTask, DomainTime, DomainDuration, DomainValue, ID>} scope
  *     Iterable of all scopes to execute. Each scope SHOULD have the same time
  *     and SHOULD contain at least one live entity.
  * @returns {void}
  */
export function executeScopeFairly(scope) {
  const ids = Array.from(scope.ids());

  /** @type {(DomainTask|null)[]} */
  const tasks = ids.map(id => scope.loadTask(id));

  const running = ids.map(_ => false);
  for (;;) {
    let any = false;
    ids.forEach((id, i) => {
      if (!running[i]) return;
      const task = tasks[i];
      if (!task) {
        running[i] = false;
        return;
      }
      any = true;

      const res = exec(scope, id, task);

      if ('next' in res) {
        tasks[i] = res.next || null;
        // TODO continue/replace observability
        return;
      }

      if (!res.ok) {
        // TODO failure reporting/handling
        tasks[i] = null;
        return;
      }

      if (!res.done) {
        // TODO yield observability
        return;
      }

      // TODO terminal observability
      tasks[i] = null;
    });
    if (!any) break;
  }

  ids.forEach((id, i) => scope.saveTask(id, tasks[i]));

  scope.close();
}

/**
  * @template {Task<DomainTask, DomainTime, DomainDuration, DomainValue>} DomainTask
  * @template {number} DomainTime = number
  * @template {number} DomainDuration = number
  * @template {TaskValue<DomainTime, DomainDuration>} DomainValue TaskValue<DomainTime, DomainDuration>
  * @template {string|number} ID = string
  *
  * @param {Scope<DomainTask, DomainTime, DomainDuration, DomainValue, ID>} scope
  * @param {ID} id
  * @param {DomainTask} task
  * @returns {Result<DomainTask>}
  */
function exec(scope, id, task) {
  return scope.exec({
    exec(id, task) {
      if ('sleep' in task)  {
        const {sleep, ...rest} = task;
        if (typeof sleep == 'object' && 'until' in sleep) {
          if (scope.time < sleep.until)
            return {ok: true, done: false, reason: 'sleeping'};
          // TODO execute else as a sub task while waiting?
          return {ok: true, done: true, next: task.then};
        }
        const delay = typeof sleep == 'number' ? sleep : sleep.delay;
        const until = /** @type {DomainTime} FIXME */ (scope.time + delay);
        const next = /** @type {DomainTask} FIXME */ ({sleep: {until}, ...rest});
        return {ok: true, done: false, next};
      }

      if ('timeout' in task) {
        const {timeout, ...rest} = task;
        const deadline = /** @type {DomainTime} FIXME */ (scope.time + timeout);
        const next = {deadline, ...rest};
        return {ok: true, done: false, next};
      }

      if ('deadline' in task) {
        const {deadline, then, ...rest} = task;
        if (scope.time > deadline)
          return {ok: false, reason: 'deadline expired', next: task.else};
        if (then) {
          const subRes = exec(scope, id, then);
          const subNext = 'next' in subRes ? subRes.next : undefined;
          const done = 'done' in subRes ? subRes.done : false;
          if (subNext && !done) {
            const next = {deadline, then: subNext, ...rest}
            return {ok: subRes.ok, done: false, next};
          }
          return subRes;
        }
        return {ok: true, done: false};
      }

      if ('sub' in task) {
        const {sub, ...rest} = task;
        const subRes = exec(scope, id, sub);
        if ('next' in subRes) {
          const {ok, reason, next: sub} = subRes;
          const next = {sub, ...rest};
          return {ok, reason, done: false, next};
        }
        const {ok} = subRes;
        const done = 'done' in subRes ? subRes.done : undefined
        return {ok, done};
      }

      if ('while' in task || 'until' in task) {
        return {ok: false, reason: 'while/until task not implemented'}; // TODO
      }

      assertNever(task, 'invalid task data');
    },

    eval: evaluate,
  }, id, task);
}

/**
  * @template {Task<DomainTask, DomainTime, DomainDuration, DomainValue>} DomainTask
  * @template {number} DomainTime = number
  * @template {number} DomainDuration = number
  * @template {TaskValue<DomainTime, DomainDuration>} DomainValue TaskValue<DomainTime, DomainDuration>
  * @template {string|number} ID = string
  *
  * @param {Scope<DomainTask, DomainTime, DomainDuration, DomainValue, ID>} scope
  * @param {ID} id
  * @param {TaskExpression<DomainValue>} expr
  * @returns {DomainValue}
  */
function evaluate(scope, id, expr) {
  return scope.eval({
    eval(id, expr) {

      if (expr === 'time') return scope.time;

      if (expr === 'random') return scope.random(id);

      if (typeof expr == 'object') {

        if ('random' in expr) {
          const {random: [min, max]} = expr;
          return min + scope.random(id) * (max - min);
        }

        if ('randint' in expr) {
          const {randint: [min, max]} = expr;
          // TODO validate math
          return Math.floor(min + scope.random(id) * (max - min));
        }

        if ('choice' in expr) {
          const {choice: exprs} = expr;
          const choice = exprs[Math.floor(scope.random(id) * exprs.length)];
          return evaluate(scope, id, choice);
        }

        // TODO boolean
        // TODO relation
        // TODO arithmetic
      }

      assertNever(expr, 'invalid expression data');
    },
  }, id, expr);
}

/**
 * @param {never} _
 * @param {string} [mess]
 * @returns {never}
 */
function assertNever(_, mess='inconceivable') {
    throw new Error(mess);
}
