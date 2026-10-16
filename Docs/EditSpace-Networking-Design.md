# EditSpace Networking Design

Updated: September 2026  
Status: design plan

## Purpose

EditSpace networking exists to let people collaboratively edit a digitally augmented physical environment across heterogeneous spatial devices, nearby or remote, with or without infrastructure networking.

The protocol should contain as little as possible, but not less than independently implemented adapters need to discover or invite one another, establish an authenticated session, join the same space, align with the physical environment when applicable, exchange edits, and converge after interruption.

EditSpace is not a general desktop-to-desktop collaborative 3D authoring protocol. USD/USDZ remains the preferred interchange mechanism for conventional 3D authoring workflows. Desktop, Blender, and MCP endpoints participate as observers, remote assistants, automation clients, relays, or import/export adapters in support of an AR editing session.

## Design principles

1. The physical environment and its augmented scene are the primary shared subject.
2. Durable operations are authoritative; snapshots and rendered scenes are caches.
3. Network reachability, participation, scene synchronization, and spatial alignment are independent states.
4. One stable peer identity survives changes between BLE, local IP, direct Wi-Fi, and relayed paths.
5. BLE is both a discovery/bootstrap path and a complete constrained fallback transport.
6. Implementations should prefer direct paths but must tolerate relays, disconnection, duplication, reordering, and delayed delivery.
7. Vendor frameworks implement EditSpace behavior; they do not define EditSpace semantics.
8. The protocol standardizes only the transport bindings required for independently written adapters to interoperate.

## System boundary

```text
Host AR application
        │
Native scene and tracking adapter
        │
EditSpace operations, participation, sync, and alignment
        │
EditSpace connectivity profiles
        │
BLE │ LAN/Wired │ Wi-Fi Aware │ Apple P2P │ Internet/Relay
```

EditSpace defines observable messages and behavior. Platform adapters own ARKit or ARCore sessions, world maps, marker detection, sockets, radios, background execution, rendering, and user interface.

## Minimum normative protocol

### 1. Scene operations

The existing immutable operation envelopes, deterministic materialization, presence envelopes, and asset references remain the shared scene foundation. Network batching, splitting, retransmission, or forwarding must not change scene semantics.

### 2. Peer identity and session authentication

Every network-capable endpoint has a stable cryptographic peer identity. Peer identity is distinct from:

- an actor that authors operations;
- a person or account;
- a transport address;
- an ARKit participant/session identifier; and
- a device's BLE, Wi-Fi, or libp2p identifier.

A common EditSpace handshake authenticates this identity above the bearer so that a session can move between transports without becoming a new peer.

### 3. Participation

Connecting to a peer does not grant access to a space. Participation uses a small state machine:

```text
connected
→ participation requested or invited
→ accepted as spatial editor, observer, assistant, or relay
→ synchronizing
→ participating
```

Presence never grants authorization. Invitations and acceptance decisions are explicit, scoped to a space, expiring where appropriate, and bound to authenticated peer identities.

### 4. Synchronization and recovery

After admission, peers exchange compact history summaries, request missing immutable operations, retrieve referenced assets, and then enter live synchronization. Reconnection repeats reconciliation rather than assuming the prior transport delivered everything.

The first reconciliation scheme should exploit the existing actor-local monotonic sequence numbers. Later revisions may add range fingerprints or Merkle summaries without changing scene operations.

Traffic has three classes:

- durable operations: reliable, retained, deduplicated, and forwardable;
- assets: content-addressed, chunked, resumable, and normally deferred on constrained links; and
- presence: expiring, coalescible, and optionally best effort.

### 5. Spatial alignment

Scene synchronization and spatial alignment are reported independently. A peer may have the complete scene while remaining unaligned.

```text
sceneSync: idle | synchronizing | complete | stale
alignment: notApplicable | unaligned | provisional | confirmed | lost
```

EditSpace defines alignment offers, evidence, confirmation, loss, and replacement. Native alignment payloads remain opaque adapter data.

For compatible Apple devices, an adapter may exchange `ARWorldMap` or ARKit collaboration data. Successful relocalization/world-data merging and participant anchors provide confirmation that devices share a coordinate frame.

For heterogeneous spatial devices, AprilTags provide a portable optical reference. Given a known tag pose in EditSpace and an observed tag pose in local tracking coordinates, the adapter derives the transform from its local frame into the EditSpace frame. Confirmation should include tag identity and physical size, pose stability, error/confidence measurements, and optional observation by an already aligned participant.

