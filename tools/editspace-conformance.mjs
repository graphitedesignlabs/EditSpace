#!/usr/bin/env node

import process from "node:process";
import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(root, "conformance/manifest.json");
const coreActions = new Set(["create", "update", "delete", "duplicate", "link", "unlink"]);
const coreEntities = new Set(["space", "document", "object", "mesh", "vertex", "face", "modifier", "material", "asset", "constraint", "parameter", "dependency", "legacySnapshot"]);
const coreFeatures = new Set(["core.v1", "scene3d.v1", "mesh.v1", "modifiers.v1", "pbrMaterial.v1", "crud.v1", "duplicate.v1", "linkedDuplicate.v1", "dependencyGraph.v1", "presence.v1"]);

function fail(message) {
  throw new Error(message);
}

function assertNoDuplicateObjectKeys(source, label) {
  let index = 0;
  const whitespace = () => { while (/\s/u.test(source[index] ?? "")) index += 1; };

  function string() {
    const start = index;
    if (source[index] !== "\"") fail(`${label}: expected a JSON string at byte ${index}`);
    index += 1;
    while (index < source.length) {
      if (source[index] === "\\") index += 2;
      else if (source[index] === "\"") {
        index += 1;
        return JSON.parse(source.slice(start, index));
      } else index += 1;
    }
    fail(`${label}: unterminated JSON string`);
  }

  function value() {
    whitespace();
    if (source[index] === "{") return object();
    if (source[index] === "[") return array();
    if (source[index] === "\"") return void string();
    const match = source.slice(index).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/u);
    if (!match) fail(`${label}: invalid JSON value at byte ${index}`);
    index += match[0].length;
  }

  function object() {
    const keys = new Set();
    index += 1;
    whitespace();
    if (source[index] === "}") { index += 1; return; }
    while (true) {
      whitespace();
      const key = string();
      if (keys.has(key)) fail(`${label}: duplicate object key ${JSON.stringify(key)}`);
      keys.add(key);
      whitespace();
      if (source[index] !== ":") fail(`${label}: expected ':' at byte ${index}`);
      index += 1;
      value();
      whitespace();
      if (source[index] === "}") { index += 1; return; }
      if (source[index] !== ",") fail(`${label}: expected ',' at byte ${index}`);
      index += 1;
    }
  }

  function array() {
    index += 1;
    whitespace();
    if (source[index] === "]") { index += 1; return; }
    while (true) {
      value();
      whitespace();
      if (source[index] === "]") { index += 1; return; }
      if (source[index] !== ",") fail(`${label}: expected ',' at byte ${index}`);
      index += 1;
    }
  }

  value();
  whitespace();
  if (index !== source.length) fail(`${label}: unexpected trailing content at byte ${index}`);
}

async function json(path) {
  const source = await readFile(path, "utf8");
  assertNoDuplicateObjectKeys(source, path);
  return JSON.parse(source);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

const equal = (left, right) => JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));

function normalizedOperation(operation) {
  return stableValue({
    ...operation,
    v: operation.v ?? 1,
    deps: operation.deps ?? [],
    fields: operation.fields ?? {},
    args: operation.args ?? {},
    features: operation.features ?? []
  });
}

function pointer(document, fragment) {
  if (!fragment || fragment === "#") return document;
  return fragment.slice(2).split("/").reduce((value, component) => {
    const key = decodeURIComponent(component).replaceAll("~1", "/").replaceAll("~0", "~");
    return value?.[key];
  }, document);
}

