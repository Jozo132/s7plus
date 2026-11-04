import { ProxyServer, loadConfig } from 's7plus';

// Forward classic or Plus traffic from a local client to the lab PLC.
// This is unrestricted forwarding: the client can also send writes or commands.
const config = loadConfig();
config.listen = { ip: '127.0.0.1', port: 1102, mode: 'passthrough' };
config.targets = [{
	id: 'plc1',
	primary: { ip: '192.168.1.200', port: 102, rack: 0, slot: 1 },
	maxConnections: 2,
}];
config.webApi = { ...config.webApi, enabled: false };

// TLS, when used, remains end-to-end between the client and the PLC.
const proxy = new ProxyServer(config);
await proxy.start();
console.log('Forwarding 127.0.0.1:1102 to 192.168.1.200:102');

// Stop forwarding when Ctrl+C is pressed.
process.once('SIGINT', async () => { await proxy.stop(); });