A remote desktop viewer uses a virtual mapping from canonical EditSpace coordinates into its renderer and does not require physical alignment.

## Connectivity profiles

Conformance is profile-based so a headless or desktop endpoint is not required to contain mobile radios.

| Profile | Purpose | Expected support |
| --- | --- | --- |
| `editspace.ip.v1` | Common local/wired IP discovery and connection | Required for IP-capable native endpoints |
| `editspace.ble.v1` | Nearby discovery, constrained sync, and bearer upgrade | Required for full mobile/offline conformance |
| `editspace.wifi-aware.v1` | Cross-vendor infrastructure-free high-bandwidth link | Required where hardware and OS APIs expose it |
| Apple peer-to-peer binding | Infrastructure-free Apple-to-Apple IP, commonly associated with AWDL | Required for full Apple spatial-device conformance |
| `editspace.remote.v1` | Invitation, remote peer lookup, direct dialing, and relay fallback | Required for full remote conformance |
| `editspace.webrtc.v1` | Browser/restricted-runtime connection | Optional |
| `editspace.bundle.v1` | File, QR, removable-media, or delay-tolerant transfer | Optional |

### Local IP and wired networking

`editspace.ip.v1` uses mDNS/DNS-SD to advertise and browse an EditSpace service on available local IP interfaces, followed by an authenticated stream connection. The final choice between a universally implementable TLS/TCP baseline and an additional QUIC mode should be made by interoperability prototypes.

mDNS only covers the local multicast domain. It does not provide remote discovery and may be filtered on managed networks.

On Apple platforms, Network framework can include Apple peer-to-peer Wi-Fi while browsing, listening, and connecting. The adapter uses the supported Network framework APIs rather than implementing undocumented AWDL behavior. The same EditSpace IP messages can therefore travel over infrastructure Wi-Fi, Ethernet, or Apple peer-to-peer Wi-Fi.

### BLE

`editspace.ble.v1` defines service and characteristic identifiers, advertisements, authenticated handshake framing, fragmentation, reassembly, flow control, acknowledgements, maximum required payloads, and reconnect behavior.

BLE must support complete operation reconciliation even when no faster bearer exists. Large assets may remain pending until a suitable link becomes available.

### BLE-assisted bearer upgrade

BLE can authenticate a nearby peer and exchange connection candidates, but it cannot itself create an IP path. The operating system must expose one of the following:

- both devices already share a LAN;
- Wi-Fi Aware creates a direct cross-vendor data path without an access point;
- Apple peer-to-peer Wi-Fi creates an Apple-only data path;
- Wi-Fi Direct or a temporary access point creates a joinable network; or
- no upgrade is possible and synchronization continues over BLE.

The logical session and peer identity remain unchanged during an upgrade:

```text
BLE discovery and authentication
→ exchange supported candidates
→ establish Wi-Fi/LAN path
→ authenticate the same peer on the new path
→ reconcile outstanding operations
→ retain or close BLE according to policy
```

Wi-Fi Aware interoperability between actual Apple and Android hardware, Apple peer-to-peer behavior with visionOS, and Quest radio/API availability require early device prototypes before their detailed bindings become normative.

## Remote invitations and discovery

Remote participants do not depend on mDNS. An invitation is a signed, space-scoped capability delivered through any external channel as a QR code, deep link, file, or text. It conveys authorization and connection hints; it does not create network reachability.

A remote join can proceed only while at least one authorized EditSpace peer is connected to a network path reachable by the invitee. That peer may be the inviter or another currently participating peer permitted to admit or relay the new participant. If no such peer is reachable, the invitation remains dormant until one becomes reachable. A DHT or rendezvous record may help locate a live peer, but a stale record cannot make an offline peer available.

An invitation minimally carries or securely resolves:

- the space identifier;
- inviter peer identity and key fingerprint;
- an unguessable, preferably one-time participation capability;
- expiry and requested/allowed role;
- known direct addresses;
- optional DHT lookup keys, rendezvous namespaces, and relay addresses.

### DHT

A distributed hash table is a peer-operated lookup system. Participating nodes collectively map a key to a small signed value. EditSpace can derive an unguessable lookup key from an invitation and publish an encrypted, expiring connection record under that key. A DHT removes the need for one authoritative directory, but it still depends on reachable bootstrap peers and should not contain scene contents or public space listings.

### Rendezvous

The word *rendezvous* is overloaded. Apple's original name for Bonjour was Rendezvous, and local mDNS/DNS-SD discovery is sometimes still described informally as rendezvous. In this document, *remote rendezvous* means an internet-reachable meeting point, as in the libp2p Rendezvous protocol.

