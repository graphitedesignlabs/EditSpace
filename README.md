# EditSpace Protocol

EditSpace is a language- and platform-neutral protocol for collaborative editing of structured documents. This repository is the final abstraction boundary: it defines interoperable data, behavior, and conformance, but contains no EditSpace implementation.

The source of truth is:

- [`SPECIFICATION.md`](SPECIFICATION.md) for normative behavior;
- [`schemas/`](schemas/) for machine-readable wire and result formats;
- [`conformance/`](conformance/) for implementation-independent golden vectors;
- [`tools/editspace-conformance.mjs`](tools/editspace-conformance.mjs) for validating schemas, messages, vectors, and implementation reports.

An implementation belongs in its language or platform repository. It should include this repository as a Git submodule, translate the conformance inputs into its native API, and compare its serialized results with the expected JSON.

## Use as a protocol submodule

```sh
git submodule add git@github.com:graphitedesignlabs/EditSpace.git Vendor/EditSpace
git submodule update --init --recursive
cd Vendor/EditSpace
npm test
```

Pin the submodule to a reviewed commit. Do not track an unpinned branch in release builds.

## Validate protocol messages

Node.js 20 or newer is required only for the supplied zero-dependency tooling, not for implementations.

```sh
npm run validate -- path/to/message.json
npm test
```

The validator chooses the envelope schema from its `kind`. `npm test` validates every schema, checks all positive and negative fixtures, and checks the integrity of every conformance vector.

## Check an implementation report

After an implementation runs every vector listed in [`conformance/manifest.json`](conformance/manifest.json), it emits a report matching [`schemas/conformance-report-v1.schema.json`](schemas/conformance-report-v1.schema.json):

```sh
npm run conformance -- path/to/editspace-conformance-report.json
```

The report contains actual acceptance decisions, problem kinds, and normalized materialized states—not self-reported pass flags. The command compares those outputs with the manifest and golden vectors, and fails on a missing, duplicated, or mismatched result. This makes the same protocol suite usable from Swift, Python, JavaScript, Rust, or another implementation without making any one language authoritative.

## Scope

EditSpace defines immutable operations, deterministic ordering and materialization, compatibility behavior, and ephemeral peer presence. It deliberately does not define a renderer, modeling kernel, native scene types, storage engine, network transport, authentication system, asset service, or user interface.

## Versioning

Protocol releases use semantic Git tags. Wire messages carry their own integer schema versions. Extensions use open string tokens and must be preserved when they are not understood. See the specification for compatibility requirements.

## License

MIT. See [`LICENSE`](LICENSE).
