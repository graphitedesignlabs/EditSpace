import { BaseAdapter } from './BaseAdapter.js';
import { GLTFModel } from '../formats/GLTFModel.js';
import { Operation, OperationType } from '../core/Operation.js';

/**
 * Adapter for Blender 3D software
 * Handles import/export between Blender's Python API format and GLTFModel
 */
export class BlenderAdapter extends BaseAdapter {
  constructor() {
    super('Blender');
  }

  /**
   * Import from Blender format to GLTFModel
   * Expected format: JSON representation of Blender objects
   */
  async importModel(blenderData) {
    const model = new GLTFModel();

    // Create default scene
    const sceneIndex = model.addScene('BlenderScene');

    // Process Blender objects
    if (blenderData.objects) {
      for (const obj of blenderData.objects) {
        await this.importBlenderObject(model, obj);
      }
    }

    return model;
  }

  /**
   * Import individual Blender object
   */
  async importBlenderObject(model, blenderObj) {
    const nodeIndex = model.addNode(blenderObj.name, {
      translation: blenderObj.location || [0, 0, 0],
      rotation: this.convertBlenderRotation(blenderObj.rotation_euler),
      scale: blenderObj.scale || [1, 1, 1]
    });

    // Handle mesh data
    if (blenderObj.type === 'MESH' && blenderObj.data) {
      const meshIndex = this.importBlenderMesh(model, blenderObj.data);
      model.nodes[nodeIndex].mesh = meshIndex;
    }

    // Handle camera
    if (blenderObj.type === 'CAMERA' && blenderObj.data) {
      const cameraIndex = this.importBlenderCamera(model, blenderObj.data);
      model.nodes[nodeIndex].camera = cameraIndex;
    }

    // Handle lights
    if (blenderObj.type === 'LIGHT' && blenderObj.data) {
      const lightIndex = this.importBlenderLight(model, blenderObj.data);
      // Note: lights would be added via extensions in real glTF
    }

    return nodeIndex;
  }

  /**
   * Import Blender mesh
   */
  importBlenderMesh(model, meshData) {
    const primitives = [];

    if (meshData.vertices && meshData.polygons) {
      primitives.push({
        attributes: {
          POSITION: meshData.vertices,
          NORMAL: meshData.normals || []
        },
        indices: meshData.polygons || [],
        material: meshData.material_index || 0
      });
    }

    return model.addMesh(meshData.name || 'Mesh', primitives);
  }

  /**
   * Import Blender camera
   */
  importBlenderCamera(model, cameraData) {
    const type = cameraData.type === 'PERSP' ? 'perspective' : 'orthographic';
    const properties = type === 'perspective' 
      ? { yfov: cameraData.angle || 0.785398, znear: cameraData.clip_start || 0.1, zfar: cameraData.clip_end || 100 }
      : { xmag: 1, ymag: 1, znear: cameraData.clip_start || 0.1, zfar: cameraData.clip_end || 100 };
    
    return model.addCamera(cameraData.name || 'Camera', type, properties);
  }

  /**
   * Import Blender light
   */
  importBlenderLight(model, lightData) {
    const typeMap = {
      'POINT': 'point',
      'SUN': 'directional',
      'SPOT': 'spot'
    };
    
    return model.addLight(
      lightData.name || 'Light',
      typeMap[lightData.type] || 'point',
      {
        color: lightData.color || [1, 1, 1],
        intensity: lightData.energy || 1
      }
    );
  }

  /**
   * Export GLTFModel to Blender format
   */
  async exportModel(gltfModel) {
    const blenderData = {
      objects: []
    };

    // Export nodes as Blender objects
    for (let i = 0; i < gltfModel.nodes.length; i++) {
      if (gltfModel.nodes[i] === null) continue;
      
      const node = gltfModel.nodes[i];
      const blenderObj = {
        name: node.name,
        location: node.translation || [0, 0, 0],
        rotation_euler: this.convertToBlenderRotation(node.rotation),
        scale: node.scale || [1, 1, 1],
        type: 'EMPTY'
      };

      // Add mesh reference
      if (node.mesh !== undefined && gltfModel.meshes[node.mesh]) {
        blenderObj.type = 'MESH';
        blenderObj.data = this.exportBlenderMesh(gltfModel.meshes[node.mesh]);
      }

      // Add camera reference
      if (node.camera !== undefined && gltfModel.cameras[node.camera]) {
        blenderObj.type = 'CAMERA';
        blenderObj.data = this.exportBlenderCamera(gltfModel.cameras[node.camera]);
      }

      blenderData.objects.push(blenderObj);
    }

    return blenderData;
  }

  /**
   * Export mesh to Blender format
   */
  exportBlenderMesh(mesh) {
    const meshData = {
      name: mesh.name,
      vertices: [],
      normals: [],
      polygons: [],
      material_index: 0
    };

    if (mesh.primitives && mesh.primitives.length > 0) {
      const primitive = mesh.primitives[0];
      meshData.vertices = primitive.attributes.POSITION || [];
      meshData.normals = primitive.attributes.NORMAL || [];
      meshData.polygons = primitive.indices || [];
      meshData.material_index = primitive.material || 0;
    }

    return meshData;
  }

