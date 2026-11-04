import { ProxyServer, loadConfig } from 's7plus';

// Run a classic S7Comm proxy on this machine for the lab PLC.
// Classic access must be enabled and verified on the PLC first.
const config = loadConfig();
config.listen = { ip: '127.0.0.1', port: 1102, mode: 'classic' };
config.targets = [{
	id: 'plc1',
	primary: { ip: '192.168.1.200', rack: 0, slot: 1 },
	maxConnections: 2,
}];
config.webApi = { ...config.webApi, enabled: true, host: '127.0.0.1', port: 8080 };

// REST and WebSocket clients connect to this proxy, not directly to the PLC.
const proxy = new ProxyServer(config);
await proxy.start();
console.log('Proxy: 127.0.0.1:1102, REST and WebSocket: 127.0.0.1:8080');

// Stop the proxy and its connections when Ctrl+C is pressed.
process.once('SIGINT', async () => { await proxy.stop(); });