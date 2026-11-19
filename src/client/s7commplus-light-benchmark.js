import { isIP } from 'node:net';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { S7CommPlusClient } from './s7commplus-client.js';

const [mode, host, portText, expectedOrder, expectedFirmware, optionText = '8', minPeriodText = '20'] = process.argv.slice(2);
const maxSpeed = ['--max-speed', '--plan-max-speed'].includes(mode);
const pipeline = ['--pipeline', '--plan-pipeline'].includes(mode);
const parallel = ['--parallel', '--plan-parallel'].includes(mode);
const maxItems = mode === '--discover' ? 8 : parallel ? 57 : Number(optionText);
const minPeriodMs = ['--discover', '--batch'].includes(mode) ? 250 : parallel ? 10 : Number(minPeriodText);
const candidateNumbers = mode === '--discover' ? optionText.split(',').map(Number) : [];
if (!['--live', '--plan', '--discover', '--batch', '--max-speed', '--plan-max-speed', '--pipeline', '--plan-pipeline', '--parallel', '--plan-parallel'].includes(mode) || !isIP(host) || portText !== '1102' || !/^6ES7 [A-Z0-9 -]{8,32}$/.test(expectedOrder ?? '')
  || !/^V\d+\.\d+$/.test(expectedFirmware ?? '') || !Number.isInteger(maxItems) || maxItems < 1 || maxItems > (mode === '--batch' ? 64 : maxSpeed || pipeline || parallel ? 57 : 8)
  || ((maxSpeed || pipeline || parallel) && maxItems !== 57) || (pipeline && minPeriodMs !== 10)
  || (parallel && process.argv.length !== 7)
  || ![10, 20, 50, 100, 250].includes(minPeriodMs) || (mode === '--discover' && (candidateNumbers.length > 6
    || new Set(candidateNumbers).size !== candidateNumbers.length || candidateNumbers.some(number => !Number.isInteger(number) || number < 1 || number > 65535)))) {
  throw new Error('Usage: node s7commplus-light-benchmark.js <--plan|--live|--discover|--batch|--plan-max-speed|--max-speed|--plan-pipeline|--pipeline|--plan-parallel|--parallel> <gateway-ip> 1102 <expected-order-number> <expected-firmware> [max-items:1..8|batch-max:1..64|discover-db-list|speed/pipeline:57] [min-period-ms:10|20|50|100|250]');
}

const sizes = [1, 2, 4, 8].filter(size => size <= maxItems);
const stages = [
  ...sizes.map(size => ({ size, periodMs: 250, cycles: 3 })),
  ...[100, 50, 20, 10].filter(periodMs => periodMs >= minPeriodMs).map(periodMs => ({ size: maxItems, periodMs, cycles: periodMs <= 20 ? 8 : periodMs === 50 ? 5 : 4 })),
];
const speedStages = [250, 100, 50, 20, 10].filter(periodMs => periodMs >= minPeriodMs)
  .map(periodMs => ({ size: 57, periodMs, cycles: periodMs <= 20 ? 8 : periodMs === 50 ? 5 : periodMs === 100 ? 4 : 3 }));
if (mode === '--plan' || mode === '--plan-max-speed' || mode === '--plan-pipeline' || mode === '--plan-parallel') {
  if (parallel) {
    console.log(JSON.stringify({ sessions: 3, db: 12, membersPerRead: 57, pauseAfterReadMs: 1,
      nativeReadPacingMs: 10, maxReadsPerSession: 90, maxSessionRequests: 128,
      samplingDurationMs: 5000, maxSessionMs: 60000, noConnection: true }, null, 2));
    process.exit(0);
  }
  if (pipeline) {
    console.log(JSON.stringify({ db: 12, membersPerRead: 57, pendingReads: 2, nativeInFlight: 1,
      readPacingMs: 10, samplingDurationMs: 5000, maxSessionRequests: 300, maxSessionMs: 20000,
      noConnection: true }, null, 2));
    process.exit(0);
  }
  console.log(JSON.stringify({ stages: maxSpeed ? speedStages : stages, maxSessionRequests: 48, maxSessionMs: 20000,
    maxMembers: maxSpeed ? 57 : 8, noConnection: true }, null, 2));
  process.exit(0);
}

