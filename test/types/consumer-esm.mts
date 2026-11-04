import { S7CommPlusClient, S7Client, loadConfig, S7AreaDB } from 's7plus';

const client: S7CommPlusClient = new S7CommPlusClient({ host: '127.0.0.1' });
const classic: S7Client = new S7Client();
const port: number = loadConfig().listen.port;
const area: number = S7AreaDB;
// @ts-expect-error PLC ports must be numbers
new S7CommPlusClient({ port: '102' });
void [client, classic, port, area];