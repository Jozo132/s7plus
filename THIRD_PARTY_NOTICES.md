# Third-Party Notices

## Runtime Dependencies

The following are or were dependencies, not source copied into this project.
Versions shown are those inspected on 2026-11-03; the package's version ranges
can resolve to later versions. Inspect the resolved dependency licenses again
for each release.

- Former dependency `@assemblyscript/loader` 0.28.20, Daniel Wirtz and contributors, Apache-2.0:
	https://github.com/AssemblyScript/assemblyscript/tree/v0.28.20/lib/loader.
	The full license is at https://github.com/AssemblyScript/assemblyscript/blob/v0.28.20/LICENSE.
	The loader is no longer a dependency or included in the JavaScript engine.
- `ws` 8.22.1, Einar Otto Stangvik, Arnout Kazemier, Luigi Pinca and
	contributors, MIT: https://github.com/websockets/ws/tree/8.22.1.
	Its full license and copyright notices are included in the installed package
	and at https://github.com/websockets/ws/blob/8.22.1/LICENSE.
- `@noble/hashes` 1.8.0, Paul Miller, MIT:
	https://github.com/paulmillr/noble-hashes/tree/1.8.0. Its full license is
	included in the installed package and the dependency is discussed below.

The project's own `package.json` declares MIT, but this checkout does not
contain a project LICENSE file. Confirm the copyright holder and provide the
project license text before publication.

## S7CommPlus Protocol Reference

The new Node.js codec and client were developed with reference to the MIT-licensed
Python project https://github.com/gijzelaerr/s7commplus at commit
`245350ea0ca6327234e5032e781a99782334bc8f`.
Inspected files: `protocol.py`, `vlq.py`, `codec.py`, `transport.py`,
`connection.py`, `client.py`, `typeinfo.py`, and `server.py`.

Protocol constants, framing, variable-length integer layouts, session object
shapes, session-version echo and request layouts informed the implementation in
`src/protocol/s7commplus/codec.js` and `src/client/s7commplus-client.js`.
The reference emulator informed loopback tests. It is not evidence of real PLC
compatibility. No Python package or reference emulator is a runtime dependency.
The same pinned MIT reference also informed TLS-over-COTP options and certificate
pin verification. The independently encoded CreateObject golden in
`test/s7commplus-fixture.js` and differential runner retain its source/commit and
distinguish emulator encoding from real-device capture evidence.
The reference's experimental upload routine was not implemented or transmitted.
The type-member/name list framing, offset-info variants, nested type references,
array ordinals and distinction between browsed type CRCs and address CRCs also
informed the self-contained JavaScript metadata decoder. Public metadata tests
use independently constructed synthetic objects, not engineering archives or
controller captures. No Python runtime is required.
No source from the separately licensed thomas-v2/S7CommPlusDriver was incorporated.

For offline data-subscription encoding and receive ordering, the Python reference
at commit `10ddc3798fb0bdd01671e363773a3d4e91171c41` informed the request
layout, bounded notification handling and its published CreateObject test vector.
That reference describes the vector as a working C# driver trace. These tests
do not establish live subscription support in this project.

The same pinned MIT reference's `v1_session_key` modules and `_fragment_hmac.py`
informed the JavaScript legacy SessionKey and authenticated-fragment compatibility
implementation. The complete S7-1200 and S7-1500 blob/key known-answer vectors and independent
OpenSSL fragment vectors are retained in the unit tests. Challenge-fingerprint
tables and S7-1200/S7-1500 public-key bytes originate in MIT-licensed HarpoS7
(https://github.com/bonk-dev/HarpoS7), as documented by that pinned reference.
The applicable HarpoS7 notice is: Copyright (c) 2024 bonk. Its MIT permission,
conditions and warranty disclaimer are the same as the MIT terms reproduced
below; the notice and those terms apply to these derived portions.

The S7-1500 family-00 key catalogue and family-specific metadata were
cross-checked with HarpoS7 revision
`b0f8968d551b5e07448dc7c77680fea59276c272`, including its
`HarpoS7.PublicKeys/Keys/00` binaries and `SetMultiVarsRequest` templates.
Operation-specific informational CreateObject status and legacy response
IntegrityId placement were informed by the pinned Python connection code.
The Wireshark dissector at revision
`073cbc71a6c8da990bbbd14a8d61cde859cc8207` independently corroborates the
service-result names; only protocol facts, not dissector source, were used.
These additions have synthetic and known-answer coverage, not production
S7-1500 hardware qualification.

Legacy SHA-256 state continuation uses `@noble/hashes` version 1.8.0, Copyright
(c) 2022 Paul Miller (https://paulmillr.com), MIT licensed. Its notice and full
license are distributed with the dependency. AES, normal hashing, HMAC and secure
randomness use Node.js crypto. No Python runtime is required.

For native program-content extraction, public protocol facts were independently
cross-checked against the attribute-name table in
https://github.com/moki-ics/s7commwireshark/blob/master/src/s7comm_plus/packet-s7comm_plus.c
and sparse-BLOB field descriptions in
https://github.com/thomas-v2/S7CommPlusDriver/blob/master/src/S7CommPlusDriver/Core/PValue.cs.
In particular, attribute 2523 is Block Language (2522 is Auto Numbering), 2580
is Code block, and sparse BLOB values carry keyed root/length/data entries with
a zero-key terminator. Only protocol facts were used; no source from either
separately licensed project was copied. JavaScript implementations and public
fixtures are independently constructed. Real controller binaries and engineering
captures are not distributed.

For CPU start, the pinned MIT reference's `OperatingStateRequest` table informed
the distinction between the RUN request value (3) and observed RUN state (8).
SetVariable field ordering, CPU object/attribute identifiers and separate write
integrity were cross-checked against the public protocol facts in
`S7CommPlusConnection.SetPlcOperatingState` and Core `Ids`, `SetVariableRequest`
and `SetVariableResponse` of thomas-v2/S7CommPlusDriver. No source was copied;
the JavaScript implementation and synthetic request/response tests were written
independently. The reference Python client does not implement CPU mode changes.

The MIT License (MIT)

Copyright (c) 2013 Gijs Molenaar, Stephan Preeker

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.