if (parallel) {
  const clients = [];
  const setupStarted = performance.now();
  try {
    for (let index = 0; index < 3; index++) {
      const session = new S7CommPlusClient({ host, port: 1102, productionReadOnly: true, securityMode: 'legacy', limits: {
        maxConnectionsPerTarget: 3, maxQueuedRequests: 1, maxRequests: 128, sessionDurationMs: 60000,
        requestTimeoutMs: 3000, pacingMs: 1000, readPacingMs: 10, maxSessionBytes: 1048576,
      } });
      clients.push(session);
      await session.connect();
      const { identity, cpuState, securityMode } = session.report;
      if (identity?.orderNumber !== expectedOrder || identity?.firmware !== expectedFirmware || cpuState !== 'RUN'
        || securityMode !== 'LEGACY_SESSION_KEY_INTEGRITY') throw new Error(`Session ${index + 1}: PLC baseline differs`);
    }
    const selections = [];
    for (const [index, session] of clients.entries()) {
      const discovery = await session.listBlockMembers({ type: 'DB', number: 12 }, { maxMembers: 512, maxTypes: 32 });
      const members = discovery.members.filter(member => member.readable).slice(0, 57);
      if (discovery.block.number !== 12 || discovery.members.length !== 140 || members.length !== 57
        || members.some(member => member.datatype !== 'BBOOL')) throw new Error(`Session ${index + 1}: DB12 layout differs`);
      const baseline = await session.readMembers(members, { maxItems: 57 });
      if (baseline.length !== 57 || baseline.some(sample => sample.observation.quality !== 'GOOD' || !sample.request)
        || new Set(baseline.map(sample => sample.request?.sequence)).size !== 1) throw new Error(`Session ${index + 1}: baseline read failed`);
      selections.push(members);
    }
    const setupRequests = clients.map(session => session.report.statistics.requests);
    const started = performance.now();
    let stopping = false;
    const timeout = setTimeout(() => { stopping = true; for (const session of clients) void session.disconnect().catch(() => undefined); }, 5000);
    try {
      const workers = await Promise.allSettled(clients.map(async (session, index) => {
        const wire = [];
        while (!stopping && performance.now() - started < 5000 && wire.length < 90) {
          let samples;
          try { samples = await session.readMembers(selections[index], { maxItems: 57 }); }
          catch (error) { if (stopping) break; throw error; }
          if (samples.length !== 57 || samples.some(sample => sample.observation.quality !== 'GOOD' || !sample.request)
            || new Set(samples.map(sample => sample.request?.sequence)).size !== 1) throw new Error(`Session ${index + 1}: incomplete or split read`);
          const request = samples[0].request;
          if (request.requestBytes > 900 || request.latencyMs > 100) throw new Error(`Session ${index + 1}: request envelope or latency exceeded`);
          wire.push(request);
          await delay(1);
        }
        return wire;
      }));
      const failure = workers.find(result => result.status === 'rejected');
      if (failure) throw failure.reason;
      const summarize = values => {
        if (!values.length) return null;
        const sorted = values.slice().sort((left, right) => left - right);
        return { min: Math.round(sorted[0] * 10) / 10, p50: Math.round(sorted[Math.ceil(sorted.length * 0.5) - 1] * 10) / 10,
          p95: Math.round(sorted[Math.ceil(sorted.length * 0.95) - 1] * 10) / 10, max: Math.round(sorted[sorted.length - 1] * 10) / 10 };
      };
      const sessions = workers.map((result, index) => {
        const wire = result.value;
        const nativeRequests = clients[index].report.statistics.requests - setupRequests[index];
        if (nativeRequests - wire.length < 0 || nativeRequests - wire.length > (stopping ? 1 : 0)) throw new Error(`Session ${index + 1}: hidden retry or incomplete read`);
        return { session: index + 1, reads: wire.length, nativeRequests,
          wireIntervalsMs: summarize(wire.slice(1).map((request, offset) => request.sentAtMonotonicMs - wire[offset].sentAtMonotonicMs)),
          idleGapsMs: summarize(wire.slice(1).map((request, offset) => request.sentAtMonotonicMs - wire[offset].receivedAtMonotonicMs)),
          latencyMs: summarize(wire.map(request => request.latencyMs)),
          requestBytes: wire.reduce((sum, request) => sum + request.requestBytes, 0),
          responseBytes: wire.reduce((sum, request) => sum + request.responseBytes, 0) };
      });
      console.log(JSON.stringify({ status: 'COMPLETED', db: 12, sessions: 3, membersPerRead: 57, pauseAfterReadMs: 1,
        nativeReadPacingMs: 10, setupMs: Math.round(started - setupStarted), elapsedMs: Math.round(performance.now() - started),
        totalReads: sessions.reduce((sum, session) => sum + session.reads, 0),
        totalValues: sessions.reduce((sum, session) => sum + session.reads * 57, 0), readOnly: true,
        results: sessions, note: 'Short three-session read-only test; HMI impact and sustained throughput unverified' }, null, 2));
    } finally { clearTimeout(timeout); }
  } catch (error) {
    console.error(JSON.stringify({ status: 'STOPPED', reason: error instanceof Error ? error.message : String(error),
      setupOrRunElapsedMs: Math.round(performance.now() - setupStarted),
      readOnly: clients.every(session => session.productionReadOnly),
      sessions: clients.map((session, index) => ({ session: index + 1, phase: session.report.failure?.phase ?? session.report.phase,
        requests: session.report.statistics.requests })) }));
    process.exitCode = 1;
  } finally { await Promise.allSettled(clients.map(session => session.disconnect())); }
  process.exit();
}

