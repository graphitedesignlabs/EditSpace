# EditSpace Protocol v1

Status: normative specification, September 2026.

The key words MUST, MUST NOT, REQUIRED, SHOULD, SHOULD NOT, and MAY are to be interpreted as described by RFC 2119 and RFC 8174 when they appear in uppercase.

## 1. Purpose and boundary

EditSpace is an application-, language-, model-, transport-, and renderer-neutral protocol for collaborative editing of structured documents. It defines:

1. immutable durable operations;
2. deterministic validation, ordering, and materialization;
3. compatibility and preservation behavior;
4. ephemeral peer identity and presence; and
5. a common conformance contract.

It does not define native APIs, a modeling kernel, scene graph, renderer, UI, network topology, authentication, authorization, durable-store product, or asset-transfer service. A platform library implements this specification; it does not extend or redefine the core rules.

## 2. JSON data model

Wire messages MUST be UTF-8 JSON objects. Values are JSON null, boolean, number, string, array, or object. Numbers MUST be finite. Integers used by this protocol MUST be in the inclusive range `0...9007199254740991` so every conforming implementation can represent them exactly.

Dates MUST be RFC 3339 timestamps with an explicit UTC offset. Senders SHOULD emit UTC using `Z`. Receivers MUST compare timestamps as instants, not strings. Timestamps never participate in durable merge ordering.

Identifiers and tokens are non-empty, case-sensitive Unicode strings. Implementations MUST compare protocol strings by Unicode scalar value, not locale-sensitive collation. Producers SHOULD use portable ASCII identifiers containing letters, digits, `-`, `_`, `.`, and `:`.

Unknown object members MUST be ignored when interpreting v1 and SHOULD be retained when forwarding or round-tripping an unmodified message. Object member order is insignificant. Duplicate JSON object keys MUST be rejected. Implementations MUST enforce practical resource limits.

The schemas in `schemas/` are normative for structural validation. Rules that relate multiple values or messages are normative in this document and are exercised by conformance vectors.

## 3. Durable operation envelope

An operation envelope is an object with:

| Member | Requirement | Meaning |
| --- | --- | --- |
| `kind` | REQUIRED | Exactly `editspace.operations`. |
| `v` | REQUIRED | Envelope schema version; exactly `1` for this specification. |
| `doc` | REQUIRED | Stable document identifier. |
| `ops` | REQUIRED | Array of zero or more operations. |

Every operation in `ops` MUST have the same `doc` as its envelope. Envelopes are transport batches only: splitting, joining, or reordering envelopes MUST NOT change document semantics.

### 3.1 Operation

| Member | Requirement | Meaning |
| --- | --- | --- |
| `v` | OPTIONAL | Operation schema version; defaults to `1`. |
| `doc` | REQUIRED | Document identifier. |
| `op` | REQUIRED | Globally unique immutable operation identifier. `actor:seq` is recommended. |
| `actor` | REQUIRED | Stable author identifier. |
| `seq` | REQUIRED | Actor-local monotonically increasing safe integer. |
| `deps` | OPTIONAL | Unique causal predecessor operation IDs; defaults to `[]`. |
| `action` | REQUIRED | Extensible action token. |
| `entity` | REQUIRED | Extensible entity-kind token. |
| `target` | Action-dependent | Target entity identifier. |
| `source` | Action-dependent | Source entity identifier. |
| `fields` | OPTIONAL | Independent JSON field writes; defaults to `{}`. |
| `args` | OPTIONAL | Action-specific JSON arguments; defaults to `{}`. |
| `features` | OPTIONAL | Unique required feature tokens; defaults to `[]`. |
| `producer` | OPTIONAL | Diagnostic producer metadata. |
| `createdAt` | OPTIONAL | Informational creation timestamp. |

An operation and all its members are immutable after publication. `op` identifies the complete decoded semantic value, including optional values after applying their defaults. Two encodings that differ only by omitted default members are therefore exact duplicates. Reusing `op` for different semantic content is an `operationIDCollision`; the later value MUST NOT replace the first.

