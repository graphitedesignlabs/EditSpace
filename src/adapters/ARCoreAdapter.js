import { BaseAdapter } from './BaseAdapter.js';
import { GLTFModel } from '../formats/GLTFModel.js';
import { Operation, OperationType } from '../core/Operation.js';

/**
 * Adapter for Google ARCore
 * Handles import/export between ARCore's Sceneform format and GLTFModel
 */
export class ARCoreAdapter extends BaseAdapter {
  constructor() {
    super('ARCore');
  }

  /**
   * Import from ARCore format to GLTFModel
   * Expected format: JSON representation of ARCore Scene/Sceneform structure
   */
  async importModel(arCoreData) {
    const model = new GLTFModel();

    // Create scene
    const sceneIndex = model.addScene(arCoreData.name || 'ARCoreScene');

    // Process scene nodes
    if (arCoreData.nodes) {
      for (const node of arCoreData.nodes) {
        await this.importARCoreNode(model, node);
      }
    }

    return model;
  }

  /**
   * Import ARCore node
   */
  async importARCoreNode(model, arNode) {
    const nodeOptions = {};

    // Transform - ARCore uses local position, rotation, scale
    if (arNode.localPosition) {
      nodeOptions.translation = [
        arNode.localPosition.x || 0,
        arNode.localPosition.y || 0,
        arNode.localPosition.z || 0
      ];
    }

    if (arNode.localRotation) {
      nodeOptions.rotation = [
        arNode.localRotation.x || 0,
        arNode.localRotation.y || 0,
        arNode.localRotation.z || 0,
        arNode.localRotation.w || 1
      ];
    }

    if (arNode.localScale) {
      nodeOptions.scale = [
        arNode.localScale.x || 1,
        arNode.localScale.y || 1,
        arNode.localScale.z || 1
      ];
    }

    // Handle renderable (mesh)
    if (arNode.renderable) {
      const meshIndex = this.importARCoreRenderable(model, arNode.renderable);
      nodeOptions.mesh = meshIndex;
    }

    // Handle camera
    if (arNode.camera) {
      const cameraIndex = this.importARCoreCamera(model, arNode.camera);
      nodeOptions.camera = cameraIndex;
    }

    // Handle light
    if (arNode.light) {
      const lightIndex = this.importARCoreLight(model, arNode.light);
    }

    const nodeIndex = model.addNode(arNode.name || 'Node', nodeOptions);

    // Process child nodes
    if (arNode.children && arNode.children.length > 0) {
      const childIndices = [];
      for (const child of arNode.children) {
        const childIndex = await this.importARCoreNode(model, child);
        childIndices.push(childIndex);
      }
      model.nodes[nodeIndex].children = childIndices;
    }

    return nodeIndex;
  }

  /**
   * Import ARCore renderable
   */
  importARCoreRenderable(model, renderable) {
    const primitives = [];

    if (renderable.submeshes) {
      for (const submesh of renderable.submeshes) {
        primitives.push({
          attributes: {
            POSITION: submesh.vertices?.positions || [],
            NORMAL: submesh.vertices?.normals || [],
            TEXCOORD_0: submesh.vertices?.uvs || []
          },
          indices: submesh.indices || [],
          material: submesh.materialIndex || 0
        });
      }
    }

    return model.addMesh(renderable.name || 'Renderable', primitives);
  }

  /**
   * Import ARCore camera
   */
  importARCoreCamera(model, camera) {
    // ARCore typically uses perspective projection
    const properties = {
      yfov: camera.verticalFov ? camera.verticalFov * Math.PI / 180 : 0.785398,
      znear: camera.nearClipPlane || 0.1,
      zfar: camera.farClipPlane || 100
    };

    return model.addCamera(camera.name || 'Camera', 'perspective', properties);
  }

  /**
   * Import ARCore light
   */
  importARCoreLight(model, light) {
    const typeMap = {
      'POINT': 'point',
      'DIRECTIONAL': 'directional',
      'SPOTLIGHT': 'spot'
    };

    return model.addLight(
      light.name || 'Light',
      typeMap[light.type] || 'point',
      {
        color: light.color ? [light.color.r || 1, light.color.g || 1, light.color.b || 1] : [1, 1, 1],
        intensity: light.intensity || 1
      }
    );
  }

  /**
   * Export GLTFModel to ARCore format
   */
  async exportModel(gltfModel) {
    const arCoreData = {
      name: 'Scene',
      nodes: []
    };

    // Export nodes
    for (let i = 0; i < gltfModel.nodes.length; i++) {
      if (gltfModel.nodes[i] === null) continue;
      
      const node = gltfModel.nodes[i];
      const arNode = await this.exportARCoreNode(gltfModel, node, i);
      arCoreData.nodes.push(arNode);
    }

    return arCoreData;
  }

