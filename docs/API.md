# API Reference

## Model Package

### Scene

```go
type Scene struct {
    ID          string
    Name        string
    Version     string
    Nodes       map[string]*Node
    Meshes      map[string]*Mesh
    Materials   map[string]*Material
    RootNodes   []string
    Metadata    map[string]interface{}
    CreatedAt   time.Time
    ModifiedAt  time.Time
}
```

#### NewScene
```go
func NewScene(name string) *Scene
```
Creates a new empty scene with the given name.

#### Clone
```go
func (s *Scene) Clone() *Scene
```
Creates a deep copy of the scene.

### Node

```go
type Node struct {
    ID        string
    Name      string
    Transform Transform
    MeshID    string
    Children  []string
    Metadata  map[string]interface{}
}
```

Represents a node in the scene graph hierarchy.

### Mesh

```go
type Mesh struct {
    ID         string
    Name       string
    Vertices   []Vector3
    Normals    []Vector3
    UVs        [][2]float64
    Indices    []uint32
    MaterialID string
}
```

Represents geometry data.

### Material

```go
type Material struct {
    ID            string
    Name          string
    BaseColor     *Vector3
    Metallic      float64
    Roughness     float64
    TextureURI    string
    NormalMapURI  string
    EmissiveColor *Vector3
}
```

Represents a PBR material.

### Transform

```go
type Transform struct {
    Position Vector3
    Rotation Quaternion
    Scale    Vector3
}
```

Represents a 3D transformation.

### Vector3

```go
type Vector3 struct {
    X float64
    Y float64
    Z float64
}
```

Represents a 3D vector.

### Quaternion

```go
type Quaternion struct {
    X float64
    Y float64
    Z float64
    W float64
}
```

Represents a rotation quaternion.

## OT Package

### Operation

```go
type Operation struct {
    ID        string
    Type      OperationType
    ClientID  string
    Timestamp time.Time
    TargetID  string
    Data      map[string]interface{}
    ParentOp  string
    Version   int
}
```

#### NewOperation
```go
func NewOperation(
    opType OperationType,
    clientID string,
    targetID string,
    data map[string]interface{}
) *Operation
```
Creates a new operation.

#### Apply
```go
func (op *Operation) Apply(scene *model.Scene) error
```
Applies the operation to a scene.

### Engine

```go
type Engine struct {
    // private fields
}
```

#### NewEngine
```go
func NewEngine(scene *model.Scene) *Engine
```
Creates a new OT engine with the given scene.

#### ApplyOperation
```go
func (e *Engine) ApplyOperation(op *Operation) error
```
Applies an operation to the engine's scene.

#### Transform
```go
func (e *Engine) Transform(
    clientOp *Operation,
    serverOps []*Operation
) (*Operation, error)
```
Transforms a client operation against server operations.

#### GetScene
```go
func (e *Engine) GetScene() *model.Scene
```
Returns the current scene state (clone).

#### GetOperations
```go
func (e *Engine) GetOperations() []*Operation
```
Returns all operations.

#### GetOperationsSince
```go
func (e *Engine) GetOperationsSince(opID string) []*Operation
```
Returns operations after a given operation ID.

### TransformOperations
```go
func TransformOperations(op1, op2 *Operation) (*Operation, error)
```
Transforms two concurrent operations.

### Operation Types

```go
const (
    OpAddNode        OperationType = "addNode"
    OpRemoveNode     OperationType = "removeNode"
    OpUpdateNode     OperationType = "updateNode"
    OpMoveNode       OperationType = "moveNode"
    OpAddMesh        OperationType = "addMesh"
    OpRemoveMesh     OperationType = "removeMesh"
    OpUpdateMesh     OperationType = "updateMesh"
    OpAddMaterial    OperationType = "addMaterial"
    OpRemoveMaterial OperationType = "removeMaterial"
    OpUpdateMaterial OperationType = "updateMaterial"
    OpTransform      OperationType = "transform"
)
```

## Adapters Package

### Adapter Interface

```go
type Adapter interface {
    Import(reader io.Reader) (*model.Scene, error)
    Export(scene *model.Scene, writer io.Writer) error
    FormatName() string
    FileExtensions() []string
}
```

### AdapterRegistry

```go
type AdapterRegistry struct {
    // private fields
}
```

