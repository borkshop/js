import test from 'ava';

import * as zop from './index.js';

test('buffered', t => {
  const {sink, flush} = zop.makeBuffer();
  const logger = zop.makeLogger(sink);

  t.deepEqual(
    flush().join(''),
    ``,
    'expected buffer to start out empty');

  logger.log('hello');
  logger.log('hello', 'world');
  logger.log({some: 99}, {more: {things: 'are possible'}}, 'hello', 'world');

  t.deepEqual(flush().join(''), [
    `{"message":"hello"}\n`,
    `{"message":"hello","extra":["world"]}\n`,
    `{"some":99,"more":{"things":"are possible"},"message":"hello","extra":["world"]}\n`,
  ].join(''), 'expected a few root logs');

  let tlog = logger.with([['time', 42]]);
  tlog.log({place: 'a new'}, 'a new time', 3, 1, 4);
  tlog.log({place: 'an other'}, 'same time', 6, 2, 8);

  let clog = tlog.with({context: 'for you'});
  clog.log('bla bla');
  clog.log({such: 'things'}, 'bla bla', 'much');

  t.deepEqual(flush().join(''), [
    `{"time":42,"place":"a new","message":"a new time","extra":[3,1,4]}\n`,
    `{"time":42,"place":"an other","message":"same time","extra":[6,2,8]}\n`,
    `{"time":42,"context":"for you","message":"bla bla"}\n`,
    `{"time":42,"context":"for you","such":"things","message":"bla bla","extra":["much"]}\n`,
  ].join(''), 'expected flush after T42');

  tlog = logger.with([['time', 43]]);
  clog = tlog.with({context: 'for you'});
  clog.log({such: 'things'}, 'bla bla', 'much...');

  t.deepEqual(flush().join(''), [
    `{"time":43,"context":"for you","such":"things","message":"bla bla","extra":["much..."]}\n`,
  ].join(''), 'expected flush after T42');

});

test('teeSink', t => {

  const voidLogger = zop.makeLogger(zop.teeSink());
  voidLogger.log('😱');

  const {sink: aSink, flush: aFlush} = zop.makeBuffer();
  const {sink: bSink, flush: bFlush} = zop.makeBuffer();

  /** @type {any[][]} */
  const logEntries = [];
  const logSink = zop.intoLog((...data) => logEntries.push(data));

  const abLogger = zop.makeLogger(zop.teeSink(aSink, bSink));
  const aLogger = zop.makeLogger(zop.teeSink(aSink));
  const bLogger = zop.makeLogger(zop.teeSink(bSink));
  const logLogger = zop.makeLogger(logSink);

  abLogger.log('one');
  aLogger.log('two');
  bLogger.log('three');
  logLogger.log('four');

  t.deepEqual(aFlush().join(''), [
    `{"message":"one"}\n`,
    `{"message":"two"}\n`,
  ].join(''), 'expected A logs');

  t.deepEqual(bFlush().join(''), [
    `{"message":"one"}\n`,
    `{"message":"three"}\n`,
  ].join(''), 'expected B logs');

  logSink('not valid json');
  t.deepEqual(logEntries, [
    [{message: 'four'}],
    [new SyntaxError('Unexpected token n in JSON at position 1')],
  ], 'expected log logs');

});
