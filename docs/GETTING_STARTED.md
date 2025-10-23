# Getting Started

This guide will help you get started with OPTransform3D.

## Installation

### Prerequisites

- Go 1.20 or higher

### Install via go get

```bash
go get github.com/graphitedesignlabs/optransform3d
```

### Clone the repository

```bash
git clone https://github.com/graphitedesignlabs/optransform3d.git
cd optransform3d
```

## Quick Start

### 1. Run the Example

```bash
go run examples/basic_usage.go
```

This will demonstrate:
- Creating a 3D scene
- Applying operational transformation
- Exporting to multiple formats

### 2. Build the CLI Tool

```bash
go build -o optrans3d ./cmd/optrans3d
```

### 3. Convert Between Formats

```bash
# List available formats
./optrans3d -list

# Convert Blender to SceneKit
./optrans3d -input scene.blend.json -output scene.scn.json -from blender -to scenekit
```

## Basic Usage in Your Code

### Creating a Scene

```go
package main

import (
    "github.com/graphitedesignlabs/optransform3d/pkg/model"
)

func main() {
    // Create a new scene
    scene := model.NewScene("My Scene")
    
    // Create a material
    material := &model.Material{
        ID:        "mat1",
        Name:      "Blue Material",
        BaseColor: &model.Vector3{X: 0.2, Y: 0.4, Z: 0.8},
        Metallic:  0.5,
        Roughness: 0.3,
    }
    scene.Materials[material.ID] = material
    
    // Create a mesh (simple triangle)
    mesh := &model.Mesh{
        ID:   "mesh1",
        Name: "Triangle",
        Vertices: []model.Vector3{
            {X: 0, Y: 0, Z: 0},
            {X: 1, Y: 0, Z: 0},
            {X: 0.5, Y: 1, Z: 0},
        },
        Indices:    []uint32{0, 1, 2},
        MaterialID: material.ID,
    }
    scene.Meshes[mesh.ID] = mesh
    
    // Create a node
    node := &model.Node{
        ID:        "node1",
        Name:      "Triangle Node",
        Transform: model.DefaultTransform(),
        MeshID:    mesh.ID,
    }
    scene.Nodes[node.ID] = node
    scene.RootNodes = append(scene.RootNodes, node.ID)
}
```

### Using Operational Transformation

```go
import (
    "github.com/graphitedesignlabs/optransform3d/pkg/ot"
)

// Initialize OT engine
engine := ot.NewEngine(scene)

// Client 1: Move object
op1 := ot.NewOperation(
    ot.OpTransform,
    "client1",
    "node1",
    map[string]interface{}{
        "position": model.Vector3{X: 5, Y: 0, Z: 0},
    },
)

// Client 2: Rotate object (concurrent)
op2 := ot.NewOperation(
    ot.OpTransform,
    "client2",
    "node1",
    map[string]interface{}{
        "rotation": model.Quaternion{X: 0.707, Y: 0, Z: 0, W: 0.707},
    },
)

// Apply with OT
engine.ApplyOperation(op1)

// Transform op2 based on op1
transformedOp2, _ := ot.TransformOperations(op2, op1)
engine.ApplyOperation(transformedOp2)

// Get the updated scene
updatedScene := engine.GetScene()
```

### Import/Export

```go
import (
    "os"
    "github.com/graphitedesignlabs/optransform3d/pkg/adapters/blender"
    "github.com/graphitedesignlabs/optransform3d/pkg/adapters/scenekit"
)

// Import from Blender
file, _ := os.Open("scene.blend.json")
blenderAdapter := blender.NewBlenderAdapter()
scene, _ := blenderAdapter.Import(file)
file.Close()

// Export to SceneKit
outFile, _ := os.Create("scene.scn.json")
sceneKitAdapter := scenekit.NewSceneKitAdapter()
sceneKitAdapter.Export(scene, outFile)
outFile.Close()
```

## Operation Types

### Node Operations

#### Add Node
```go
op := ot.NewOperation(
    ot.OpAddNode,
    "clientID",
    "",
    map[string]interface{}{
        "node": &model.Node{
            ID:   "newNode",
            Name: "New Node",
            Transform: model.DefaultTransform(),
        },
        "parentId": "parentNodeID", // optional
    },
)
```

#### Remove Node
```go
op := ot.NewOperation(
    ot.OpRemoveNode,
    "clientID",
    "nodeToRemove",
    map[string]interface{}{},
)
```

#### Update Node
```go
op := ot.NewOperation(
    ot.OpUpdateNode,
    "clientID",
    "nodeID",
    map[string]interface{}{
        "name": "Updated Name",
    },
)
```

