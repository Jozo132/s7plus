// @ts-check
// Integration test — classic bridge frame-building and parsing

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setup, teardown } from '../helpers.js';
import { ClassicBridge, WasmBridge, loadClassicEngine, loadWasmEngine, resetClassicEngineCache, resetWasmCache } from '../../src/lib.js';
import {
  COTP_CR, COTP_CC, COTP_DT,
  S7AreaDB, S7WLBit, S7WLByte, S7WLWord,
} from '../../src/protocol/constants.js';

/** @type {import('../helpers.js').TestContext} */
let ctx;

describe('ClassicBridge', () => {
  beforeAll(async () => {
    ctx = await setup({ port: 11102 });
  });

  afterAll(async () => {
    await teardown();
  });

  it('should build COTP Connection Request', () => {
    const frame = ctx.bridge.buildCotpCR(0, 1);
    expect(frame).toBeInstanceOf(Buffer);
    expect(frame.length).toBeGreaterThan(0);
    // TPKT header: version 3, reserved 0
    expect(frame[0]).toBe(3);
    expect(frame[1]).toBe(0);
  });

  it('should build COTP Connection Confirm', () => {
    const frame = ctx.bridge.buildCotpCC(0, 0);
    expect(frame).toBeInstanceOf(Buffer);
    expect(frame.length).toBeGreaterThan(0);
  });

  it('should build S7 Setup Communication', () => {
    const frame = ctx.bridge.buildSetupComm(1, 1, 480);
    expect(frame).toBeInstanceOf(Buffer);
    expect(frame.length).toBeGreaterThan(0);
  });

  it('should build a read request for DB1', () => {
    const frame = ctx.bridge.buildReadRequest(S7AreaDB, 1, 0, 10, S7WLByte);
    expect(frame).toBeInstanceOf(Buffer);
    expect(frame.length).toBeGreaterThan(0);
  });

  it('should build a read request for DB1 words', () => {
    const frame = ctx.bridge.buildReadRequest(S7AreaDB, 1, 0, 5, S7WLWord);
    expect(frame).toBeInstanceOf(Buffer);
    expect(frame.length).toBeGreaterThan(0);
  });

  it('should build a write request for DB2', () => {
    const data = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    const frame = ctx.bridge.buildWriteRequest(S7AreaDB, 2, 0, 4, S7WLByte, data);
    expect(frame).toBeInstanceOf(Buffer);
    expect(frame.length).toBeGreaterThan(0);
    expect(frame[32]).toBe(0x04);
    expect(frame.readUInt16BE(33)).toBe(32);
  });

  it('should build an atomic bit write request for DB2.DBX4.3', () => {
    const frame = ctx.bridge.buildBitWriteRequest(S7AreaDB, 2, 4, 3, true);
    expect(frame).toBeInstanceOf(Buffer);
    expect(frame.length).toBeGreaterThan(0);
    expect(frame[22]).toBe(S7WLBit);
    expect(frame[23]).toBe(0x00);
    expect(frame[24]).toBe(0x01);
    expect(frame[28]).toBe(0x00);
    expect(frame[29]).toBe(0x00);
    expect(frame[30]).toBe(0x23);
    expect(frame[32]).toBe(0x03);
    expect(frame.readUInt16BE(33)).toBe(1);
    expect(frame[35]).toBe(0x01);
  });

  it('should build COTP Disconnect Request', () => {
    const frame = ctx.bridge.buildCotpDR(0x1234, 0x5678, 0x9a);
    const exports = ctx.bridge.exports;
    const tx = exports.getTxBufferOffset();
    const length = exports.cotp_buildDR(0x1234, 0x5678, 0x9a, tx + 4);
    exports.tpkt_build(length, tx);
    expect(frame).toEqual(ctx.bridge.readFromTx(0, length + 4));
    expect(frame.toString('hex')).toBe('0300000b0680567812349a');
  });

  it('should parse a raw frame', () => {
    // Build a read request, then parse it back
    const frame = ctx.bridge.buildReadRequest(S7AreaDB, 1, 0, 10, S7WLByte);
    const parsed = ctx.bridge.parseFrame(frame);
    expect(parsed).toBeDefined();
    expect(parsed.cotpType).toBe(COTP_DT);
    expect(parsed.pdu).toBeDefined();
    expect(parsed.pdu?.functionCode).toBeDefined();
  });

  it('matches classic engine wire fixtures and preserves independent result buffers', () => {
    const bridge = ctx.bridge;
    const cases = [
      ['buildCotpCR', [0x1234, 0x5678], '0300001611e00000000100c0010ac1021234c2025678'],
      ['buildCotpCC', [0x1234, 0x5678], '0300000e09d05678123400c0010a'],
      ['buildSetupComm', [3, 4, 960], '0300001902f08032010000000100080000f0000003000403c0'],
      ['buildReadRequest', [132, 7, 10, 4, 2], '0300001f02f080320100000001000e00000401120a10020004000784000050'],
      ['buildWriteRequest', [132, 7, 10, 4, 2, Buffer.from([1, 2, 3, 4])], '0300002702f080320100000001000e00080501120a100200040007840000500004002001020304'],
      ['buildBitWriteRequest', [132, 7, 12, 3, true], '0300002402f080320100000001000e00050501120a100100010007840000630003000101'],
    ];
    for (const [name, args, expected] of cases) {
      bridge.exports.s7_resetSeqCounter();
      const frame = /** @type {any} */ (bridge)[/** @type {string} */ (name)](.../** @type {any[]} */ (args));
      expect(frame.toString('hex')).toBe(expected);
      bridge.buildCotpCR(0, 0);
      expect(frame.toString('hex')).toBe(expected);
    }
  });

  it('retains the legacy public aliases', async () => {
    expect(WasmBridge).toBe(ClassicBridge);
    expect(loadWasmEngine).toBe(loadClassicEngine);
    expect(resetWasmCache).toBe(resetClassicEngineCache);
    expect(await loadWasmEngine()).toBe(await loadClassicEngine());
  });

  it('rejects malformed or oversized frames and scratch allocations', () => {
    expect(() => ctx.bridge.parseFrame(Buffer.alloc(6))).toThrow('Frame parse error');
    expect(() => ctx.bridge.parseFrame(Buffer.from('0300000302f080', 'hex'))).toThrow('Frame parse error');
    expect(() => ctx.bridge.parseFrame(Buffer.from('0300000703f080', 'hex'))).toThrow('Frame parse error');
    expect(() => ctx.bridge.copyToRx(Buffer.alloc(65537))).toThrow('exceeds RX buffer capacity');
    ctx.bridge.exports.scratchReset();
    expect(() => ctx.bridge.copyToScratch(Buffer.alloc(16385))).toThrow('scratch area OOM');
  });

  it('wraps sequence references without emitting zero', () => {
    const bridge = ctx.bridge;
    bridge.exports.s7_resetSeqCounter();
    for (let index = 1; index < 65535; index++) {
      bridge.buildReadRequest(S7AreaDB, 1, 0, 1, S7WLByte);
    }
    expect(bridge.buildReadRequest(S7AreaDB, 1, 0, 1, S7WLByte).readUInt16BE(11)).toBe(65535);
    expect(bridge.buildReadRequest(S7AreaDB, 1, 0, 1, S7WLByte).readUInt16BE(11)).toBe(1);
  });
});
