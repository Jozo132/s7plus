# S7CommPlus Feature Comparison

Research snapshot: 2026-11-03. Statuses distinguish implemented, partial,
unsupported and unverified behavior; a project's own claims are not independent
verification, nor a guarantee for every firmware or protection configuration.
The S7Plus column describes this repository, not a released npm package.

## Sources and licenses

| Reference | Revision inspected | License | Scope |
| --- | --- | --- | --- |
| [gijzelaerr/s7commplus](https://github.com/gijzelaerr/s7commplus/tree/10ddc3798fb0bdd01671e363773a3d4e91171c41) | `10ddc3798fb0bdd01671e363773a3d4e91171c41` | MIT | Python client and emulator |
| [S7CommPlusDriver](https://github.com/thomas-v2/S7CommPlusDriver/tree/dbd61e447c7aaf4486cf1f1fe0201212a6bd93c8) | `dbd61e447c7aaf4486cf1f1fe0201212a6bd93c8` | LGPL-3.0-or-later | C# driver |
| [node-red-contrib-s7-plus](https://github.com/DataLogXE/node-red-contrib-s7-plus/tree/03aa93d4999d858d46cbbe82826267ecd5b0631a) | `03aa93d4999d858d46cbbe82826267ecd5b0631a` | LGPL-3.0-or-later | Node-RED driver |
| [S7CommRust](https://github.com/sullibar/S7CommRust/tree/6c2c0ece52286b322d6e99dd81a93250f5eebc34) | `6c2c0ece52286b322d6e99dd81a93250f5eebc34` | LGPL-3.0-or-later, with separately noticed MIT components | Rust driver |
| [HarpoS7](https://github.com/bonk-dev/HarpoS7/tree/b0f8968d551b5e07448dc7c77680fea59276c272) | `b0f8968d551b5e07448dc7c77680fea59276c272` | MIT, with third-party notices | Authentication library, not a full driver |

See [third-party notices](../THIRD_PARTY_NOTICES.md) for existing incorporated
material and its precise provenance. LGPL projects are technical references;
their source has not been incorporated into this MIT implementation.

## This repository

| Feature | Status | Evidence and limitations |
| --- | --- | --- |
| Protocol versions and sessions | Partial | Explicit TLS V2 and legacy SessionKey with V3 integrity; other profiles are not universally qualified. No automatic security downgrade. |
| TLS and authentication | Partial | CA and certificate pin validation, explicit trust enrollment or unverified opt-in; legacy S7-1200 keys. Username/password legitimation and other legacy families are unsupported. |
| S7-1200, S7-1500, PLCSIM | Partial | Bounded reads were observed on specific S7-1200 firmware; S7-1500 and PLCSIM are not established by that evidence. Loopback tests are not hardware evidence. |
| Symbol discovery and optimized DBs | Partial | Symbol and type discovery and session-owned descriptors support qualified symbolic reads. Metadata can be incomplete, and descriptors must be rebound after a new session. |
| Scalar, structure and array types | Partial | Selected typed reads and nested metadata are supported; CHAR, WCHAR, DATE and TIME_OF_DAY mappings have synthetic wire tests only. Unqualified layouts are rejected; not every Siemens datatype or aggregate is supported. |
| Batch reads and writes | Partial | Bounded batch reads exist; arbitrary native process writes and SetMultiVariables are unsupported. Classic writes are a separate feature. |
| Native data and alarm subscriptions | Unsupported | Offline notification parsing and lifecycle adapter exist, but no live PLC subscription wire adapter or public push API. Active alarm snapshots are not subscriptions. |
| Reconnection and recovery | Partial | Classic connection management exists; native descriptors and subscriptions are not automatically restored after session loss. |
| Diagnostics, PLC information and resources | Partial | Bounded CPU, resource, alarm and program metadata reads exist; resource units and coverage remain qualified. Program-content extraction has stricter security conditions. |
| DAQ, REST and WebSocket | Partial | Classic polling DAQ and its APIs exist; native Plus exposes bounded pull-driven polling but is not a REST/WebSocket backend. Polling is not PLC push or an atomic snapshot. |

## Reference project claims

| Feature | Python | C# driver | Node-RED | Rust | HarpoS7 |
| --- | --- | --- | --- | --- | --- |
| Versions and security | V1 SessionKey, V2 TLS, V3; implemented, project reports hardware validation for selected V1 profiles | TLS, partial; README requires compatible V17+ project | TLS, partial; V17+ project required | Legacy and TLS, partial | Legacy challenge and TLS authentication, partial; TLS described as proof of concept |
| S7-1200 / S7-1500 / PLCSIM | Partial; project reports selected devices and PLCSIM Advanced | Partial; project lists 1211 V4.5 and PLCSIM V17/V18 | Unverified per-firmware; README targets 1200/1500 | Partial; project lists several 1200s and PLCSIM Advanced, no physical 1500 | Partial; project lists selected 1200, 1500 and PLCSIM versions |
| Symbol discovery / optimized DB | Implemented, subject to project scope | Implemented, subject to project scope | Implemented, subject to project scope | Implemented, subject to project scope | Unsupported; authentication library |
| Scalars / structures / arrays | Partial; aggregates exposed as dict/list | Partial; README provides datatype table and limitations | Partial; README lists scalar mappings | Partial; Variant and S7String explicitly unsupported | Unsupported; authentication library |
| Batch reads / writes | Partial; see project documentation for limits | Unverified from README | Implemented; project claims PLC-limit chunking and per-tag status | Implemented; project claims named batch reads/writes | Unsupported; authentication library |
| Native data / alarm subscriptions | Unverified from README | Unverified from README | Partial; native data push claimed, alarm push unverified | Implemented; project claims value and alarm events | Unsupported; authentication library |
| Reconnection / session recovery | Unverified from README | Unverified from README | Implemented; project claims reconnect and subscription re-establishment | Implemented; project claims manual and automatic reconnect | Unsupported; authentication library |
| Diagnostics / resources / program metadata | Unverified from README | Unverified from README | Partial; session, firmware and resource information claimed | Partial; CPU state and alarms claimed | Unsupported; authentication library |

The comparison reports public documentation, not a fresh independent test of
each project. The other drivers' write, control, authentication and recovery
claims must not be interpreted as authorization or evidence for this package.