async function validatorSet() {
  const schemas = new Map();
  const directory = resolve(root, "schemas");
  const names = (await readdir(directory)).filter((name) => name.endsWith(".schema.json")).sort();
  for (const name of names) {
    const schema = await json(resolve(directory, name));
    if (!schema.$id) fail(`${name}: schema has no $id`);
    if (schemas.has(schema.$id)) fail(`${name}: duplicate schema $id ${schema.$id}`);
    schemas.set(schema.$id, schema);
  }

  function dereference(reference, baseID) {
    const url = new URL(reference, baseID);
    const documentID = `${url.origin}${url.pathname}`;
    const document = schemas.get(documentID);
    const target = document && pointer(document, url.hash);
    if (!target) fail(`unresolved schema reference ${reference} from ${baseID}`);
    return { schema: target, baseID: documentID };
  }

  function validate(schema, value, baseID = schema.$id, path = "$") {
    if (schema.$ref) {
      const target = dereference(schema.$ref, baseID);
      return validate(target.schema, value, target.baseID, path);
    }
    const errors = [];
    const add = (message) => errors.push(`${path} ${message}`);
    const actualType = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
    const typeMatches = (type) => type === "integer" ? Number.isSafeInteger(value) :
      type === "number" ? typeof value === "number" && Number.isFinite(value) :
      type === "object" ? actualType === "object" : actualType === type;

    if (schema.anyOf) {
      const matches = schema.anyOf.some((choice) => validate(choice, value, baseID, path).length === 0);
      if (!matches) add("does not match any allowed shape");
      return errors;
    }
    if (schema.type) {
      const types = Array.isArray(schema.type) ? schema.type : [schema.type];
      if (!types.some(typeMatches)) { add(`must have type ${types.join(" or ")}`); return errors; }
    }
    if ("const" in schema && !equal(value, schema.const)) add(`must equal ${JSON.stringify(schema.const)}`);
    if (schema.enum && !schema.enum.some((item) => equal(value, item))) add("has an unsupported value");
    if (typeof value === "number") {
      if (schema.minimum !== undefined && value < schema.minimum) add(`must be at least ${schema.minimum}`);
      if (schema.maximum !== undefined && value > schema.maximum) add(`must be at most ${schema.maximum}`);
    }
    if (typeof value === "string") {
      if (schema.minLength !== undefined && [...value].length < schema.minLength) add(`must contain at least ${schema.minLength} characters`);
      if (schema.maxLength !== undefined && [...value].length > schema.maxLength) add(`must contain at most ${schema.maxLength} characters`);
      if (schema.pattern && !new RegExp(schema.pattern, "u").test(value)) add(`must match ${schema.pattern}`);
      if (schema.format === "date-time" &&
          (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value) || Number.isNaN(Date.parse(value)))) {
        add("must be an RFC 3339 date-time");
      }
    }
    if (Array.isArray(value)) {
      if (schema.minItems !== undefined && value.length < schema.minItems) add(`must contain at least ${schema.minItems} items`);
      if (schema.maxItems !== undefined && value.length > schema.maxItems) add(`must contain at most ${schema.maxItems} items`);
      if (schema.uniqueItems) {
        const keys = value.map((item) => JSON.stringify(stableValue(item)));
        if (new Set(keys).size !== keys.length) add("must contain unique items");
      }
      if (schema.items) value.forEach((item, index) => errors.push(...validate(schema.items, item, baseID, `${path}[${index}]`)));
    }
    if (actualType === "object") {
      for (const key of schema.required ?? []) if (!(key in value)) errors.push(`${path}.${key} is required`);
      for (const [key, child] of Object.entries(schema.properties ?? {})) {
        if (key in value) errors.push(...validate(child, value[key], baseID, `${path}.${key}`));
      }
      if (schema.additionalProperties === false) {
        for (const key of Object.keys(value)) if (!(key in (schema.properties ?? {}))) errors.push(`${path}.${key} is not allowed`);
      }
    }
    return errors;
  }

  function inspectReferences(schema, baseID = schema.$id) {
    if (schema && typeof schema === "object") {
      if (schema.$ref) dereference(schema.$ref, baseID);
      for (const child of Object.values(schema)) inspectReferences(child, baseID);
    }
  }
  for (const schema of schemas.values()) inspectReferences(schema);
  return { schemas, validate };
}

