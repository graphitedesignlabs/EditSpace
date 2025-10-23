import { BaseAdapter } from './BaseAdapter.js';
import { GLTFModel } from '../formats/GLTFModel.js';
import { Operation, OperationType } from '../core/Operation.js';

/**
 * Adapter for SketchUp
 * Handles import/export between SketchUp's format and GLTFModel
 */
export class SketchUpAdapter extends BaseAdapter {
  constructor() {
    super('SketchUp');
  }

  /**
   * Import from SketchUp format to GLTFModel
   * Expected format: JSON representation of SketchUp model structure
   */
  async importModel(sketchUpData) {
    const model = new GLTFModel();

    // Create scene
    const sceneIndex = model.addScene(sketchUpData.name || 'SketchUpScene');

    // Process entities
    if (sketchUpData.entities) {
      for (const entity of sketchUpData.entities) {
        await this.importSketchUpEntity(model, entity);
      }
    }

    return model;
  }

  /**
   * Import SketchUp entity
   */
  async importSketchUpEntity(model, entity) {
    const nodeOptions = {};

    // Transformation
    if (entity.transformation) {
      const transform = entity.transformation;
      
      // SketchUp uses transformation matrix
      if (transform.matrix) {
        nodeOptions.matrix = transform.matrix;
      } else {
        if (transform.origin) {
          nodeOptions.translation = [
            transform.origin[0] || 0,
            transform.origin[1] || 0,
            transform.origin[2] || 0
          ];
        }
        
        if (transform.rotation) {
          nodeOptions.rotation = transform.rotation;
        }
        
        if (transform.scale) {
          nodeOptions.scale = transform.scale;
        }
      }
    }

    // Handle different entity types
    if (entity.type === 'ComponentInstance' || entity.type === 'Group') {
      if (entity.definition && entity.definition.entities) {
        // Process nested entities
        for (const childEntity of entity.definition.entities) {
          await this.importSketchUpEntity(model, childEntity);
        }
      }
    }

    if (entity.type === 'Face' || entity.type === 'Edge') {
      const meshIndex = this.importSketchUpGeometry(model, entity);
      nodeOptions.mesh = meshIndex;
    }

    const nodeIndex = model.addNode(entity.name || 'Entity', nodeOptions);
    return nodeIndex;
  }

  /**
   * Import SketchUp geometry
   */
  importSketchUpGeometry(model, entity) {
    const primitives = [];

    if (entity.type === 'Face' && entity.vertices) {
      // Convert face to mesh primitive
      const positions = [];
      const indices = [];

      entity.vertices.forEach((vertex, i) => {
        positions.push(vertex.position[0], vertex.position[1], vertex.position[2]);
        indices.push(i);
      });

      primitives.push({
        attributes: {
          POSITION: positions,
          NORMAL: entity.normal || []
        },
        indices: indices,
        material: entity.materialId || 0
      });
    }

    return model.addMesh(entity.name || 'Geometry', primitives);
  }

  /**
   * Export GLTFModel to SketchUp format
   */
  async exportModel(gltfModel) {
    const sketchUpData = {
      name: 'SketchUpModel',
      entities: []
    };

    // Export nodes as SketchUp entities
    for (let i = 0; i < gltfModel.nodes.length; i++) {
      if (gltfModel.nodes[i] === null) continue;
      
      const node = gltfModel.nodes[i];
      const entity = await this.exportSketchUpEntity(gltfModel, node, i);
      sketchUpData.entities.push(entity);
    }

    return sketchUpData;
  }

  /**
   * Export node to SketchUp entity
   */
  async exportSketchUpEntity(gltfModel, node, nodeIndex) {
    const entity = {
      name: node.name,
      type: 'ComponentInstance',
      transformation: {}
    };

    // Transformation
    if (node.matrix) {
      entity.transformation.matrix = node.matrix;
    } else {
      if (node.translation) {
        entity.transformation.origin = node.translation;
      }
      if (node.rotation) {
        entity.transformation.rotation = node.rotation;
      }
      if (node.scale) {
        entity.transformation.scale = node.scale;
      }
    }

    // Handle mesh
    if (node.mesh !== undefined && gltfModel.meshes[node.mesh]) {
      const faces = this.exportSketchUpGeometry(gltfModel.meshes[node.mesh]);
      entity.definition = {
        entities: faces
      };
    }

    return entity;
  }

