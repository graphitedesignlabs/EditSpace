import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Operation, OperationType } from '../src/core/Operation.js';
import { OTEngine } from '../src/core/OTEngine.js';

describe('Operation', () => {
  it('should create an operation with type and data', () => {
    const op = new Operation(OperationType.TRANSLATE, {
      targetId: 'cube1',
      x: 1,
      y: 2,
      z: 3
    });

    assert.strictEqual(op.type, OperationType.TRANSLATE);
    assert.strictEqual(op.data.targetId, 'cube1');
    assert.strictEqual(op.data.x, 1);
    assert.ok(op.id);
  });

  it('should serialize and deserialize operations', () => {
    const op = new Operation(OperationType.ADD_MESH, {
      targetId: 'mesh1',
      name: 'NewMesh'
    });

    const json = op.toJSON();
    const restored = Operation.fromJSON(json);

    assert.strictEqual(restored.type, op.type);
    assert.strictEqual(restored.data.targetId, op.data.targetId);
    assert.strictEqual(restored.id, op.id);
  });
});

describe('OTEngine', () => {
  it('should initialize with empty operations', () => {
    const engine = new OTEngine();
    assert.strictEqual(engine.getVersion(), 0);
    assert.strictEqual(engine.operations.length, 0);
  });

  it('should apply operations and increment version', () => {
    const engine = new OTEngine();
    const op = new Operation(OperationType.TRANSLATE, { targetId: 'obj1', x: 1 });

    const version = engine.apply(op);

    assert.strictEqual(version, 1);
    assert.strictEqual(engine.getVersion(), 1);
    assert.strictEqual(engine.operations.length, 1);
  });

  it('should get operations since a version', () => {
    const engine = new OTEngine();
    const op1 = new Operation(OperationType.TRANSLATE, { targetId: 'obj1', x: 1 });
    const op2 = new Operation(OperationType.SCALE, { targetId: 'obj2', x: 2 });

    engine.apply(op1);
    engine.apply(op2);

    const ops = engine.getOperationsSince(1);
    assert.strictEqual(ops.length, 1);
    assert.strictEqual(ops[0].type, OperationType.SCALE);
  });

  it('should detect conflicts between operations on same target', () => {
    const engine = new OTEngine();
    const op1 = new Operation(OperationType.TRANSLATE, { targetId: 'obj1', x: 1 });
    const op2 = new Operation(OperationType.SCALE, { targetId: 'obj1', x: 2 });

    assert.ok(engine.conflictsWith(op1, op2));
  });

  it('should not detect conflicts on different targets', () => {
    const engine = new OTEngine();
    const op1 = new Operation(OperationType.TRANSLATE, { targetId: 'obj1', x: 1 });
    const op2 = new Operation(OperationType.TRANSLATE, { targetId: 'obj2', x: 2 });

    assert.ok(!engine.conflictsWith(op1, op2));
  });

  it('should transform operations correctly', () => {
    const engine = new OTEngine();
    const op1 = new Operation(OperationType.TRANSLATE, {
      targetId: 'obj1',
      x: 1,
      y: 0,
      z: 0
    });
    const op2 = new Operation(OperationType.TRANSLATE, {
      targetId: 'obj1',
      x: 0,
      y: 2,
      z: 0
    });

    const result = engine.transform(op1, op2);

    assert.ok(result.op1Prime);
    assert.ok(result.op2Prime);
  });

  it('should handle commutative transform operations', () => {
    const engine = new OTEngine();
    const op1 = new Operation(OperationType.TRANSLATE, {
      targetId: 'obj1',
      x: 2,
      y: 0,
      z: 0
    });
    const op2 = new Operation(OperationType.TRANSLATE, {
      targetId: 'obj1',
      x: 0,
      y: 3,
      z: 0
    });

    // Transform op1 against op2 - should return op1 unchanged
    const transformed = engine.transformOperation(op1, op2);

    assert.strictEqual(transformed.data.x, 2);
    assert.strictEqual(transformed.data.y, 0);
    assert.strictEqual(transformed.data.z, 0);
  });

  it('should preserve operations when transforming', () => {
    const engine = new OTEngine();
    const op1 = new Operation(OperationType.SCALE, {
      targetId: 'obj1',
      x: 2,
      y: 2,
      z: 2
    });
    const op2 = new Operation(OperationType.TRANSLATE, {
      targetId: 'obj1',
      x: 5,
      y: 0,
      z: 0
    });

    // Different operation types on same object - both should apply
    const result = engine.transform(op1, op2);

    assert.strictEqual(result.op1Prime.type, OperationType.SCALE);
    assert.strictEqual(result.op2Prime.type, OperationType.TRANSLATE);
  });

  it('should handle delete operations', () => {
    const engine = new OTEngine();
    const deleteOp = new Operation(OperationType.DELETE_MESH, { targetId: 'obj1' });
    const translateOp = new Operation(OperationType.TRANSLATE, {
      targetId: 'obj1',
      x: 1
    });

    const transformed = engine.transformOperation(translateOp, deleteOp);

    assert.strictEqual(transformed.type, 'NO_OP');
  });
});
