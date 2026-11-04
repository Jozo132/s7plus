import WebSocket from 'ws';

// Start lab-s7comm-proxy.js first: its classic target plc1 is 192.168.1.200.
// Connect to the local proxy, and verify marker byte 0 is appropriate for the PLC.
const socket = new WebSocket('ws://127.0.0.1:8080/ws');
let subscriptionId;

// Bound the demo if the proxy cannot deliver an update.
const timeout = setTimeout(() => {
  console.error('Timed out waiting for a subscription update');
  socket.close();
}, 5000);

// Ask the proxy to poll the marker every second.
const subscription = {
  type: 'subscribe',
  targetId: 'plc1',
  tags: [{
    name: 'marker0',
    area: 0x83,
    start: 0,
    amount: 1,
    wordLen: 0x02,
  }],
  intervalMs: 1000,
};
socket.on('open', () => socket.send(JSON.stringify(subscription)));

// Print the first update, then unsubscribe and close the connection.
socket.on('message', data => {
  const message = JSON.parse(data.toString());
  console.log(message);
  if (message.type === 'subscribed') subscriptionId = message.subscriptionId;
  else if (message.type === 'data' && subscriptionId) {
    socket.send(JSON.stringify({ type: 'unsubscribe', subscriptionId }));
  } else if (message.type === 'unsubscribed' || message.error) socket.close();
});

socket.on('error', error => console.error(error));
socket.on('close', () => clearTimeout(timeout));