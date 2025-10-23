# OpTransform3D Architecture

## Overview

OpTransform3D is a complete operational transformation (OT) system designed for real-time collaborative 3D model editing across multiple platforms. This document describes the system architecture and design decisions.

## System Components

### 1. Core OT Engine (`src/core/`)

#### Operation.js
- Defines the base `Operation` class for all 3D transformations
- Provides serialization/deserialization for network transmission
- Defines operation types: TRANSLATE, ROTATE, SCALE, ADD_MESH, DELETE_MESH, etc.

#### OTEngine.js
- Implements the operational transformation algorithm
- Handles conflict detection and resolution
- Key insight: 3D geometric transforms are commutative
  - `translate(x+2)` then `translate(y+3)` = `translate(y+3)` then `translate(x+2)`
  - This simplifies OT compared to text editing
- Maintains operation history for synchronization

### 2. Generic Format (`src/formats/`)

#### GLTFModel.js
- Based on glTF 2.0 specification (Khronos Group standard)
- Serves as universal interchange format between platforms
- Supports:
  - Scene graphs with hierarchical nodes
  - Meshes with primitives and materials
  - Cameras (perspective and orthographic)
  - Lights (point, directional, spot)
  - Transform matrices and TRS decomposition

**Why glTF?**
- Industry standard with wide support
- Efficient for network transmission
- Comprehensive feature set
- JSON-based, easy to work with

### 3. Platform Adapters (`src/adapters/`)

#### BaseAdapter.js
- Abstract base class defining the adapter interface
- Methods:
  - `importModel()` - Platform format → glTF
  - `exportModel()` - glTF → Platform format
  - `applyOperations()` - Apply OT operations to native model
  - `extractOperations()` - Detect changes and generate operations

#### BlenderAdapter.js
- Handles Blender's Python API format
- Converts between Blender objects and glTF nodes
- Maps Blender's Euler rotations to quaternions
- Supports meshes, cameras, lights

#### SceneKitAdapter.js
- Handles Apple SceneKit/ARKit format
- Works with SCNNode hierarchy
- Converts SCNGeometry to glTF primitives
- Supports iOS/macOS development

#### RealityKitAdapter.js
- Handles Apple RealityKit Entity format
- Works with Entity Component System (ECS)
- Converts ModelComponents to glTF meshes
- Optimized for AR experiences

#### SketchUpAdapter.js
- Handles SketchUp's entity format
- Supports ComponentInstances and Groups
- Converts Faces to mesh primitives
- Works with SketchUp's Ruby API format

#### ARCoreAdapter.js
- Handles Google ARCore/Sceneform format
- Works with Scene nodes and Renderables
- Converts submeshes to glTF primitives
- Optimized for Android AR

### 4. Collaborative Session (`src/index.js`)

#### CollaborativeSession
- High-level API for multi-user editing
- Manages local and remote operations
- Tracks pending operations for synchronization
- Key methods:
  - `initialize()` - Load initial model
  - `applyLocalOperations()` - Apply user's edits
  - `applyRemoteOperations()` - Apply and transform remote edits
  - `getPendingOperations()` - Get ops to send to server
  - `acknowledgePendingOperations()` - Clear sent operations

## Operational Transformation Algorithm

### Key Properties

1. **Commutativity**: For geometric transforms on the same object:
   ```
   transform(A) ∘ transform(B) = transform(B) ∘ transform(A)
   ```

2. **Convergence**: All clients reach the same final state regardless of operation order

3. **Causality Preservation**: Operations are applied in a causally consistent order

### Transform Function

For 3D models, the transform function is simple:
```javascript
transform(op1, op2) {
  if (op2 is DELETE && targets same object) {
    return NO_OP  // Can't operate on deleted object
  }
  return op1  // Most transforms are commutative
}
```

This is much simpler than text OT because:
- Position changes don't affect each other's meaning
- No character shifting like in text
- Geometric operations compose naturally

### Synchronization Protocol

