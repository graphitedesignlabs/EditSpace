# EditSpace conformance suite

`manifest.json` is the stable entry point for protocol consumers. Paths are relative to the repository root.

Wire fixtures test decoding and semantic acceptance under the baseline compatibility policy declared in the manifest. A fixture marked `valid: false` names the required problem kind. Materialization vectors contain an operation envelope and the exact normalized state expected after acceptance, deterministic ordering, and replay.

Implementation procedure:

1. Read every required manifest entry.
2. Decode inputs using protocol defaults (`v = 1`, `deps = []`, `fields = {}`, `args = {}`, and `features = []`).
3. Apply the normative validation and materialization rules.
4. Normalize state using `schemas/materialized-state-v1.schema.json`. Sort entities by `(kind, id)` and links by `(kind, id)` using protocol string comparison. Preserve operation replay order in the two operation-ID arrays.
5. Compare JSON structurally; object key order is irrelevant.
6. Emit one actual result per required entry in a conformance report. Wire results contain `accepted` and any `problems`; materialization results contain normalized `actual` state.

The supplied runner validates the report and independently compares actual results with the manifest and vectors. Implementations own their native vector adapters; this repository intentionally contains no language implementation.
