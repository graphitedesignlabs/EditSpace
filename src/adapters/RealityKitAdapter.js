import { BaseAdapter } from './BaseAdapter.js';
import { GLTFModel } from '../formats/GLTFModel.js';
import { Operation, OperationType } from '../core/Operation.js';

/**
 * Adapter for Apple RealityKit/ModelEntities
 * Handles import/export between RealityKit's format and GLTFModel
 */
export class RealityKitAdapter extends BaseAdapter {
  constructor() {
    super('RealityKit/ModelEntities');
  }

  /**
   * Import from RealityKit format to GLTFModel
   * Expected format: JSON representation of RealityKit Entity structure
   */
  async importModel(realityKitData) {
    const model = new GLTFModel();

    // Create scene
    const sceneIndex = model.addScene(realityKitData.name || 'RealityKitScene');

    // Process entities
    if (realityKitData.entities) {
      for (const entity of realityKitData.entities) {
        await this.importEntity(model, entity);
      }
    }

    return model;
  }

  /**
   * Import RealityKit entity
   */
  async importEntity(model, entity) {
    const nodeOptions = {};

    // Transform component
    if (entity.transform) {
      if (entity.transform.translation) {
        nodeOptions.translation = [
          entity.transform.translation.x || 0,
          entity.transform.translation.y || 0,
          entity.transform.translation.z || 0
        ];
      }

      if (entity.transform.rotation) {
        nodeOptions.rotation = [
          entity.transform.rotation.x || 0,
          entity.transform.rotation.y || 0,
          entity.transform.rotation.z || 0,
          entity.transform.rotation.w || 1
        ];
      }

      if (entity.transform.scale) {
        nodeOptions.scale = [
          entity.transform.scale.x || 1,
          entity.transform.scale.y || 1,
          entity.transform.scale.z || 1
        ];
      }
    }

    // Model component
    if (entity.model) {
      const meshIndex = this.importModelComponent(model, entity.model);
      nodeOptions.mesh = meshIndex;
    }

    const nodeIndex = model.addNode(entity.name || 'Entity', nodeOptions);

    // Process children
    if (entity.children && entity.children.length > 0) {
      const childIndices = [];
      for (const child of entity.children) {
        const childIndex = await this.importEntity(model, child);
        childIndices.push(childIndex);
      }
      model.nodes[nodeIndex].children = childIndices;
    }

    return nodeIndex;
  }

  /**
   * Import RealityKit model component
   */
  importModelComponent(model, modelComponent) {
    const primitives = [];

    if (modelComponent.mesh) {
      primitives.push({
        attributes: {
          POSITION: modelComponent.mesh.positions || [],
          NORMAL: modelComponent.mesh.normals || [],
          TEXCOORD_0: modelComponent.mesh.textureCoordinates || []
        },
        indices: modelComponent.mesh.indices || [],
        material: modelComponent.materialIndex || 0
      });
    }

    return model.addMesh(modelComponent.name || 'Model', primitives);
  }

  /**
   * Export GLTFModel to RealityKit format
   */
  async exportModel(gltfModel) {
    const realityKitData = {
      name: 'Scene',
      entities: []
    };

    // Export nodes as entities
    for (let i = 0; i < gltfModel.nodes.length; i++) {
      if (gltfModel.nodes[i] === null) continue;
      
      const node = gltfModel.nodes[i];
      const entity = await this.exportEntity(gltfModel, node, i);
      realityKitData.entities.push(entity);
    }

    return realityKitData;
  }

  /**
   * Export node to RealityKit entity
   */
  async exportEntity(gltfModel, node, nodeIndex) {
    const entity = {
      name: node.name,
      transform: {},
      components: []
    };

    // Transform
    if (node.translation) {
      entity.transform.translation = {
        x: node.translation[0],
        y: node.translation[1],
        z: node.translation[2]
      };
    }

    if (node.rotation) {
      entity.transform.rotation = {
        x: node.rotation[0],
        y: node.rotation[1],
        z: node.rotation[2],
        w: node.rotation[3]
      };
    }

    if (node.scale) {
      entity.transform.scale = {
        x: node.scale[0],
        y: node.scale[1],
        z: node.scale[2]
      };
    }

    // Model component
    if (node.mesh !== undefined && gltfModel.meshes[node.mesh]) {
      entity.model = this.exportModelComponent(gltfModel.meshes[node.mesh]);
    }

    // Children
    if (node.children && node.children.length > 0) {
      entity.children = [];
      for (const childIndex of node.children) {
        const childEntity = await this.exportEntity(gltfModel, gltfModel.nodes[childIndex], childIndex);
        entity.children.push(childEntity);
      }
    }

    return entity;
  }

