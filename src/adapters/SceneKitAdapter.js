import { BaseAdapter } from './BaseAdapter.js';
import { GLTFModel } from '../formats/GLTFModel.js';
import { Operation, OperationType } from '../core/Operation.js';

/**
 * Adapter for Apple SceneKit/ARKit
 * Handles import/export between SceneKit's format and GLTFModel
 */
export class SceneKitAdapter extends BaseAdapter {
  constructor() {
    super('SceneKit/ARKit');
  }

  /**
   * Import from SceneKit format to GLTFModel
   * Expected format: JSON representation of SCNScene structure
   */
  async importModel(sceneKitData) {
    const model = new GLTFModel();

    // Create scene
    const sceneIndex = model.addScene(sceneKitData.name || 'SceneKitScene');

    // Process SceneKit nodes
    if (sceneKitData.rootNode) {
      await this.importSceneKitNode(model, sceneKitData.rootNode);
    }

    return model;
  }

  /**
   * Import SceneKit node recursively
   */
  async importSceneKitNode(model, scnNode) {
    const nodeOptions = {};

    // Transform
    if (scnNode.position) {
      nodeOptions.translation = [
        scnNode.position.x || 0,
        scnNode.position.y || 0,
        scnNode.position.z || 0
      ];
    }

    if (scnNode.rotation) {
      nodeOptions.rotation = [
        scnNode.rotation.x || 0,
        scnNode.rotation.y || 0,
        scnNode.rotation.z || 0,
        scnNode.rotation.w || 1
      ];
    }

    if (scnNode.scale) {
      nodeOptions.scale = [
        scnNode.scale.x || 1,
        scnNode.scale.y || 1,
        scnNode.scale.z || 1
      ];
    }

    // Handle geometry
    if (scnNode.geometry) {
      const meshIndex = this.importSceneKitGeometry(model, scnNode.geometry);
      nodeOptions.mesh = meshIndex;
    }

    // Handle camera
    if (scnNode.camera) {
      const cameraIndex = this.importSceneKitCamera(model, scnNode.camera);
      nodeOptions.camera = cameraIndex;
    }

    // Handle light
    if (scnNode.light) {
      const lightIndex = this.importSceneKitLight(model, scnNode.light);
    }

    const nodeIndex = model.addNode(scnNode.name || 'Node', nodeOptions);

    // Process child nodes
    if (scnNode.childNodes && scnNode.childNodes.length > 0) {
      const childIndices = [];
      for (const child of scnNode.childNodes) {
        const childIndex = await this.importSceneKitNode(model, child);
        childIndices.push(childIndex);
      }
      model.nodes[nodeIndex].children = childIndices;
    }

    return nodeIndex;
  }

  /**
   * Import SceneKit geometry
   */
  importSceneKitGeometry(model, geometry) {
    const primitives = [{
      attributes: {
        POSITION: geometry.vertices || [],
        NORMAL: geometry.normals || [],
        TEXCOORD_0: geometry.textureCoordinates || []
      },
      indices: geometry.indices || [],
      material: geometry.materialIndex || 0
    }];

    return model.addMesh(geometry.name || 'Geometry', primitives);
  }

  /**
   * Import SceneKit camera
   */
  importSceneKitCamera(model, camera) {
    const type = camera.usesOrthographicProjection ? 'orthographic' : 'perspective';
    const properties = type === 'perspective'
      ? {
          yfov: camera.fieldOfView ? camera.fieldOfView * Math.PI / 180 : 0.785398,
          znear: camera.zNear || 0.1,
          zfar: camera.zFar || 100
        }
      : {
          xmag: camera.orthographicScale || 1,
          ymag: camera.orthographicScale || 1,
          znear: camera.zNear || 0.1,
          zfar: camera.zFar || 100
        };

    return model.addCamera(camera.name || 'Camera', type, properties);
  }

  /**
   * Import SceneKit light
   */
  importSceneKitLight(model, light) {
    const typeMap = {
      'omni': 'point',
      'directional': 'directional',
      'spot': 'spot',
      'ambient': 'point'
    };

    return model.addLight(
      light.name || 'Light',
      typeMap[light.type] || 'point',
      {
        color: light.color ? [light.color.r || 1, light.color.g || 1, light.color.b || 1] : [1, 1, 1],
        intensity: light.intensity || 1000
      }
    );
  }

  /**
   * Export GLTFModel to SceneKit format
   */
  async exportModel(gltfModel) {
    const sceneKitData = {
      name: 'Scene',
      rootNode: {
        name: 'Root',
        childNodes: []
      }
    };

    // Export nodes
    for (let i = 0; i < gltfModel.nodes.length; i++) {
      if (gltfModel.nodes[i] === null) continue;
      
      const node = gltfModel.nodes[i];
      const scnNode = await this.exportSceneKitNode(gltfModel, node, i);
      sceneKitData.rootNode.childNodes.push(scnNode);
    }

    return sceneKitData;
  }