`producer` contains required string members `app` and `library`, with optional `appVersion` and `libraryVersion`. Producer data and `createdAt` MUST NOT influence validation support, authorization, ordering, or materialization.

### 3.2 Core tokens

Core actions are `create`, `update`, `delete`, `duplicate`, `link`, and `unlink`.

Core entity kinds are `document`, `object`, `modifier`, `material`, `asset`, `constraint`, `parameter`, `dependency`, and `legacySnapshot`.

Core feature tokens are `core.v1`, `crud.v1`, `duplicate.v1`, `linkedDuplicate.v1`, `dependencyGraph.v1`, and `presence.v1`.

Action, entity, and feature domains are open. Extension tokens SHOULD use a reverse-DNS or similarly collision-resistant prefix. An unknown token MUST NOT be interpreted as a known token.

### 3.3 Action requirements

| Action | Required IDs | Effect |
| --- | --- | --- |
| `create` | `target` | Creates the target or applies its supplied writes to an existing live target. It does not remove a tombstone. |
| `update` | `target` | Applies supplied field writes to an existing live target. |
| `delete` | `target` | Places a tombstone on an existing target. |
| `duplicate` | `source`, `target` | Creates/replaces target from a live source, then overlays supplied fields. |
| `link` | `source`, `target` | Adds target to the source's link set. |
| `unlink` | `source`, `target` | Removes target from the source's link set. |

For `link` and `unlink`, `entity` is the kind of both source and target. Cross-kind links require an extension action whose semantics declare both kinds.

## 4. Acceptance and compatibility

Before accepting an operation, an endpoint checks it in this order:

1. structural schema validity;
2. envelope/operation document equality and expected local document equality;
3. operation-ID duplicate or collision;
4. supported operation schema version;
5. supported required feature tokens;
6. supported action and entity token; and
7. action-specific required identifiers.

An exact duplicate is idempotent. An accepted operation is appended exactly once. An unsupported or invalid operation MUST NOT modify materialized state, but its original representation MUST be retained in the operation log, a quarantine store, or a lossless forwarding layer.

Problem kinds are `unsupportedSchema`, `unsupportedAction`, `unsupportedEntity`, `unsupportedFeature`, `documentMismatch`, `invalidOperation`, and `operationIDCollision`. APIs may expose multiple problems for one operation. Human-readable problem text is non-normative.

## 5. Deterministic ordering

An operation stamp is the tuple `(seq, actor, op)`. Compare `seq` numerically, then `actor` by Unicode scalar value, then `op` by Unicode scalar value. The greater tuple wins a last-writer comparison.

Accepted operations are ordered with this deterministic algorithm:

1. Index the input set by `op`.
2. Mark all operations remaining and none emitted.
3. Select every remaining operation whose dependencies are either absent from the input set or already emitted.
4. Sort that ready set by ascending operation stamp and emit the entire set.
5. Repeat steps 3–4. If no operation is ready, sort every remaining operation by ascending stamp and emit it; this is the deterministic cycle fallback.

A dependency absent from the available input set does not block ordering. Receivers SHOULD request missing history, but MUST converge over the same available set. Dependencies only constrain order; they do not authorize an operation or change its stamp.

## 6. Materialized state

The durable operation set is authoritative. Materialized state and snapshots are disposable caches.

Each entity is addressed by `(entity, target)` and contains:

- independent field registers;
- action-specific arguments;
- a set of same-kind entity links;
- the operation ID that created its current incarnation;
- an optional source ID; and
- an optional tombstone stamp.

Replay accepted operations in the order from section 5:

- A field write replaces its register only when the incoming stamp is greater than the register's stamp. Equal stamps are identical operations by construction.
- `create` on a missing target creates it. On an existing target it applies field writes; it never clears a tombstone.
- `update` on a missing or tombstoned target is unapplied. Otherwise it applies field writes.
- `delete` on a missing target is unapplied. Otherwise it stores the greater of the existing and incoming tombstone stamps.
- `duplicate` with a missing or tombstoned source is unapplied. Otherwise it creates/replaces target from the source's visible fields, overlays operation fields, clears inherited links and tombstone, records `source`, and uses the duplicate operation as creator.
- `link` or `unlink` with a missing source is unapplied. Otherwise it mutates the source's link set.
- An unknown or unsupported operation is unapplied.

Operation `args` are retained as action metadata. On create they initialize the entity arguments; on a create/update of a live entity, supplied keys replace earlier argument keys in replay order; on duplicate they initialize the new entity arguments. Arguments are not field registers and MUST NOT be used for durable properties requiring independent conflict resolution.

Unapplied operations remain preserved and reported in deterministic replay order. Implementations MUST NOT silently synthesize missing entities, dependencies, or extension semantics.

## 7. Presence envelope

Presence is ephemeral and separate from durable operations. It MUST NOT enter the operation log or affect materialized document state.

A presence envelope contains `kind = editspace.presence`, `v = 1`, `doc`, and `presence`. The presence value contains:

| Member | Requirement | Meaning |
| --- | --- | --- |
| `identity.peerID` | REQUIRED | Stable presentation identity for a returning person/device. |
| `identity.actorID` | REQUIRED | Actor associated with durable operations. |
| `identity.displayName` | OPTIONAL | Untrusted presentation string or null. |
| `identity.color` | OPTIONAL | Untrusted presentation string or null. |
| `identity.avatarURL` | OPTIONAL | Untrusted presentation string or null. |
| `identity.attributes` | REQUIRED | Endpoint-defined JSON object. |
| `sessionID` | REQUIRED | Connection-scoped identifier. |
| `state` | REQUIRED | `active`, `idle`, `away`, or `offline`. |
| `sequence` | REQUIRED | Session-local monotonically increasing safe integer. |
| `selectedEntities` | REQUIRED | Array of `{kind, id}` hints. |
| `focus` | REQUIRED | Endpoint-defined JSON object. |
| `updatedAt` | REQUIRED | Sender timestamp. |
| `timeToLiveSeconds` | REQUIRED | Positive safe-integer expiry interval. |

A receiver retains only the greatest `sequence` observed for each `sessionID`. A non-expired `offline` record removes that session. Other records expire when receiver time is strictly later than `updatedAt + timeToLiveSeconds`. Authentication and authorization are transport concerns; presence identity is untrusted and grants no authority.

## 8. Synchronization and storage

An author MUST durably append locally before advertising an operation. A peer import is appended idempotently and SHOULD be queued for durable storage. A store import is appended idempotently and MAY be relayed. Relays MUST deduplicate by immutable operation ID to prevent loops.

Binary geometry, media, and other large values SHOULD be referenced by stable asset ID and integrity hash, then transferred outside the operation channel. Native platform types MUST NOT appear in protocol JSON.

## 9. Versioning and preservation

Envelope and operation schema versions evolve independently. A new optional member may be added compatibly when ignoring it preserves correct semantics. A semantic addition older endpoints must understand requires a feature token. An incompatible representation requires a new schema version and a documented migration.

Unknown members and unsupported operations SHOULD survive lossless forwarding. Implementations that decode into a lossy native model MUST also retain the original JSON whenever they may forward it.

## 10. Conformance

An implementation conforms to EditSpace v1 when it:

1. accepts every positive wire fixture and rejects every negative fixture for the stated reason;
2. produces the exact normalized result for every required conformance vector;
3. preserves unsupported data as required; and
4. emits its actual results in a report matching `schemas/conformance-report-v1.schema.json`, with one unique result for every required manifest entry. The protocol runner, not the implementation, determines whether those results pass.

Object key order is ignored when comparing JSON. Array order is significant unless a schema or vector explicitly identifies the array as a set. Conformance reports identify the exact protocol commit so results remain reproducible.
