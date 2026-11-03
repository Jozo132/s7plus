# Changelog

## 0.5.0 (unreleased)

- Prepare the npm package and primary CLI as `s7plus`, retaining the `s7proxy`
  CLI alias and existing configuration names.
- Document the current protocol feature boundaries and reference implementations.
- Add synthetic-wire-tested native CHAR, WCHAR, DATE and TIME_OF_DAY reads.
- Fail closed when an area type-reference read is rejected.
- Add bounded, pull-driven native Plus member polling; this is not PLC push.
- Replace the classic protocol engine with JavaScript Buffer-based framing and
  keep the previous bridge and loader exports as compatibility aliases.
- The low-level engine now exposes a fixed ArrayBuffer; callers cannot grow
  its memory, and legacy host callbacks are no longer used.
- In a warmed in-memory read-frame benchmark on Node 22, median throughput was
  6.39 million frames/s versus 6.30 million for the previous engine (12 batches
  of 500,000 frames per engine). This is not a PLC throughput measurement.
- Preserve the existing classic and native Plus APIs and production restrictions.

## 0.4.8

- Previous `s7proxy` release.