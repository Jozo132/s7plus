import { S7CommPlusClient } from 's7plus';

// Inspect the lab PLC's program-event metadata without changing its program.
// Verify its certificate independently before trusting the first connection.
const plc = new S7CommPlusClient({
  host: '192.168.1.200',
  securityMode: 'tls',
  tls: { trustOnFirstUse: true },
  limits: { maxRequests: 100 },
});

try {
  await plc.connect();

  // Event metadata is not evidence that the associated code has executed.
  const events = await plc.readProgramEventMetadata({ maxEvents: 128 });
  console.log(events);
} finally {
  // Release the native session.
  await plc.disconnect();
}