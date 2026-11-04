import { S7CommPlusClient } from 's7plus';

// Read CPU state and communication-resource counters from the lab PLC.
// Verify its certificate independently before trusting the first connection.
const plc = new S7CommPlusClient({
  host: '192.168.1.200',
  securityMode: 'tls',
  tls: { trustOnFirstUse: true },
  limits: { maxRequests: 100 },
});

try {
  await plc.connect();

  // Resource counts are snapshots, not a guarantee of safe connection capacity.
  console.log('CPU:', await plc.readCpuState());
  console.log('Resources:', await plc.readCommunicationResources());
} finally {
  // Release the native session.
  await plc.disconnect();
}