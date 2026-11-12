# S7-1500 Protocol Research And Incorporation Plan

## Scope And Evidence

The initial source audit below was offline. The separately recorded bounded
hardware follow-up now covers selected reads on one production S7-1500, not a
general S7-1500 compatibility certification. Previous S7-1200 results do not
qualify it. No security change, process write, download, CPU mode change or
service restart was performed.

The native repository baseline is `058ac6a282c48a5cd23a8df0c71048d1694b808b`.
On 2026-11-12, fetching `origin` confirmed that `HEAD` and `origin/main` both
match this revision, with no commits ahead or behind. The remote URL is
`https://github.com/Jozo132/s7plus.git`. The Portal backend pins this same Git
revision as `s7proxy` and resolves its installed source through
`back/src/scripts/tia/tia-s7plus-client.mjs`. Changing this nested checkout does
not update the installed dependency or an IPC bundle.

## Implemented Offline

The current checkout now implements the following changes on that baseline:

- CreateObject accepts the evidenced pre-legitimated service code 17 on either
  profile only when the error bit is clear. Other unknown/informational outcomes
  remain rejected; session IDs, ownership, schema and version must still validate.
- Legacy SessionKey supports 13 exact family-00 public-key fingerprints alongside
  the existing family-01 keys. Key size and derived fingerprint are checked
  before authentication material is generated. There is no family-only lookup,
  candidate-key probing, password probing or automatic role selection.
- Inner blob and outer descriptor flags follow the selected family. The complete
  S7-1500 and S7-1200 authentication vectors match byte-for-byte, without replacing
  the existing arithmetic or fragment-integrity implementation.
- Family 00 does not apply the S7-1200 post-activation counter skip. Attribute
  responses validate either the leading-ID profile or a zero ReturnValue with
  a trailing IntegrityId; the physical V2.8 controller uses the latter.
  Explore and GetMultiVariables retain trailing-ID validation. Generic Error
  envelopes are not mistaken for these successful response layouts.

Validation on 2026-11-12: all 267 tests in
`test/unit/s7commplus-session-key.test.js` and `test/unit/s7commplus.test.js`
passed in 176.78 seconds. Coverage includes both full authentication vectors,
all bundled family-00 identities, independent activation/protection request
goldens, loopback setup/CPU/protection/DB reads, malformed owned-session objects,
wrong leading counters, unknown results and existing S7-1200/TLS regressions.
These are synthetic/loopback checks, not production or home-lab connections.

The remaining native unit suites were also exercised: 547 unique native unit
cases passed across the scoped runs after fixing one consumer-test environment
issue. The standalone ESM/CommonJS type fixture now explicitly loads Node
ambient types rather than inheriting unrelated backend `@types` packages;
strict checking and `skipLibCheck: false` remain enabled. Its complete five-case
package-boundary suite passed on rerun. Native type checking, the package build,
and five selected backend loader/port/phase/fallback tests also passed. Those
backend tests still use the installed Git-pinned package or mocks; they are not
deployment evidence for these uncommitted native changes.

The findings and the four-check probe below describe the audited baseline;
they explain why these changes were made, rather than describing the updated
decoder. Hardware qualification and backend adoption remain separate gates.
The installed backend dependency is still the fetched remote revision above:
publishing and repinning the new implementation require a new commit. No
commit, push, dependency substitution or production deployment is performed here.

## Bounded Hardware Readout

On 2026-11-12, the updated checkout was used directly through the existing IPC
gateway for explicit, non-retrying legacy sessions. The controller returned
order number `6ES7 516-3FN02-0AB0`, firmware `V2.8`, and RUN. The first connection
exposed a protection-response layout defect: zero ReturnValue was mistaken for
a leading IntegrityId (expected 6, observed 0). A failing loopback regression
preceded the fix; both leading and trailing counter layouts still reject wrong
counters.

The subsequent readout fixes and measured results were:

- Scalar BBOOL software type 40 maps to BOOL wire type 1, with strict type and
  batch-size validation. Packed BBOOL arrays remain unsupported.
