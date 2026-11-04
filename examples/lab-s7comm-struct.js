import { ProxyServer, loadConfig } from 's7plus';

// Configure the classic proxy locally and point it at the lab PLC.
// The Motor DB10 layout below is illustrative and must match a standard DB.
// Classic access and this DB layout have not been qualified on the lab PLC.
const config = loadConfig();
config.listen = { ip: '127.0.0.1', port: 1102, mode: 'classic' };
config.targets = [{
  id: 'plc1',
  primary: { ip: '192.168.1.200', rack: 0, slot: 1 },
  maxConnections: 2,
}];
config.webApi = { ...config.webApi, host: '127.0.0.1', port: 8080 };
const server = new ProxyServer(config);

// Define the layout before decoding values into a JavaScript object.
server.registerStruct({
  name: 'Motor',
  db: 10,
  offset: 0,
  items: [
    { name: 'speed', type: 'REAL' },
    { name: 'running', type: 'BOOL' },
    { name: 'fault', type: 'BOOL' },
    { name: 'setpoint', type: 'REAL' },
  ],
});

try {
  await server.start();

  // Read only the fields needed by this application.
  console.log(await server.readStruct('Motor', ['speed', 'running'], 'plc1'));
} finally {
  // Stop the proxy and its PLC connections.
  await server.stop();
}