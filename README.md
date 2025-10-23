# OpTransform3D

A comprehensive operational transformation (OT) system for real-time collaborative 3D model editing, similar to Google Docs but for 3D models.

## Features

- **Operational Transformation Engine**: Conflict resolution for concurrent edits
- **Generic 3D Format**: Based on glTF 2.0 as interchange format
- **Multi-Platform Support**: Live editing adapters for:
  - **Blender** - Popular open-source 3D creation suite
  - **SceneKit/ARKit** - Apple's 3D graphics framework
  - **RealityKit/ModelEntities** - Apple's AR framework
  - **SketchUp** - 3D modeling for design
  - **ARCore** - Google's AR platform

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   OpTransform3D System                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐      ┌──────────────┐                     │
│  │  OT Engine   │◄────►│  Operations  │                     │
│  └──────────────┘      └──────────────┘                     │
│         ▲                                                    │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────────────────────────────────┐               │
│  │       glTF Model (Interchange)           │               │
│  └──────────────────────────────────────────┘               │
│         ▲                                                    │
│         │                                                    │
│  ┌──────┴───────┬─────────┬──────────┬──────────┐           │
│  │              │         │          │          │           │
│  ▼              ▼         ▼          ▼          ▼           │
│ Blender    SceneKit  RealityKit  SketchUp   ARCore         │
│ Adapter     Adapter    Adapter    Adapter    Adapter        │
└─────────────────────────────────────────────────────────────┘
```

## Installation

```bash
npm install optransform3d
```

## Quick Start

### Basic Collaborative Editing

```javascript
import {
  CollaborativeSession,
  BlenderAdapter,
  Operation,
  OperationType
} from 'optransform3d';

// Initialize session with Blender adapter
const adapter = new BlenderAdapter();
const session = new CollaborativeSession(adapter);

// Load initial model
const blenderModel = {
  objects: [{
    name: 'Cube',
    type: 'MESH',
    location: [0, 0, 0],
    scale: [1, 1, 1]
  }]
};

await session.initialize(blenderModel);

// Create and apply operations
const translateOp = new Operation(OperationType.TRANSLATE, {
  targetId: 'Cube',
  x: 5, y: 0, z: 0
});

session.applyLocalOperations([translateOp]);

// Sync with remote users
const remoteOps = getRemoteOperations(); // From network
session.applyRemoteOperations(remoteOps);
```

### Cross-Platform Editing

```javascript
import {
  BlenderAdapter,
  SceneKitAdapter,
  RealityKitAdapter
} from 'optransform3d';

// User 1 with Blender
const blenderAdapter = new BlenderAdapter();
const gltfModel = await blenderAdapter.importModel(blenderData);

// User 2 with SceneKit
const sceneKitAdapter = new SceneKitAdapter();
const sceneKitModel = await sceneKitAdapter.exportModel(gltfModel);

// User 3 with RealityKit
const realityKitAdapter = new RealityKitAdapter();
const realityKitModel = await realityKitAdapter.exportModel(gltfModel);

// All users work on the same model in their preferred tool!
```

## Operation Types

The system supports various 3D operations:

### Transform Operations
- `TRANSLATE` - Move objects in 3D space
- `ROTATE` - Rotate objects
- `SCALE` - Scale objects

### Mesh Operations
- `ADD_MESH` - Add new mesh to scene
- `DELETE_MESH` - Remove mesh from scene
- `UPDATE_MESH` - Modify mesh geometry

### Vertex Operations
- `ADD_VERTEX` - Add vertex to mesh
- `DELETE_VERTEX` - Remove vertex from mesh
- `MOVE_VERTEX` - Move vertex position

### Material Operations
- `ADD_MATERIAL` - Add new material
- `DELETE_MATERIAL` - Remove material
- `UPDATE_MATERIAL` - Modify material properties

### Scene Operations
- `ADD_NODE` - Add scene node
- `DELETE_NODE` - Remove scene node
- `UPDATE_NODE` - Update node properties

### Light & Camera Operations
- `ADD_LIGHT`, `DELETE_LIGHT`, `UPDATE_LIGHT`
- `ADD_CAMERA`, `DELETE_CAMERA`, `UPDATE_CAMERA`

## Adapters

### Blender Adapter

```javascript
import { BlenderAdapter } from 'optransform3d';

const adapter = new BlenderAdapter();

// Import from Blender Python API format
const blenderData = {
  objects: [{
    name: 'Cube',
    type: 'MESH',
    location: [0, 0, 0],
    rotation_euler: [0, 0, 0],
    scale: [1, 1, 1],
    data: { /* mesh data */ }
  }]
};