function schemaIDForMessage(message) {
  if (message?.kind === "editspace.operations") return "https://protocol.editspace.dev/schemas/operation-envelope-v1.schema.json";
  if (message?.kind === "editspace.presence") return "https://protocol.editspace.dev/schemas/presence-envelope-v1.schema.json";
  return undefined;
}

function sceneFieldProblems(validators, operation) {
  const definitionNames = {
    space: "spaceFields",
    document: "spaceFields",
    object: "objectFields",
    mesh: "meshFields",
    vertex: "vertexFields",
    face: "faceFields",
    modifier: "modifierFields",
    material: "materialFields",
    asset: "assetFields"
  };
  const definitionName = definitionNames[operation.entity];
  if (!definitionName) return [];
  const sceneSchema = validators.schemas.get("https://protocol.editspace.dev/schemas/scene-fields-v1.schema.json");
  const errors = validators.validate(sceneSchema.$defs[definitionName], operation.fields ?? {}, sceneSchema.$id, "$.fields");
  if (errors.length > 0) return ["invalidOperation"];

  if (operation.entity === "mesh") {
    const positions = operation.fields?.positions;
    const faces = operation.fields?.faces;
    if (Array.isArray(positions) && Array.isArray(faces) && faces.some((face) => face.some((index) => index >= positions.length))) {
      return ["invalidOperation"];
    }
    for (const field of ["normals", "textureCoordinates", "colors"]) {
      if (Array.isArray(operation.fields?.[field]) && Array.isArray(positions) && operation.fields[field].length !== positions.length) {
        return ["invalidOperation"];
      }
    }
    if (Array.isArray(operation.fields?.materialIndices) && Array.isArray(faces) && operation.fields.materialIndices.length !== faces.length) {
      return ["invalidOperation"];
    }
  }
  return [];
}

function semanticProblems(validators, message) {
  if (message.kind !== "editspace.operations") return [];
  const problems = [];
  const operationsByID = new Map();
  for (const operation of message.ops) {
    if (operation.doc !== message.doc) problems.push("documentMismatch");
    if ((operation.v ?? 1) > 1) problems.push("unsupportedSchema");
    if (!coreActions.has(operation.action)) problems.push("unsupportedAction");
    if (!coreEntities.has(operation.entity)) problems.push("unsupportedEntity");
    if ((operation.features ?? []).some((feature) => !coreFeatures.has(feature))) problems.push("unsupportedFeature");
    problems.push(...sceneFieldProblems(validators, operation));
    const existing = operationsByID.get(operation.op);
    if (existing && !equal(normalizedOperation(existing), normalizedOperation(operation))) problems.push("operationIDCollision");
    if (!existing) operationsByID.set(operation.op, operation);
    if (["create", "update", "delete"].includes(operation.action) && operation.target === undefined) problems.push("invalidOperation");
    if (["duplicate", "link", "unlink"].includes(operation.action) && (operation.target === undefined || operation.source === undefined)) problems.push("invalidOperation");
  }
  return [...new Set(problems)];
}

function messageProblems(validators, value) {
  const schemaID = schemaIDForMessage(value);
  if (!schemaID) return ["invalidOperation", "unknown message kind"];
  const structural = validators.validate(validators.schemas.get(schemaID), value);
  return structural.length === 0 ? semanticProblems(validators, value) : ["invalidOperation", ...structural];
}

