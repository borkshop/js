/** @callback RecognizerFunc -- a function that may skip or recognize token
 * bytes from the prefix of a byte buffer.
 *
 * @param {Uint8Array} buf -- a byte array being scanned; may be a subarray
 * within a larger byte buffer; which may itself be logically offset within a
 * larger sequence of bytes
 *
 * @param {boolean} done -- true if no more bytes will ever be read
 *
 * @returns {number} -- if 0, no token can currently be recognized, causing
 * more bytes to be read if not done, or halting otherwise; if >0 the caller
 * MAY process all buf[0 <= i < R] bytes.
 *
 * After a recognizer returns R!=0, the caller MUST NEVER call that recognizer
 * over any bytes in buf[0 <= i < abs(R)] again. This means that a recognizer
 * MAY return R<0 to skip bytes without producing a token.
 *
 * Recognizer functions MAY be stateful, so a caller MUST NOT re-use one over
 * multiple byte sequences.
 */

/** @typedef {object} Recognizer -- an object with a recognize method
 * @prop {RecognizerFunc} recognize
 */

/** Binds a Recognizer and a readable stream together, allowing
 * its consumer to scan through recognized tokens.
 */
export class Scanner {
  /**
   * @param {AsyncIterator<Uint8Array>|AsyncIterable<Uint8Array>} stream
   * @param {Recognizer|RecognizerFunc} rec
   * @param {number|Uint8Array} [buffer]
   */
  constructor(stream, rec, buffer=4*1024) {
    if (!('next' in stream)) stream = stream[Symbol.asyncIterator]();
    this._rec = rec;
    this._stream = stream;
    this._buf = typeof buffer === 'number' ? new Uint8Array(buffer) : buffer;
  }

  /** @private */
  _rec

  /** @private */
  _recognized = 0

  /** @private */
  _stream

  /** @private */
  _done = false

  /** @private */
  _offset = 0

  /** @private */
  _buf

  /** @private */
  _bufred = 0

  /** @private */
  _consumed = 0

  /** @return {number} -- the offset of the current token within the overall stream */
  get offset() {
    return this._offset + this._consumed;
  }

  /** @returns {null|Uint8Array} -- the last recognized token, or null if the
   * last recognizer call declined or skipped.
   *
   * The returned array logically starts at offset bytes within stream.
   */
  get bytes() {
    if (this._recognized <= 0) return null;
    const start = this._consumed;
    const end = start + this._recognized;
    return this._buf.subarray(start, end);
  }

  /** Consumes any prior recognized bytes then loops the recognizer:
   * - the first positive return is saved as recognized, then scan returns true
   * - any negative return is immediately skipped (by consuming -N bytes)
   * - zero causes scan to wait for another chunk from the underlying stream,
   *   or return false if the stream is done; once another chunk is recieved,
   *   it's copied into buf after first calling grow() to make room
   */
  async scan() {
    // consume last scan() token
    this._consumed += this._recognized;
    this._recognized = 0;

    for (;;) { // FIXME oh the insanity

      // if we haven't consumed all of buf, call the recognizer
      if (this._consumed < this._bufred) {
        const chunk = this._buf.subarray(this._consumed, this._bufred);
        const n = typeof this._rec === 'function'
          ? this._rec(chunk, this._done)
          : this._rec.recognize(chunk, this._done)

        // may recognize a token
        if (n > 0) {
          this._recognized = n;
          return true;
        }

        // may skip
        if (n < 0) {
          this._consumed += -n;
          continue;
        }

        // n == 0 by trichotomy
      }
      // either all buf content consumed, or recognizer declined

      // halt if stream done
      if (this._done) return false;

      // wait for next chunk
      const {value: chunk, done} = await this._stream.next();

      // if stream just finished, set flag and do a last round of recognition
      if (done) {
        this._done = true;
        continue;
      }

      const tail = this._buf.length - this._bufred;
      const free = tail + this._consumed;

      // may need to grow the buffer
      if (chunk.length > free)
        this._realloc(this._bufred - this._consumed + chunk.length);

      // may need to compact the buffer
      else if (tail < chunk.length) {
        if (this._consumed <= 0)
          throw new Error('inconceivable: buffer should be able to compact enough space, because math');
        this._compact();
      }

      // copy chunk into the end of the buffer
      this._buf.set(chunk, this._bufred);
      this._bufred += chunk.length;
    }
  }

  /** @private
   * @param {number} need
   */
  _realloc(need) {
    let alloc = this._buf.length;
    while (alloc < need)
      if (alloc < 1024 * 1024) alloc *= 2;
      else alloc *= 1.25;
    const buf = new Uint8Array(alloc);
    if (this._consumed < this._bufred) {
      buf.set(this._buf.subarray(this._consumed, this._bufred));
    }
    this._offset += this._consumed;
    this._bufred = Math.max(0, this._bufred - this._consumed);
    this._consumed = 0;
    this._buf = buf;
  }

  /** @private */
  _compact() {
    this._buf.copyWithin(0, this._consumed);
    this._offset += this._consumed;
    this._bufred -= this._consumed;
    this._consumed = 0;
  }
}
