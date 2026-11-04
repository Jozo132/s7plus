import { S7CommPlusClient } from 's7plus';

// This writes MyData.x0 on the lab PLC and then restores its original value.
// Run only with explicit authorization and exclusive use of this scratch BOOL.
// TOFU does not authenticate the first connection; verify the certificate first.
const makeClient = () => new S7CommPlusClient({
  host: '192.168.1.200',
  securityMode: 'tls',
  tls: { trustOnFirstUse: true },
  limits: { maxRequests: 100 },
});

// The library requires the exact target and an explicit unverified-identity opt-in.
const options = {
  confirmWrite: true,
  confirmTarget: '192.168.1.200:102',
  allowUnverifiedIdentity: true,
};

// Discover the scratch member again after every new connection.
const findScratch = async plc => {
  const discovery = await plc.listBlockMembers({ type: 'DB', number: 1 });
  const member = discovery.members.find(item => item.path === 'x0' && item.datatype === 'BOOL' && item.readable);
  if (!member) throw new Error('Scratch BOOL unavailable');
  return member;
};

// Reconnect if needed, read the current value, then restore and verify it.
async function restoreScratch(plc, member, original) {
  let activeClient = plc;

  try {
    if (!activeClient.connected) {
      await activeClient.disconnect();
      activeClient = makeClient();
      await activeClient.connect();
      member = await findScratch(activeClient);
    }

    // Never retry an uncertain write without an independent readback.
    const current = (await activeClient.readMember(member)).observation;
    if (current.quality !== 'GOOD') throw new Error('Cannot determine value for restoration');
    if (current.value !== original) await activeClient.writeMember(member, original, options);

    const restored = (await activeClient.readMember(member)).observation;
    if (restored.quality !== 'GOOD' || restored.value !== original) throw new Error('Restoration not verified');
    console.log('Restored:', restored.value);
  } catch (error) {
    // An interrupted process or a failed connection can prevent restoration.
    console.error('Restoration failed. Independently inspect and restore MyData.x0 to:', original);
    throw error;
  } finally {
    await activeClient.disconnect();
  }
}

const plc = makeClient();
let member;
let original;
let attempted = false;
try {
  await plc.connect();
  member = await findScratch(plc);

  // Snapshot a stable original value before attempting the temporary write.
  const first = (await plc.readMember(member)).observation;
  const second = (await plc.readMember(member)).observation;
  if (first.quality !== 'GOOD' || second.quality !== 'GOOD' || typeof first.value !== 'boolean' || first.value !== second.value) {
    throw new Error('Scratch value is not a stable GOOD BOOL');
  }
  original = first.value;
  console.log('Original MyData.x0:', original);

  // Toggle once and independently read back the PLC's value.
  attempted = true;
  await plc.writeMember(member, !original, options);
  const readback = (await plc.readMember(member)).observation;
  if (readback.quality !== 'GOOD' || readback.value !== !original) throw new Error('Write readback failed');
  console.log('Readback:', readback.value);
} finally {
  if (attempted) await restoreScratch(plc, member, original);
  else await plc.disconnect();
}