  /**
   * Export node to SceneKit format
   */
  async exportSceneKitNode(gltfModel, node, nodeIndex) {
    const scnNode = {
      name: node.name
    };

    // Transform
    if (node.translation) {
      scnNode.position = {
        x: node.translation[0],
        y: node.translation[1],
        z: node.translation[2]
      };
    }

    if (node.rotation) {
      scnNode.rotation = {
        x: node.rotation[0],
        y: node.rotation[1],
        z: node.rotation[2],
        w: node.rotation[3]
      };
    }

    if (node.scale) {
      scnNode.scale = {
        x: node.scale[0],
        y: node.scale[1],
        z: node.scale[2]
      };
    }

    // Geometry
    if (node.mesh !== undefined && gltfModel.meshes[node.mesh]) {
      scnNode.geometry = this.exportSceneKitGeometry(gltfModel.meshes[node.mesh]);
    }

    // Camera
    if (node.camera !== undefined && gltfModel.cameras[node.camera]) {
      scnNode.camera = this.exportSceneKitCamera(gltfModel.cameras[node.camera]);
    }

    // Children
    if (node.children && node.children.length > 0) {
      scnNode.childNodes = [];
      for (const childIndex of node.children) {
        const childNode = await this.exportSceneKitNode(gltfModel, gltfModel.nodes[childIndex], childIndex);
        scnNode.childNodes.push(childNode);
      }
    }

    return scnNode;
  }

  /**
   * Export geometry to SceneKit format
   */
  exportSceneKitGeometry(mesh) {
    const geometry = {
      name: mesh.name
    };

    if (mesh.primitives && mesh.primitives.length > 0) {
      const primitive = mesh.primitives[0];
      geometry.vertices = primitive.attributes.POSITION || [];
      geometry.normals = primitive.attributes.NORMAL || [];
      geometry.textureCoordinates = primitive.attributes.TEXCOORD_0 || [];
      geometry.indices = primitive.indices || [];
      geometry.materialIndex = primitive.material || 0;
    }

    return geometry;
  }

  /**
   * Export camera to SceneKit format
   */
  exportSceneKitCamera(camera) {
    return {
      name: camera.name,
      usesOrthographicProjection: camera.type === 'orthographic',
      fieldOfView: camera.perspective ? camera.perspective.yfov * 180 / Math.PI : 60,
      orthographicScale: camera.orthographic ? camera.orthographic.xmag : 1,
      zNear: camera.perspective?.znear || camera.orthographic?.znear || 0.1,
      zFar: camera.perspective?.zfar || camera.orthographic?.zfar || 100
    };
  }

  /**
   * Apply operations to SceneKit model
   */
  async applyOperations(sceneKitData, operations) {
    for (const op of operations) {
      await this.applyOperation(sceneKitData, op);
    }
    return sceneKitData;
  }

  /**
   * Apply single operation
   */
  async applyOperation(sceneKitData, operation) {
    const targetId = operation.data.targetId;

    switch (operation.type) {
      case OperationType.TRANSLATE:
        this.applyTranslate(sceneKitData.rootNode, targetId, operation.data);
        break;
      case OperationType.ROTATE:
        this.applyRotate(sceneKitData.rootNode, targetId, operation.data);
        break;
      case OperationType.SCALE:
        this.applyScale(sceneKitData.rootNode, targetId, operation.data);
        break;
      // Add more operation handlers
    }
  }

  findNodeByName(node, name) {
    if (node.name === name) return node;
    
    if (node.childNodes) {
      for (const child of node.childNodes) {
        const found = this.findNodeByName(child, name);
        if (found) return found;
      }
    }
    
    return null;
  }

  applyTranslate(rootNode, targetId, data) {
    const node = this.findNodeByName(rootNode, targetId);
    if (node && node.position) {
      node.position.x = (node.position.x || 0) + (data.x || 0);
      node.position.y = (node.position.y || 0) + (data.y || 0);
      node.position.z = (node.position.z || 0) + (data.z || 0);
    }
  }

  applyRotate(rootNode, targetId, data) {
    const node = this.findNodeByName(rootNode, targetId);
    if (node) {
      node.rotation = data.rotation || { x: 0, y: 0, z: 0, w: 1 };
    }
  }

  applyScale(rootNode, targetId, data) {
    const node = this.findNodeByName(rootNode, targetId);
    if (node && node.scale) {
      node.scale.x = (node.scale.x || 1) * (data.x || 1);
      node.scale.y = (node.scale.y || 1) * (data.y || 1);
      node.scale.z = (node.scale.z || 1) * (data.z || 1);
    }
  }

  /**
   * Extract operations from model changes
   */
  async extractOperations(oldModel, newModel) {
    const operations = [];
    
    // Simplified extraction - compare node trees
    this.compareNodes(oldModel.rootNode, newModel.rootNode, operations);
    
    return operations;
  }

  compareNodes(oldNode, newNode, operations) {
    if (!oldNode || !newNode) return;

    // Check position changes
    if (oldNode.position && newNode.position) {
      if (oldNode.position.x !== newNode.position.x ||
          oldNode.position.y !== newNode.position.y ||
          oldNode.position.z !== newNode.position.z) {
        operations.push(new Operation(OperationType.TRANSLATE, {
          targetId: newNode.name,
          x: newNode.position.x - oldNode.position.x,
          y: newNode.position.y - oldNode.position.y,
          z: newNode.position.z - oldNode.position.z
        }));
      }
    }

    // Recurse to children
    if (oldNode.childNodes && newNode.childNodes) {
      for (let i = 0; i < Math.min(oldNode.childNodes.length, newNode.childNodes.length); i++) {
        this.compareNodes(oldNode.childNodes[i], newNode.childNodes[i], operations);
      }
    }
  }
}
