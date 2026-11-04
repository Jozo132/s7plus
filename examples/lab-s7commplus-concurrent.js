import { S7CommPlusClient } from 's7plus';

// Each client owns a separate session to the same lab PLC.
// Verify its certificate independently before trusting the first connection.
const clients = Array.from({ length: 2 }, () => new S7CommPlusClient({
  host: '192.168.1.200',
  securityMode: 'tls',
  tls: { trustOnFirstUse: true },
  limits: { maxRequests: 100, maxConnectionsPerTarget: 2 },
}));

// Discover separately: descriptors cannot be shared across sessions.
async function readValue(client) {
  await client.listBlockMembers({ type: 'DB', number: 1 });
  return (await client.readSymbol('MyData.D')).observation;
}

try {
  // Wait for both attempts so both sessions can be cleaned up on failure.
  const connections = await Promise.allSettled(clients.map(client => client.connect()));
  const failure = connections.find(result => result.status === 'rejected');
  if (failure) throw failure.reason;

  const readings = await Promise.all(clients.map(readValue));
  console.log(readings);
} finally {
  // Close both connections, even when one connection or read fails.
  await Promise.all(clients.map(client => client.disconnect()));
}