1. User makes local edit → generates Operation
2. Apply operation locally to glTF model
3. Store in `localOperations` list
4. Periodically send `getPendingOperations()` to server
5. Server broadcasts to other users
6. Receiving user:
   - Gets their `localOperations` (not yet synced)
   - Transforms incoming operations against local ops
   - Applies transformed operations
   - Acknowledges sent operations

## Data Flow

```
┌─────────────┐
│   User A    │
│  (Blender)  │
└──────┬──────┘
       │ Edit mesh
       ▼
┌─────────────────────┐
│  Operation Created  │
│  TRANSLATE(x+5)     │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│   BlenderAdapter    │
│  Import to glTF     │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│    OT Engine        │
│  Apply operation    │
│  Store in history   │
└──────┬──────────────┘
       │
       │ Network
       ▼
┌─────────────────────┐
│    Server           │
│  Broadcast to all   │
└──────┬──────────────┘
       │
       ▼
┌─────────────┐
│   User B    │
│ (RealityKit)│
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│    OT Engine        │
│  Transform against  │
│  local operations   │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ RealityKitAdapter   │
│  Apply to native    │
└─────────────────────┘
```

## Design Decisions

### 1. Commutative Transforms
**Decision**: Don't compose transforms, rely on commutativity
**Rationale**: 
- Simpler implementation
- Matches mathematical properties of 3D transforms
- Avoids complex transform composition logic

### 2. glTF as Interchange
**Decision**: Use glTF 2.0 as universal format
**Rationale**:
- Industry standard
- Comprehensive feature support
- JSON format easy to work with
- Wide platform support

### 3. Local Operation Tracking
**Decision**: Track local vs remote operations separately
**Rationale**:
- Prevents double-application of operations
- Clean synchronization protocol
- Easy to understand and debug

### 4. Adapter Pattern
**Decision**: Separate adapters for each platform
**Rationale**:
- Platform-specific code isolated
- Easy to add new platforms
- Each adapter can optimize for its platform

## Testing Strategy

### Unit Tests (`test/core.test.js`)
- Operation creation and serialization
- OT engine transform logic
- Version tracking
- Conflict detection

### Adapter Tests (`test/adapters.test.js`)
- Import/export for each platform
- Operation application
- Round-trip conversion (platform → glTF → platform)

### Integration Tests (Examples)
- `basic-usage.js`: Two-user concurrent editing
- `multi-adapter.js`: Cross-platform operation application
- `debug-usage.js`: Detailed step-by-step tracing

## Performance Considerations

1. **Memory**: Operation history grows over time
   - Solution: Implement garbage collection after acknowledged sync
   - Compress old operations

2. **Network**: Operations sent frequently
   - Solution: Batch operations
   - Use delta compression

3. **Transform Cost**: O(n) where n = local operations
   - Solution: Usually small (1-5 ops between syncs)
   - Optimize conflict detection

## Future Enhancements

### 1. Undo/Redo
- Store inverse operations
- Track operation authorship

### 2. History Compaction
- Merge consecutive operations
- Remove redundant operations

### 3. Conflict UI
- Highlight concurrent edits
- Show other users' cursors/selections

### 4. Offline Support
- Queue operations while disconnected
- Sync when reconnected

### 5. Advanced Features
- Animation timeline collaboration
- Material/texture editing
- Constraint systems
- Physics properties

## Security Considerations

- Input validation on all operations
- Rate limiting for operation submission
- Access control for model editing
- Audit log of all operations

## References

1. **Operational Transformation**
   - Ellis, C.A. and Gibbs, S.J. (1989). "Concurrency control in groupware systems"
   - Sun, C. et al. (1998). "Operational transformation in real-time group editors"

2. **glTF Specification**
   - Khronos Group. "glTF 2.0 Specification"
   - https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html

3. **Collaborative 3D**
   - Aguerrebere, C. et al. (2010). "3D Modeling Collaborative Platform"
   - Margery, D. et al. (2002). "3D Collaborative Editing"
