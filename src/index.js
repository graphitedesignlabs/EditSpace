/**
 * OpTransform3D - Operational Transformation for Collaborative 3D Model Editing
 * Main entry point
 */

// Core components
export { Operation, OperationType } from './core/Operation.js';
export { OTEngine } from './core/OTEngine.js';

// Format
export { GLTFModel } from './formats/GLTFModel.js';

// Adapters
export { BaseAdapter } from './adapters/BaseAdapter.js';
export { BlenderAdapter } from './adapters/BlenderAdapter.js';
export { SceneKitAdapter } from './adapters/SceneKitAdapter.js';
export { RealityKitAdapter } from './adapters/RealityKitAdapter.js';
export { SketchUpAdapter } from './adapters/SketchUpAdapter.js';
export { ARCoreAdapter } from './adapters/ARCoreAdapter.js';

// Import OTEngine for CollaborativeSession
import { OTEngine } from './core/OTEngine.js';

/**
 * Create a collaborative session
 */
export class CollaborativeSession {
  constructor(adapter) {
    this.adapter = adapter;
    this.engine = new OTEngine();
    this.model = null;
    this.localOperations = []; // Track operations we generated
  }

  /**
   * Initialize session with a model
   */
  async initialize(nativeModel) {
    this.model = await this.adapter.importModel(nativeModel);
    return this.model;
  }

  /**
   * Apply local operations
   */
  async applyLocalOperations(operations) {
    for (const op of operations) {
      this.engine.apply(op);
      this.localOperations.push(op);
    }
    
    // Apply to the GLTF model
    await this.applyOperationsToModel(operations);
  }

  /**
   * Transform and apply remote operations
   */
  async applyRemoteOperations(remoteOps) {
    const transformedOps = [];
    
    for (const remoteOp of remoteOps) {
      let transformedOp = remoteOp;
      
      // Transform against all local operations we haven't yet synced
      for (const localOp of this.localOperations) {
        const result = this.engine.transform(transformedOp, localOp);
        transformedOp = result.op1Prime;
      }
      
      // Don't apply NO_OP operations
      if (transformedOp.type !== 'NO_OP') {
        this.engine.apply(transformedOp);
        transformedOps.push(transformedOp);
      }
    }
    
    // Apply to the GLTF model
    await this.applyOperationsToModel(transformedOps);
  }

  /**
   * Acknowledge that pending operations have been sent
   * Call this after successfully sending operations to remote users
   */
  acknowledgePendingOperations() {
    this.localOperations = [];
  }

  /**
   * Apply operations to the model
   */
  async applyOperationsToModel(operations) {
    for (const op of operations) {
      this.applyOperationToGLTF(op);
    }
  }

  /**
   * Apply a single operation to the GLTF model
   */
  applyOperationToGLTF(operation) {
    const targetId = operation.data.targetId;
    
    // Find the node by name
    const node = this.model.nodes.find(n => n && n.name === targetId);
    if (!node) return;

    switch (operation.type) {
      case 'TRANSLATE':
        if (!node.translation) node.translation = [0, 0, 0];
        node.translation[0] += operation.data.x || 0;
        node.translation[1] += operation.data.y || 0;
        node.translation[2] += operation.data.z || 0;
        break;
      
      case 'SCALE':
        if (!node.scale) node.scale = [1, 1, 1];
        node.scale[0] *= operation.data.x || 1;
        node.scale[1] *= operation.data.y || 1;
        node.scale[2] *= operation.data.z || 1;
        break;
      
      case 'ROTATE':
        if (operation.data.rotation) {
          node.rotation = operation.data.rotation;
        }
        break;
    }
  }

  /**
   * Get current model state
   */
  async getModel() {
    return this.model;
  }

  /**
   * Get native format
   */
  async getNativeModel() {
    return await this.adapter.exportModel(this.model);
  }

  /**
   * Get pending operations to send to remote users
   * Returns a copy of local operations
   * Note: Call acknowledgePendingOperations() after successfully sending
   */
  getPendingOperations() {
    return [...this.localOperations];
  }
}
