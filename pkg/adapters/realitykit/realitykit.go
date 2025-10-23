package realitykit

import (
	"encoding/json"
	"fmt"
	"io"

	"github.com/graphitedesignlabs/optransform3d/pkg/model"
)

// RealityKitAdapter handles RealityKit/ModelEntity format
type RealityKitAdapter struct{}

// NewRealityKitAdapter creates a new RealityKit adapter
func NewRealityKitAdapter() *RealityKitAdapter {
	return &RealityKitAdapter{}
}

// FormatName returns the format name
func (a *RealityKitAdapter) FormatName() string {
	return "RealityKit/ModelEntity"
}

// FileExtensions returns supported file extensions
func (a *RealityKitAdapter) FileExtensions() []string {
	return []string{".reality.json", ".usdz.json"}
}

// RealityScene represents a RealityKit scene
type RealityScene struct {
	Version  string          `json:"version"`
	Entities []ModelEntity   `json:"entities"`
}

// ModelEntity represents a RealityKit entity
type ModelEntity struct {
	Name       string          `json:"name"`
	Transform  EntityTransform `json:"transform"`
	Model      *EntityModel    `json:"model,omitempty"`
	Children   []ModelEntity   `json:"children,omitempty"`
	Components map[string]interface{} `json:"components,omitempty"`
}

// EntityTransform represents RealityKit transform
type EntityTransform struct {
	Translation [3]float64 `json:"translation"`
	Rotation    [4]float64 `json:"rotation"`
	Scale       [3]float64 `json:"scale"`
}

// EntityModel represents model component
type EntityModel struct {
	Mesh     *EntityMesh     `json:"mesh"`
	Materials []EntityMaterial `json:"materials"`
}

// EntityMesh represents mesh data
type EntityMesh struct {
	Positions [][3]float64 `json:"positions"`
	Normals   [][3]float64 `json:"normals,omitempty"`
	UVs       [][2]float64 `json:"uvs,omitempty"`
	Indices   []uint32     `json:"indices"`
}

// EntityMaterial represents RealityKit material
type EntityMaterial struct {
	Name           string      `json:"name"`
	BaseColor      *ColorValue `json:"baseColor,omitempty"`
	Metallic       float64     `json:"metallic,omitempty"`
	Roughness      float64     `json:"roughness,omitempty"`
	BaseColorTexture string    `json:"baseColorTexture,omitempty"`
	NormalTexture    string    `json:"normalTexture,omitempty"`
	EmissiveColor    *ColorValue `json:"emissiveColor,omitempty"`
}

// ColorValue represents a color
type ColorValue struct {
	R float64 `json:"r"`
	G float64 `json:"g"`
	B float64 `json:"b"`
}

// Import imports a RealityKit scene
func (a *RealityKitAdapter) Import(reader io.Reader) (*model.Scene, error) {
	var realityScene RealityScene
	if err := json.NewDecoder(reader).Decode(&realityScene); err != nil {
		return nil, fmt.Errorf("failed to decode RealityKit scene: %w", err)
	}

	scene := model.NewScene("RealityKit Scene")
	
	for _, entity := range realityScene.Entities {
		a.importEntity(&entity, scene, "")
	}
	
	return scene, nil
}

func (a *RealityKitAdapter) importEntity(entity *ModelEntity, scene *model.Scene, parentID string) string {
	nodeID := generateID()
	
	node := &model.Node{
		ID:   nodeID,
		Name: entity.Name,
		Transform: model.Transform{
			Position: model.Vector3{
				X: entity.Transform.Translation[0],
				Y: entity.Transform.Translation[1],
				Z: entity.Transform.Translation[2],
			},
			Rotation: model.Quaternion{
				X: entity.Transform.Rotation[0],
				Y: entity.Transform.Rotation[1],
				Z: entity.Transform.Rotation[2],
				W: entity.Transform.Rotation[3],
			},
			Scale: model.Vector3{
				X: entity.Transform.Scale[0],
				Y: entity.Transform.Scale[1],
				Z: entity.Transform.Scale[2],
			},
		},
		Children: []string{},
		Metadata: entity.Components,
	}
	
	if node.Metadata == nil {
		node.Metadata = make(map[string]interface{})
	}
	
	// Import model
	if entity.Model != nil && entity.Model.Mesh != nil {
		meshID := generateID()
		mesh := &model.Mesh{
			ID:   meshID,
			Name: entity.Name + "_mesh",
		}
		
		// Convert positions
		for _, pos := range entity.Model.Mesh.Positions {
			mesh.Vertices = append(mesh.Vertices, model.Vector3{X: pos[0], Y: pos[1], Z: pos[2]})
		}
		
		// Convert normals
		for _, norm := range entity.Model.Mesh.Normals {
			mesh.Normals = append(mesh.Normals, model.Vector3{X: norm[0], Y: norm[1], Z: norm[2]})
		}
		
		// Convert UVs
		mesh.UVs = entity.Model.Mesh.UVs
		
		// Convert indices
		mesh.Indices = entity.Model.Mesh.Indices
		
		// Import materials (use first material)
		if len(entity.Model.Materials) > 0 {
			mat := entity.Model.Materials[0]
			materialID := generateID()
			
			material := &model.Material{
				ID:        materialID,
				Name:      mat.Name,
				Metallic:  mat.Metallic,
				Roughness: mat.Roughness,
				TextureURI: mat.BaseColorTexture,
				NormalMapURI: mat.NormalTexture,
			}
			
			if mat.BaseColor != nil {
				material.BaseColor = &model.Vector3{
					X: mat.BaseColor.R,
					Y: mat.BaseColor.G,
					Z: mat.BaseColor.B,
				}
			}
			
			if mat.EmissiveColor != nil {
				material.EmissiveColor = &model.Vector3{
					X: mat.EmissiveColor.R,
					Y: mat.EmissiveColor.G,
					Z: mat.EmissiveColor.B,
				}
			}
			
			scene.Materials[materialID] = material
			mesh.MaterialID = materialID
		}
		
		scene.Meshes[meshID] = mesh
		node.MeshID = meshID
	}
	
	scene.Nodes[nodeID] = node
	
	// Link to parent
	if parentID != "" {
		parent := scene.Nodes[parentID]
		parent.Children = append(parent.Children, nodeID)
	} else {
		scene.RootNodes = append(scene.RootNodes, nodeID)
	}
	
	// Import children
	for i := range entity.Children {
		a.importEntity(&entity.Children[i], scene, nodeID)
	}
	
	return nodeID
}

