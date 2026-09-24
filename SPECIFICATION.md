# EditSpace Protocol v1

Status: normative specification, September 2026.

The key words MUST, MUST NOT, REQUIRED, SHOULD, SHOULD NOT, and MAY are to be interpreted as described by RFC 2119 and RFC 8174 when they appear in uppercase.

## 1. Purpose and boundary

EditSpace is an application-, language-, platform-, transport-, and renderer-neutral protocol for collaboratively creating and editing shared 3D spaces. An EditSpace space is a synchronized 3D scene, not an arbitrary document. It contains scene objects, transforms, geometry, materials, modifiers, assets, hierarchy, constraints, and collaborator presence. It defines:

1. immutable durable operations;
2. deterministic validation, ordering, and materialization;
3. compatibility and preservation behavior;
4. ephemeral peer identity and presence; and
5. a common conformance contract.

It does not define native APIs, a particular modeling-kernel or scene-graph implementation, renderer, UI, network topology, authentication, authorization, durable-store product, or asset-transfer service. A platform library implements this specification; it does not extend or redefine the core rules.

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
| `doc` | REQUIRED | Stable shared-space identifier. The short key is retained for v1 wire compatibility; it does not mean EditSpace is a general document protocol. |
| `ops` | REQUIRED | Array of zero or more operations. |

Every operation in `ops` MUST have the same `doc` space ID as its envelope. Envelopes are transport batches only: splitting, joining, or reordering envelopes MUST NOT change scene semantics.

### 3.1 Operation

| Member | Requirement | Meaning |
| --- | --- | --- |
| `v` | OPTIONAL | Operation schema version; defaults to `1`. |
| `doc` | REQUIRED | Shared-space identifier. |
| `op` | REQUIRED | Globally unique immutable operation identifier. `actor:seq` is recommended. |
| `actor` | REQUIRED | Stable author identifier. |
| `seq` | REQUIRED | Actor-local monotonically increasing safe integer. It is allocated across all spaces, not independently per space, so later space merges cannot create operation-ID collisions. |
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

When spaces have been merged under section 3.4, implementations compare and route `doc` after resolving it to the component's canonical space ID. An implementation MAY create a canonicalized in-memory copy for an operation log that requires one space ID, but MUST preserve the original wire representation when forwarding or durably archiving it. Canonicalization alone does not create a distinct operation and MUST NOT change `op`, `actor`, `seq`, dependencies, content, or ordering stamp.

`producer` contains required string members `app` and `library`, with optional `appVersion` and `libraryVersion`. Producer data and `createdAt` MUST NOT influence validation support, authorization, ordering, or materialization.

### 3.2 Core tokens

Core actions are `create`, `update`, `delete`, `duplicate`, `link`, and `unlink`.

Core entity kinds are `space`, `object`, `mesh`, `vertex`, `face`, `modifier`, `material`, `asset`, `constraint`, `parameter`, `dependency`, and `legacySnapshot`. The v1 `document` token is a deprecated compatibility spelling for `space` metadata; producers MUST emit `space`.

Core feature tokens are `core.v1`, `scene3d.v1`, `mesh.v1`, `modifiers.v1`, `pbrMaterial.v1`, `crud.v1`, `duplicate.v1`, `linkedDuplicate.v1`, `dependencyGraph.v1`, and `presence.v1`.

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

### 3.4 Space merge envelope

A space merge envelope records immutable declarations that previously distinct space identifiers refer to one logical shared space. It contains:

| Member | Requirement | Meaning |
| --- | --- | --- |
| `kind` | REQUIRED | Exactly `editspace.space-merges`. |
| `v` | REQUIRED | Envelope schema version; exactly `1` for this specification. |
| `declarations` | REQUIRED | Array of zero or more merge declarations. |

Each declaration contains `first` and `second` space identifiers. The pair is unordered semantically and producers MUST encode the lexicographically lesser identifier as `first`. Repeated declarations are exact idempotent duplicates. A declaration joining a space to itself is valid but has no effect.