At a remote rendezvous point, the inviter temporarily registers under an unguessable namespace; the invitee queries the same service and obtains connection candidates. Remote rendezvous can be federated, replaceable, self-hosted, and unable to decrypt the resulting session, but it remains reachable coordination infrastructure. Local peers use mDNS or BLE and do not need it.

### Direct IPv6

An invitation should carry the inviter's current global IPv6 address and listening port when available. The invitee attempts this direct path before DHT lookup, remote rendezvous, hole punching, or relay. IPv6 can remove the IPv4 NAT obstacle, but an address does not guarantee reachability: carrier, enterprise, or host firewalls may block unsolicited inbound traffic; mobile privacy addresses rotate; the inviter may change networks or suspend; and the invitee may lack compatible IPv6 connectivity. The address is therefore an expiring connection candidate bound to the inviter's authenticated peer identity, not a durable identity or universal replacement for fallback discovery and relay.

### Relay

A relay forwards end-to-end encrypted traffic when direct dialing or NAT traversal fails. It has no scene authority and cannot admit participants. Relays are essential to reliable remote mobile connectivity because two devices behind unrelated carrier or enterprise NATs are not generally reachable directly.

### Meaning of serverless

For EditSpace, serverless should mean no required authoritative Graphite service and no trusted server that owns membership or scene state. It cannot mean that reliable remote connectivity requires no reachable third peer. A short human code also needs a DHT, rendezvous/mailbox, or an already connected peer to resolve it.

Remote participation therefore requires overlapping availability: the invitee and at least one authorized space peer must be online and mutually reachable, either directly or through a relay. Supporting admission while every authorized peer is offline would require delegating admission and encrypted state custody to an always-reachable service or peer, which is outside the minimum protocol.

The preferred remote flow is:

```text
receive invitation
→ wait until an authorized space peer is reachable
→ attempt embedded direct IPv6 and IPv4 candidates
→ resolve fresher candidates through DHT or remote rendezvous if necessary
→ attempt direct connection and NAT traversal
→ fall back to an encrypted relay
→ authenticate inviter and invitation capability
→ request or confirm participation
→ synchronize the authorized scene
```

## Heterogeneous mesh behavior

The mesh exists above individual transports. A phone can receive an operation over BLE, retain it, and later forward it over Wi-Fi to a wired desktop or relay.

```text
iPhone ←BLE→ Android/Quest ←Wi-Fi→ laptop ←Ethernet→ relay or MCP peer
```

Forwarding is bounded by space authorization, message identity, expiry, hop limit, storage budget, and policy. Durable operations are safe to encounter repeatedly because the operation log deduplicates them. Presence should normally remain local to active sessions and should not be delay-tolerantly flooded.

## Reference implementations

The first reference set should be deliberately heterogeneous:

| Endpoint | Primary adapters | Purpose |
| --- | --- | --- |
| iOS/iPadOS | Swift EditSpace, Network framework, Core Bluetooth, Wi-Fi Aware, ARKit | Primary spatial editor and Apple mobile reference |
| visionOS | Swift EditSpace, Network framework/Apple P2P, ARKit shared-coordinate facilities | Immersive Apple participant |
| Android/Quest | Independent Kotlin/Java protocol implementation with native BLE and Wi-Fi APIs; optional Rust networking core | Cross-vendor spatial participant |
| Blender desktop | Independent Python EditSpace implementation with an IP/remote networking adapter or sidecar | Remote observation, inspection, import/export, and validation—not general live DCC collaboration |
| Headless/MCP endpoint | Rust or TypeScript endpoint | Invitation, bounded automation, relay/bootstrap experiments, and unattended conformance testing |

Independent codecs and state engines should consume the same fixtures. Sharing one implementation core across every platform would conceal specification ambiguities and common bugs.

## External systems

- libp2p is the leading candidate for implementation of remote DHT, rendezvous, NAT traversal, and circuit relay behavior. It should not become a requirement of EditSpace semantics.
- p2panda is useful prior art for transport-independent anti-entropy and delay-tolerant store-and-forward.
- Wesh is useful prior art for offline-first encrypted mobile networking, but its Go/gRPC stack and broader group-messaging model should not become an EditSpace dependency.
- If MARS means the Mesh Agent Routing Standard, its Kademlia/QUIC capability discovery may be useful for MCP or agent lookup, but it does not replace local radio discovery, spatial alignment, participation, or scene synchronization.
- Unity MARS is an AR environment-authoring/runtime system rather than a peer networking protocol. Its environment proxies, markers, and simulation are relevant adapter prior art, not an EditSpace transport foundation.

