import { describe, it } from 'node:test';
import assert from 'node:assert';
import { BlenderAdapter } from '../src/adapters/BlenderAdapter.js';
import { SceneKitAdapter } from '../src/adapters/SceneKitAdapter.js';
import { RealityKitAdapter } from '../src/adapters/RealityKitAdapter.js';
import { SketchUpAdapter } from '../src/adapters/SketchUpAdapter.js';
import { ARCoreAdapter } from '../src/adapters/ARCoreAdapter.js';
import { Operation, OperationType } from '../src/core/Operation.js';

describe('BlenderAdapter', () => {
  it('should import Blender model to GLTFModel', async () => {
    const adapter = new BlenderAdapter();
    const blenderData = {
      objects: [
        {
          name: 'Cube',
          type: 'MESH',
          location: [1, 2, 3],
          rotation_euler: [0, 0, 0],
          scale: [1, 1, 1],
          data: {
            name: 'CubeMesh',
            vertices: [1, 1, 1, -1, -1, -1],
            polygons: [0, 1, 2]
          }
        }
      ]
    };

    const model = await adapter.importModel(blenderData);

    assert.ok(model);
    assert.ok(model.nodes.length > 0);
    assert.strictEqual(model.nodes[0].name, 'Cube');
  });

  it('should export GLTFModel to Blender format', async () => {
    const adapter = new BlenderAdapter();
    const blenderData = {
      objects: [
        {
          name: 'Cube',
          type: 'MESH',
          location: [0, 0, 0],
          rotation_euler: [0, 0, 0],
          scale: [1, 1, 1],
          data: { name: 'Mesh' }
        }
      ]
    };

    const model = await adapter.importModel(blenderData);
    const exported = await adapter.exportModel(model);

    assert.ok(exported);
    assert.ok(exported.objects);
    assert.ok(exported.objects.length > 0);
  });

  it('should apply translate operation', async () => {
    const adapter = new BlenderAdapter();
    const blenderData = {
      objects: [
        {
          name: 'Cube',
          location: [0, 0, 0],
          rotation_euler: [0, 0, 0],
          scale: [1, 1, 1]
        }
      ]
    };

    const op = new Operation(OperationType.TRANSLATE, {
      targetId: 'Cube',
      x: 5,
      y: 0,
      z: 0
    });

    const result = await adapter.applyOperations(blenderData, [op]);

    assert.strictEqual(result.objects[0].location[0], 5);
  });
});

describe('SceneKitAdapter', () => {
  it('should import SceneKit model to GLTFModel', async () => {
    const adapter = new SceneKitAdapter();
    const sceneKitData = {
      name: 'TestScene',
      rootNode: {
        name: 'Root',
        position: { x: 0, y: 0, z: 0 },
        childNodes: [
          {
            name: 'Box',
            position: { x: 1, y: 2, z: 3 },
            geometry: {
              name: 'BoxGeometry',
              vertices: [1, 1, 1]
            }
          }
        ]
      }
    };

    const model = await adapter.importModel(sceneKitData);

    assert.ok(model);
    assert.ok(model.nodes.length > 0);
  });

  it('should export GLTFModel to SceneKit format', async () => {
    const adapter = new SceneKitAdapter();
    const sceneKitData = {
      name: 'TestScene',
      rootNode: {
        name: 'Root',
        childNodes: []
      }
    };

    const model = await adapter.importModel(sceneKitData);
    const exported = await adapter.exportModel(model);

    assert.ok(exported);
    assert.ok(exported.rootNode);
  });
});

describe('RealityKitAdapter', () => {
  it('should import RealityKit model to GLTFModel', async () => {
    const adapter = new RealityKitAdapter();
    const realityKitData = {
      name: 'TestScene',
      entities: [
        {
          name: 'Box',
          transform: {
            translation: { x: 1, y: 2, z: 3 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: { x: 1, y: 1, z: 1 }
          }
        }
      ]
    };

    const model = await adapter.importModel(realityKitData);

    assert.ok(model);
    assert.ok(model.nodes.length > 0);
  });

  it('should apply operations to RealityKit model', async () => {
    const adapter = new RealityKitAdapter();
    const realityKitData = {
      entities: [
        {
          name: 'Box',
          transform: {
            translation: { x: 0, y: 0, z: 0 }
          }
        }
      ]
    };

    const op = new Operation(OperationType.TRANSLATE, {
      targetId: 'Box',
      x: 3,
      y: 0,
      z: 0
    });

    await adapter.applyOperations(realityKitData, [op]);

    assert.strictEqual(realityKitData.entities[0].transform.translation.x, 3);
  });
});

describe('SketchUpAdapter', () => {
  it('should import SketchUp model to GLTFModel', async () => {
    const adapter = new SketchUpAdapter();
    const sketchUpData = {
      name: 'TestModel',
      entities: [
        {
          name: 'Component',
          type: 'ComponentInstance',
          transformation: {
            origin: [0, 0, 0]
          }
        }
      ]
    };

    const model = await adapter.importModel(sketchUpData);

    assert.ok(model);
    assert.ok(model.nodes.length > 0);
  });
});

describe('ARCoreAdapter', () => {
  it('should import ARCore model to GLTFModel', async () => {
    const adapter = new ARCoreAdapter();
    const arCoreData = {
      name: 'TestScene',
      nodes: [
        {
          name: 'Box',
          localPosition: { x: 1, y: 2, z: 3 },
          localRotation: { x: 0, y: 0, z: 0, w: 1 },
          localScale: { x: 1, y: 1, z: 1 }
        }
      ]
    };

    const model = await adapter.importModel(arCoreData);

    assert.ok(model);
    assert.ok(model.nodes.length > 0);
  });

  it('should export GLTFModel to ARCore format', async () => {
    const adapter = new ARCoreAdapter();
    const arCoreData = {
      name: 'TestScene',
      nodes: [
        {
          name: 'Box',
          localPosition: { x: 0, y: 0, z: 0 }
        }
      ]
    };

    const model = await adapter.importModel(arCoreData);
    const exported = await adapter.exportModel(model);

    assert.ok(exported);
    assert.ok(exported.nodes);
    assert.ok(exported.nodes.length > 0);
  });
});
