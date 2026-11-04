import { S7CommPlusClient } from 's7plus';

// Read the current alarm snapshot from the lab PLC without acknowledging alarms.
// Verify its certificate independently before trusting the first connection.
const plc = new S7CommPlusClient({
  host: '192.168.1.200',
  securityMode: 'tls',
  tls: { trustOnFirstUse: true },
  limits: { maxRequests: 100 },
});

try {
  await plc.connect();

  // 1033 requests English text; the response is not a historical alarm log.
  const alarms = await plc.readActiveAlarms({ languageId: 1033, maxAlarms: 128 });
  console.log(alarms);
} finally {
  // Release the native session.
  await plc.disconnect();
}