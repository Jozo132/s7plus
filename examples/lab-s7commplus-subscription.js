import { setTimeout as delay } from 'node:timers/promises';
import { S7CommPlusClient } from 's7plus';

// Receive native push updates for the lab PLC's Clock_Byte marker.
// Verify its certificate independently before trusting the first connection.
const plc = new S7CommPlusClient({
  host: '192.168.1.200',
  securityMode: 'tls',
  tls: { trustOnFirstUse: true },
  limits: { maxRequests: 100 },
});

// Drain updates until eight arrive or the deadline expires. Credits are finite.
async function receiveUpdates(handle) {
  let received = 0;
  const deadline = Date.now() + 8000;

  while (received < 8 && Date.now() < deadline) {
    const delta = plc.popSubscription(handle);
    if (!delta) {
      await delay(50);
      continue;
    }

    console.log(delta.items.map(item => item.observation));
    if (++received === 3) console.log('Renewal:', await plc.renewSubscription(handle, 5));
  }

  return received;
}

// Delete the owned subscription before closing the session.
async function closeSubscription(handle) {
  try {
    if (handle) await plc.deleteSubscription(handle);
  } finally {
    await plc.disconnect();
  }
}

let handle;
try {
  await plc.connect();

  // Discover the marker on this session, then create an owned subscription.
  const markers = await plc.listAreaMembers({ type: 'M' });
  const clock = markers.members.find(member => member.path === 'Clock_Byte' && member.readable);
  if (!clock) throw new Error('Clock_Byte unavailable');
  handle = await plc.createSubscription([clock], { cycleMs: 250, credits: 5 });

  const received = await receiveUpdates(handle);

  // Diagnostics expose missed updates and credit state; deltas are not snapshots.
  console.log('Updates:', received, 'diagnostics:', plc.subscriptionDiagnostics(handle));
} finally {
  await closeSubscription(handle);
}