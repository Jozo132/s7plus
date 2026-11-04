import { S7CommPlusClient } from 's7plus';

// Poll two discovered DB1 members from the lab PLC over TLS.
// Verify its certificate independently before trusting the first connection.
const plc = new S7CommPlusClient({
  host: '192.168.1.200',
  securityMode: 'tls',
  tls: { trustOnFirstUse: true },
  limits: { maxRequests: 100 },
});

try {
  await plc.connect();

  // Descriptors are specific to this connection; discover them after connecting.
  const discovery = await plc.listBlockMembers({ type: 'DB', number: 1 });
  const members = discovery.members.filter(member => member.readable && ['D', 'x0'].includes(member.path));

  // Read once per second for ten cycles; this is polling, not PLC push.
  for await (const values of plc.pollMembers(members, { intervalMs: 1000, maxCycles: 10 })) {
    console.log(values.map(value => value.observation));
  }
} finally {
  // Stop polling and release the session on success or error.
  await plc.disconnect();
}