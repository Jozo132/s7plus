import { S7CommPlusClient } from 's7plus';

// TypeScript uses the same native Plus API and declarations as JavaScript.
// Verify the lab certificate independently before trusting the first connection.
const plc = new S7CommPlusClient({
  host: '192.168.1.200',
  securityMode: 'tls',
  tls: { trustOnFirstUse: true },
  limits: { maxRequests: 100 },
});

try {
  await plc.connect();

  // Discover DB1 before reading its BYTE member by symbol name.
  await plc.listBlockMembers({ type: 'DB', number: 1 });
  console.log((await plc.readSymbol('MyData.D')).observation);
} finally {
  // Disconnect even if discovery or the read fails.
  await plc.disconnect();
}