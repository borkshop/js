/** @typedef {ReturnType<makeLogger>} Logger */

/** Creates a Zop logger which supports creating sub-loggers with attached
 * fields, in addition to a normative `log(...any[])` method ala
 * `console.log()`.
 *
 * The first non-object argument passed to `log(...any[])` will be the
 * "message" field, while any subsequent arguments get packed into an "extra"
 * field. Any objects that precede that first argument directly become fields
 * via Object.entries().
 *
 * The provided sink function receives all of the serialized field parts of a
 * single log entry each time it is called; these parts will form a valid JSON
 * object when concatenated together. Sink functions that write into a larger
 * stream are expected to handle any framing concerns, including surrounding
 * object braces, newlines or record separators.
 *
 * @param {ZopSink} sink
 */
export function makeLogger(sink) {
  /** @param {Iterable<string>} [withParts] */
  function makeWith(withParts = []) {
    const base = [...withParts];

    /** @param {Iterable<[name: string, value: any]>} fields */
    function* addFields(fields) {
      const parts = iter(entryParts(fields));
      if (base.length) {
        yield* base;
        for (const part of parts) {
          yield ',';
          yield part;
          break;
        }
      }
      yield* parts;
    }

    return Object.freeze({

      /** @param {any[]} data */
      log(...data) {
        const fields = logFields(...data);
        sink(addFields(fields));
      },

      /** @param {{[name: string]: any}|[name: string, value: any][]} args */
      with(args) {
        const fields = Array.isArray(args) ? args : Object.entries(args);
        return makeWith(addFields(fields));
      },

    });
  }

  return makeWith();
}

/** @typedef {(parts: Iterable<string>) => void} ZopSink */

/** Creates a ZopSink that passes data into one or more sinks.
 *
 * @param {ZopSink[]} sinks
 * @returns {ZopSink}
 */
export function teeSink(...sinks) {
  switch (sinks.length) {
    case 0: return discardSink;
    case 1: return sinks[0];
  }
  return it => {
    const parts = [...it];
    for (const sink of sinks) sink(parts);
  }
}

/** @type {ZopSink} */
export const discardSink = () => { };

/**
 * @param {(...data: any[]) => void} log
 * @returns {ZopSink}
 */
export function intoLog(log) {
  return parts => {
    try { log(JSON.parse(`{${[...parts].join('')}}`)) }
    catch (err) { log(err) }
  }
}

/**
  * @param {(parts: Iterable<string>) => Iterable<string>} framer
 * @returns {{sink: ZopSink, flush: () => string[]}}
 */
export function makeBuffer(framer = ndjsonFramer) {
  /** @type {string[]} */
  let buffer = [];
  return {
    sink(parts) {
      for (const part of framer(parts))
        buffer.push(part)
    },
    flush() {
      const r = buffer;
      buffer = [];
      return r;
    },
  }
}

/** @param {Iterable<string>} parts */
function* ndjsonFramer(parts) {
  yield '{'
  yield* parts;
  yield '}\n';
}

/** Zop logging entry field creator: generates log entry fields(s) from an
 * arbitrary list of arguments, as would be expected by a `console.log`-alike
 * logger.
 *
 * Special treatment is given to any object arguments that precede a normative
 * message argument: their Object.entries() are added directly as structured
 * log fields before any message field.
 *
 * Any additional arguments after a normative message argument are packed into
 * an "extra" array field.
 *
 * @param {any[]} args
 * @returns {Generator<[name: string, value: any]>}
 */
function* logFields(...args) {
  // any objects in data's header become direct fields
  let i = 0;
  for (; i < args.length; i++) {
    const arg = args[i];
    if (typeof arg != 'object' || Array.isArray(arg)) break;
    yield* Object.entries(arg);
  }

  // the first non-object argument is the "message" field
  if (i < args.length)
    yield ['message', args[i++]];

  // any additional arguments get tucked into an "extra" field
  if (i < args.length)
    yield ['extra', args.slice(i)];
}

/** @param {Iterable<[name: string, value: any]>} fields */
function* entryParts(fields) {
  let i = 0;
  for (const field of fields) {
    if (i++ > 0) yield ',';
    const [name, value] = field;
    yield JSON.stringify(name);
    yield ':';
    yield JSON.stringify(value);
  }
}

/**
 * @template T
 * @param {Iterable<T>} ita
 * @returns {IterableIterator<T>}
 */
function iter(ita) {
  const it = ita[Symbol.iterator]();
  const self = Object.freeze({
    [Symbol.iterator]() { return self },
    next() { return it.next() },
  });
  return self;
}

