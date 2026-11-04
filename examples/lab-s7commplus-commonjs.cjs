const { S7CommPlusClient } = require('s7plus');

// CommonJS uses the same client API as the ESM examples.
// Verify the lab certificate independently before trusting the first connection.
const plc = new S7CommPlusClient({
  host: '192.168.1.200',
  securityMode: 'tls',
  tls: { trustOnFirstUse: true },
  limits: { maxRequests: 100 },
});

async function main() {
  try {
    await plc.connect();

    // Discovery binds MyData.D to this session before the named read.
    await plc.listBlockMembers({ type: 'DB', number: 1 });
    console.log((await plc.readSymbol('MyData.D')).observation);
  } finally {
    // Always release the session when the read is finished.
    await plc.disconnect();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});