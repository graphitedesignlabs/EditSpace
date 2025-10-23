import {
  Operation,
  OperationType,
  OTEngine,
  BlenderAdapter,
  CollaborativeSession
} from '../src/index.js';

/**
 * Basic usage example of OpTransform3D
 * Demonstrates collaborative editing with two users
 */

async function basicExample() {
  console.log('=== OpTransform3D Basic Example ===\n');

  // Create a sample Blender model
  const blenderModel = {
    objects: [
      {
        name: 'Cube',
        type: 'MESH',
        location: [0, 0, 0],
        rotation_euler: [0, 0, 0],
        scale: [1, 1, 1],
        data: {
          name: 'CubeMesh',
          vertices: [],
          polygons: []
        }
      },
      {
        name: 'Sphere',
        type: 'MESH',
        location: [5, 0, 0],
        rotation_euler: [0, 0, 0],
        scale: [1, 1, 1],
        data: {
          name: 'SphereMesh',
          vertices: [],
          polygons: []
        }
      }
    ]
  };

  console.log('Initial Model:', JSON.stringify(blenderModel, null, 2), '\n');

  // User 1: Create a collaborative session
  const user1Adapter = new BlenderAdapter();
  const user1Session = new CollaborativeSession(user1Adapter);
  await user1Session.initialize(blenderModel);

  console.log('User 1 initialized session\n');

  // User 2: Create a collaborative session with the same model
  const user2Adapter = new BlenderAdapter();
  const user2Session = new CollaborativeSession(user2Adapter);
  await user2Session.initialize(JSON.parse(JSON.stringify(blenderModel)));

  console.log('User 2 initialized session\n');

  // User 1: Move the cube
  console.log('User 1: Moving Cube by (2, 0, 0)');
  const user1Op1 = new Operation(OperationType.TRANSLATE, {
    targetId: 'Cube',
    x: 2,
    y: 0,
    z: 0
  });
  await user1Session.applyLocalOperations([user1Op1]);

  // User 2: Move the same cube (concurrent operation)
  console.log('User 2: Moving Cube by (0, 3, 0) (concurrent)');
  const user2Op1 = new Operation(OperationType.TRANSLATE, {
    targetId: 'Cube',
    x: 0,
    y: 3,
    z: 0
  });
  await user2Session.applyLocalOperations([user2Op1]);

  // User 2: Scale the sphere
  console.log('User 2: Scaling Sphere by (2, 2, 2)');
  const user2Op2 = new Operation(OperationType.SCALE, {
    targetId: 'Sphere',
    x: 2,
    y: 2,
    z: 2
  });
  await user2Session.applyLocalOperations([user2Op2]);

  console.log('\n--- Synchronizing changes ---\n');

  // Get operations before applying remote ops
  console.log('Getting pending operations...');
  const user1Ops = user1Session.getPendingOperations();
  const user2Ops = user2Session.getPendingOperations();

  // User 1 receives User 2's operations
  console.log('User 1 receiving operations from User 2...');
  await user1Session.applyRemoteOperations(user2Ops);
  user1Session.acknowledgePendingOperations();

  // User 2 receives User 1's operations
  console.log('User 2 receiving operations from User 1...');
  await user2Session.applyRemoteOperations(user1Ops);
  user2Session.acknowledgePendingOperations();

  // Get final models
  const user1Final = await user1Session.getNativeModel();
  const user2Final = await user2Session.getNativeModel();

  console.log('\n=== Final Results ===\n');
  console.log('User 1 Model:');
  console.log(JSON.stringify(user1Final, null, 2), '\n');

  console.log('User 2 Model:');
  console.log(JSON.stringify(user2Final, null, 2), '\n');

  // Verify convergence
  const cubeUser1 = user1Final.objects.find(o => o.name === 'Cube');
  const cubeUser2 = user2Final.objects.find(o => o.name === 'Cube');

  console.log('=== Verification ===\n');
  console.log('Cube location in User 1 model:', cubeUser1.location);
  console.log('Cube location in User 2 model:', cubeUser2.location);
  
  const locationsMatch = JSON.stringify(cubeUser1.location) === JSON.stringify(cubeUser2.location);
  console.log('Models converged:', locationsMatch ? '✓ YES' : '✗ NO');
  
  if (locationsMatch) {
    console.log('\nSuccess! Both users have the same final state.');
  }
}

// Run the example
basicExample().catch(console.error);