Declarations form an undirected graph. Every connected component is one logical space, and its canonical space ID is the lexicographically least member. Implementations MUST resolve aliases transitively. Applying the same declaration set in any grouping, arrival order, join order, or replay order MUST produce the same components and canonical identifiers.

After a merge, operation envelopes addressed to any member of the component belong to the same logical space. Receivers MUST resolve both the envelope `doc` and operation `doc` before enforcing the expected-space check. Operations keep their original identity and stamp. Peers SHOULD exchange their complete retained declaration sets when negotiating or reconnecting so transitive merges converge without requiring the original participants to remain online. Authorization to accept a declaration is transport- or application-specific and outside this protocol.

Space merge declarations are durable coordination metadata, not scene operations. They MUST NOT be inserted into the operation log or materialized as scene entities. Presence remains ephemeral and follows the resolved canonical space.

### 3.5 Shared 3D scene model

The `fields` object is not an opaque application dictionary for core entities. The field names and value shapes below are the interoperable EditSpace scene model. `create` supplies an entity's initial fields. `update` is a sparse field patch: omitted fields are unchanged, and each supplied top-level field is an independent last-writer-wins register. Arrays and nested objects are atomic values unless their contents are modeled as separate entities.

Unknown fields are extensions and MUST use a collision-resistant prefix. Implementations MUST preserve them, but MUST NOT guess their meaning. A core field with the wrong value shape is `invalidOperation`.

#### Coordinate and numeric conventions

- Linear values are meters unless a field explicitly declares another unit.
- The canonical coordinate system is right-handed, Y-up, with the local forward direction along negative Z.
- A `vec2`, `vec3`, or `vec4` is a JSON array containing exactly 2, 3, or 4 finite numbers.
- An axis-angle rotation is `[axisX, axisY, axisZ, angleRadians]` with a normalized axis. A quaternion field, where explicitly named, is `[x, y, z, w]` and MUST be normalized before emission.
- A 4×4 transform is 16 finite numbers in column-major order. Indices `0...3` are column 0, `4...7` are column 1, `8...11` are column 2, and `12...15` are the translation column. It maps entity-local coordinates into parent coordinates using column vectors.
- A color is sRGB `[red, green, blue, alpha]`, with every component in `0...1`.
- Angles are radians. Texture coordinates use `[u, v]` with the texture origin at the lower-left.
- An adapter for a Z-up or left-handed host MUST convert at the protocol boundary.

#### `space` fields

| Field | Value | Meaning |
| --- | --- | --- |
| `name` | string | User-visible space name. |
| `units` | `"meters"` | Canonical linear unit. |
| `upAxis` | `"Y"` | Canonical up axis. |
| `handedness` | `"right"` | Canonical handedness. |
| `rootObjectIDs` | entity-ID array | Ordered roots of the shared scene. |
| `environmentAssetID` | entity ID | Optional environment/lighting asset. |

#### `object` fields

| Field | Value | Meaning |
| --- | --- | --- |
| `name` | string | User-visible object name. |
| `objectType` | token | Semantic type such as `mesh`, `curve`, `light`, `camera`, or `group`. |
| `parentID` | entity ID or null | Parent object; null means scene root. |
| `transform` | matrix4 | Authoritative local transform. |
| `pivot` | matrix4 | Local modeling pivot. |
| `visible` | boolean | Scene visibility. |
| `opacity` | number | Object opacity in `0...1`. |
| `meshID` | entity ID | Referenced mesh entity. |
| `materialIDs` | entity-ID array | Ordered material slots. |
| `modifierIDs` | entity-ID array | Ordered modifier stack. |

`position`, `orientation`, and `scale` MAY be used instead of `transform` for component editing. `orientation` uses axis-angle; `quaternion` is the optional quaternion alternative. When an operation supplies `transform`, it is authoritative for that operation; otherwise supplied components patch the prior decomposition. Producers SHOULD avoid sending multiple rotation representations in one operation.

