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
export function makeLogger(sink: ZopSink): Readonly<{
    /** @param {any[]} data */
    log(...data: any[]): void;
    /** @param {{[name: string]: any}|[name: string, value: any][]} args */
    with(args: {
        [name: string]: any;
    } | [name: string, value: any][]): Readonly<any>;
}>;
/** @typedef {(parts: Iterable<string>) => void} ZopSink */
/** Creats a ZopSink that passes data into one or more sinks.
 *
 * @param {ZopSink[]} sinks
 * @returns {ZopSink}
 */
export function teeSink(...sinks: ZopSink[]): ZopSink;
/**
 * @param {(...data: any[]) => void} log
 * @returns {ZopSink}
 */
export function intoLog(log: (...data: any[]) => void): ZopSink;
/**
  * @param {(parts: Iterable<string>) => Iterable<string>} framer
 * @returns {{sink: ZopSink, flush: () => string[]}}
 */
export function makeBuffer(framer?: (parts: Iterable<string>) => Iterable<string>): {
    sink: ZopSink;
    flush: () => string[];
};
/** @type {ZopSink} */
export const discardSink: ZopSink;
export type Logger = ReturnType<typeof makeLogger>;
export type ZopSink = (parts: Iterable<string>) => void;
