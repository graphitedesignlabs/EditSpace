# OPTransform3D

A comprehensive operational transformation (OT) system for collaborative multi-user editing of 3D models, similar to Google Docs but for 3D content.

## Features

- **Operational Transformation Engine**: Implements OT algorithms for concurrent editing of 3D scenes
- **Generic 3D Model Format**: Uses a universal interchange format based on common 3D primitives
- **Multiple Platform Adapters**: 
  - Blender (import/export)
  - SceneKit/ARKit (import/export)
  - RealityKit/ModelEntities (import/export)
  - SketchUp (import/export)
  - ARCore (import/export)
- **Conflict Resolution**: Automatic resolution of concurrent edits
- **Real-time Collaboration**: Support for multiple users editing simultaneously

## Architecture

### Core Components

1. **Model Package** (`pkg/model`): Defines the universal 3D scene representation
   - Scene hierarchy with nodes
   - Meshes with vertices, normals, UVs, and indices
   - Materials with PBR properties
   - Transform system (position, rotation, scale)

2. **OT Package** (`pkg/ot`): Operational transformation engine
   - Operation types for all 3D manipulations
   - Transformation functions for conflict resolution
   - Engine for applying and managing operations

3. **Adapters Package** (`pkg/adapters`): Format-specific import/export
   - Adapter interface for extensibility
   - Platform-specific implementations

## Installation

```bash
go get github.com/graphitedesignlabs/optransform3d
```

## Quick Start

```go
package main

import (
    "github.com/graphitedesignlabs/optransform3d/pkg/model"
    "github.com/graphitedesignlabs/optransform3d/pkg/ot"
    "github.com/graphitedesignlabs/optransform3d/pkg/adapters/blender"
)

func main() {
    // Create a scene
    scene := model.NewScene("My Scene")
    
    // Initialize OT engine
    engine := ot.NewEngine(scene)
    
    // Apply operations
    op := ot.NewOperation(
        ot.OpAddNode,
        "client1",
        "",
        map[string]interface{}{
            "node": &model.Node{
                ID:   "node1",
                Name: "Cube",
                Transform: model.DefaultTransform(),
            },
        },
    )
    engine.ApplyOperation(op)
    
    // Export to Blender
    adapter := blender.NewBlenderAdapter()
    file, _ := os.Create("scene.blend.json")
    adapter.Export(scene, file)
}
```

## Operation Types

The system supports the following operation types:

- **Node Operations**: `addNode`, `removeNode`, `updateNode`, `moveNode`
- **Mesh Operations**: `addMesh`, `removeMesh`, `updateMesh`
- **Material Operations**: `addMaterial`, `removeMaterial`, `updateMaterial`
- **Transform Operations**: `transform` (position, rotation, scale)

## Operational Transformation

The OT engine handles concurrent operations from multiple users:

```go
// Client 1 moves a node
op1 := ot.NewOperation(ot.OpTransform, "client1", nodeID, 
    map[string]interface{}{"position": model.Vector3{X: 2, Y: 0, Z: 0}})

// Client 2 rotates the same node (concurrent)
op2 := ot.NewOperation(ot.OpTransform, "client2", nodeID,
    map[string]interface{}{"rotation": model.Quaternion{...}})

// Transform operations for consistency
transformedOp2, _ := ot.TransformOperations(op2, op1)

// Both operations are applied correctly
engine.ApplyOperation(op1)
engine.ApplyOperation(transformedOp2)
```

## Adapters

### Blender Adapter

Import/export Blender scenes in JSON format:

```go
adapter := blender.NewBlenderAdapter()
scene, _ := adapter.Import(file)
adapter.Export(scene, outputFile)
```

### SceneKit/ARKit Adapter

Works with Apple's SceneKit and ARKit:

```go
adapter := scenekit.NewSceneKitAdapter()
scene, _ := adapter.Import(file)
adapter.Export(scene, outputFile)
```

### RealityKit/ModelEntity Adapter

For Apple's RealityKit and USDZ format:

```go
adapter := realitykit.NewRealityKitAdapter()
scene, _ := adapter.Import(file)
adapter.Export(scene, outputFile)
```

### SketchUp Adapter

Import/export SketchUp models:

```go
adapter := sketchup.NewSketchUpAdapter()
scene, _ := adapter.Import(file)
adapter.Export(scene, outputFile)
```

### ARCore Adapter

For Google's ARCore platform:

```go
adapter := arcore.NewARCoreAdapter()
scene, _ := adapter.Import(file)
adapter.Export(scene, outputFile)
```

## Running the Example

```bash
go run examples/basic_usage.go
```

This will:
1. Create a 3D scene with a cube
2. Demonstrate operational transformation with concurrent edits
3. Export the scene to all supported formats
4. Test round-trip import/export

## Use Cases

- **Collaborative 3D Modeling**: Multiple users editing the same 3D scene
- **Real-time Game Development**: Team collaboration on game assets
- **AR/VR Content Creation**: Synchronized editing across platforms
- **Architectural Design**: Multi-user building modeling
- **Educational Tools**: Interactive 3D modeling classrooms

## Technical Details

### Scene Format

The universal scene format includes:
- **Nodes**: Hierarchical scene graph with transforms
- **Meshes**: Vertex data, indices, normals, UVs
- **Materials**: PBR materials (metallic-roughness workflow)
- **Metadata**: Extensible properties for platform-specific data

### OT Algorithm

The transformation algorithm ensures:
- **Convergence**: All clients reach the same final state
- **Causality Preservation**: Operations are applied in logical order
- **Intention Preservation**: User intentions are maintained

## License

MIT License - see LICENSE file for details