#### Geometry

A `mesh` may use a bulk representation for import, creation, or whole-mesh replacement:

| Field | Value | Meaning |
| --- | --- | --- |
| `positions` | vec3 array | Vertex positions in mesh-local meters. |
| `normals` | vec3 array | Optional per-position normals. |
| `textureCoordinates` | vec2 array | Optional per-position UV coordinates. |
| `colors` | color array | Optional per-position colors. |
| `faces` | integer-array array | Polygon vertex indices into `positions`; each face has at least three indices. |
| `materialIndices` | non-negative integer array | Optional material slot for each face. |
| `bounds` | `{min: vec3, max: vec3}` | Optional local-space bounds cache. |

All indices MUST be in range. If normals, UVs, colors, or material indices are present, their counts MUST match the corresponding positions or faces. Because each top-level field is atomic, producers changing mesh topology SHOULD update all dependent arrays in one operation.

For fine-grained concurrent modeling, vertices and faces are separate stable entities. A `vertex` has required `meshID` and `position`, with optional `normal`, `textureCoordinate`, and `color`. A `face` has required `meshID` and an ordered `vertexIDs` array of at least three stable vertex IDs, plus optional `materialID`. Deleting a mesh does not erase its vertex/face operation history.

#### `modifier` fields

A modifier has required `objectID`, `modifierType`, `enabled`, and `order`. Its parameter fields are semantic inputs; generated geometry is a cache and MUST NOT be synchronized as authoritative state when the inputs are available.

Core modifier types and fields include:

| `modifierType` | Fields |
| --- | --- |
| `circle` | `segments` integer ≥ 3, `radius` dimension |
| `polyline` | `vertices` vec3 array, optional `closed` boolean |
| `box` | `width`, `height`, `depth` dimensions |
| `sphere` | `radius` dimension, optional `segments` integer |
| `extrusion` | `depth` number, optional `localNormal` vec3 and `pathPoints` vec3 array |
| `extrudePipe` | `radius` number, `capEnds` boolean |
| `smooth` | `minimumResolution` integer, `curveResolution` integer |
| `closeLoop`, `solidify`, `shiftToSurface` | Type-specific extension parameters, if any |
| `strokeRenderer`, `wireframe` | `width` number, optional `color` and rendering-mode token |
| `label` | `text` string |
| `externalModel` | optional `embeddedMesh` using the bulk mesh shape, or an asset reference |

A dimension is `{ "valueMeters": number }` with optional authoring metadata such as display value, unit symbol, or defining points. Implementations compute generated vertices from modifier inputs deterministically where they support the modifier type.

#### `material` and `asset` fields

Core materials use a metallic/roughness PBR vocabulary: `name`, `baseColor`, `metallic`, `roughness`, `emissiveColor`, `opacity`, `doubleSided`, `baseColorTextureAssetID`, `normalTextureAssetID`, and `metallicRoughnessTextureAssetID`. Colors use sRGB; scalar factors are in `0...1`.

An asset contains `name`, `uri`, `mediaType`, and `sha256`. `sha256` is the lowercase hexadecimal digest of the referenced bytes. Large mesh buffers, textures, and media SHOULD travel through the asset channel while their IDs, hashes, and scene relationships travel through operations.

The normative structural shapes for these fields are in `schemas/scene-fields-v1.schema.json` and are exercised by conformance fixtures.

## 4. Acceptance and compatibility

Before accepting an operation, an endpoint checks it in this order:

1. structural schema validity;
2. envelope/operation space-ID equality and expected local space-ID equality;
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

The durable operation set is authoritative. Materialized shared-scene state and snapshots are disposable caches.

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

Presence is ephemeral and separate from durable operations. It MUST NOT enter the operation log or affect materialized shared-scene state.

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
