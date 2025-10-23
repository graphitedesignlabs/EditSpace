/**
 * Generic 3D Model Format based on glTF 2.0 specification
 * Serves as the interchange format for operational transformation
 */
export class GLTFModel {
  constructor() {
    this.asset = {
      version: '2.0',
      generator: 'optransform3d'
    };
    this.scenes = [];
    this.nodes = [];
    this.meshes = [];
    this.materials = [];
    this.cameras = [];
    this.lights = [];
    this.accessors = [];
    this.bufferViews = [];
    this.buffers = [];
    this.scene = 0; // Default scene index
  }

  /**
   * Add a scene to the model
   */
  addScene(name, nodeIndices = []) {
    const scene = {
      name: name,
      nodes: nodeIndices
    };
    this.scenes.push(scene);
    return this.scenes.length - 1;
  }

  /**
   * Add a node to the model
   */
  addNode(name, options = {}) {
    const node = {
      name: name,
      ...options
    };
    
    // Add transform properties if provided
    if (options.translation) node.translation = options.translation;
    if (options.rotation) node.rotation = options.rotation;
    if (options.scale) node.scale = options.scale;
    if (options.matrix) node.matrix = options.matrix;
    if (options.mesh !== undefined) node.mesh = options.mesh;
    if (options.camera !== undefined) node.camera = options.camera;
    if (options.children) node.children = options.children;

    this.nodes.push(node);
    return this.nodes.length - 1;
  }

  /**
   * Add a mesh to the model
   */
  addMesh(name, primitives = []) {
    const mesh = {
      name: name,
      primitives: primitives
    };
    this.meshes.push(mesh);
    return this.meshes.length - 1;
  }

  /**
   * Add a material to the model
   */
  addMaterial(name, properties = {}) {
    const material = {
      name: name,
      pbrMetallicRoughness: properties.pbrMetallicRoughness || {},
      ...properties
    };
    this.materials.push(material);
    return this.materials.length - 1;
  }

  /**
   * Add a camera to the model
   */
  addCamera(name, type, properties) {
    const camera = {
      name: name,
      type: type, // 'perspective' or 'orthographic'
      [type]: properties
    };
    this.cameras.push(camera);
    return this.cameras.length - 1;
  }

  /**
   * Add a light to the model (KHR_lights_punctual extension)
   */
  addLight(name, type, properties = {}) {
    const light = {
      name: name,
      type: type, // 'directional', 'point', or 'spot'
      ...properties
    };
    this.lights.push(light);
    return this.lights.length - 1;
  }

  /**
   * Update node transform
   */
  updateNodeTransform(nodeIndex, transform) {
    if (nodeIndex < 0 || nodeIndex >= this.nodes.length) {
      throw new Error('Invalid node index');
    }
    
    const node = this.nodes[nodeIndex];
    if (transform.translation) node.translation = transform.translation;
    if (transform.rotation) node.rotation = transform.rotation;
    if (transform.scale) node.scale = transform.scale;
    if (transform.matrix) node.matrix = transform.matrix;
  }

  /**
   * Delete a node
   */
  deleteNode(nodeIndex) {
    if (nodeIndex < 0 || nodeIndex >= this.nodes.length) {
      throw new Error('Invalid node index');
    }
    
    // Mark as deleted (in production, you'd handle this more carefully)
    this.nodes[nodeIndex] = null;
  }

  /**
   * Delete a mesh
   */
  deleteMesh(meshIndex) {
    if (meshIndex < 0 || meshIndex >= this.meshes.length) {
      throw new Error('Invalid mesh index');
    }
    
    this.meshes[meshIndex] = null;
  }

  /**
   * Export to glTF JSON format
   */
  toJSON() {
    return {
      asset: this.asset,
      scene: this.scene,
      scenes: this.scenes.filter(s => s !== null),
      nodes: this.nodes.filter(n => n !== null),
      meshes: this.meshes.filter(m => m !== null),
      materials: this.materials.filter(m => m !== null),
      cameras: this.cameras.filter(c => c !== null),
      lights: this.lights.filter(l => l !== null),
      accessors: this.accessors.filter(a => a !== null),
      bufferViews: this.bufferViews.filter(b => b !== null),
      buffers: this.buffers.filter(b => b !== null)
    };
  }

  /**
   * Import from glTF JSON format
   */
  static fromJSON(json) {
    const model = new GLTFModel();
    model.asset = json.asset || model.asset;
    model.scene = json.scene || 0;
    model.scenes = json.scenes || [];
    model.nodes = json.nodes || [];
    model.meshes = json.meshes || [];
    model.materials = json.materials || [];
    model.cameras = json.cameras || [];
    model.lights = json.lights || [];
    model.accessors = json.accessors || [];
    model.bufferViews = json.bufferViews || [];
    model.buffers = json.buffers || [];
    return model;
  }
}
