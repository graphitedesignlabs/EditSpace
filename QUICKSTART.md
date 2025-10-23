# Quick Start Guide

Get started with OpTransform3D in 5 minutes!

## Installation

```bash
# Clone the repository
git clone https://github.com/graphitedesignlabs/optransform3d.git
cd optransform3d

# No dependencies needed! Pure JavaScript.
```

## Run the Examples

```bash
# Basic two-user collaboration
node examples/basic-usage.js

# Cross-platform demonstration
node examples/multi-adapter.js

# Detailed debug output
node examples/debug-usage.js
```

## Your First Collaborative Session

### Step 1: Choose Your Platform

```javascript
import { BlenderAdapter } from './src/index.js';
// Or: SceneKitAdapter, RealityKitAdapter, ARCoreAdapter, SketchUpAdapter

const adapter = new BlenderAdapter();
```

### Step 2: Create a Model

```javascript
const myModel = {
  objects: [{
    name: 'Cube',
    type: 'MESH',
    location: [0, 0, 0],
    rotation_euler: [0, 0, 0],
    scale: [1, 1, 1],
    data: {
      name: 'CubeMesh',
      vertices: [/* vertex data */],
      polygons: [/* face data */]
    }
  }]
};
```

### Step 3: Start a Session

```javascript
import { CollaborativeSession } from './src/index.js';

const session = new CollaborativeSession(adapter);
await session.initialize(myModel);
```

### Step 4: Make Changes

```javascript
import { Operation, OperationType } from './src/index.js';

// Move the cube
const moveOp = new Operation(OperationType.TRANSLATE, {
  targetId: 'Cube',
  x: 5,
  y: 0,
  z: 0
});

await session.applyLocalOperations([moveOp]);
```

### Step 5: Sync with Others

```javascript
// Get your changes to send to server
const myOps = session.getPendingOperations();

// Send myOps to server (using WebSocket, HTTP, etc.)
socket.send(JSON.stringify(myOps));

// Receive changes from others
socket.on('operations', async (remoteOps) => {
  await session.applyRemoteOperations(remoteOps);
  session.acknowledgePendingOperations();
});
```

### Step 6: Get Updated Model

```javascript
// Get model in native format
const updatedModel = await session.getNativeModel();

// Use in your application
console.log('Cube position:', updatedModel.objects[0].location);
```

## Common Operations

### Translate (Move)

```javascript
new Operation(OperationType.TRANSLATE, {
  targetId: 'ObjectName',
  x: 5,    // Move 5 units right
  y: 2,    // Move 2 units up
  z: -3    // Move 3 units back
})
```

### Rotate

```javascript
new Operation(OperationType.ROTATE, {
  targetId: 'ObjectName',
  rotation: [0, 0, 0, 1]  // Quaternion [x, y, z, w]
})
```

### Scale

```javascript
new Operation(OperationType.SCALE, {
  targetId: 'ObjectName',
  x: 2,    // Double width
  y: 2,    // Double height
  z: 2     // Double depth
})
```

### Add Mesh

```javascript
new Operation(OperationType.ADD_MESH, {
  targetId: 'NewCube',
  name: 'NewCube',
  location: [10, 0, 0],
  meshData: {
    vertices: [/* vertex data */],
    polygons: [/* face data */]
  }
})
```

### Delete Mesh

```javascript
new Operation(OperationType.DELETE_MESH, {
  targetId: 'OldCube'
})
```

## Platform-Specific Examples

### Blender

```javascript
import { BlenderAdapter } from './src/index.js';

const blenderData = {
  objects: [{
    name: 'Suzanne',
    type: 'MESH',
    location: [0, 0, 0],
    rotation_euler: [0, 0, 0],
    scale: [1, 1, 1],
    data: {
      name: 'MonkeyMesh',
      vertices: [/* ... */],
      polygons: [/* ... */]
    }
  }]
};

const adapter = new BlenderAdapter();
const gltf = await adapter.importModel(blenderData);
```

### SceneKit (iOS/macOS)

```javascript
import { SceneKitAdapter } from './src/index.js';

const sceneKitData = {
  name: 'MyScene',
  rootNode: {
    name: 'Root',
    childNodes: [{
      name: 'Box',
      position: { x: 0, y: 0, z: 0 },
      geometry: {
        name: 'BoxGeometry',
        vertices: [/* ... */]
      }
    }]
  }
};

const adapter = new SceneKitAdapter();
const gltf = await adapter.importModel(sceneKitData);
```

### RealityKit (iOS AR)

```javascript
import { RealityKitAdapter } from './src/index.js';

const realityKitData = {
  entities: [{
    name: 'ARObject',
    transform: {
      translation: { x: 0, y: 0, z: -2 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 }
    },
    model: {
      mesh: {
        positions: [/* ... */],
        normals: [/* ... */]
      }
    }
  }]
};

const adapter = new RealityKitAdapter();
const gltf = await adapter.importModel(realityKitData);
```

### ARCore (Android AR)

```javascript
import { ARCoreAdapter } from './src/index.js';

const arCoreData = {
  nodes: [{
    name: 'ARModel',
    localPosition: { x: 0, y: 0, z: -1 },
    localRotation: { x: 0, y: 0, z: 0, w: 1 },
    localScale: { x: 0.1, y: 0.1, z: 0.1 },
    renderable: {
      submeshes: [{
        vertices: { positions: [/* ... */] },
        indices: [/* ... */]
      }]
    }
  }]
};

const adapter = new ARCoreAdapter();
const gltf = await adapter.importModel(arCoreData);
```

### SketchUp

```javascript
import { SketchUpAdapter } from './src/index.js';

const sketchUpData = {
  entities: [{
    name: 'Building',
    type: 'ComponentInstance',
    transformation: {
      origin: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1]
    },
    definition: {
      entities: [/* nested geometry */]
    }
  }]
};

const adapter = new SketchUpAdapter();
const gltf = await adapter.importModel(sketchUpData);
```

## Building a Server

Here's a minimal WebSocket server for synchronization:

```javascript
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  
  ws.on('message', (data) => {
    const operations = JSON.parse(data);
    
    // Broadcast to all other clients
    clients.forEach((client) => {
      if (client !== ws && client.readyState === 1) {
        client.send(data);
      }
    });
  });
  
  ws.on('close', () => {
    clients.delete(ws);
  });
});
```

## Testing

Run the included tests:

```bash
npm test
```

## Next Steps

1. **Read the Architecture**: See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed design
2. **Try the Examples**: Run the example files to see it in action
3. **Build Your App**: Integrate with your preferred platform
4. **Add a Server**: Implement real network synchronization
5. **Extend**: Add new operation types or adapters

## Common Issues

### Operations Not Syncing

Make sure you call `acknowledgePendingOperations()` after sending:

```javascript
const ops = session.getPendingOperations();
await sendToServer(ops);
session.acknowledgePendingOperations();  // Don't forget this!
```

### Models Not Converging

Ensure operations are sent in both directions:

```javascript
// User A → User B
const opsA = sessionA.getPendingOperations();
await sessionB.applyRemoteOperations(opsA);

// User B → User A  (Don't forget this!)
const opsB = sessionB.getPendingOperations();
await sessionA.applyRemoteOperations(opsB);
```

### Transform Order Matters

Operations are commutative, so order doesn't matter for most transforms. But remember:
- Get pending operations BEFORE applying remote operations
- Acknowledge AFTER successfully sending

## Support

- Issues: https://github.com/graphitedesignlabs/optransform3d/issues
- Discussions: https://github.com/graphitedesignlabs/optransform3d/discussions

## License

MIT - See [LICENSE](./LICENSE) file