async function runProtocolTests() {
  const validators = await validatorSet();
  const manifest = await json(manifestPath);
  const ids = new Set();
  let count = 0;
  for (const entry of [...manifest.wireFixtures, ...manifest.vectors]) {
    if (ids.has(entry.id)) fail(`duplicate manifest ID: ${entry.id}`);
    ids.add(entry.id);
  }
  for (const fixture of manifest.wireFixtures) {
    const value = await json(resolve(root, fixture.path));
    const problems = messageProblems(validators, value);
    if (fixture.valid && problems.length > 0) fail(`${fixture.id}: expected valid, received ${problems.join("; ")}`);
    if (!fixture.valid && problems.length === 0) fail(`${fixture.id}: expected rejection`);
    if (!fixture.valid && !problems.includes(fixture.problem)) fail(`${fixture.id}: expected ${fixture.problem}, received ${problems.join("; ")}`);
    count += 1;
  }
  const vectorSchema = validators.schemas.get("https://protocol.editspace.dev/schemas/conformance-vector-v1.schema.json");
  for (const entry of manifest.vectors) {
    const vector = await json(resolve(root, entry.path));
    const errors = validators.validate(vectorSchema, vector);
    if (errors.length > 0) fail(`${entry.id}: invalid vector: ${errors.join("; ")}`);
    if (vector.id !== entry.id) fail(`${entry.id}: vector ID does not match manifest`);
    const problems = messageProblems(validators, vector.input);
    if (problems.length > 0) fail(`${entry.id}: invalid vector input: ${problems.join("; ")}`);
    count += 1;
  }
  console.log(`EditSpace protocol suite passed (${count} fixtures and vectors; ${validators.schemas.size} schemas).`);
}

async function validateFiles(paths) {
  if (paths.length === 0) fail("validate requires at least one JSON file");
  const validators = await validatorSet();
  let invalid = false;
  for (const path of paths) {
    const value = await json(resolve(process.cwd(), path));
    const problems = messageProblems(validators, value);
    if (problems.length === 0) console.log(`PASS ${path}`);
    else { invalid = true; console.error(`FAIL ${path}: ${problems.join("; ")}`); }
  }
  if (invalid) process.exitCode = 1;
}

async function checkReport(path) {
  if (!path) fail("conformance requires a report JSON file");
  const validators = await validatorSet();
  const report = await json(resolve(process.cwd(), path));
  const schema = validators.schemas.get("https://protocol.editspace.dev/schemas/conformance-report-v1.schema.json");
  const errors = validators.validate(schema, report);
  if (errors.length > 0) fail(`invalid conformance report: ${errors.join("; ")}`);
  const manifest = await json(manifestPath);
  const results = new Map();
  for (const result of report.results) {
    if (results.has(result.id)) fail(`duplicate conformance result: ${result.id}`);
    results.set(result.id, result);
  }
  const requiredFixtures = manifest.wireFixtures.filter((entry) => entry.required);
  const requiredVectors = manifest.vectors.filter((entry) => entry.required);
  for (const fixture of requiredFixtures) {
    const result = results.get(fixture.id);
    if (!result) fail(`missing required conformance result: ${fixture.id}`);
    if (result.accepted !== fixture.valid) {
      fail(`${fixture.id}: expected accepted=${fixture.valid}, received ${JSON.stringify(result.accepted)}`);
    }
    if (!fixture.valid && !(result.problems ?? []).includes(fixture.problem)) {
      fail(`${fixture.id}: expected problem ${fixture.problem}, received ${JSON.stringify(result.problems ?? [])}`);
    }
  }
  for (const entry of requiredVectors) {
    const result = results.get(entry.id);
    if (!result) fail(`missing required conformance result: ${entry.id}`);
    const vector = await json(resolve(root, entry.path));
    if (!equal(result.actual, vector.expected)) {
      fail(`${entry.id}: actual materialized state does not match the golden vector${result.diagnostics ? ` (${result.diagnostics})` : ""}`);
    }
  }
  const requiredCount = requiredFixtures.length + requiredVectors.length;
  console.log(`${report.implementation.name} ${report.implementation.version} conforms to EditSpace v1 (${requiredCount} required checks).`);
}

function usage() {
  console.log("Usage:\n  editspace-conformance test\n  editspace-conformance validate <message.json>...\n  editspace-conformance conformance <report.json>");
}

try {
  const [command, ...arguments_] = process.argv.slice(2);
  if (command === "test") await runProtocolTests();
  else if (command === "validate") await validateFiles(arguments_);
  else if (command === "conformance") await checkReport(arguments_[0]);
  else {
    usage();
    if (command && command !== "--help" && command !== "-h") process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
