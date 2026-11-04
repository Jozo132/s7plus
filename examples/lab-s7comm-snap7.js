import { S7Client } from 's7plus';

// The snap7-compatible client uses classic S7Comm, not native Plus.
// Classic access and DB1's standard byte offsets must be enabled and verified.
const plc = new S7Client();

// Print the data and close the connection when the read completes.
function onRead(readError, data) {
  if (readError) console.error(readError);
  else console.log(data);
  plc.Disconnect();
}

// Connect to rack 0, slot 1 and read four bytes from DB1.
function onConnect(error) {
  if (error) throw error;
  plc.DBRead(1, 0, 4, onRead);
}

plc.ConnectTo('192.168.1.200', 0, 1, onConnect);