#### NewAdapterRegistry
```go
func NewAdapterRegistry() *AdapterRegistry
```
Creates a new adapter registry.

#### Register
```go
func (r *AdapterRegistry) Register(name string, adapter Adapter)
```
Registers an adapter with a name.

#### Get
```go
func (r *AdapterRegistry) Get(name string) (Adapter, bool)
```
Retrieves an adapter by name.

#### List
```go
func (r *AdapterRegistry) List() []string
```
Returns all registered adapter names.

## Blender Adapter

```go
func NewBlenderAdapter() *BlenderAdapter
```

Creates a Blender adapter.

- **Format Name**: "Blender"
- **Extensions**: [".blend.json"]

## SceneKit Adapter

```go
func NewSceneKitAdapter() *SceneKitAdapter
```

Creates a SceneKit/ARKit adapter.

- **Format Name**: "SceneKit/ARKit"
- **Extensions**: [".scn.json", ".arkit.json"]

## RealityKit Adapter

```go
func NewRealityKitAdapter() *RealityKitAdapter
```

Creates a RealityKit/ModelEntity adapter.

- **Format Name**: "RealityKit/ModelEntity"
- **Extensions**: [".reality.json", ".usdz.json"]

## SketchUp Adapter

```go
func NewSketchUpAdapter() *SketchUpAdapter
```

Creates a SketchUp adapter.

- **Format Name**: "SketchUp"
- **Extensions**: [".skp.json"]

## ARCore Adapter

```go
func NewARCoreAdapter() *ARCoreAdapter
```

Creates an ARCore adapter.

- **Format Name**: "ARCore"
- **Extensions**: [".arcore.json", ".sfb.json"]

## Usage Examples

### Basic Scene Creation

```go
scene := model.NewScene("My Scene")

// Add a material
mat := &model.Material{
    ID:        "mat1",
    Name:      "Red Material",
    BaseColor: &model.Vector3{X: 1.0, Y: 0.0, Z: 0.0},
    Metallic:  0.5,
    Roughness: 0.5,
}
scene.Materials[mat.ID] = mat

// Add a mesh
mesh := &model.Mesh{
    ID:   "mesh1",
    Name: "Triangle",
    Vertices: []model.Vector3{
        {X: 0, Y: 0, Z: 0},
        {X: 1, Y: 0, Z: 0},
        {X: 0.5, Y: 1, Z: 0},
    },
    Indices:    []uint32{0, 1, 2},
    MaterialID: mat.ID,
}
scene.Meshes[mesh.ID] = mesh

// Add a node
node := &model.Node{
    ID:   "node1",
    Name: "Triangle Node",
    Transform: model.DefaultTransform(),
    MeshID: mesh.ID,
}
scene.Nodes[node.ID] = node
scene.RootNodes = append(scene.RootNodes, node.ID)
```

### Applying Operations

```go
engine := ot.NewEngine(scene)

// Add node operation
op := ot.NewOperation(
    ot.OpAddNode,
    "client1",
    "",
    map[string]interface{}{
        "node": newNode,
    },
)
engine.ApplyOperation(op)

// Transform operation
transformOp := ot.NewOperation(
    ot.OpTransform,
    "client1",
    "node1",
    map[string]interface{}{
        "position": model.Vector3{X: 10, Y: 0, Z: 0},
    },
)
engine.ApplyOperation(transformOp)
```

### Import/Export

```go
// Import
file, _ := os.Open("scene.blend.json")
adapter := blender.NewBlenderAdapter()
scene, _ := adapter.Import(file)

// Export
outFile, _ := os.Create("output.scn.json")
sceneKitAdapter := scenekit.NewSceneKitAdapter()
sceneKitAdapter.Export(scene, outFile)
```

### Concurrent Operations

```go
// Client 1 operation
op1 := ot.NewOperation(ot.OpTransform, "client1", "node1",
    map[string]interface{}{
        "position": model.Vector3{X: 5, Y: 0, Z: 0},
    })

// Client 2 concurrent operation
op2 := ot.NewOperation(ot.OpTransform, "client2", "node1",
    map[string]interface{}{
        "rotation": model.Quaternion{X: 0, Y: 0, Z: 0.707, W: 0.707},
    })

// Transform and apply
transformedOp2, _ := ot.TransformOperations(op2, op1)
engine.ApplyOperation(op1)
engine.ApplyOperation(transformedOp2)
```
