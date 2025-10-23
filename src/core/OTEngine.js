import { Operation, OperationType } from './Operation.js';

/**
 * Operational Transformation Engine for 3D models
 * Handles conflict resolution and operation transformation
 */
export class OTEngine {
  constructor() {
    this.operations = [];
    this.version = 0;
  }

  /**
   * Transform two concurrent operations
   * @param {Operation} op1 - First operation
   * @param {Operation} op2 - Second operation
   * @returns {Object} - Transformed operations {op1Prime, op2Prime}
   */
  transform(op1, op2) {
    // If operations don't conflict, return as-is
    if (!this.conflictsWith(op1, op2)) {
      return { op1Prime: op1, op2Prime: op2 };
    }

    // Handle specific transformation cases
    const op1Prime = this.transformOperation(op1, op2);
    const op2Prime = this.transformOperation(op2, op1);

    return { op1Prime, op2Prime };
  }

  /**
   * Check if two operations conflict
   */
  conflictsWith(op1, op2) {
    // Same target object
    if (op1.data.targetId === op2.data.targetId) {
      return true;
    }

    // Delete operations conflict with any operation on the same object
    if ((op1.type.includes('DELETE') || op2.type.includes('DELETE')) &&
        op1.data.targetId === op2.data.targetId) {
      return true;
    }

    return false;
  }

  /**
   * Transform an operation against another
   * For 3D transforms, concurrent operations on the same object can both apply
   * The key is they're commutative: translate(x+2) then translate(y+3) = translate(y+3) then translate(x+2)
   */
  transformOperation(op, against) {
    const transformed = new Operation(op.type, { ...op.data }, op.timestamp);
    transformed.id = op.id;

    // Handle delete operations
    if (against.type.includes('DELETE') && op.data.targetId === against.data.targetId) {
      // If the target is deleted, this operation becomes a no-op
      transformed.type = 'NO_OP';
      return transformed;
    }

    // For transform operations on the same object, they're commutative
    // So no transformation needed - both operations can apply as-is
    // This is a key property of 3D geometric transforms

    return transformed;
  }

  /**
   * Check if operations are transform operations
   */
  areTransformOps(type1, type2) {
    const transformOps = [OperationType.TRANSLATE, OperationType.ROTATE, OperationType.SCALE];
    return transformOps.includes(type1) && transformOps.includes(type2);
  }

  /**
   * Compose transform operations
   * For OT, we DON'T compose - each operation should apply independently
   * This method is not used in the current transform logic
   */
  composeTransforms(op1, op2) {
    // Keep op1 as-is since both operations should apply independently
    return op1.data;
  }

  /**
   * Apply an operation to the operation history
   */
  apply(operation) {
    this.operations.push(operation);
    this.version++;
    return this.version;
  }

  /**
   * Get operations since a specific version
   */
  getOperationsSince(version) {
    return this.operations.slice(version);
  }

  /**
   * Get current version
   */
  getVersion() {
    return this.version;
  }

  /**
   * Clear operation history
   */
  clear() {
    this.operations = [];
    this.version = 0;
  }
}
