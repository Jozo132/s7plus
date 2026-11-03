// @ts-check
// Compatibility loader for the JavaScript classic protocol engine.

import { createClassicEngine } from '../protocol/classic-engine.js';

/**
 * @typedef {Object} ClassicExports
 * @property {{buffer:ArrayBuffer}} memory
 *
 * @property {(ptr: number, len: number) => number} tpkt_parse
 * @property {(payloadLen: number, outPtr: number) => number} tpkt_build
 * @property {() => number} tpkt_getPayloadOffset
 * @property {() => number} tpkt_getPayloadLength
 * @property {() => number} tpkt_getTotalLength
 *
 * @property {(ptr: number, len: number) => number} cotp_parse
 * @property {(srcTsap: number, dstTsap: number, outPtr: number) => number} cotp_buildCR
 * @property {(srcRef: number, dstRef: number, outPtr: number) => number} cotp_buildCC
 * @property {(lastUnit: number, outPtr: number) => number} cotp_buildDT
 * @property {(srcRef: number, dstRef: number, reason: number, outPtr: number) => number} cotp_buildDR
 * @property {() => number} cotp_getPduType
 * @property {() => number} cotp_getHeaderLength
 * @property {() => number} cotp_getSrcRef
 * @property {() => number} cotp_getDstRef
 * @property {() => number} cotp_getSrcTsap
 * @property {() => number} cotp_getDstTsap
 * @property {() => number} cotp_getTpduSize
 * @property {() => number} cotp_isLastDataUnit
 * @property {() => number} cotp_getReason
 * @property {() => number} cotp_getPayloadOffset
 *
 * @property {(ptr: number, len: number) => number} s7_parse
 * @property {(maxAmqCalling: number, maxAmqCalled: number, pduSize: number, outPtr: number) => number} s7_buildSetupComm
 * @property {(area: number, dbNum: number, start: number, amount: number, wordLen: number, outPtr: number) => number} s7_buildReadRequest
 * @property {(area: number, dbNum: number, start: number, amount: number, wordLen: number, dataPtr: number, dataLen: number, outPtr: number) => number} s7_buildWriteRequest
 * @property {(area: number, dbNum: number, byteOffset: number, bitOffset: number, value: number, outPtr: number) => number} s7_buildBitWriteRequest
 * @property {(itemsPtr: number, itemCount: number, outPtr: number) => number} s7_buildMultiReadRequest
 * @property {() => number} s7_getMessageType
 * @property {() => number} s7_getFunctionCode
 * @property {() => number} s7_getPduRef
 * @property {() => number} s7_getParameterLength
 * @property {() => number} s7_getDataLength
 * @property {() => number} s7_getErrorClass
 * @property {() => number} s7_getErrorCode
 * @property {() => number} s7_getHeaderSize
 * @property {() => number} s7_getParamOffset
 * @property {() => number} s7_getDataOffset
 * @property {() => void} s7_resetSeqCounter
 *
 * @property {(s7Ptr: number, s7Len: number, outPtr: number) => number} frame_build
 * @property {(ptr: number, len: number) => number} frame_parse
 *
 * @property {(totalDataLen: number, maxPduSize: number) => number} pdu_needsSplit
 * @property {(maxPduSize: number) => number} pdu_maxPayload
 * @property {(totalDataLen: number, maxPduSize: number) => number} pdu_chunkCount
 *
 * @property {() => number} getLastError
 *
 * @property {(size: number) => number} scratchAlloc
 * @property {() => void} scratchReset
 * @property {() => number} getRxBufferOffset
 * @property {() => number} getTxBufferOffset
 * @property {() => number} getRxBufferSize
 * @property {() => number} getTxBufferSize
 */

/**
 * @typedef {Object} ClassicImports
 * @property {(ptr: number, len: number) => void} log_debug
 * @property {(ptr: number, len: number) => void} log_error
 * @property {() => number} now_ms
 * @property {(oldPages: number, newPages: number) => void} memory_grown
 */

/**
 * @typedef {Object} ClassicEngine
 * @property {*} instance
 * @property {ClassicExports} exports
 * @property {{buffer:ArrayBuffer}} memory
 */

/** @type {ClassicEngine | null} */
let cachedEngine = null;

/**
 * Return the classic JavaScript engine. The legacy name is retained for compatibility.
 * @param {Partial<ClassicImports>} [imports]
 * @returns {Promise<ClassicEngine>}
 */
export async function loadClassicEngine(imports) {
  if (cachedEngine) return cachedEngine;
  cachedEngine = createClassicEngine();
  return cachedEngine;
}

export function resetClassicEngineCache() {
  cachedEngine = null;
}

export { loadClassicEngine as loadWasmEngine, resetClassicEngineCache as resetWasmCache };
