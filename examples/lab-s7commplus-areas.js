import { S7CommPlusClient } from 's7plus';

// Discover symbolic inputs (I), outputs (Q) and markers (M) on the lab PLC.
// Verify its certificate independently before trusting the first connection.
const plc = new S7CommPlusClient({
  host: '192.168.1.200',
  securityMode: 'tls',
  tls: { trustOnFirstUse: true },
  limits: { maxRequests: 100 },
});

try {
  await plc.connect();

  // The returned members are symbolic PLC metadata, not absolute byte offsets.
  for (const type of ['I', 'Q', 'M']) {
    const area = await plc.listAreaMembers({ type });
    console.log(type, area.members);
    const member = area.members.find(item => item.readable);
    if (member) console.log(member.path, (await plc.readMember(member)).observation);
  }
} finally {
  // Release the native session.
  await plc.disconnect();
}