const gltfModel = await adapter.importModel(blenderData);
const exportedBlender = await adapter.exportModel(gltfModel);
```

### SceneKit/ARKit Adapter

```javascript
import { SceneKitAdapter } from 'optransform3d';

const adapter = new SceneKitAdapter();

// Import from SceneKit format
const sceneKitData = {
  rootNode: {
    name: 'Root',
    position: { x: 0, y: 0, z: 0 },
    childNodes: [/* ... */]
  }
};

const gltfModel = await adapter.importModel(sceneKitData);
```

### RealityKit Adapter

```javascript
import { RealityKitAdapter } from 'optransform3d';

const adapter = new RealityKitAdapter();

// Import from RealityKit Entity format
const realityKitData = {
  entities: [{
    name: 'Box',
    transform: {
      translation: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 }
    }
  }]
};

const gltfModel = await adapter.importModel(realityKitData);
```

### SketchUp Adapter

```javascript
import { SketchUpAdapter } from 'optransform3d';

const adapter = new SketchUpAdapter();

// Import from SketchUp format
const sketchUpData = {
  entities: [{
    type: 'ComponentInstance',
    transformation: { origin: [0, 0, 0] }
  }]
};

const gltfModel = await adapter.importModel(sketchUpData);
```

### ARCore Adapter

```javascript
import { ARCoreAdapter } from 'optransform3d';

const adapter = new ARCoreAdapter();

// Import from ARCore Sceneform format
const arCoreData = {
  nodes: [{
    name: 'Box',
    localPosition: { x: 0, y: 0, z: 0 },
    localRotation: { x: 0, y: 0, z: 0, w: 1 },
    localScale: { x: 1, y: 1, z: 1 }
  }]
};

const gltfModel = await adapter.importModel(arCoreData);
```

## How Operational Transformation Works

1. **Concurrent Edits**: Multiple users edit the same 3D model simultaneously
2. **Operation Generation**: Each edit generates an Operation object
3. **Transformation**: When operations conflict, the OT engine transforms them
4. **Convergence**: All clients converge to the same final state

### Example: Concurrent Edits

```javascript
// User A moves cube right: (0,0,0) → (5,0,0)
const opA = new Operation(OperationType.TRANSLATE, {
  targetId: 'Cube',
  x: 5, y: 0, z: 0
});

// User B moves cube up: (0,0,0) → (0,3,0)
const opB = new Operation(OperationType.TRANSLATE, {
  targetId: 'Cube',
  x: 0, y: 3, z: 0
});

// OT Engine transforms operations
const { op1Prime, op2Prime } = engine.transform(opA, opB);

// Final position converges to (5,3,0) for both users
```

## Testing

```bash
npm test
```

## Examples

Run the included examples:

```bash
# Basic collaborative editing
npm run example

# Or run directly
node examples/basic-usage.js
node examples/multi-adapter.js
```

## API Reference

### OTEngine

- `transform(op1, op2)` - Transform two concurrent operations
- `apply(operation)` - Apply operation to history
- `getOperationsSince(version)` - Get operations since version
- `conflictsWith(op1, op2)` - Check if operations conflict

### CollaborativeSession

- `initialize(nativeModel)` - Initialize session with model
- `applyLocalOperations(ops)` - Apply local user operations
- `applyRemoteOperations(ops)` - Apply and transform remote operations
- `getModel()` - Get current glTF model
- `getNativeModel()` - Get model in native format
- `getPendingOperations(since)` - Get operations to sync

### BaseAdapter

All adapters inherit from BaseAdapter:

- `importModel(nativeModel)` - Import to glTF
- `exportModel(gltfModel)` - Export from glTF
- `applyOperations(model, ops)` - Apply operations
- `extractOperations(oldModel, newModel)` - Extract operations

## Use Cases

- **Real-time collaborative 3D modeling** across different platforms
- **Multi-user AR experiences** with live model updates
- **Remote design collaboration** between different tools
- **Educational environments** with synchronized 3D scenes
- **Game development** with collaborative level editing
- **Architecture visualization** with team collaboration

## Technical Details

### glTF 2.0 Format

The system uses glTF 2.0 as the universal interchange format because:
- Industry-standard 3D format
- Efficient transmission over networks
- Supports all major 3D features (meshes, materials, animations, etc.)
- Wide platform support

### Conflict Resolution

The OT engine handles conflicts using transformation functions:
- Transform composition for geometric operations
- Priority-based resolution for conflicting edits
- Maintains causality and convergence properties

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Based on Operational Transformation theory from collaborative text editing
- Inspired by Google Docs' real-time collaboration
- Uses glTF 2.0 specification from the Khronos Group
