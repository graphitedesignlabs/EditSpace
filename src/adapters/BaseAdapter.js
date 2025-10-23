/**
 * Base Adapter class for platform-specific 3D model I/O
 */
export class BaseAdapter {
  constructor(name) {
    this.name = name;
  }

  /**
   * Import from platform-specific format to GLTFModel
   * @param {*} nativeModel - Platform-specific model data
   * @returns {GLTFModel}
   */
  async importModel(nativeModel) {
    throw new Error('importModel must be implemented by subclass');
  }

  /**
   * Export from GLTFModel to platform-specific format
   * @param {GLTFModel} gltfModel
   * @returns {*} Platform-specific model data
   */
  async exportModel(gltfModel) {
    throw new Error('exportModel must be implemented by subclass');
  }

  /**
   * Apply operations to a native model
   * @param {*} nativeModel - Platform-specific model
   * @param {Operation[]} operations - Array of operations to apply
   * @returns {*} Updated platform-specific model
   */
  async applyOperations(nativeModel, operations) {
    throw new Error('applyOperations must be implemented by subclass');
  }

  /**
   * Extract operations from model changes
   * @param {*} oldModel - Previous platform-specific model
   * @param {*} newModel - Updated platform-specific model
   * @returns {Operation[]} Array of operations
   */
  async extractOperations(oldModel, newModel) {
    throw new Error('extractOperations must be implemented by subclass');
  }

  /**
   * Validate model format
   */
  validateModel(model) {
    return true;
  }
}