const client = new S7CommPlusClient({ host, port: 1102, productionReadOnly: true, securityMode: 'legacy', limits: {
  maxConnectionsPerTarget: 1, maxQueuedRequests: 1, maxRequests: pipeline ? 300 : mode === '--live' || maxSpeed ? 48 : 32, sessionDurationMs: mode === '--discover' ? 25000 : 20000,
  requestTimeoutMs: 3000, pacingMs: 1000, readPacingMs: minPeriodMs, maxSessionBytes: 1048576,
} });
const results = [];
let ceiling = 'NOT_REACHED_WITHIN_CONFIGURED_ENVELOPE';

try {
  await client.connect();
  const { identity, cpuState, securityMode } = client.report;
  if (identity?.orderNumber !== expectedOrder || identity?.firmware !== expectedFirmware || cpuState !== 'RUN' || securityMode !== 'LEGACY_SESSION_KEY_INTEGRITY') {
    throw new Error('PLC identity, RUN state, or security profile differs from the pre-approved baseline');
  }
  if (mode === '--discover') {
    const inventory = await client.listDataBlocks();
    const candidates = [];
    for (const number of candidateNumbers) {
      const matches = inventory.blocks.filter(block => block.number === number && block.name);
      if (matches.length !== 1) throw new Error(`Saved DB${number} no longer has one unambiguous inventory identity`);
      let discovery;
      try { discovery = await client.listBlockMembers({ type: 'DB', number }, { maxMembers: 512, maxTypes: 32 }); }
      catch (error) {
        if (error instanceof Error && error.message === 'Expanded member budget exceeded') {
          const candidate = { db: number, status: 'EXCEEDS_512_EXPANDED_MEMBERS', requestsSoFar: client.report.statistics.requests };
          candidates.push(candidate);
          console.log(JSON.stringify({ kind: 'candidate', ...candidate }));
          continue;
        }
        throw error;
      }
      const candidate = { db: number, completeness: discovery.completeness, total: discovery.members.length,
        readable: discovery.members.filter(member => member.readable).length, requestsSoFar: client.report.statistics.requests };
      candidates.push(candidate);
      console.log(JSON.stringify({ kind: 'candidate', ...candidate }));
      if (candidate.readable >= 64) break;
    }
    console.log(JSON.stringify({ status: 'METADATA_ONLY', candidates, readOnly: client.productionReadOnly,
      session: client.report.statistics, note: 'No process values were read' }, null, 2));
  } else if (mode === '--batch') {
    const discovery = await client.listBlockMembers({ type: 'DB', number: 12 }, { maxMembers: 512, maxTypes: 32 });
    const readable = discovery.members.filter(member => member.readable);
    if (discovery.block.number !== 12 || discovery.members.length !== 140 || readable.length !== 123) {
      throw new Error(`DB12 layout differs: block=${discovery.block.number}, members=${discovery.members.length}, readable=${readable.length}`);
    }
    const members = readable.slice(0, maxItems);
    if (members.length !== maxItems) throw new Error(`DB12 has only ${members.length} native-readable members for the requested batch size`);
    const datatypes = Object.fromEntries([...new Set(members.map(member => member.datatype))].map(datatype =>
      [datatype, members.filter(member => member.datatype === datatype).length]));
    console.log(JSON.stringify({ kind: 'selection', db: 12, selected: members.length, datatypes }));
    let largestSingleRequest = 0;
    let firstSplit = null;
    const sizes = [1, 8, 16, 32, 48, 64].filter(size => size <= maxItems);
    if (sizes.at(-1) !== maxItems) sizes.push(maxItems);
    /** @param {number} size */
    const probe = async size => {
      const before = client.report.statistics.requests;
      const samples = await client.readMembers(members.slice(0, size), { maxItems: size });
      if (samples.length !== size || samples.some(sample => sample.observation.quality !== 'GOOD' || !sample.request)) {
        throw new Error(`DB12 size ${size} returned an incomplete or non-GOOD read; benchmark stopped`);
      }
      const requests = new Map();
      for (const sample of samples) {
        const request = sample.request;
        if (!request) throw new Error('Native request timing missing');
        requests.set(request.sequence, request);
      }
      const wire = Array.from(requests.values());
      const requestCount = client.report.statistics.requests - before;
      const result = { size, requestCount, wireRequests: wire.length, requestBytes: wire.map(request => request.requestBytes),
        latencyMs: wire.map(request => Math.round(request.latencyMs)), status: requestCount === 1 && wire.length === 1 ? 'SINGLE_GOOD' : 'SPLIT_OR_FALLBACK' };
      console.log(JSON.stringify({ kind: 'batch', ...result }));
      return result;
    };
    for (const size of sizes) {
      const result = await probe(size);
      if (result.status !== 'SINGLE_GOOD') {
        firstSplit = size;
        if (result.requestCount === result.wireRequests) {
          let lower = largestSingleRequest;
          let upper = size;
          while (upper - lower > 1 && client.report.statistics.requests + 2 < 32) {
            const middle = Math.floor((lower + upper) / 2);
            const refined = await probe(middle);
            if (refined.status === 'SINGLE_GOOD') lower = middle;
            else if (refined.requestCount === refined.wireRequests) upper = middle;
            else break;
          }
          largestSingleRequest = lower;
          firstSplit = upper;
        }
        break;
      }
      largestSingleRequest = size;
    }
    console.log(JSON.stringify({ status: 'COMPLETED', db: 12, selectedMembers: members.length, largestSingleRequest,
      firstSplit, nativeMaxItems: 64, readOnly: client.productionReadOnly, session: client.report.statistics,
      note: 'One DB12 prefix at 250ms read pacing; not a universal PLC limit or sustained qualification' }, null, 2));
  } else {
  const dbNumber = maxSpeed || pipeline ? 12 : 9;
  const discovery = await client.listBlockMembers({ type: 'DB', number: dbNumber }, maxSpeed || pipeline ? { maxMembers: 512, maxTypes: 32 } : { maxMembers: 32, maxTypes: 8 });
  const members = discovery.members.filter(member => member.readable).slice(0, maxItems);
  if (maxSpeed || pipeline ? discovery.block.number !== 12 || discovery.members.length !== 140 || members.length !== 57
      || members.some(member => member.datatype !== 'BBOOL') : !['COMPLETE', 'PARTIAL'].includes(discovery.completeness)
      || discovery.block.number !== 9 || discovery.members.length !== 10 || members.length !== 8) {
    throw new Error(`DB${dbNumber} member layout differs from the verified read-only baseline`);
  }
  if (pipeline) {
    const selection = members.slice();
    const baseline = await client.readMembers(selection, { maxItems: 57 });
    if (baseline.length !== 57 || baseline.some(sample => sample.observation.quality !== 'GOOD' || !sample.request)
      || new Set(baseline.map(sample => sample.request?.sequence)).size !== 1) throw new Error('57-member baseline did not return GOOD values in one native request');
    const setupRequests = client.report.statistics.requests;
    const requests = new Map();
    let completed = 0;
    let stopping = false;
    let reason = 'FIVE_SECOND_DEADLINE';
    const started = performance.now();
    const timeout = setTimeout(() => { stopping = true; void client.disconnect().catch(() => undefined); }, 5000);
    const worker = async () => {
      while (!stopping && performance.now() - started < 5000 && completed < 280) {
        try {
          const samples = await client.readMembers(selection, { maxItems: 57 });
          if (samples.length !== 57 || samples.some(sample => sample.observation.quality !== 'GOOD' || !sample.request)) throw new Error('Pipeline read returned incomplete or non-GOOD samples');
          const timing = samples[0].request;
          if (!timing || timing.requestBytes > 900 || samples.some(sample => sample.request?.sequence !== timing.sequence)) {
            throw new Error('Pipeline read split, fell back, or exceeded the request-byte cap');
          }
          requests.set(timing.sequence, timing);
          completed++;
          if (timing.latencyMs > 100) throw new Error('Pipeline request latency exceeded 100 ms');
        } catch (error) {
          if (stopping && reason === 'FIVE_SECOND_DEADLINE') return;
          stopping = true;
          reason = error instanceof Error ? error.message : String(error);
          void client.disconnect().catch(() => undefined);
          throw error;
        }
      }
      if (completed >= 280) { stopping = true; reason = 'READ_GROUP_CAP'; }
    };
    const workers = await Promise.allSettled([worker(), worker()]);
    clearTimeout(timeout);
    if (workers.some(result => result.status === 'rejected')) throw new Error(reason);
    const wire = Array.from(requests.values()).sort((left, right) => left.sentAtMonotonicMs - right.sentAtMonotonicMs);
    const elapsedMs = Math.min(5000, performance.now() - started);
    const intervals = wire.slice(1).map((request, index) => request.sentAtMonotonicMs - wire[index].sentAtMonotonicMs);
    const nativeRequests = client.report.statistics.requests - setupRequests;
    const interruptedRequests = nativeRequests - wire.length;
    if (interruptedRequests < 0 || interruptedRequests > (reason === 'FIVE_SECOND_DEADLINE' ? 1 : 0)
      || completed !== wire.length) throw new Error('Hidden retries or incomplete pipeline reads detected');
    /** @param {number[]} values */
    const summarize = values => {
      if (!values.length) return null;
      const sorted = values.slice().sort((left, right) => left - right);
      return { min: Math.round(sorted[0]), p50: Math.round(sorted[Math.ceil(sorted.length * 0.5) - 1]),
        p95: Math.round(sorted[Math.ceil(sorted.length * 0.95) - 1]), max: Math.round(sorted[sorted.length - 1]) };
    };
    console.log(JSON.stringify({ status: 'COMPLETED', reason, db: 12, membersPerRead: 57, pendingLimit: 2,
      nativeInFlightLimit: client.report.concurrency.maxInFlightRequests, elapsedMs: Math.round(elapsedMs),
      completedReads: completed, values: completed * 57, nativeRequests, interruptedRequests,
      meanWireIntervalMs: intervals.length ? Math.round(intervals.reduce((sum, value) => sum + value, 0) / intervals.length * 10) / 10 : null,
      latencyMs: summarize(wire.map(request => request.latencyMs)), wireIntervalsMs: summarize(intervals),
      requestBytes: wire.reduce((sum, request) => sum + request.requestBytes, 0),
      responseBytes: wire.reduce((sum, request) => sum + request.responseBytes, 0),
      readOnly: client.productionReadOnly, session: client.report.statistics,
      note: 'One native request in flight; this does not qualify two simultaneous PLC requests or HMI coexistence' }, null, 2));
  } else {
  for (const stage of maxSpeed ? speedStages : stages) {
    const requests = new Map();
    const selection = members.slice(0, stage.size);
    let firstSent;
    let lastReceived;
    let nextDue = performance.now();
    for (let cycle = 0; cycle < stage.cycles; cycle++) {
      if (nextDue > performance.now()) await delay(nextDue - performance.now());
      const before = client.report.statistics.requests;
      const samples = await client.readMembers(selection, { maxItems: stage.size });
      if (samples.length !== stage.size || samples.some(sample => sample.observation.quality !== 'GOOD' || !sample.request)) {
        throw new Error(`${stage.size}@${stage.periodMs} returned an incomplete or non-GOOD read; benchmark stopped`);
      }
      const cycleRequests = new Map();
      for (const sample of samples) {
        const request = sample.request;
        if (!request || request.requestBytes > 900) throw new Error('Native request timing missing or exceeded the 900-byte envelope');
        cycleRequests.set(request.sequence, request);
        requests.set(request.sequence, request);
      }
      if (cycleRequests.size !== 1 || client.report.statistics.requests - before !== 1) {
        throw new Error('Native batch split or individual fallback detected; benchmark stopped');
      }
      const wire = Array.from(cycleRequests.values())[0];
      firstSent ??= wire.sentAtMonotonicMs;
      lastReceived = wire.receivedAtMonotonicMs;
      nextDue = wire.sentAtMonotonicMs + stage.periodMs;
    }
    const wire = Array.from(requests.values());
    const elapsedMs = lastReceived - firstSent;
    const intervalsMs = wire.slice(1).map((request, index) => request.sentAtMonotonicMs - wire[index].sentAtMonotonicMs);
    const meanIntervalMs = intervalsMs.reduce((total, interval) => total + interval, 0) / intervalsMs.length;
    results.push({ membersPerRequest: stage.size, targetPeriodMs: stage.periodMs, cycles: stage.cycles, requests: wire.length,
      elapsedMs: Math.round(elapsedMs), cadenceValuesPerSecond: Math.round(stage.size * 1000 / meanIntervalMs),
      meanWireIntervalMs: Math.round(meanIntervalMs * 10) / 10,
      requestBytes: wire.reduce((total, request) => total + request.requestBytes, 0),
      responseBytes: wire.reduce((total, request) => total + request.responseBytes, 0),
      latencyMs: wire.map(request => Math.round(request.latencyMs)),
      wireIntervalsMs: intervalsMs.map(Math.round) });
    if (wire.some(request => request.latencyMs > (maxSpeed ? 100 : Math.max(50, stage.periodMs)))
      || intervalsMs.some(interval => interval > stage.periodMs * 2)) {
      ceiling = 'LATENCY_OR_SCHEDULING_BOUNDARY';
      break;
    }
  }
  console.log(JSON.stringify({ status: 'COMPLETED', identity: { orderNumber: identity.orderNumber, firmware: identity.firmware },
    cpuState, profile: securityMode, readOnly: client.productionReadOnly, db: dbNumber, ceiling, results,
    session: client.report.statistics, note: 'Short read-only bursts only; HMI impact and sustained throughput unverified' }, null, 2));
  }
  }
} catch (error) {
  console.error(JSON.stringify({ status: 'STOPPED', reason: error instanceof Error ? error.message : String(error),
    phase: client.report.failure?.phase ?? client.report.phase, requests: client.report.statistics.requests,
    readOnly: client.productionReadOnly, completedStages: results }));
  process.exitCode = 1;
} finally {
  await client.disconnect();
}