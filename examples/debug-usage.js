import {
  Operation,
  OperationType,
  BlenderAdapter,
  CollaborativeSession
} from '../src/index.js';

async function debugExample() {
  console.log('=== Debug Example ===\n');

  const blenderModel = {
    objects: [
      {
        name: 'Cube',
        type: 'MESH',
        location: [0, 0, 0],
        rotation_euler: [0, 0, 0],
        scale: [1, 1, 1],
        data: { name: 'CubeMesh', vertices: [], polygons: [] }
      }
    ]
  };

  // User 1
  const user1Adapter = new BlenderAdapter();
  const user1Session = new CollaborativeSession(user1Adapter);
  await user1Session.initialize(blenderModel);
  console.log('User 1 initialized\n');

  // User 2
  const user2Adapter = new BlenderAdapter();
  const user2Session = new CollaborativeSession(user2Adapter);
  await user2Session.initialize(JSON.parse(JSON.stringify(blenderModel)));
  console.log('User 2 initialized\n');

  // User 1: Move cube x+2
  console.log('User 1: Applying TRANSLATE x+2');
  const user1Op = new Operation(OperationType.TRANSLATE, {
    targetId: 'Cube',
    x: 2, y: 0, z: 0
  });
  await user1Session.applyLocalOperations([user1Op]);
  
  const user1Model1 = await user1Session.getNativeModel();
  console.log('User 1 after local op:', user1Model1.objects[0].location);
  console.log('User 1 version:', user1Session.engine.getVersion());
  console.log('User 1 ops:', user1Session.getPendingOperations(0).map(o => `${o.type}(${o.data.x},${o.data.y},${o.data.z})`), '\n');

  // User 2: Move cube y+3
  console.log('User 2: Applying TRANSLATE y+3');
  const user2Op = new Operation(OperationType.TRANSLATE, {
    targetId: 'Cube',
    x: 0, y: 3, z: 0
  });
  await user2Session.applyLocalOperations([user2Op]);
  
  const user2Model1 = await user2Session.getNativeModel();
  console.log('User 2 after local op:', user2Model1.objects[0].location);
  console.log('User 2 version:', user2Session.engine.getVersion());
  console.log('User 2 ops:', user2Session.getPendingOperations(0).map(o => `${o.type}(${o.data.x},${o.data.y},${o.data.z})`), '\n');

  // Get operations before syncing
  console.log('Getting pending operations...');
  const user1Ops = user1Session.getPendingOperations();
  const user2Ops = user2Session.getPendingOperations();
  console.log('User 1 ops to send:', user1Ops.map(o => `${o.type}(${o.data.x},${o.data.y},${o.data.z})`));
  console.log('User 2 ops to send:', user2Ops.map(o => `${o.type}(${o.data.x},${o.data.y},${o.data.z})`), '\n');

  // Sync: User 1 receives User 2's ops
  console.log('User 1 receiving ops from User 2...');
  await user1Session.applyRemoteOperations(user2Ops);
  user1Session.acknowledgePendingOperations();
  
  const user1Model2 = await user1Session.getNativeModel();
  console.log('User 1 after receiving remote:', user1Model2.objects[0].location);
  console.log('User 1 version:', user1Session.engine.getVersion(), '\n');

  // Sync: User 2 receives User 1's ops
  console.log('User 2 receiving ops from User 1...');
  await user2Session.applyRemoteOperations(user1Ops);
  user2Session.acknowledgePendingOperations();
  
  const user2Model2 = await user2Session.getNativeModel();
  console.log('User 2 after receiving remote:', user2Model2.objects[0].location);
  console.log('User 2 version:', user2Session.engine.getVersion(), '\n');

  console.log('=== Final ===');
  console.log('User 1:', user1Model2.objects[0].location);
  console.log('User 2:', user2Model2.objects[0].location);
  console.log('Match:', JSON.stringify(user1Model2.objects[0].location) === JSON.stringify(user2Model2.objects[0].location));
}

debugExample().catch(console.error);