#### Move Node
```go
op := ot.NewOperation(
    ot.OpMoveNode,
    "clientID",
    "nodeID",
    map[string]interface{}{
        "oldParentId": "oldParent",
        "newParentId": "newParent",
    },
)
```

#### Transform Node
```go
op := ot.NewOperation(
    ot.OpTransform,
    "clientID",
    "nodeID",
    map[string]interface{}{
        "position": model.Vector3{X: 10, Y: 5, Z: 0},
        "rotation": model.Quaternion{X: 0, Y: 0, Z: 0, W: 1},
        "scale":    model.Vector3{X: 2, Y: 2, Z: 2},
    },
)
```

### Mesh Operations

#### Add Mesh
```go
op := ot.NewOperation(
    ot.OpAddMesh,
    "clientID",
    "",
    map[string]interface{}{
        "mesh": &model.Mesh{
            ID:   "meshID",
            Name: "Mesh",
            // ... mesh data
        },
    },
)
```

#### Update Mesh
```go
op := ot.NewOperation(
    ot.OpUpdateMesh,
    "clientID",
    "meshID",
    map[string]interface{}{
        "vertices": []model.Vector3{
            // new vertices
        },
    },
)
```

### Material Operations

#### Add Material
```go
op := ot.NewOperation(
    ot.OpAddMaterial,
    "clientID",
    "",
    map[string]interface{}{
        "material": &model.Material{
            ID:   "matID",
            Name: "Material",
            // ... material properties
        },
    },
)
```

#### Update Material
```go
op := ot.NewOperation(
    ot.OpUpdateMaterial,
    "clientID",
    "materialID",
    map[string]interface{}{
        "baseColor": &model.Vector3{X: 1, Y: 0, Z: 0},
        "metallic":  0.8,
        "roughness": 0.2,
    },
)
```

## Format Support

### Blender
- Extensions: `.blend.json`
- Import/Export: ✓
- Notes: JSON representation of Blender scene

### SceneKit/ARKit
- Extensions: `.scn.json`, `.arkit.json`
- Import/Export: ✓
- Notes: Apple's SceneKit format

### RealityKit
- Extensions: `.reality.json`, `.usdz.json`
- Import/Export: ✓
- Notes: Apple's RealityKit/USDZ format

### SketchUp
- Extensions: `.skp.json`
- Import/Export: ✓
- Notes: SketchUp model format

### ARCore
- Extensions: `.arcore.json`, `.sfb.json`
- Import/Export: ✓
- Notes: Google's ARCore format

## Testing

Run all tests:
```bash
go test ./...
```

Run tests with coverage:
```bash
go test -cover ./...
```

Run specific package tests:
```bash
go test ./pkg/ot -v
```

## Building

Build the CLI tool:
```bash
go build -o optrans3d ./cmd/optrans3d
```

Build for different platforms:
```bash
# Linux
GOOS=linux GOARCH=amd64 go build -o optrans3d-linux ./cmd/optrans3d

# macOS
GOOS=darwin GOARCH=amd64 go build -o optrans3d-macos ./cmd/optrans3d

# Windows
GOOS=windows GOARCH=amd64 go build -o optrans3d.exe ./cmd/optrans3d
```

## Next Steps

- Read the [Architecture Guide](ARCHITECTURE.md)
- Check the [API Reference](API.md)
- Explore the examples in `examples/`
- Build your own adapters for custom formats

## Common Use Cases

### 1. Real-time Collaboration Server

Build a WebSocket server that:
1. Maintains a central scene state
2. Receives operations from clients
3. Transforms and broadcasts operations
4. Keeps clients synchronized

### 2. Offline Editing with Sync

Allow users to:
1. Edit locally and queue operations
2. Sync with server when online
3. Resolve conflicts via OT
4. Maintain consistent state

### 3. Format Conversion Pipeline

Create a tool to:
1. Import from any supported format
2. Apply transformations
3. Export to target format
4. Batch process multiple files

### 4. 3D Asset Library

Build a system that:
1. Stores scenes in universal format
2. Provides adapters for platforms
3. Enables search and filtering
4. Supports versioning

## Troubleshooting

### Import Errors

If import fails:
- Check file format matches adapter
- Validate JSON syntax
- Ensure required fields are present

### OT Conflicts

If operations conflict:
- Check operation timestamps
- Verify client IDs are unique
- Review transformation rules

### Performance Issues

For large scenes:
- Consider pagination
- Use incremental updates
- Cache frequently accessed data

## Support

- GitHub Issues: Report bugs and request features
- Discussions: Ask questions and share ideas
- Documentation: Read the docs in `/docs`
