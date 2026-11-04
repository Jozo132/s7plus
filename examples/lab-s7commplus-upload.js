import { S7CommPlusClient } from 's7plus';

// This is the lab PLC's observed public certificate, not a private key.
// Verify its fingerprint independently before trusting it for program retrieval.
const certificate = `-----BEGIN CERTIFICATE-----
MIICwjCCAmmgAwIBAgIIcsvNOAMkaUwwCgYIKoZIzj0EAwIwYjEeMBwGA1UEAxMV
UExDLTEvQ29tbXVuaWNhdGlvbi0xMQswCQYDVQQGEwJERTEQMA4GA1UEChMHU2ll
bWVuczEhMB8GA1UECxMYSW5kdXN0cmlhbCBDb21tdW5pY2F0aW9uMB4XDTI1MDky
NTE5MzY1OVoXDTM3MDkyNDIyMDAwMFowYjEeMBwGA1UEAxMVUExDLTEvQ29tbXVu
aWNhdGlvbi0xMQswCQYDVQQGEwJERTEQMA4GA1UEChMHU2llbWVuczEhMB8GA1UE
CxMYSW5kdXN0cmlhbCBDb21tdW5pY2F0aW9uMFkwEwYHKoZIzj0CAQYIKoZIzj0D
AQcDQgAEKpJwjzVpZemKAbQKJP8aTacLmqtgAcSVnh0UUujXUlV16niQbyuULhx9
IMnh7AOqxxW+AhUc7ZJKslZlWychBKOCAQcwggEDMAwGA1UdEwEB/wQCMAAwHQYD
VR0OBBYEFID/vw7iMvaLWWKjotOvScaHLY9QMIGTBgNVHSMEgYswgYiAFID/vw7i
MvaLWWKjotOvScaHLY9QoWakZDBiMR4wHAYDVQQDExVQTEMtMS9Db21tdW5pY2F0
aW9uLTExCzAJBgNVBAYTAkRFMRAwDgYDVQQKEwdTaWVtZW5zMSEwHwYDVQQLExhJ
bmR1c3RyaWFsIENvbW11bmljYXRpb26CCHLLzTgDJGlMMA4GA1UdDwEB/wQEAwIC
7DAdBgNVHSUEFjAUBggrBgEFBQcDAQYIKwYBBQUHAwIwDwYDVR0RBAgwBocEwKgB
yDAKBggqhkjOPQQDAgNHADBEAiBr/dXJsyXX8SQJUcsXWqsmBcIZyQPS7TRpGuo4
ilxx9QIgKOEoUxTKc1jtCrokHPI6InvBViS93se7mJeLQYDRiPE=
-----END CERTIFICATE-----`;

// Program content requires certificate and hostname verification plus a pin.
const plc = new S7CommPlusClient({
  host: '192.168.1.200',
  securityMode: 'tls',
  tls: {
    ca: certificate,
    certificateSha256: '5f873bfb847b00a91e21972ab18066967ed35ef2a09491b8594f66406d246661',
  },
  limits: { maxRequests: 100 },
});

try {
  await plc.connect();

  // Retrieve authorized program content in memory; this is not a restorable backup.
  const program = await plc.uploadProgram({ mode: 'run', include: ['OB', 'FC', 'DB'] });
  for (const file of program.files) console.log(file.name, file.byteCount, file.sha256, file.bytes);
} finally {
  // Release the native session; the example does not write files to disk.
  await plc.disconnect();
}