- DB9 yielded 10 members, including eight readable scalars; one scalar read and
  a three-member batch all returned GOOD. Two packed arrays remain unreadable.
- Program inventory validates observed FB/FC system and user prefixes and six
  OB classes, preserving class/RID/number checks. It returned 413 entries:
  219 DB, 64 FB, 124 FC and six OB. The native response is bounded, not proven
  exhaustive.
- That value/inventory session sent 13 requests, received 72,500 bytes and sent
  1,590 bytes in 12,974 ms. RUN was observed before and after.
- Explicitly confirmed per-block family-00 content reads require authenticated
  responses, full-access level 0 or 1, RUN and native protection mode zero.
  Protected blocks, unconfirmed calls, STOP and bulk legacy extraction remain
  denied. No TLS trust or PLC security setting was changed.
- OB1 returned 497 code bytes plus 3,978 supporting component bytes over five
  authenticated fragments. Primary code SHA-256:
  `2360adbf274e47f12f17d124fbbd4cc067ac1feae879445b519306825bc74e99`.
- DB9 returned a 1,035-byte interface definition and 16 comment bytes over two
  authenticated fragments. It is DEFINITION_ONLY, not a DB memory image.
- The content session sent 14 requests, received 105,295 bytes and sent 1,610
  bytes in 13,992 ms. RUN was observed around both block reads. Each session
  closed only its own transport; no teardown warning was reported.

Metadata, acceptance summaries and extracted bytes were retained in the user's
temporary directory, not committed to the repository. These are native opaque
components, not reconstructed LAD/SCL/STL source or a restorable controller
backup. HMI coexistence, scan impact, all data types, FB content and endurance
were not qualified. The installed Portal dependency and running services remain
unchanged; successful checkout probes do not imply Portal deployment.

Follow-up validation: all 570 native unit tests in 18 suites passed in 163.19
seconds, including the package build, ESM/CommonJS consumer declarations and
existing TLS/S7-1200/write/mode safety regressions. The native source/test
TypeScript no-emit check passed. A final test-only adjustment uses the actual
PValue decoder rather than incomplete handwritten values; its BBOOL regression
and the same TypeScript check passed afterward. No further PLC read was needed.

Evidence terms used below:

- **Local fact:** inspected code or recorded output from this integration.
- **Reference fact:** behavior present in pinned public source, not independently
  qualified on our production controller.
- **Hypothesis:** a plausible explanation requiring a discriminating fixture or
  an explicitly scheduled bounded hardware check.

## Sources And Provenance

The revisions are those already cited in [the feature comparison](FEATURE_COMPARISON.md).