// Export exports a scene to RealityKit format
func (a *RealityKitAdapter) Export(scene *model.Scene, writer io.Writer) error {
	realityScene := RealityScene{
		Version:  "1.0",
		Entities: []ModelEntity{},
	}
	
	// Export root nodes
	for _, rootID := range scene.RootNodes {
		if node, ok := scene.Nodes[rootID]; ok {
			entity := a.exportEntity(node, scene)
			realityScene.Entities = append(realityScene.Entities, *entity)
		}
	}
	
	encoder := json.NewEncoder(writer)
	encoder.SetIndent("", "  ")
	return encoder.Encode(realityScene)
}

func (a *RealityKitAdapter) exportEntity(node *model.Node, scene *model.Scene) *ModelEntity {
	entity := &ModelEntity{
		Name: node.Name,
		Transform: EntityTransform{
			Translation: [3]float64{
				node.Transform.Position.X,
				node.Transform.Position.Y,
				node.Transform.Position.Z,
			},
			Rotation: [4]float64{
				node.Transform.Rotation.X,
				node.Transform.Rotation.Y,
				node.Transform.Rotation.Z,
				node.Transform.Rotation.W,
			},
			Scale: [3]float64{
				node.Transform.Scale.X,
				node.Transform.Scale.Y,
				node.Transform.Scale.Z,
			},
		},
		Children:   []ModelEntity{},
		Components: node.Metadata,
	}
	
	// Export model
	if node.MeshID != "" {
		if mesh, ok := scene.Meshes[node.MeshID]; ok {
			entityMesh := &EntityMesh{
				Indices: mesh.Indices,
			}
			
			for _, v := range mesh.Vertices {
				entityMesh.Positions = append(entityMesh.Positions, [3]float64{v.X, v.Y, v.Z})
			}
			
			for _, n := range mesh.Normals {
				entityMesh.Normals = append(entityMesh.Normals, [3]float64{n.X, n.Y, n.Z})
			}
			
			entityMesh.UVs = mesh.UVs
			
			entity.Model = &EntityModel{
				Mesh:      entityMesh,
				Materials: []EntityMaterial{},
			}
			
			// Export material
			if mesh.MaterialID != "" {
				if mat, ok := scene.Materials[mesh.MaterialID]; ok {
					entityMat := EntityMaterial{
						Name:              mat.Name,
						Metallic:          mat.Metallic,
						Roughness:         mat.Roughness,
						BaseColorTexture:  mat.TextureURI,
						NormalTexture:     mat.NormalMapURI,
					}
					
					if mat.BaseColor != nil {
						entityMat.BaseColor = &ColorValue{
							R: mat.BaseColor.X,
							G: mat.BaseColor.Y,
							B: mat.BaseColor.Z,
						}
					}
					
					if mat.EmissiveColor != nil {
						entityMat.EmissiveColor = &ColorValue{
							R: mat.EmissiveColor.X,
							G: mat.EmissiveColor.Y,
							B: mat.EmissiveColor.Z,
						}
					}
					
					entity.Model.Materials = append(entity.Model.Materials, entityMat)
				}
			}
		}
	}
	
	// Export children
	for _, childID := range node.Children {
		if child, ok := scene.Nodes[childID]; ok {
			entity.Children = append(entity.Children, *a.exportEntity(child, scene))
		}
	}
	
	return entity
}

func generateID() string {
	return fmt.Sprintf("rk_%d", len(fmt.Sprintf("%p", &struct{}{})))
}
