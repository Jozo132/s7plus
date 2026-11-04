import { S7CommPlusClient } from 's7plus';

// This can change the lab CPU from STOP to RUN. Run only after the equipment
// and operator explicitly authorize starting it. Verify the certificate first:
// TOFU does not independently authenticate the first connection.
const plc = new S7CommPlusClient({
  host: '192.168.1.200',
  securityMode: 'tls',
  tls: { trustOnFirstUse: true },
  limits: { maxRequests: 100 },
});

try {
  await plc.connect();

  // The target and unverified-identity opt-in must be confirmed for this call.
  console.log(await plc.cpuStart({
    confirmRun: true,
    confirmTarget: '192.168.1.200:102',
    allowUnverifiedIdentity: true,
  }));
} finally {
  // The command is not retried if its outcome is uncertain.
  await plc.disconnect();
}