| Source | Revision | Useful evidence | Limits |
| --- | --- | --- | --- |
| [Python s7commplus](https://github.com/gijzelaerr/s7commplus/tree/10ddc3798fb0bdd01671e363773a3d4e91171c41) | `10ddc3798fb0bdd01671e363773a3d4e91171c41` | Legacy family selection, request profiles, result codes, session setup | MIT; source and test evidence are not our hardware qualification |
| [HarpoS7](https://github.com/bonk-dev/HarpoS7/tree/b0f8968d551b5e07448dc7c77680fea59276c272) | `b0f8968d551b5e07448dc7c77680fea59276c272` | Family-specific authentication and setup templates | MIT with notices; authentication library, not a complete monitoring driver |
| [S7CommPlusDriver](https://github.com/thomas-v2/S7CommPlusDriver/tree/dbd61e447c7aaf4486cf1f1fe0201212a6bd93c8) | `dbd61e447c7aaf4486cf1f1fe0201212a6bd93c8` | TLS session lifecycle, PLC resource limits, per-item reads | LGPL-3.0-or-later; TLS path does not solve a legacy handshake |
| [Node-RED driver](https://github.com/DataLogXE/node-red-contrib-s7-plus/tree/03aa93d4999d858d46cbbe82826267ecd5b0631a) | `03aa93d4999d858d46cbbe82826267ecd5b0631a` | Shared endpoint, per-item read results, bounded batches | LGPL-3.0-or-later, derived from C#; requires TLS and a compatible V17+ project |
| [S7CommRust](https://github.com/sullibar/S7CommRust/tree/6c2c0ece52286b322d6e99dd81a93250f5eebc34) | `6c2c0ece52286b322d6e99dd81a93250f5eebc34` | Legacy framing, chained response digests, malformed-input tests | LGPL-3.0-or-later with MIT components; README explicitly says no physical S7-1500 tested |
| [Wireshark S7CommPlus dissector](https://github.com/moki-ics/s7commwireshark/blob/073cbc71a6c8da990bbbd14a8d61cde859cc8207/src/s7comm_plus/packet-s7comm_plus.c#L303) | `073cbc71a6c8da990bbbd14a8d61cde859cc8207` | Result table independently names codes 17, 19 and 22 | Protocol interpretation reference only; no dissector code incorporated |

The existing local Python reference checkout is older:
`245350ea0ca6327234e5032e781a99782334bc8f`. It was inspected without updating
or executing it. In particular, its `tests/test_s7_v2.py` already contains an
exact-value regression for `0x4000800000000011`; this is not evidence that a
current upstream test was run locally.

These are not five independent hardware confirmations: Node-RED and Rust derive
from the C# driver, and Python's legacy authentication derives from Harpo.
Harpo reports selected physical S7-1500 testing; Rust's PLCSIM evidence must not
be relabelled as physical S7-1500 evidence.

The audit itself copied no implementation. The subsequent family-00 additions
use MIT key material and known-answer vectors with provenance recorded in the
[third-party notices](../THIRD_PARTY_NOTICES.md). Preserve the existing
[notices](../THIRD_PARTY_NOTICES.md) when incorporating MIT material. Treat LGPL
implementations as protocol references unless a separate licensing decision is
made; a JavaScript port is not a license exemption.

## Communication Model

```text
Portal read-only adapter
  -> installed native s7proxy client
  -> TCP 192.168.10.200:1102 (transparent IPC router)
  -> configured PLC interface:102
  -> COTP / S7CommPlus session / symbolic reads
```

The router forwards bytes. It neither implements S7CommPlus authentication nor
enforces read-only operations. Port 1102 does not change the PLC protocol.
There is no reason to replace the IPC's shared Node runtime, stop Siemens port
102 services, enable PUT/GET, or alter DB optimization to implement this path.

The native client currently performs:

1. TCP and COTP connection, called TSAP `SIMATIC-ROOT-HMI`.
2. InitSSL; the selected profile determines whether TLS activation follows.
3. V1 CreateObject for an owned ServerSession; decode IDs, version, role and,
   for legacy, challenge and advertised key fingerprint.
4. V2 SetMultiVariables for owned session attributes: SecurityKey 1830 for
   legacy and ServerSessionVersion 306. The PAOM string member 319 is cleared.
5. Legacy authenticated activation, followed by initial CPU/protection reads.
6. Only then bound symbol discovery/reads and eventual owned-session teardown.

TLS travels over the COTP transport, not as raw TLS immediately after TCP.
Legacy SessionKey traffic subsequently uses a V3 envelope with HMAC-SHA256;
outer version 3 alone does not mean TLS. Negotiated application version,
ObjectQualifier layout, encryption, and fragment integrity are separate axes.

Session setup mutates session-owned protocol state. It is not a process-data
write, but it does allocate PLC communication resources. A read-only connection
cannot be promised to have zero impact on a running machine.

## Findings

### 1. The Reported Status Is Not Self-Proving Access Denial

**Local fact:** [responsePayload](../src/protocol/s7commplus/codec.js) extracts
the signed low 16-bit service code from the 64-bit ReturnValue. It allows
nonnegative CreateObject statuses only in its verified-TLS-create branch;
legacy CreateObject with `0x4000800000000011` is rejected before returned session
objects can be examined.

**Reference fact:** Python's
[protocol.py](https://github.com/gijzelaerr/s7commplus/blob/10ddc3798fb0bdd01671e363773a3d4e91171c41/s7commplus/protocol.py)
names code 17 `SESSION_PRE_LEGITIMIZED`. Its
[connection.py](https://github.com/gijzelaerr/s7commplus/blob/10ddc3798fb0bdd01671e363773a3d4e91171c41/s7commplus/connection.py)
logs nonzero CreateObject status and continues parsing returned session data,
including on plaintext sessions. The older local test specifically checks that
this value does not produce a claim that TLS is required.

The pinned Wireshark dissector independently names 17 "Message Session
Pre-Legitimated", 19 "Warning Service Executed With Partial Error", and 22
"Service Session Delegitimated". Its raw source was checked against the pinned
revision, not just a moving branch link. This corroborates the status name,
not the interpretation of an unknown production response layout.

**Hypothesis:** if the reported failure was legacy CreateObject with valid
owned session objects, the current status gate is an immediate compatibility
blocker. The exact failing operation was not captured, so this is not yet a
confirmed diagnosis of that production attempt.

Do not implement "all positive statuses succeed". The same reference names 19
as partial error, 22 as session delegitimation, and 37 as temporary resource
exhaustion. The operation, complete result, item errors and returned objects
matter. Do not interpret Generic Error payloads as ordinary ReturnValues.

An initial patch should narrowly classify an evidenced CreateObject outcome,
preserve the full status in diagnostics, and still require valid, correlated,
owned session IDs and objects. Negative errors, unknown outcomes and malformed
objects must not become success. Retain the -134 Multi-ES refusal handling.

### 2. Legacy Key Metadata Is Currently S7-1200-Specific

**Local fact:** [session-key.js](../src/protocol/s7commplus/session-key.js)
accepts only exact supported S7-1200 fingerprints. It emits S7-1200 family flags
in both the encrypted blob and outer SecurityKey descriptors. A status-only fix
therefore cannot establish S7-1500 support.

The public Python [key store](https://github.com/gijzelaerr/s7commplus/blob/10ddc3798fb0bdd01671e363773a3d4e91171c41/s7commplus/v1_session_key/keys.py)
contains family-00 exact fingerprints and traces the bytes to Harpo's MIT
public-key files. Rust's [realplc.rs](https://github.com/sullibar/S7CommRust/blob/6c2c0ece52286b322d6e99dd81a93250f5eebc34/src/legacy/realplc.rs)
also assembles distinct family-00/01 setup requests and echoes controller
version values. Its caller can try bundled keys when lookup fails; that
behavior must not be copied into this production policy. Retain the local
structured object parser rather than scanning arbitrary response bytes for
fingerprint-looking strings or patching captured packet templates.

**Reference fact:** Python's
[blob_metadata.py](https://github.com/gijzelaerr/s7commplus/blob/10ddc3798fb0bdd01671e363773a3d4e91171c41/s7commplus/v1_session_key/blob_metadata.py)
and Harpo's
[setup templates](https://github.com/bonk-dev/HarpoS7/blob/b0f8968d551b5e07448dc7c77680fea59276c272/HarpoS7.PoC/Packets/SetMultiVarsRequest.cs)
distinguish:

| Wire field | S7-1500 family 00 | S7-1200 family 01 |
| --- | --- | --- |
| Encrypted blob length | 180 bytes | 180 bytes |
| Public key length | 40 bytes | 40 bytes |
| Blob symmetric flags, offset 24, little endian | `0x001` | `0x101` |
| Blob public flags, offset 40, little endian | `0x010` | `0x110` |
| Outer public descriptor flags | `0x10` | `0x110` |
| Outer symmetric descriptor flags | `0x10001` | `0x10101` |

Family 03 PLCSIM has different key/blob sizes and is not a substitute profile.
Select family from verified advertised fingerprint/key evidence, never IP,
archive filename or a guessed model. Preserve exact-fingerprint lookup and
fail closed for unknown keys; do not adopt automatic candidate-key probing.

The local Python `tests/test_v1_session_key_handshake.py` contains deterministic
full-blob and 24-byte session-key vectors for both real PLC families. These
are excellent offline gates, not fresh hardware captures. Its scalar-boundary
tests also show that apparently equivalent arithmetic rewrites can change seed
bytes: adding family support is not an excuse to replace the crypto kernel.

### 3. Request And Response Layouts Need Explicit Profiles

Python's connection implementation distinguishes real S7-1500 and S7-1200
legacy paths, even though both can negotiate V1 with a SessionKey:

- GetVarSubstreamed uses a different ObjectQualifier representation, field width
  and fill length. The reference's generic V1 integrity tail is three bytes for
  S7-1200 and four for S7-1500; this is not a universal rule for every operation.
- For legacy S7-1500 GetMultiVariables and Explore, the response IntegrityId
  follows the result body. Other legacy response paths can place it first.
- Data requests can require a V2 ObjectQualifier while the negotiated
  application version remains V1. Do not replace every version byte globally.
- Read and non-read IntegrityId counters are separate. The reference's
  S7-1200 post-legitimation skip does not apply to observed S7-1500 FW 2.6.
- PLCSIM has further setup, activation and response differences. Its profile
  must remain separate from physical family 00.

The local encoder has no family-aware context selecting these layouts. Audit
the [client receive path](../src/client/s7commplus-client.js) together with the
encoder: stripping a leading byte unconditionally can turn an IntegrityId into
a status, or remove actual payload. Each change needs an operation-specific
known-answer request and response fixture.

### 4. Preserve Existing Integrity And Ownership Checks

The local PlusAssembler already verifies authenticated fragments through
FragmentHMACVerifier and caps bytes/fragments. Do not remove these checks to
make a new family connect. Rust's
[legacy/session.rs](https://github.com/sullibar/S7CommRust/blob/6c2c0ece52286b322d6e99dd81a93250f5eebc34/src/legacy/session.rs)
provides useful reference cases: continuation digests are chained, chunks can
span transport telegrams, and truncated digests, bare V2 data, trailing bytes
and wrong-session keys must fail. Its captured multi-telegram example is
PLCSIM, not proof of our S7-1500's fragment sizes.

Likewise, preserve HMI TSAP and the existing omission of explicit requested
Role 299. Earlier S7-1200 coexistence work found that requesting engineering
role 1 caused Multi-ES rejection. Do not copy a reference's populated ES/PG
role, client identity or subscription container template wholesale.

### 5. TLS Capability Depends On The Loaded Project Too

The [C# README](https://github.com/thomas-v2/S7CommPlusDriver/blob/dbd61e447c7aaf4486cf1f1fe0201212a6bd93c8/README.md)
requires compatible firmware and a project engineered for secure communication
with TIA V17 or later. A newer physical CPU can still carry an older project.

Our recorded TLS attempt stopped at InitSSL: one request, 69 sent bytes, 74
received bytes, 958 ms, no established session, identity unknown. It received
Generic Error function `0x05A9` instead of `0x05B3`. This is consistent with a
legacy project but does not prove a specific firmware, access level or reason.
Certificate negotiation was not reached. A subsequent legacy tool invocation
has no recorded outcome; do not treat it as a successful or diagnosed attempt,
and do not repeat it automatically to fill the evidence gap.

Do not force TLS, silently downgrade after trust/authentication failure, add
role probes, or change PLC security. Profile selection must remain explicit or
within the Portal's existing narrowly bounded pre-session fallback policy.

### 6. Read Success Is More Than A Successful Handshake

The C# connection and Node-RED
[read-result.js](https://github.com/DataLogXE/node-red-contrib-s7-plus/blob/03aa93d4999d858d46cbbe82826267ecd5b0631a/lib/s7plus/read-result.js)
distinguish per-item errors from values. Use PLC-advertised read limits when
available, bounded by local safety limits. Do not inherit Node-RED's automatic
reconnect/subscription restoration into this manually commissioned workflow.

Require RUN observation without issuing a mode request; exact controller and
symbol identity; fresh session-bound descriptors; supported type layouts;
valid per-item results; and invalidation on session/program changes. Initial
CPU/protection reads belong to the native `ready` phase, so the phase label
alone does not demonstrate successful process monitoring or archive parity.

## Ordered Incorporation Gates

| Stage | Smallest change | Required offline evidence before proceeding |
| --- | --- | --- |
| A: Result decoding | Operation-specific CreateObject informational status; retain full diagnostics | Exact reported value with valid session objects; same value with missing/malformed objects; negative -134; unknown positive result; Generic Error; wrong function/sequence |
| B: Family 00 authentication | Explicit family/key material and matching inner/outer flags | Full known-answer blob/session key; both families; short VLQ key IDs and recomputed lengths; unknown/mismatched fingerprints rejected |
| C: Legacy read profile | Family-aware qualifiers, counters and response IntegrityId placement | Byte-exact activation/CPU/protection/Explore/GetMultiVariables fixtures; leading versus trailing IDs; no S7-1200 regression |
| D: Framing and lifecycle | Reuse bounded assembler and owned-session teardown | Chained fragments, split transport data, wrong key, replay, timeout, cancellation, truncated payload, SystemEvent and teardown after every failed phase |
| E: Portal integration | Pin the qualified native revision and verify loader provenance | Adapter fallback boundaries, custom port, RUN gate, original error code/phase, stale descriptor/cache invalidation; no automatic reconnect |

Do not combine all stages into a permissive compatibility flag. Add a profile
only where it controls a proven wire difference. Reuse existing native tests
and the Portal adapter tests rather than introducing a second protocol stack.

The cheap discriminating check for stage A is a synthetic CreateObject response
through the current decoder, not another production connection. Even if that
test establishes the status-gate issue, stages B and C remain necessary before
claiming legacy S7-1500 support.

### Measured Offline Check

An in-memory probe imported the actual local `responsePayload` implementation
at the audited baseline. Four checks passed:

- Legacy CreateObject with the reported composite status throws
  `SESSION_CREATE_REJECTED`, preserving service code 17.
- The identical response passes the TLS CreateObject status gate with code 17.
- A CreateObject result with code -134 still throws `ENGINEERING_SESSION_IN_USE`.
- The Generic Error function still throws `INDETERMINATE_PROTOCOL_ERROR`
  instead of interpreting its payload as an ordinary service result.

This verifies the local status-gate asymmetry. The synthetic payload does not
contain a valid session object tree, so it does not prove that a complete
handshake would succeed, or that the production response had this layout.
No sockets were opened. Documentation links and ASCII encoding were also
checked; no protocol implementation or upstream test suite was changed/run.

## Later Read-Only Hardware Qualification

The bounded checks above qualify only their exact reads. For further qualification:

1. Confirm the exact model/order number, firmware, loaded-project generation,
   configured gateway target and operator-visible HMI baseline. Do not guess
   them from the archive or historical S7-1200 sessions.
2. Schedule one explicit profile, one owned connection, no automatic retries,
   bounded requests/bytes/time and conservative pacing. The earlier diagnostic
   used 12 requests, a 20-second session budget and one-second pacing; this is
   an upper-bound starting point, not permission for discovery or polling.
3. Record connect phases, full status/function/sequence, returned role and
   identity, RUN observation and effective protection. Redact keys, challenges,
   credentials and process values from shared reports.
4. If connection succeeds, read only one pre-agreed existing symbol, then close
   the owned session. No broad browse, subscriptions, CPU control, process
   writes, password probing, configuration/download, or example DB import.
5. Stop on unexpected status, resource pressure, HMI degradation or identity
   mismatch. Never kill other readers, stop PLC/services or broaden the
   gateway allowlist to recover a test. Resource impact and coexistence must
   be observed, not inferred from a read-only flag.

A successful one-symbol check qualifies that exact controller/profile/read
only. Broader discovery, type coverage, polling cadence and endurance require
separate measured acceptance, not extrapolation from the handshake.

## Remaining Uncertainty

The historical probe outcome and exact original status-reporting operation
remain unverified. The current controller identity, successful scalar/batch
reads, bounded program inventory and selected OB/DB content reads have the
separate measured evidence above. This does not establish all firmware/security
profiles, full source reconstruction, protected-block access, all datatypes,
HMI coexistence, scan impact or endurance. The backend dependency has not been
repinned, and no production configuration was changed.