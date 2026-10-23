#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function assertEqual(actual, expected, id) {
  if (JSON.stringify(stable(actual)) !== JSON.stringify(stable(expected))) {
    throw new Error(`${id}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function highestCommon(left, right) {
  const permitted = new Set(right);
  return [...left].filter((value) => permitted.has(value)).sort((a, b) => b - a)[0];
}

function negotiate(input) {
  return {
    networkVersion: highestCommon(input.left.networkVersions, input.right.networkVersions),
    operationVersion: highestCommon(input.left.operationVersions, input.right.operationVersions)
  };
}

function chooseConnection(input) {
  const designated = [input.leftPeerID, input.rightPeerID].sort()[0];
  const candidates = input.connections
    .filter((connection) => connection.initiatorPeerID === designated)
    .sort((left, right) => left.initiatorPort - right.initiatorPort);
  if (candidates.length === 0) throw new Error("no correctly directed connection");
  return candidates[0];
}

function selectSpaces(input) {
  const leftOfferSet = new Set(input.leftOffers);
  const rightOfferSet = new Set(input.rightOffers);
  if (input.leftSelectsFromRight.some((space) => !rightOfferSet.has(space)) ||
      input.rightSelectsFromLeft.some((space) => !leftOfferSet.has(space))) {
    throw new Error("selection contains an unoffered space");
  }
  return {
    activeSpaces: [...new Set([...input.leftSelectsFromRight, ...input.rightSelectsFromLeft])].sort()
  };
}

function subtractRanges(remoteRanges, localRanges) {
  const missing = [];
  for (const [remoteFirst, remoteLast] of remoteRanges) {
    let cursor = remoteFirst;
    let exhausted = false;
    for (const [localFirst, localLast] of localRanges) {
      if (localLast < cursor) continue;
      if (localFirst > remoteLast) break;
      if (localFirst > cursor) missing.push([cursor, Math.min(remoteLast, localFirst - 1)]);
      if (localLast >= remoteLast) {
        exhausted = true;
        break;
      }
      cursor = Math.max(cursor, localLast + 1);
    }
    if (!exhausted && cursor <= remoteLast) missing.push([cursor, remoteLast]);
  }
  return missing;
}

function missingRanges(input) {
  const local = new Map(input.local.map((entry) => [entry.actor, entry.ranges]));
  return {
    actors: input.remote.flatMap((entry) => {
      const ranges = subtractRanges(entry.ranges, local.get(entry.actor) ?? []);
      return ranges.length === 0 ? [] : [{ actor: entry.actor, ranges }];
    })
  };
}

function eligibleExports(input) {
  const allowed = new Set(["local", "application-import", input.targetNeighbor]);
  return {
    itemIDs: input.items.filter((item) => allowed.has(item.origin)).map((item) => item.id).sort()
  };
}

function encodeDiscoveryTXT(input) {
  return {
    net: [...input.networkVersions].sort((a, b) => b - a).join(","),
    ops: [...input.operationVersions].sort((a, b) => b - a).join(","),
    peer: input.peerID,
    caps: [...input.capabilities].sort().join(",")
  };
}

function parsePartialFrames(input) {
  const wire = Buffer.concat(input.messages.map((message) => {
    const payload = Buffer.from(JSON.stringify(message), "utf8");
    const prefix = Buffer.alloc(4);
    prefix.writeUInt32BE(payload.length);
    return Buffer.concat([prefix, payload]);
  }));
  let buffered = Buffer.alloc(0);
  const kinds = [];
  let offset = 0;
  let chunkIndex = 0;
  while (offset < wire.length) {
    const size = input.chunkSizes[chunkIndex % input.chunkSizes.length];
    const end = Math.min(offset + size, wire.length);
    buffered = Buffer.concat([buffered, wire.subarray(offset, end)]);
    offset = end;
    chunkIndex += 1;
    while (buffered.length >= 4) {
      const length = buffered.readUInt32BE(0);
      if (length === 0 || length > 16777216) throw new Error("invalidFrame");
      if (buffered.length < length + 4) break;
      const message = JSON.parse(buffered.subarray(4, length + 4).toString("utf8"));
      kinds.push(message.kind);
      buffered = buffered.subarray(length + 4);
    }
  }
  return { kinds, remainingBytes: buffered.length };
}

function validateFrameLengths(input) {
  return {
    results: input.lengths.map((length) => length >= 1 && length <= 16777216 ? "accepted" : "invalidFrame")
  };
}

function messageOrder(input) {
  const results = input.sequences.map((sequence) => {
    let state = "hello";
    for (const kind of sequence) {
      const allowed = state === "hello" ? new Set(["editspace.network.hello", "editspace.network.error"]) :
        state === "selection" ? new Set(["editspace.network.space-selection", "editspace.network.error"]) :
          new Set([
            "editspace.network.history-summary",
            "editspace.network.request-operations",
            "editspace.network.operation-batch",
            "editspace.network.sync-complete",
            "editspace.network.error"
          ]);
      if (!allowed.has(kind)) return { error: "unexpectedMessage" };
      if (state === "hello" && kind === "editspace.network.hello") state = "selection";
      else if (state === "selection" && kind === "editspace.network.space-selection") state = "synchronizing";
    }
    return { state };
  });
  return { results };
}

function completeRequestBatches(input) {
  const requested = new Map(input.actors.map((entry) => [entry.actor, entry.ranges]));
  const operations = [];
  let sawFinal = false;
  for (const [index, batch] of input.batches.entries()) {
    if (batch.requestID !== input.requestID || sawFinal || (batch.final && index !== input.batches.length - 1)) {
      throw new Error("invalid batch sequence");
    }
    for (const operation of batch.operations) {
      const ranges = requested.get(operation.actor) ?? [];
      if (!ranges.some(([first, last]) => operation.seq >= first && operation.seq <= last)) {
        throw new Error("batch contains an unrequested operation");
      }
      operations.push(`${operation.actor}:${operation.seq}`);
    }
    sawFinal = batch.final;
  }
  return { complete: sawFinal, operations };
}

function detectCollisions(input) {
  const byID = new Map();
  const byActorSequence = new Map();
  const results = [];
  for (const operation of input.operations) {
    const semantic = JSON.stringify(stable(operation));
    const existingID = byID.get(operation.op);
    const actorSequence = `${operation.actor}:${operation.seq}`;
    if (existingID !== undefined) {
      results.push(existingID === semantic ? "duplicate" : "operationIDCollision");
      continue;
    }
    if (byActorSequence.has(actorSequence)) {
      results.push("actorSequenceCollision");
      continue;
    }
    byID.set(operation.op, semantic);
    byActorSequence.set(actorSequence, operation.op);
    results.push("accepted");
  }
  return { results };
}

const operations = {
  negotiate,
  chooseConnection,
  selectSpaces,
  missingRanges,
  eligibleExports,
  encodeDiscoveryTXT,
  parsePartialFrames,
  validateFrameLengths,
  messageOrder,
  completeRequestBatches,
  detectCollisions
};

const manifest = await json(resolve(root, "conformance/network-v1/manifest.json"));
if (manifest.networkVersion !== 1) throw new Error("network manifest must describe v1");
const schema = await json(resolve(root, manifest.messageSchema));
if (schema.$id !== "https://protocol.editspace.dev/schemas/network-message-v1.schema.json") {
  throw new Error("network manifest references the wrong message schema");
}

const ids = new Set();
for (const entry of manifest.vectors) {
  if (ids.has(entry.id)) throw new Error(`duplicate vector ID ${entry.id}`);
  ids.add(entry.id);
  const vector = await json(resolve(root, entry.path));
  if (vector.id !== entry.id) throw new Error(`${entry.id}: vector ID mismatch`);
  if (vector.networkVersion !== 1) throw new Error(`${entry.id}: expected networkVersion 1`);
  const operation = operations[vector.operation];
  if (!operation) throw new Error(`${entry.id}: unknown operation ${vector.operation}`);
  assertEqual(operation(vector.input), vector.expected, entry.id);
}

console.log(`Validated ${manifest.vectors.length} EditSpace networking v1 vectors.`);
