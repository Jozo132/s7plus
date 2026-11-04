import { Worker } from 'node:worker_threads';
import { loadConfig } from 's7plus';

// Run the classic proxy in a worker for the PLC at 192.168.1.200.
// Classic access must be enabled and verified on the PLC first.
const config = loadConfig();
config.listen = { ip: '127.0.0.1', port: 1102, mode: 'classic' };
config.targets = [{
  id: 'plc1',
  primary: { ip: '192.168.1.200', rack: 0, slot: 1 },
  maxConnections: 2,
}];
config.webApi = { ...config.webApi, host: '127.0.0.1', port: 8080 };

// Start the worker with its own proxy instance and configuration.
const worker = new Worker(new URL(import.meta.resolve('s7plus/worker')), {
  workerData: { config, autoStart: true },
});
worker.on('message', async message => {
  console.log(message);

  // This short demo stops immediately after startup; applications can keep it running.
  if (message.type === 'started') worker.postMessage({ type: 'stop' });
  else if (message.type === 'stopped') await worker.terminate();
});
worker.on('error', error => console.error(error));