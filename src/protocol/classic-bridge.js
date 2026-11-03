// @ts-check
// Classic protocol bridge, retaining the legacy low-level engine interface.

/** @import { ClassicEngine, ClassicExports } from './classic-loader.js' */
/** @import { ParsedPDU } from '../protocol/types.js' */

export class ClassicBridge {
  /** @type {ClassicEngine} */
  #engine;
  /** @type {Uint8Array} */
  #memoryView;

  /** @param {ClassicEngine} engine */
  constructor(engine) {
    this.#engine = engine;
    this.#memoryView = new Uint8Array(engine.memory.buffer);
  }

  #refreshMemoryView() {
    if (this.#memoryView.buffer !== this.#engine.memory.buffer) {
      this.#memoryView = new Uint8Array(this.#engine.memory.buffer);
    }
  }

  /**
  * Copy a Node.js Buffer into the RX region. Returns the offset written to.
   * @param {Buffer} data
   * @param {number} [offset=0]
   * @returns {number}
   */
  copyToRx(data, offset = 0) {
    this.#refreshMemoryView();
    const rxBase = this.#engine.exports.getRxBufferOffset();
    const rxSize = this.#engine.exports.getRxBufferSize();
    const writeOffset = rxBase + offset;

    if (offset + data.length > rxSize) {
      throw new Error(`Data (${data.length} bytes) exceeds RX buffer capacity at offset ${offset}`);
    }

    this.#memoryView.set(data, writeOffset);
    return writeOffset;
  }

  /**
  * Read bytes from the TX region into a Node.js Buffer.
   * @param {number} offset
   * @param {number} length
   * @returns {Buffer}
   */
  readFromTx(offset, length) {
    this.#refreshMemoryView();
    const txBase = this.#engine.exports.getTxBufferOffset();
    return Buffer.from(this.#memoryView.subarray(txBase + offset, txBase + offset + length));
  }

  /**
  * Read bytes from an engine memory offset.
   * @param {number} offset
   * @param {number} length
   * @returns {Buffer}
   */
  readMemory(offset, length) {
    this.#refreshMemoryView();
    return Buffer.from(this.#memoryView.subarray(offset, offset + length));
  }

  /**
  * Copy data to the scratch area. Returns its offset.
   * @param {Buffer} data
   * @returns {number}
   */
  copyToScratch(data) {
    this.#refreshMemoryView();
    const ptr = this.#engine.exports.scratchAlloc(data.length);
    if (ptr === 0) throw new Error('Classic engine scratch area OOM');
    this.#memoryView.set(data, ptr);
    return ptr;
  }

  /**
   * Parse a complete TPKT+COTP+S7 frame.
   * @param {Buffer} frame
   * @returns {{ cotpType: number; pdu: ParsedPDU | null }}
   */
  parseFrame(frame) {
    const framePtr = this.copyToRx(frame);
    const e = this.#engine.exports;

    const rc = e.frame_parse(framePtr, frame.length);
    if (rc !== 0) {
      throw new Error(`Frame parse error: ${rc} (engine error: ${e.getLastError()})`);
    }

    const cotpType = e.cotp_getPduType();

    // Only DT frames have S7 payload
    if (cotpType !== 0xF0) {
      return { cotpType, pdu: null };
    }

    /** @type {ParsedPDU} */
    const pdu = {
      raw: frame,
      messageType: e.s7_getMessageType(),
      functionCode: e.s7_getFunctionCode(),
      pduRef: e.s7_getPduRef(),
      paramLength: e.s7_getParameterLength(),
      dataLength: e.s7_getDataLength(),
      errorClass: e.s7_getErrorClass(),
      errorCode: e.s7_getErrorCode(),
    };

    return { cotpType, pdu };
  }

  /**
   * Build a COTP Connection Request frame (TPKT + COTP CR).
   * @param {number} srcTsap
   * @param {number} dstTsap
   * @returns {Buffer}
   */
  buildCotpCR(srcTsap, dstTsap) {
    const e = this.#engine.exports;
    this.#refreshMemoryView();

    const txBase = e.getTxBufferOffset();
    const cotpLen = e.cotp_buildCR(srcTsap, dstTsap, txBase + 4);
    e.tpkt_build(cotpLen, txBase);

    const totalLen = 4 + cotpLen;
    return this.readFromTx(0, totalLen);
  }

  /**
   * Build a COTP Connection Confirm frame.
   * @param {number} srcRef
   * @param {number} dstRef
   * @returns {Buffer}
   */
  buildCotpCC(srcRef, dstRef) {
    const e = this.#engine.exports;
    this.#refreshMemoryView();

    const txBase = e.getTxBufferOffset();
    const cotpLen = e.cotp_buildCC(srcRef, dstRef, txBase + 4);
    e.tpkt_build(cotpLen, txBase);

    return this.readFromTx(0, 4 + cotpLen);
  }

  /**
   * Build a COTP Disconnect Request frame.
   * @param {number} srcRef
   * @param {number} dstRef
   * @param {number} [reason=0]
   * @returns {Buffer}
   */
  buildCotpDR(srcRef, dstRef, reason = 0) {
    return Buffer.from([3, 0, 0, 11, 6, 0x80,
      (dstRef >>> 8) & 0xFF, dstRef & 0xFF,
      (srcRef >>> 8) & 0xFF, srcRef & 0xFF, reason & 0xFF]);
  }

  /**
   * Build a complete TPKT+COTP DT+S7 Setup Communication frame.
   * @param {number} maxAmqCalling
   * @param {number} maxAmqCalled
   * @param {number} pduSize
   * @returns {Buffer}
   */
  buildSetupComm(maxAmqCalling, maxAmqCalled, pduSize) {
    const e = this.#engine.exports;
    this.#refreshMemoryView();
    const txBase = e.getTxBufferOffset();
    const s7Len = e.s7_buildSetupComm(maxAmqCalling, maxAmqCalled, pduSize, txBase + 7);
    e.tpkt_build(s7Len + 3, txBase);
    e.cotp_buildDT(1, txBase + 4);
    return this.readFromTx(0, s7Len + 7);
  }

  /**
   * Build S7 Read Var request frame.
   * @param {number} area
   * @param {number} dbNum
   * @param {number} start
   * @param {number} amount
   * @param {number} wordLen
   * @returns {Buffer}
   */
  buildReadRequest(area, dbNum, start, amount, wordLen) {
    const e = this.#engine.exports;
    this.#refreshMemoryView();
    const txBase = e.getTxBufferOffset();
    const s7Len = e.s7_buildReadRequest(area, dbNum, start, amount, wordLen, txBase + 7);
    e.tpkt_build(s7Len + 3, txBase);
    e.cotp_buildDT(1, txBase + 4);
    return this.readFromTx(0, s7Len + 7);
  }

  /**
   * Build S7 Write Var request frame.
   * @param {number} area
   * @param {number} dbNum
   * @param {number} start
   * @param {number} amount
   * @param {number} wordLen
   * @param {Buffer} data
   * @returns {Buffer}
   */
  buildWriteRequest(area, dbNum, start, amount, wordLen, data) {
    const e = this.#engine.exports;
    this.#refreshMemoryView();

    e.scratchReset();
    const dataPtr = this.copyToScratch(data);
    const txBase = e.getTxBufferOffset();
    const s7Len = e.s7_buildWriteRequest(area, dbNum, start, amount, wordLen, dataPtr, data.length, txBase + 7);
    e.tpkt_build(s7Len + 3, txBase);
    e.cotp_buildDT(1, txBase + 4);
    return this.readFromTx(0, s7Len + 7);
  }

  /**
   * Build S7 Write Var request frame for a single atomic bit write.
   * @param {number} area
   * @param {number} dbNum
   * @param {number} byteOffset
   * @param {number} bitOffset
   * @param {boolean} value
   * @returns {Buffer}
   */
  buildBitWriteRequest(area, dbNum, byteOffset, bitOffset, value) {
    const e = this.#engine.exports;
    this.#refreshMemoryView();
    const txBase = e.getTxBufferOffset();
    const s7Len = e.s7_buildBitWriteRequest(area, dbNum, byteOffset, bitOffset, value ? 1 : 0, txBase + 7);
    e.tpkt_build(s7Len + 3, txBase);
    e.cotp_buildDT(1, txBase + 4);
    return this.readFromTx(0, s7Len + 7);
  }

  /** @returns {ClassicExports} */
  get exports() {
    return this.#engine.exports;
  }
}

export { ClassicBridge as WasmBridge };
