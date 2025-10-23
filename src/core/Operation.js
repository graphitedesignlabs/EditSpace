/**
 * Base operation class for 3D model transformations
 */
export class Operation {
  constructor(type, data, timestamp = Date.now()) {
    this.type = type;
    this.data = data;
    this.timestamp = timestamp;
    this.id = this.generateId();
  }

  generateId() {
    return `${this.timestamp}-${Math.random().toString(36).substr(2, 9)}`;
  }

  toJSON() {
    return {
      type: this.type,
      data: this.data,
      timestamp: this.timestamp,
      id: this.id
    };
  }

  static fromJSON(json) {
    const op = new Operation(json.type, json.data, json.timestamp);
    op.id = json.id;
    return op;
  }
}

/**
 * Operation types for 3D model editing
 */
export const OperationType = {
  // Mesh operations
  ADD_MESH: 'ADD_MESH',
  DELETE_MESH: 'DELETE_MESH',
  UPDATE_MESH: 'UPDATE_MESH',
  
  // Transform operations
  TRANSLATE: 'TRANSLATE',
  ROTATE: 'ROTATE',
  SCALE: 'SCALE',
  
  // Vertex operations
  ADD_VERTEX: 'ADD_VERTEX',
  DELETE_VERTEX: 'DELETE_VERTEX',
  MOVE_VERTEX: 'MOVE_VERTEX',
  
  // Material operations
  ADD_MATERIAL: 'ADD_MATERIAL',
  DELETE_MATERIAL: 'DELETE_MATERIAL',
  UPDATE_MATERIAL: 'UPDATE_MATERIAL',
  
  // Scene operations
  ADD_NODE: 'ADD_NODE',
  DELETE_NODE: 'DELETE_NODE',
  UPDATE_NODE: 'UPDATE_NODE',
  
  // Light operations
  ADD_LIGHT: 'ADD_LIGHT',
  DELETE_LIGHT: 'DELETE_LIGHT',
  UPDATE_LIGHT: 'UPDATE_LIGHT',
  
  // Camera operations
  ADD_CAMERA: 'ADD_CAMERA',
  DELETE_CAMERA: 'DELETE_CAMERA',
  UPDATE_CAMERA: 'UPDATE_CAMERA'
};