  /**
   * Export mesh to SketchUp geometry
   */
  exportSketchUpGeometry(mesh) {
    const faces = [];

    if (mesh.primitives && mesh.primitives.length > 0) {
      for (const primitive of mesh.primitives) {
        const positions = primitive.attributes.POSITION || [];
        const indices = primitive.indices || [];
        
        // Convert primitive to faces
        const vertices = [];
        for (let i = 0; i < positions.length; i += 3) {
          vertices.push({
            position: [positions[i], positions[i + 1], positions[i + 2]]
          });
        }

        faces.push({
          type: 'Face',
          name: mesh.name,
          vertices: vertices,
          materialId: primitive.material || 0
        });
      }
    }

    return faces;
  }

  /**
   * Apply operations to SketchUp model
   */
  async applyOperations(sketchUpData, operations) {
    for (const op of operations) {
      await this.applyOperation(sketchUpData, op);
    }
    return sketchUpData;
  }

  /**
   * Apply single operation
   */
  async applyOperation(sketchUpData, operation) {
    const targetId = operation.data.targetId;

    switch (operation.type) {
      case OperationType.TRANSLATE:
        this.applyTranslate(sketchUpData.entities, targetId, operation.data);
        break;
      case OperationType.ROTATE:
        this.applyRotate(sketchUpData.entities, targetId, operation.data);
        break;
      case OperationType.SCALE:
        this.applyScale(sketchUpData.entities, targetId, operation.data);
        break;
      // Add more operation handlers
    }
  }

  findEntityByName(entities, name) {
    for (const entity of entities) {
      if (entity.name === name) return entity;
      
      if (entity.definition && entity.definition.entities) {
        const found = this.findEntityByName(entity.definition.entities, name);
        if (found) return found;
      }
    }
    
    return null;
  }

  applyTranslate(entities, targetId, data) {
    const entity = this.findEntityByName(entities, targetId);
    if (entity && entity.transformation && entity.transformation.origin) {
      entity.transformation.origin = [
        (entity.transformation.origin[0] || 0) + (data.x || 0),
        (entity.transformation.origin[1] || 0) + (data.y || 0),
        (entity.transformation.origin[2] || 0) + (data.z || 0)
      ];
    }
  }

  applyRotate(entities, targetId, data) {
    const entity = this.findEntityByName(entities, targetId);
    if (entity && entity.transformation) {
      entity.transformation.rotation = data.rotation || [0, 0, 0, 1];
    }
  }

  applyScale(entities, targetId, data) {
    const entity = this.findEntityByName(entities, targetId);
    if (entity && entity.transformation && entity.transformation.scale) {
      entity.transformation.scale = [
        (entity.transformation.scale[0] || 1) * (data.x || 1),
        (entity.transformation.scale[1] || 1) * (data.y || 1),
        (entity.transformation.scale[2] || 1) * (data.z || 1)
      ];
    }
  }

  /**
   * Extract operations from model changes
   */
  async extractOperations(oldModel, newModel) {
    const operations = [];
    
    // Compare entity structures
    this.compareEntities(oldModel.entities, newModel.entities, operations);
    
    return operations;
  }

  compareEntities(oldEntities, newEntities, operations) {
    if (!oldEntities || !newEntities) return;

    for (let i = 0; i < Math.min(oldEntities.length, newEntities.length); i++) {
      const oldEntity = oldEntities[i];
      const newEntity = newEntities[i];

      // Check transformation changes
      if (oldEntity.transformation && newEntity.transformation) {
        if (oldEntity.transformation.origin && newEntity.transformation.origin) {
          const oldO = oldEntity.transformation.origin;
          const newO = newEntity.transformation.origin;
          
          if (oldO[0] !== newO[0] || oldO[1] !== newO[1] || oldO[2] !== newO[2]) {
            operations.push(new Operation(OperationType.TRANSLATE, {
              targetId: newEntity.name,
              x: newO[0] - oldO[0],
              y: newO[1] - oldO[1],
              z: newO[2] - oldO[2]
            }));
          }
        }
      }

      // Recurse to nested entities
      if (oldEntity.definition?.entities && newEntity.definition?.entities) {
        this.compareEntities(oldEntity.definition.entities, newEntity.definition.entities, operations);
      }
    }
  }
}