  /**
   * Export camera to Blender format
   */
  exportBlenderCamera(camera) {
    return {
      name: camera.name,
      type: camera.type === 'perspective' ? 'PERSP' : 'ORTHO',
      angle: camera.perspective?.yfov || 0.785398,
      clip_start: camera.perspective?.znear || camera.orthographic?.znear || 0.1,
      clip_end: camera.perspective?.zfar || camera.orthographic?.zfar || 100
    };
  }

  /**
   * Convert Blender rotation (Euler) to quaternion
   */
  convertBlenderRotation(eulerRotation) {
    if (!eulerRotation) return [0, 0, 0, 1];
    
    // Simplified conversion (in production, use proper math library)
    const [x, y, z] = eulerRotation;
    return [0, 0, 0, 1]; // Placeholder - would need proper Euler to Quaternion conversion
  }

  /**
   * Convert quaternion to Blender rotation (Euler)
   */
  convertToBlenderRotation(quaternion) {
    if (!quaternion) return [0, 0, 0];
    
    // Simplified conversion (in production, use proper math library)
    return [0, 0, 0]; // Placeholder - would need proper Quaternion to Euler conversion
  }

  /**
   * Apply operations to Blender model
   */
  async applyOperations(blenderData, operations) {
    for (const op of operations) {
      await this.applyOperation(blenderData, op);
    }
    return blenderData;
  }

  /**
   * Apply single operation
   */
  async applyOperation(blenderData, operation) {
    const targetId = operation.data.targetId;

    switch (operation.type) {
      case OperationType.TRANSLATE:
        this.applyTranslate(blenderData, targetId, operation.data);
        break;
      case OperationType.ROTATE:
        this.applyRotate(blenderData, targetId, operation.data);
        break;
      case OperationType.SCALE:
        this.applyScale(blenderData, targetId, operation.data);
        break;
      case OperationType.ADD_MESH:
        this.addMesh(blenderData, operation.data);
        break;
      case OperationType.DELETE_MESH:
        this.deleteMesh(blenderData, targetId);
        break;
      // Add more operation handlers as needed
    }
  }

  applyTranslate(blenderData, targetId, data) {
    const obj = blenderData.objects.find(o => o.name === targetId);
    if (obj) {
      obj.location = [
        (obj.location[0] || 0) + (data.x || 0),
        (obj.location[1] || 0) + (data.y || 0),
        (obj.location[2] || 0) + (data.z || 0)
      ];
    }
  }

  applyRotate(blenderData, targetId, data) {
    const obj = blenderData.objects.find(o => o.name === targetId);
    if (obj) {
      // Update rotation (simplified)
      obj.rotation_euler = data.rotation || [0, 0, 0];
    }
  }

  applyScale(blenderData, targetId, data) {
    const obj = blenderData.objects.find(o => o.name === targetId);
    if (obj) {
      obj.scale = [
        (obj.scale[0] || 1) * (data.x || 1),
        (obj.scale[1] || 1) * (data.y || 1),
        (obj.scale[2] || 1) * (data.z || 1)
      ];
    }
  }

  addMesh(blenderData, data) {
    blenderData.objects.push({
      name: data.name || 'NewMesh',
      location: data.location || [0, 0, 0],
      rotation_euler: [0, 0, 0],
      scale: [1, 1, 1],
      type: 'MESH',
      data: data.meshData || {}
    });
  }

  deleteMesh(blenderData, targetId) {
    const index = blenderData.objects.findIndex(o => o.name === targetId);
    if (index !== -1) {
      blenderData.objects.splice(index, 1);
    }
  }

  /**
   * Extract operations from model changes
   */
  async extractOperations(oldModel, newModel) {
    const operations = [];
    
    // Compare objects and generate operations
    // This is a simplified version
    for (const newObj of newModel.objects) {
      const oldObj = oldModel.objects.find(o => o.name === newObj.name);
      
      if (!oldObj) {
        // Object was added
        operations.push(new Operation(OperationType.ADD_MESH, {
          targetId: newObj.name,
          name: newObj.name,
          location: newObj.location,
          meshData: newObj.data
        }));
      } else {
        // Check for transforms
        if (JSON.stringify(oldObj.location) !== JSON.stringify(newObj.location)) {
          operations.push(new Operation(OperationType.TRANSLATE, {
            targetId: newObj.name,
            x: newObj.location[0] - oldObj.location[0],
            y: newObj.location[1] - oldObj.location[1],
            z: newObj.location[2] - oldObj.location[2]
          }));
        }
      }
    }

    // Check for deleted objects
    for (const oldObj of oldModel.objects) {
      const exists = newModel.objects.find(o => o.name === oldObj.name);
      if (!exists) {
        operations.push(new Operation(OperationType.DELETE_MESH, {
          targetId: oldObj.name
        }));
      }
    }

    return operations;
  }
}