  /**
   * Export node to ARCore format
   */
  async exportARCoreNode(gltfModel, node, nodeIndex) {
    const arNode = {
      name: node.name
    };

    // Transform
    if (node.translation) {
      arNode.localPosition = {
        x: node.translation[0],
        y: node.translation[1],
        z: node.translation[2]
      };
    }

    if (node.rotation) {
      arNode.localRotation = {
        x: node.rotation[0],
        y: node.rotation[1],
        z: node.rotation[2],
        w: node.rotation[3]
      };
    }

    if (node.scale) {
      arNode.localScale = {
        x: node.scale[0],
        y: node.scale[1],
        z: node.scale[2]
      };
    }

    // Renderable
    if (node.mesh !== undefined && gltfModel.meshes[node.mesh]) {
      arNode.renderable = this.exportARCoreRenderable(gltfModel.meshes[node.mesh]);
    }

    // Camera
    if (node.camera !== undefined && gltfModel.cameras[node.camera]) {
      arNode.camera = this.exportARCoreCamera(gltfModel.cameras[node.camera]);
    }

    // Children
    if (node.children && node.children.length > 0) {
      arNode.children = [];
      for (const childIndex of node.children) {
        const childNode = await this.exportARCoreNode(gltfModel, gltfModel.nodes[childIndex], childIndex);
        arNode.children.push(childNode);
      }
    }

    return arNode;
  }

  /**
   * Export mesh to ARCore renderable
   */
  exportARCoreRenderable(mesh) {
    const renderable = {
      name: mesh.name,
      submeshes: []
    };

    if (mesh.primitives && mesh.primitives.length > 0) {
      for (const primitive of mesh.primitives) {
        renderable.submeshes.push({
          vertices: {
            positions: primitive.attributes.POSITION || [],
            normals: primitive.attributes.NORMAL || [],
            uvs: primitive.attributes.TEXCOORD_0 || []
          },
          indices: primitive.indices || [],
          materialIndex: primitive.material || 0
        });
      }
    }

    return renderable;
  }

  /**
   * Export camera to ARCore format
   */
  exportARCoreCamera(camera) {
    return {
      name: camera.name,
      verticalFov: camera.perspective ? camera.perspective.yfov * 180 / Math.PI : 60,
      nearClipPlane: camera.perspective?.znear || camera.orthographic?.znear || 0.1,
      farClipPlane: camera.perspective?.zfar || camera.orthographic?.zfar || 100
    };
  }

  /**
   * Apply operations to ARCore model
   */
  async applyOperations(arCoreData, operations) {
    for (const op of operations) {
      await this.applyOperation(arCoreData, op);
    }
    return arCoreData;
  }

  /**
   * Apply single operation
   */
  async applyOperation(arCoreData, operation) {
    const targetId = operation.data.targetId;

    switch (operation.type) {
      case OperationType.TRANSLATE:
        this.applyTranslate(arCoreData.nodes, targetId, operation.data);
        break;
      case OperationType.ROTATE:
        this.applyRotate(arCoreData.nodes, targetId, operation.data);
        break;
      case OperationType.SCALE:
        this.applyScale(arCoreData.nodes, targetId, operation.data);
        break;
      // Add more operation handlers
    }
  }

  findNodeByName(nodes, name) {
    for (const node of nodes) {
      if (node.name === name) return node;
      
      if (node.children) {
        const found = this.findNodeByName(node.children, name);
        if (found) return found;
      }
    }
    
    return null;
  }

  applyTranslate(nodes, targetId, data) {
    const node = this.findNodeByName(nodes, targetId);
    if (node && node.localPosition) {
      node.localPosition.x = (node.localPosition.x || 0) + (data.x || 0);
      node.localPosition.y = (node.localPosition.y || 0) + (data.y || 0);
      node.localPosition.z = (node.localPosition.z || 0) + (data.z || 0);
    }
  }

  applyRotate(nodes, targetId, data) {
    const node = this.findNodeByName(nodes, targetId);
    if (node) {
      node.localRotation = data.rotation || { x: 0, y: 0, z: 0, w: 1 };
    }
  }

  applyScale(nodes, targetId, data) {
    const node = this.findNodeByName(nodes, targetId);
    if (node && node.localScale) {
      node.localScale.x = (node.localScale.x || 1) * (data.x || 1);
      node.localScale.y = (node.localScale.y || 1) * (data.y || 1);
      node.localScale.z = (node.localScale.z || 1) * (data.z || 1);
    }
  }

  /**
   * Extract operations from model changes
   */
  async extractOperations(oldModel, newModel) {
    const operations = [];
    
    // Compare node trees
    this.compareNodes(oldModel.nodes, newModel.nodes, operations);
    
    return operations;
  }

  compareNodes(oldNodes, newNodes, operations) {
    if (!oldNodes || !newNodes) return;

    for (let i = 0; i < Math.min(oldNodes.length, newNodes.length); i++) {
      const oldNode = oldNodes[i];
      const newNode = newNodes[i];

      // Check position changes
      if (oldNode.localPosition && newNode.localPosition) {
        const oldP = oldNode.localPosition;
        const newP = newNode.localPosition;
        
        if (oldP.x !== newP.x || oldP.y !== newP.y || oldP.z !== newP.z) {
          operations.push(new Operation(OperationType.TRANSLATE, {
            targetId: newNode.name,
            x: newP.x - oldP.x,
            y: newP.y - oldP.y,
            z: newP.z - oldP.z
          }));
        }
      }

      // Recurse to children
      if (oldNode.children && newNode.children) {
        this.compareNodes(oldNode.children, newNode.children, operations);
      }
    }
  }
}
