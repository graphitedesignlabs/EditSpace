# Architecture

## Overview

OPTransform3D is designed as a modular system with clear separation of concerns:

```
┌─────────────────────────────────────────────────────┐
│                  Applications                        │
│  (CLI Tools, Servers, Client Libraries)             │
└─────────────────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐
│   Adapters   │ │ OT Engine  │ │   Model    │
│              │ │            │ │            │
│ - Blender    │ │ Transform  │ │ Scene      │
│ - SceneKit   │ │ Operations │ │ Nodes      │
│ - RealityKit │ │ Conflict   │ │ Meshes     │
│ - SketchUp   │ │ Resolution │ │ Materials  │
│ - ARCore     │ │            │ │            │
└──────────────┘ └────────────┘ └────────────┘
```

## Core Components

### 1. Model Package (`pkg/model`)

The model package defines the universal 3D scene representation:

- **Scene**: Root container for a 3D scene
  - Nodes hierarchy
  - Meshes collection
  - Materials collection
  - Metadata

- **Node**: Scene graph node
  - Transform (position, rotation, scale)
  - Optional mesh reference
  - Child nodes
  - Metadata for platform-specific data

- **Mesh**: Geometry data
  - Vertices (positions)
  - Normals
  - UV coordinates
  - Indices (triangles)
  - Material reference

- **Material**: PBR material
  - Base color
  - Metallic/roughness values
  - Texture references
  - Emissive properties

### 2. OT Package (`pkg/ot`)

The operational transformation engine:

#### Operation Types
- **Node operations**: add, remove, update, move
- **Mesh operations**: add, remove, update
- **Material operations**: add, remove, update
- **Transform operations**: position, rotation, scale

#### OT Engine
- Applies operations to scenes
- Manages operation history
- Transforms concurrent operations
- Resolves conflicts

#### Transformation Algorithm
The engine implements operational transformation to handle concurrent edits:

1. **Transform Function**: Given two concurrent operations `op1` and `op2`, produces `op1'` and `op2'` such that:
   ```
   apply(op1, apply(op2, state)) = apply(op2', apply(op1', state))
   ```

2. **Conflict Resolution Rules**:
   - Remove + Update: Remove takes precedence
   - Transform + Transform: Both applied, later timestamp wins for conflicts
   - Add + Add: Earlier timestamp wins for ID conflicts
   - Move + Move: Later operation determines final parent

### 3. Adapters Package (`pkg/adapters`)

Format-specific import/export implementations:

#### Adapter Interface
```go
type Adapter interface {
    Import(reader io.Reader) (*model.Scene, error)
    Export(scene *model.Scene, writer io.Writer) error
    FormatName() string
    FileExtensions() []string
}
```

#### Platform Adapters

1. **Blender Adapter**
   - JSON format representing Blender's internal structure
   - Objects, meshes, materials
   - Parent-child hierarchy

2. **SceneKit/ARKit Adapter**
   - Apple's SceneKit scene format
   - SCNNode hierarchy
   - SCNGeometry and SCNMaterial

3. **RealityKit Adapter**
   - Apple's RealityKit ModelEntity format
   - Entity-Component-System pattern
   - USDZ-compatible structure

4. **SketchUp Adapter**
   - SketchUp model format
   - Groups, components, layers
   - Face-based geometry

5. **ARCore Adapter**
   - Google's ARCore format
   - Renderable components
   - Shadow properties

## Data Flow

### Import Flow
```
File → Adapter.Import() → Scene → OT Engine
```

### Export Flow
```
OT Engine → Scene → Adapter.Export() → File
```

### Collaboration Flow
```
Client A: Edit → Operation → Transform → Apply → Scene
                                ↓
                          Server/Sync
                                ↓
Client B: Receive Op → Transform against local ops → Apply → Scene
```

## Design Decisions

### Why JSON for Platform Formats?

The adapters use JSON representations of native formats for several reasons:
1. **Simplicity**: Easy to parse and generate
2. **Portability**: Cross-platform without binary dependencies
3. **Debugging**: Human-readable for development
4. **Extension**: Can be wrapped with native format converters

Production systems would add binary format support and native SDK integration.

### Universal Scene Format

The universal format is based on:
- glTF 2.0 concepts (proven interchange format)
- PBR material model (industry standard)
- Scene graph hierarchy (universal 3D pattern)

### OT vs CRDT

We chose Operational Transformation over CRDTs because:
1. **Intention preservation**: Better for user-initiated actions
2. **Smaller state**: No need to store entire history
3. **Deterministic**: Easier to reason about conflicts
4. **Established**: Well-understood for collaborative editing

## Extensibility

### Adding New Adapters

1. Implement the `Adapter` interface
2. Register in the adapter registry
3. Handle platform-specific features via node metadata

### Adding New Operations

1. Define new `OperationType` constant
2. Add apply function in `operation.go`
3. Update transformation rules in `engine.go`
4. Add tests

### Custom Metadata

Nodes support arbitrary metadata for platform-specific features:
```go
node.Metadata["platform_specific_feature"] = value
```

## Performance Considerations

1. **Scene Cloning**: Uses JSON serialization (simple but not fastest)
2. **Operation History**: Grows unbounded (could add compaction)
3. **Transformation**: O(n) where n = number of concurrent operations
4. **Memory**: Keeps full scene in memory (could use lazy loading)

## Security

- No authentication/authorization (application layer responsibility)
- Input validation in adapters
- No remote code execution
- Safe concurrent access via mutex locks

## Future Enhancements

1. **Binary formats**: Direct support for .blend, .skp, .usdz
2. **Streaming**: Large scene handling
3. **History compaction**: Reduce operation history size
4. **Undo/redo**: Operation reversal
5. **Permissions**: Fine-grained access control
6. **Real-time sync**: WebSocket/gRPC server
7. **Optimistic UI**: Client-side prediction
