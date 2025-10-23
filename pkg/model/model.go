package model

import (
	"encoding/json"
	"time"
)

// Vector3 represents a 3D vector
type Vector3 struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

// Quaternion represents a rotation
type Quaternion struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
	W float64 `json:"w"`
}

// Transform represents a 3D transformation
type Transform struct {
	Position Vector3    `json:"position"`
	Rotation Quaternion `json:"rotation"`
	Scale    Vector3    `json:"scale"`
}

// Material represents material properties
type Material struct {
	ID              string   `json:"id"`
	Name            string   `json:"name"`
	BaseColor       *Vector3 `json:"baseColor,omitempty"`
	Metallic        float64  `json:"metallic,omitempty"`
	Roughness       float64  `json:"roughness,omitempty"`
	TextureURI      string   `json:"textureUri,omitempty"`
	NormalMapURI    string   `json:"normalMapUri,omitempty"`
	EmissiveColor   *Vector3 `json:"emissiveColor,omitempty"`
}

// Mesh represents geometry data
type Mesh struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Vertices     []Vector3 `json:"vertices"`
	Normals      []Vector3 `json:"normals,omitempty"`
	UVs          [][2]float64 `json:"uvs,omitempty"`
	Indices      []uint32  `json:"indices"`
	MaterialID   string    `json:"materialId,omitempty"`
}

// Node represents a scene node with hierarchy
type Node struct {
	ID        string     `json:"id"`
	Name      string     `json:"name"`
	Transform Transform  `json:"transform"`
	MeshID    string     `json:"meshId,omitempty"`
	Children  []string   `json:"children,omitempty"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// Scene represents a 3D scene
type Scene struct {
	ID          string              `json:"id"`
	Name        string              `json:"name"`
	Version     string              `json:"version"`
	Nodes       map[string]*Node    `json:"nodes"`
	Meshes      map[string]*Mesh    `json:"meshes"`
	Materials   map[string]*Material `json:"materials"`
	RootNodes   []string            `json:"rootNodes"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt   time.Time           `json:"createdAt"`
	ModifiedAt  time.Time           `json:"modifiedAt"`
}

// NewScene creates a new empty scene
func NewScene(name string) *Scene {
	now := time.Now()
	return &Scene{
		ID:         generateID(),
		Name:       name,
		Version:    "1.0.0",
		Nodes:      make(map[string]*Node),
		Meshes:     make(map[string]*Mesh),
		Materials:  make(map[string]*Material),
		RootNodes:  []string{},
		Metadata:   make(map[string]interface{}),
		CreatedAt:  now,
		ModifiedAt: now,
	}
}

// Clone creates a deep copy of the scene
func (s *Scene) Clone() *Scene {
	data, _ := json.Marshal(s)
	clone := &Scene{}
	json.Unmarshal(data, clone)
	return clone
}

// generateID generates a unique ID
func generateID() string {
	return time.Now().Format("20060102150405.000000")
}

// DefaultTransform returns an identity transform
func DefaultTransform() Transform {
	return Transform{
		Position: Vector3{X: 0, Y: 0, Z: 0},
		Rotation: Quaternion{X: 0, Y: 0, Z: 0, W: 1},
		Scale:    Vector3{X: 1, Y: 1, Z: 1},
	}
}