## Implementation plan

### Phase 1: Specify the common session

1. Define peer identity and the authenticated hello.
2. Define participation request, invitation, acceptance, rejection, and resumption.
3. Define history summary, missing-range request, operation batch, sync completion, and asset manifest messages.
4. Define alignment state and opaque alignment offer/evidence/confirmation messages.
5. Add transport-independent state-machine and failure conformance vectors.

### Phase 2: Local IP reference

1. Implement `editspace.ip.v1` in Swift and one independent desktop/headless implementation.
2. Validate mDNS discovery over Wi-Fi and Ethernet.
3. Validate direct connection, authentication, complete history transfer, reconnect, and duplicate delivery.
4. Validate Apple peer-to-peer Wi-Fi through supported Network framework APIs.

### Phase 3: BLE and bearer upgrade

1. Implement full constrained BLE synchronization between two mobile peers.
2. Resume interrupted history and prove convergence under small MTUs and duplicate/reordered delivery.
3. Prototype Apple-to-Android Wi-Fi Aware using BLE-established identity.
4. Fall back to BLE without restarting the EditSpace session.

### Phase 4: Spatial alignment

1. Carry ARKit world maps/collaboration data as adapter-specific alignment payloads.
2. Confirm Apple alignment using relocalization/world merging and participant anchors.
3. Implement AprilTag alignment evidence across Apple and Android/Quest.
4. Exercise provisional, confirmed, lost, and realigned transitions independently of scene sync.

### Phase 5: Remote invitations

1. Define signed QR/deep-link invitation encoding.
2. Prototype DHT and rendezvous resolution behind a common adapter contract.
3. Add direct dialing, NAT traversal, and end-to-end encrypted relay fallback.
4. Demonstrate accepted remote observation of the complete authorized scene.

### Phase 6: Heterogeneous mesh

1. Forward durable operations across BLE and IP adapters on an intermediate peer.
2. Enforce loop suppression, expiry, hop, authorization, and storage limits.
3. Test partitions, delayed delivery, bearer migration, and eventual convergence across at least three independent platform implementations.

## Early decisions and risks

The following require prototypes before the specification freezes:

- Apple-to-Android Wi-Fi Aware service, pairing, and data-path interoperability;
- supported Wi-Fi and BLE behavior on representative Quest hardware;
- the required common IP stream baseline: TLS/TCP, QUIC, or both;
- mobile background behavior and energy limits;
- practical BLE throughput, peer degree, and payload limits;
- privacy-preserving invitation lookup and resistance to code guessing;
- relay abuse controls without giving the relay scene authority;
- operation-history compaction without preventing late or intermittently connected peers from recovering.

## Success criteria

The design is successful when:

1. nearby Apple peers edit one physical environment without a base station;
2. an Apple and Android/Quest peer align optically and converge while offline;
3. BLE continues useful editing and later upgrades to a faster bearer without changing peer identity;
4. a remote invited observer joins through direct or relayed connectivity without public space discovery;
5. an intermediate device forwards durable operations between incompatible local bearers;
6. independently implemented Swift, Kotlin/Python, and Rust/TypeScript endpoints pass the same behavioral conformance suite; and
7. none of these requirements turns EditSpace into a general-purpose desktop collaborative modeling protocol.

## References

- Apple, *TN3111: iOS Wi-Fi API overview*: <https://developer.apple.com/documentation/technotes/tn3111-ios-wifi-api-overview>
- Apple, *Moving from Multipeer Connectivity to Network framework*: <https://developer.apple.com/documentation/technotes/tn3213-moving-from-multipeer-connectivity-to-network-framework>
- Apple, *Wi-Fi Aware*: <https://developer.apple.com/documentation/wifiaware>
- Android, *Wi-Fi Aware overview*: <https://developer.android.com/develop/connectivity/wifi/wifi-aware>
- Android, *Wi-Fi Direct*: <https://developer.android.com/develop/connectivity/wifi/wifi-direct>
- libp2p, *Rendezvous*: <https://libp2p.io/docs/rendezvous/>
- libp2p, *Circuit Relay*: <https://libp2p.io/docs/circuit-relay/>
- Magic Wormhole documentation: <https://magic-wormhole.readthedocs.io/>
- p2panda: <https://p2panda.org/>
