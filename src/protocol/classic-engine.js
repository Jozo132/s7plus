// @ts-check

export function createClassicEngine() {
  const memory = { buffer: new ArrayBuffer(262144) };
  const bytes = Buffer.from(memory.buffer);
  let scratch = 131072;
  let lastError = 0;
  let sequence = 1;
  let tpktOffset = 0, tpktLength = 0, tpktTotal = 0;
  let cotpType = 0, cotpLength = 0, cotpSrc = 0, cotpDst = 0, cotpSrcTsap = 0, cotpDstTsap = 0, cotpSize = 0, cotpLast = false, cotpReason = 0, cotpOffset = 0;
  let messageType = 0, functionCode = 0, pduRef = 0, paramLength = 0, dataLength = 0, errorClass = 0, errorCode = 0, headerSize = 0, paramOffset = 0, dataOffset = 0;

  /** @param {number} code */
  const fail = code => { lastError = code; return code; };
  const nextRef = () => { const ref = sequence; sequence = (sequence + 1) & 0xFFFF; if (!sequence) sequence = 1; return ref; };
  /** @param {number} ptr @param {number} value */
  const put16 = (ptr, value) => { bytes[ptr] = value >>> 8; bytes[ptr + 1] = value; };
  /** @param {number} ptr */
  const get16 = ptr => (bytes[ptr] << 8) | bytes[ptr + 1];
  /** @param {number} ptr @param {number} length */
  function tpkt_parse(ptr, length) {
    if (length < 4) return fail(-2);
    if (bytes[ptr] !== 3) return fail(-1);
    const total = get16(ptr + 2);
    if (total < 4 || total > length || ptr + total > bytes.length) return fail(-3);
    tpktOffset = 4; tpktLength = total - 4; tpktTotal = total;
    return fail(0);
  }
  /** @param {number} length @param {number} ptr */
  function tpkt_build(length, ptr) {
    bytes[ptr] = 3; bytes[ptr + 1] = 0; put16(ptr + 2, length + 4);
    return 4;
  }
  /** @param {number} ptr @param {number} length */
  function cotp_parse(ptr, length) {
    if (length < 2) return fail(-10);
    const size = bytes[ptr];
    const raw = bytes[ptr + 1];
    if (size + 1 > length) return fail(-12);
    cotpType = raw & 0xF0; cotpLength = size; cotpSrc = 0; cotpDst = 0; cotpSrcTsap = 0; cotpDstTsap = 0;
    cotpSize = 0; cotpLast = false; cotpReason = 0; cotpOffset = size + 1;
    if (cotpType === 0xE0 || cotpType === 0xD0) {
      if (length < 7) return fail(-10);
      cotpDst = get16(ptr + 2); cotpSrc = get16(ptr + 4);
      for (let offset = 7; offset + 2 < size + 1;) {
        const code = bytes[ptr + offset];
        const paramSize = bytes[ptr + offset + 1];
        if (offset + 2 + paramSize > size + 1) break;
        if (code === 0xC1 && paramSize >= 2) cotpSrcTsap = get16(ptr + offset + 2);
        else if (code === 0xC2 && paramSize >= 2) cotpDstTsap = get16(ptr + offset + 2);
        else if (code === 0xC0 && paramSize >= 1) cotpSize = bytes[ptr + offset + 2];
        offset += 2 + paramSize;
      }
    } else if (cotpType === 0xF0) cotpLast = (raw & 0x80) !== 0;
    else if (cotpType === 0x80) {
      if (length < 7) return fail(-10);
      cotpDst = get16(ptr + 2); cotpSrc = get16(ptr + 4); cotpReason = bytes[ptr + 6];
    } else return fail(-11);
    return fail(0);
  }
  /** @param {number} src @param {number} dst @param {number} ptr */
  function cotp_buildCR(src, dst, ptr) {
    bytes.set([17, 0xE0, 0, 0, 0, 1, 0, 0xC0, 1, 10, 0xC1, 2, 0, 0, 0xC2, 2, 0, 0], ptr);
    put16(ptr + 12, src); put16(ptr + 16, dst); return 18;
  }
  /** @param {number} src @param {number} dst @param {number} ptr */
  function cotp_buildCC(src, dst, ptr) {
    bytes.set([9, 0xD0, 0, 0, 0, 0, 0, 0xC0, 1, 10], ptr);
    put16(ptr + 2, dst); put16(ptr + 4, src); return 10;
  }
  /** @param {number} last @param {number} ptr */
  function cotp_buildDT(last, ptr) { bytes.set([2, 0xF0, last ? 0x80 : 0], ptr); return 3; }
  /** @param {number} src @param {number} dst @param {number} reason @param {number} ptr */
  function cotp_buildDR(src, dst, reason, ptr) {
    bytes.set([6, 0x80, 0, 0, 0, 0, reason & 0xFF], ptr);
    put16(ptr + 2, dst); put16(ptr + 4, src); return 7;
  }
  /** @param {number} ptr @param {number} length */
  function s7_parse(ptr, length) {
    if (length < 10) return fail(-21);
    if (bytes[ptr] !== 0x32) return fail(-20);
    messageType = bytes[ptr + 1]; pduRef = get16(ptr + 4); paramLength = get16(ptr + 6); dataLength = get16(ptr + 8);
    errorClass = 0; errorCode = 0; functionCode = 0;
    if (messageType === 2 || messageType === 3) {
      if (length < 12) return fail(-21);
      errorClass = bytes[ptr + 10]; errorCode = bytes[ptr + 11]; headerSize = 12;
    } else if (messageType === 1 || messageType === 7) headerSize = 10;
    else return fail(-22);
    paramOffset = headerSize; dataOffset = headerSize + paramLength;
    if (paramLength > 0 && headerSize < length) functionCode = bytes[ptr + headerSize];
    return fail(0);
  }
  /** @param {number} ptr @param {number} params @param {number} data */
  function writeHeader(ptr, params, data) {
    bytes.set([0x32, 1, 0, 0, 0, 0, 0, 0, 0, 0], ptr);
    put16(ptr + 4, nextRef()); put16(ptr + 6, params); put16(ptr + 8, data);
  }
  /** @param {number} calling @param {number} called @param {number} size @param {number} ptr */
  function s7_buildSetupComm(calling, called, size, ptr) {
    writeHeader(ptr, 8, 0); bytes[ptr + 10] = 0xF0; bytes[ptr + 11] = 0;
    put16(ptr + 12, calling); put16(ptr + 14, called); put16(ptr + 16, size); return 18;
  }
  /** @param {number} ptr @param {number} fn @param {number} area @param {number} db @param {number} start @param {number} amount @param {number} wordLen */
  function writeItem(ptr, fn, area, db, start, amount, wordLen) {
    bytes.set([fn, 1, 0x12, 0x0A, 0x10, wordLen & 0xFF, 0, 0, 0, 0, area & 0xFF, 0, 0, 0], ptr + 10);
    put16(ptr + 16, amount); put16(ptr + 18, db);
    const address = wordLen === 1 ? start : start * 8;
    bytes[ptr + 21] = address >>> 16; bytes[ptr + 22] = address >>> 8; bytes[ptr + 23] = address;
  }
  /** @param {number} area @param {number} db @param {number} start @param {number} amount @param {number} wordLen @param {number} ptr */
  function s7_buildReadRequest(area, db, start, amount, wordLen, ptr) {
    writeHeader(ptr, 14, 0); writeItem(ptr, 4, area, db, start, amount, wordLen); return 24;
  }
  /** @param {number} area @param {number} db @param {number} start @param {number} amount @param {number} wordLen @param {number} dataPtr @param {number} length @param {number} ptr */
  function s7_buildWriteRequest(area, db, start, amount, wordLen, dataPtr, length, ptr) {
    const transport = wordLen === 1 ? 3 : wordLen === 5 || wordLen === 7 ? 5 : wordLen === 8 ? 7 : [3, 28, 29].includes(wordLen) ? 9 : 4;
    writeHeader(ptr, 14, 4 + length); writeItem(ptr, 5, area, db, start, amount, wordLen);
    bytes[ptr + 24] = 0; bytes[ptr + 25] = transport; put16(ptr + 26, [3, 7, 9].includes(transport) ? length : length * 8);
    bytes.copyWithin(ptr + 28, dataPtr, dataPtr + length); return 28 + length;
  }
  /** @param {number} area @param {number} db @param {number} offset @param {number} bit @param {number} value @param {number} ptr */
  function s7_buildBitWriteRequest(area, db, offset, bit, value, ptr) {
    bytes[ptr + 28] = value ? 1 : 0;
    return s7_buildWriteRequest(area, db, offset * 8 + (bit & 7), 1, 1, ptr + 28, 1, ptr);
  }
  /** @param {number} items @param {number} count @param {number} ptr */
  function s7_buildMultiReadRequest(items, count, ptr) {
    writeHeader(ptr, 2 + count * 12, 0); bytes[ptr + 10] = 4; bytes[ptr + 11] = count;
    bytes.copyWithin(ptr + 12, items, items + count * 12); return 12 + count * 12;
  }
  /** @param {number} source @param {number} length @param {number} ptr */
  function frame_build(source, length, ptr) {
    tpkt_build(3 + length, ptr); cotp_buildDT(1, ptr + 4); bytes.copyWithin(ptr + 7, source, source + length); return 7 + length;
  }
  /** @param {number} ptr @param {number} length */
  function frame_parse(ptr, length) {
    if (length < 7) return fail(-30);
    let result = tpkt_parse(ptr, length); if (result) return result;
    result = cotp_parse(ptr + tpktOffset, tpktLength); if (result) return result;
    if (cotpType === 0xF0 && tpktLength > cotpOffset) {
      result = s7_parse(ptr + tpktOffset + cotpOffset, tpktLength - cotpOffset); if (result) return result;
    }
    return fail(0);
  }
  const exports = {
    memory, tpkt_parse, tpkt_build, tpkt_getPayloadOffset: () => tpktOffset, tpkt_getPayloadLength: () => tpktLength, tpkt_getTotalLength: () => tpktTotal,
    cotp_parse, cotp_buildCR, cotp_buildCC, cotp_buildDT, cotp_buildDR, cotp_getPduType: () => cotpType, cotp_getHeaderLength: () => cotpLength,
    cotp_getSrcRef: () => cotpSrc, cotp_getDstRef: () => cotpDst, cotp_getSrcTsap: () => cotpSrcTsap, cotp_getDstTsap: () => cotpDstTsap,
    cotp_getTpduSize: () => cotpSize, cotp_isLastDataUnit: () => cotpLast ? 1 : 0, cotp_getReason: () => cotpReason, cotp_getPayloadOffset: () => cotpOffset,
    s7_parse, s7_buildSetupComm, s7_buildReadRequest, s7_buildWriteRequest, s7_buildBitWriteRequest, s7_buildMultiReadRequest,
    s7_getMessageType: () => messageType, s7_getFunctionCode: () => functionCode, s7_getPduRef: () => pduRef,
    s7_getParameterLength: () => paramLength, s7_getDataLength: () => dataLength, s7_getErrorClass: () => errorClass, s7_getErrorCode: () => errorCode,
    s7_getHeaderSize: () => headerSize, s7_getParamOffset: () => paramOffset, s7_getDataOffset: () => dataOffset, s7_resetSeqCounter: () => { sequence = 1; },
    frame_build, frame_parse, pdu_needsSplit: (/** @type {number} */ total, /** @type {number} */ size) => total > ((size - 31) >>> 0) ? 1 : 0,
    pdu_maxPayload: (/** @type {number} */ size) => (size - 31) >>> 0,
    pdu_chunkCount: (/** @type {number} */ total, /** @type {number} */ size) => { const max = (size - 31) >>> 0; return max ? Math.floor(((total + max - 1) >>> 0) / max) : 0; },
    getLastError: () => lastError,
    scratchAlloc: (/** @type {number} */ size) => { if (scratch + size > 147456) return 0; const ptr = scratch; scratch += size; return ptr; },
    scratchReset: () => { scratch = 131072; }, getRxBufferOffset: () => 0, getTxBufferOffset: () => 65536,
    getRxBufferSize: () => 65536, getTxBufferSize: () => 65536,
  };
  return { instance: { exports }, exports, memory };
}