  /**
   * Export mesh to RealityKit model component
   */
  exportModelComponent(mesh) {
    const modelComponent = {
      name: mesh.name,
      mesh: {}
    };

    if (mesh.primitives && mesh.primitives.length > 0) {
      const primitive = mesh.primitives[0];
      modelComponent.mesh.positions = primitive.attributes.POSITION || [];
      modelComponent.mesh.normals = primitive.attributes.NORMAL || [];
      modelComponent.mesh.textureCoordinates = primitive.attributes.TEXCOORD_0 || [];
      modelComponent.mesh.indices = primitive.indices || [];
      modelComponent.materialIndex = primitive.material || 0;
    }

    return modelComponent;
  }

  /**
   * Apply operations to RealityKit model
   */
  async applyOperations(realityKitData, operations) {
    for (const op of operations) {
      await this.applyOperation(realityKitData, op);
    }
    return realityKitData;
  }

  /**
   * Apply single operation
   */
  async applyOperation(realityKitData, operation) {
    const targetId = operation.data.targetId;

    switch (operation.type) {
      case OperationType.TRANSLATE:
        this.applyTranslate(realityKitData.entities, targetId, operation.data);
        break;
      case OperationType.ROTATE:
        this.applyRotate(realityKitData.entities, targetId, operation.data);
        break;
      case OperationType.SCALE:
        this.applyScale(realityKitData.entities, targetId, operation.data);
        break;
      // Add more operation handlers
    }
  }

  findEntityByName(entities, name) {
    for (const entity of entities) {
      if (entity.name === name) return entity;
      
      if (entity.children) {
        const found = this.findEntityByName(entity.children, name);
        if (found) return found;
      }
    }
    
    return null;
  }

  applyTranslate(entities, targetId, data) {
    const entity = this.findEntityByName(entities, targetId);
    if (entity && entity.transform && entity.transform.translation) {
      entity.transform.translation.x = (entity.transform.translation.x || 0) + (data.x || 0);
      entity.transform.translation.y = (entity.transform.translation.y || 0) + (data.y || 0);
      entity.transform.translation.z = (entity.transform.translation.z || 0) + (data.z || 0);
    }
  }

  applyRotate(entities, targetId, data) {
    const entity = this.findEntityByName(entities, targetId);
    if (entity && entity.transform) {
      entity.transform.rotation = data.rotation || { x: 0, y: 0, z: 0, w: 1 };
    }
  }

  applyScale(entities, targetId, data) {
    const entity = this.findEntityByName(entities, targetId);
    if (entity && entity.transform && entity.transform.scale) {
      entity.transform.scale.x = (entity.transform.scale.x || 1) * (data.x || 1);
      entity.transform.scale.y = (entity.transform.scale.y || 1) * (data.y || 1);
      entity.transform.scale.z = (entity.transform.scale.z || 1) * (data.z || 1);
    }
  }

  /**
   * Extract operations from model changes
   */
  async extractOperations(oldModel, newModel) {
    const operations = [];
    
    // Compare entity trees
    this.compareEntities(oldModel.entities, newModel.entities, operations);
    
    return operations;
  }

  compareEntities(oldEntities, newEntities, operations) {
    if (!oldEntities || !newEntities) return;

    for (let i = 0; i < Math.min(oldEntities.length, newEntities.length); i++) {
      const oldEntity = oldEntities[i];
      const newEntity = newEntities[i];

      // Check transform changes
      if (oldEntity.transform && newEntity.transform) {
        if (oldEntity.transform.translation && newEntity.transform.translation) {
          const oldT = oldEntity.transform.translation;
          const newT = newEntity.transform.translation;
          
          if (oldT.x !== newT.x || oldT.y !== newT.y || oldT.z !== newT.z) {
            operations.push(new Operation(OperationType.TRANSLATE, {
              targetId: newEntity.name,
              x: newT.x - oldT.x,
              y: newT.y - oldT.y,
              z: newT.z - oldT.z
            }));
          }
        }
      }

      // Recurse to children
      if (oldEntity.children && newEntity.children) {
        this.compareEntities(oldEntity.children, newEntity.children, operations);
      }
    }
  }
}
