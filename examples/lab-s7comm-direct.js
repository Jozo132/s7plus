import { PlcConnection, ClassicBridge, loadClassicEngine, createLogger } from 's7plus';

// Classic S7Comm requires PLC-side access and a standard DB1 layout.
// Those settings and offsets have not been qualified on this lab PLC.
const bridge = new ClassicBridge(await loadClassicEngine());
const logger = createLogger();
const connection = new PlcConnection('plc1-0', 'plc1', { ip: '192.168.1.200', rack: 0, slot: 1 }, bridge, logger, 3000);
connection.on('error', error => logger.error({ error }, 'PLC socket error'));

try {
  await connection.connect();

  // Request four bytes from DB1, starting at byte offset zero.
  const frame = bridge.buildReadRequest(0x84, 1, 0, 4, 0x02);
  console.log(await connection.sendRequest(frame, frame.readUInt16BE(11)));
} finally {
  // Close the classic PLC connection.
  await connection.disconnect();
}