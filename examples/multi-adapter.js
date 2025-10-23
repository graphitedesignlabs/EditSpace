import {
  Operation,
  OperationType,
  BlenderAdapter,
  SceneKitAdapter,
  RealityKitAdapter,
  ARCoreAdapter,
  SketchUpAdapter,
  GLTFModel
} from '../src/index.js';

/**
 * Multi-adapter example
 * Demonstrates cross-platform collaboration
 */

async function multiAdapterExample() {
  console.log('=== Multi-Adapter Cross-Platform Example ===\n');

  // User 1 with Blender
  console.log('User 1 is using Blender');
  const blenderAdapter = new BlenderAdapter();
  const blenderModel = {
    objects: [
      {
        name: 'Box',
        type: 'MESH',
        location: [0, 0, 0],
        rotation_euler: [0, 0, 0],
        scale: [1, 1, 1],
        data: { name: 'BoxMesh', vertices: [], polygons: [] }
      }
    ]
  };

  const gltfFromBlender = await blenderAdapter.importModel(blenderModel);
  console.log('Blender model imported to glTF\n');

  // User 2 with SceneKit
  console.log('User 2 is using SceneKit/ARKit');
  const sceneKitAdapter = new SceneKitAdapter();
  const sceneKitModel = await sceneKitAdapter.exportModel(gltfFromBlender);
  console.log('glTF exported to SceneKit format');
  console.log('SceneKit model:', JSON.stringify(sceneKitModel, null, 2), '\n');

  // User 3 with RealityKit
  console.log('User 3 is using RealityKit');
  const realityKitAdapter = new RealityKitAdapter();
  const realityKitModel = await realityKitAdapter.exportModel(gltfFromBlender);
  console.log('glTF exported to RealityKit format');
  console.log('RealityKit model:', JSON.stringify(realityKitModel, null, 2), '\n');

  // User 4 with ARCore
  console.log('User 4 is using ARCore');
  const arCoreAdapter = new ARCoreAdapter();
  const arCoreModel = await arCoreAdapter.exportModel(gltfFromBlender);
  console.log('glTF exported to ARCore format');
  console.log('ARCore model:', JSON.stringify(arCoreModel, null, 2), '\n');

  // User 5 with SketchUp
  console.log('User 5 is using SketchUp');
  const sketchUpAdapter = new SketchUpAdapter();
  const sketchUpModel = await sketchUpAdapter.exportModel(gltfFromBlender);
  console.log('glTF exported to SketchUp format');
  console.log('SketchUp model:', JSON.stringify(sketchUpModel, null, 2), '\n');

  // Apply an operation in Blender
  console.log('--- User 1 (Blender) makes a change ---');
  const operation = new Operation(OperationType.TRANSLATE, {
    targetId: 'Box',
    x: 5,
    y: 0,
    z: 0
  });
  console.log('Operation:', operation.toJSON(), '\n');

  // Apply to Blender model
  await blenderAdapter.applyOperations(blenderModel, [operation]);
  console.log('Applied to Blender model');
  console.log('New location:', blenderModel.objects[0].location, '\n');

  // Apply to SceneKit model
  await sceneKitAdapter.applyOperations(sceneKitModel, [operation]);
  console.log('Applied to SceneKit model');
  const sceneKitBox = sceneKitAdapter.findNodeByName(sceneKitModel.rootNode, 'Box');
  if (sceneKitBox && sceneKitBox.position) {
    console.log('New position:', sceneKitBox.position, '\n');
  }

  // Apply to RealityKit model
  await realityKitAdapter.applyOperations(realityKitModel, [operation]);
  console.log('Applied to RealityKit model');
  const realityKitBox = realityKitModel.entities[0];
  if (realityKitBox && realityKitBox.transform) {
    console.log('New translation:', realityKitBox.transform.translation, '\n');
  }

  // Apply to ARCore model
  await arCoreAdapter.applyOperations(arCoreModel, [operation]);
  console.log('Applied to ARCore model');
  const arCoreBox = arCoreModel.nodes[0];
  if (arCoreBox && arCoreBox.localPosition) {
    console.log('New position:', arCoreBox.localPosition, '\n');
  }

  // Apply to SketchUp model
  await sketchUpAdapter.applyOperations(sketchUpModel, [operation]);
  console.log('Applied to SketchUp model');
  const sketchUpBox = sketchUpModel.entities[0];
  if (sketchUpBox && sketchUpBox.transformation) {
    console.log('New origin:', sketchUpBox.transformation.origin, '\n');
  }

  console.log('=== Success! ===');
  console.log('The same operation was successfully applied across all 5 platforms:');
  console.log('✓ Blender');
  console.log('✓ SceneKit/ARKit');
  console.log('✓ RealityKit/ModelEntities');
  console.log('✓ ARCore/Sceneform');
  console.log('✓ SketchUp');
}

// Run the example
multiAdapterExample().catch(console.error);
