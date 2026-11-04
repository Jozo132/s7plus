import { setTimeout as delay } from 'node:timers/promises';

// Start lab-s7comm-proxy.js first: it maps plc1 to the PLC at 192.168.1.200.
// This HTTP address is the local proxy, not an HTTP service on the PLC.
const base = 'http://127.0.0.1:8080';

// Subscribe to classic marker byte 0; verify that this offset is appropriate.
const response = await fetch(`${base}/api/subscriptions`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    targetId: 'plc1',
    tags: [{
      name: 'marker0',
      area: 0x83,
      start: 0,
      amount: 1,
      wordLen: 0x02,
    }],
    intervalMs: 1000,
  }),
});
if (!response.ok) throw new Error(`Subscription failed: ${response.status} ${await response.text()}`);
const subscription = await response.json();

try {
  // The proxy polls the PLC; wait for its first scan before reading the cache.
  await delay(1500);
  const reading = await fetch(`${base}/api/read?tag=marker0`);
  console.log('Read:', reading.status, await reading.json());
} finally {
  // Remove the subscription when the application no longer needs it.
  const removed = await fetch(`${base}/api/subscriptions/${encodeURIComponent(subscription.id)}`, { method: 'DELETE' });
  if (!removed.ok) console.error('Subscription cleanup failed:', removed.status, await removed.text());
}