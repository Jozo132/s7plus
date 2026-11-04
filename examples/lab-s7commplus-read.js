import { S7CommPlusClient } from 's7plus';

// Connect to the lab PLC. TOFU remembers its certificate, but the first
// connection must be verified independently before it can be trusted.
const plc = new S7CommPlusClient({
  host: '192.168.1.200',
  securityMode: 'tls',
  tls: { trustOnFirstUse: true },
  limits: { maxRequests: 100 },
});

try {
  await plc.connect();

  // Discover DB1's current members before reading them by descriptor or name.
  const block = await plc.getBlockMetadata({ type: 'DB', number: 1 });
  const discovery = await plc.listBlockMembers({ type: 'DB', number: 1 });
  const members = discovery.members.filter(member => member.readable && ['D', 'x0'].includes(member.path));
  const values = await plc.readMembers(members);

  // MyData.x0 is a BOOL and MyData.D is a BYTE on this lab PLC.
  console.log('Block:', block.name);
  console.log('Members:', members.map(member => member.path));
  console.log('Values:', values.map(value => value.observation));
  console.log('MyData.D:', (await plc.readSymbol('MyData.D')).observation);
} finally {
  // Close the PLC session even if discovery or reading fails.
  await plc.disconnect();
}