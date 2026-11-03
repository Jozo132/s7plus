// @ts-check
import { createHash, randomUUID, timingSafeEqual, X509Certificate } from 'node:crypto';
import { link, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PlusError } from '../protocol/s7commplus/codec.js';

/** @param {Buffer} certificate @param {string} host @param {number} port @param {string} peerName @param {string} [directory] @param {boolean} [allowChangedCertificate] */
export async function enrollCertificate(certificate, host, port, peerName, directory = join(tmpdir(), 's7plus', 'certificates'), allowChangedCertificate = false) {
  const parsed = new X509Certificate(certificate);
  const now = Date.now();
  if (now < Date.parse(parsed.validFrom) || now > Date.parse(parsed.validTo)) {
    throw new PlusError('CERTIFICATE_REJECTED', 'PLC certificate is outside its validity period');
  }
  const observed = createHash('sha256').update(certificate).digest();
  const target = createHash('sha256').update(JSON.stringify([host.toLowerCase(), port, peerName.toLowerCase()])).digest('hex');
  const certificatePath = join(directory, `${target}.der`);
  /** @param {Buffer} stored */
  const match = async stored => {
    const expected = createHash('sha256').update(stored).digest();
    if (!timingSafeEqual(observed, expected)) {
      if (!allowChangedCertificate) {
        throw new PlusError('CERTIFICATE_PIN_MISMATCH', 'PLC certificate changed; automatic re-enrollment is disabled', {
          observedSha256: observed.toString('hex'), expectedSha256: expected.toString('hex'), certificatePath,
        });
      }
      const temporaryPath = join(directory, `.${target}.${randomUUID()}.tmp`);
      try {
        await writeFile(temporaryPath, certificate, { flag: 'wx', mode: 0o600 });
        await rename(temporaryPath, certificatePath);
      } finally { await rm(temporaryPath, { force: true }); }
      console.warn(`[S7CommPlus] Automatically accepting changed PLC certificate for ${host}:${port} (previous SHA-256 ${expected.toString('hex')}, new SHA-256 ${observed.toString('hex')}); identity is not independently verified. Certificate stored at ${certificatePath}`);
      return { status: 'REPLACED', certificatePath };
    }
    return { status: 'MATCHED', certificatePath };
  };
  try {
    try { return await match(await readFile(certificatePath)); }
    catch (error) { if (/** @type {NodeJS.ErrnoException} */ (error).code !== 'ENOENT') throw error; }
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const temporaryPath = join(directory, `.${target}.${randomUUID()}.tmp`);
    try {
      await writeFile(temporaryPath, certificate, { flag: 'wx', mode: 0o600 });
      try {
        await link(temporaryPath, certificatePath);
        console.warn(`[S7CommPlus] Automatically accepting unseen PLC certificate for ${host}:${port} (SHA-256 ${observed.toString('hex')}); identity is not independently verified. Certificate stored at ${certificatePath}`);
        return { status: 'ENROLLED', certificatePath };
      } catch (error) {
        if (/** @type {NodeJS.ErrnoException} */ (error).code !== 'EEXIST') throw error;
        return await match(await readFile(certificatePath));
      }
    } finally { await rm(temporaryPath, { force: true }); }
  } catch (error) {
    if (error instanceof PlusError) throw error;
    throw new PlusError('CERTIFICATE_TRUST_STORE', 'Cannot read or persist the PLC certificate trust store', {
      certificatePath, cause: error instanceof Error ? error.message : String(error),
    });
  }
}