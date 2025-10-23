package sketchup

import (
	"encoding/json"
	"fmt"
	"io"

	"github.com/graphitedesignlabs/optransform3d/pkg/model"
)

// SketchUpAdapter handles SketchUp format
type SketchUpAdapter struct{}

// NewSketchUpAdapter creates a new SketchUp adapter
func NewSketchUpAdapter() *SketchUpAdapter {
	return &SketchUpAdapter{}
}

// FormatName returns the format name
func (a *SketchUpAdapter) FormatName() string {
	return "SketchUp"
}

// FileExtensions returns supported file extensions
func (a *SketchUpAdapter) FileExtensions() []string {
	return []string{".skp.json"}
}

// SUModel represents a SketchUp model
type SUModel struct {
	Name       string         `json:"name"`
	Version    string         `json:"version"`
	Entities   []SUEntity     `json:"entities"`
	Materials  []SUMaterial   `json:"materials,omitempty"`
	Components []SUComponent  `json:"components,omitempty"`
}

// SUEntity represents a SketchUp entity
type SUEntity struct {
	Type       string         `json:"type"`
	Name       string         `json:"name,omitempty"`
	Layer      string         `json:"layer,omitempty"`
	Geometry   *SUGeometry    `json:"geometry,omitempty"`
	Transform  *SUTransform   `json:"transform,omitempty"`
	Material   string         `json:"material,omitempty"`
	Component  string         `json:"component,omitempty"`
}

// SUTransform represents SketchUp transformation
type SUTransform struct {
	Origin   [3]float64   `json:"origin"`
	XAxis    [3]float64   `json:"xaxis"`
	YAxis    [3]float64   `json:"yaxis"`
	ZAxis    [3]float64   `json:"zaxis"`
	Scale    [3]float64   `json:"scale,omitempty"`
}

// SUGeometry represents SketchUp geometry
type SUGeometry struct {
	Vertices [][3]float64 `json:"vertices"`
	Faces    []SUFace     `json:"faces"`
}

// SUFace represents a SketchUp face
type SUFace struct {
	Indices  []int        `json:"indices"`
	Normal   [3]float64   `json:"normal"`
	UVs      [][2]float64 `json:"uvs,omitempty"`
	Material string       `json:"material,omitempty"`
}

// SUMaterial represents SketchUp material
type SUMaterial struct {
	Name    string     `json:"name"`
	Color   [4]float64 `json:"color"`
	Texture string     `json:"texture,omitempty"`
	Alpha   float64    `json:"alpha,omitempty"`
}

// SUComponent represents a SketchUp component
type SUComponent struct {
	Name      string     `json:"name"`
	Entities  []SUEntity `json:"entities"`
}

// Import imports a SketchUp model
func (a *SketchUpAdapter) Import(reader io.Reader) (*model.Scene, error) {
	var suModel SUModel
	if err := json.NewDecoder(reader).Decode(&suModel); err != nil {
		return nil, fmt.Errorf("failed to decode SketchUp model: %w", err)
	}

	scene := model.NewScene(suModel.Name)
	
	// Import materials
	materialMap := make(map[string]string)
	for _, suMat := range suModel.Materials {
		mat := &model.Material{
			ID:   generateID(),
			Name: suMat.Name,
			BaseColor: &model.Vector3{
				X: suMat.Color[0],
				Y: suMat.Color[1],
				Z: suMat.Color[2],
			},
			TextureURI: suMat.Texture,
		}
		scene.Materials[mat.ID] = mat
		materialMap[suMat.Name] = mat.ID
	}
	
	// Import entities
	for _, entity := range suModel.Entities {
		a.importEntity(&entity, scene, "", materialMap)
	}
	
	return scene, nil
}

func (a *SketchUpAdapter) importEntity(entity *SUEntity, scene *model.Scene, parentID string, materialMap map[string]string) string {
	nodeID := generateID()
	
	node := &model.Node{
		ID:       nodeID,
		Name:     entity.Name,
		Transform: model.DefaultTransform(),
		Children: []string{},
		Metadata: make(map[string]interface{}),
	}
	
	node.Metadata["sketchupType"] = entity.Type
	if entity.Layer != "" {
		node.Metadata["layer"] = entity.Layer
	}
	
	// Apply transform if present
	if entity.Transform != nil {
		node.Transform.Position = model.Vector3{
			X: entity.Transform.Origin[0],
			Y: entity.Transform.Origin[1],
			Z: entity.Transform.Origin[2],
		}
		
		if entity.Transform.Scale[0] != 0 {
			node.Transform.Scale = model.Vector3{
				X: entity.Transform.Scale[0],
				Y: entity.Transform.Scale[1],
				Z: entity.Transform.Scale[2],
			}
		}
		
		// Convert axis vectors to quaternion (simplified)
		node.Transform.Rotation = model.Quaternion{X: 0, Y: 0, Z: 0, W: 1}
	}
	
	// Import geometry
	if entity.Geometry != nil {
		meshID := generateID()
		mesh := &model.Mesh{
			ID:   meshID,
			Name: entity.Name + "_geometry",
		}
		
		// Convert vertices
		for _, v := range entity.Geometry.Vertices {
			mesh.Vertices = append(mesh.Vertices, model.Vector3{X: v[0], Y: v[1], Z: v[2]})
		}
		
		// Convert faces to indices and normals
		for _, face := range entity.Geometry.Faces {
			// Add normal for each vertex in the face
			for range face.Indices {
				mesh.Normals = append(mesh.Normals, model.Vector3{
					X: face.Normal[0],
					Y: face.Normal[1],
					Z: face.Normal[2],
				})
			}
			
			// Add indices (triangulate if necessary)
			if len(face.Indices) == 3 {
				for _, idx := range face.Indices {
					mesh.Indices = append(mesh.Indices, uint32(idx))
				}
			} else if len(face.Indices) == 4 {
				// Triangulate quad
				mesh.Indices = append(mesh.Indices,
					uint32(face.Indices[0]),
					uint32(face.Indices[1]),
					uint32(face.Indices[2]),
					uint32(face.Indices[0]),
					uint32(face.Indices[2]),
					uint32(face.Indices[3]),
				)
			}
			
			// Add UVs if present
			if len(face.UVs) > 0 {
				mesh.UVs = append(mesh.UVs, face.UVs...)
			}
		}
		
		// Set material
		if entity.Material != "" {
			if matID, ok := materialMap[entity.Material]; ok {
				mesh.MaterialID = matID
			}
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
	
	return nodeID
}

// Export exports a scene to SketchUp format
func (a *SketchUpAdapter) Export(scene *model.Scene, writer io.Writer) error {
	suModel := SUModel{
		Name:      scene.Name,
		Version:   "SketchUp 2021",
		Entities:  []SUEntity{},
		Materials: []SUMaterial{},
	}
	
	// Export materials
	for _, mat := range scene.Materials {
		suMat := SUMaterial{
			Name: mat.Name,
			Color: [4]float64{1, 1, 1, 1},
			Texture: mat.TextureURI,
		}
		
		if mat.BaseColor != nil {
			suMat.Color = [4]float64{
				mat.BaseColor.X,
				mat.BaseColor.Y,
				mat.BaseColor.Z,
				1.0,
			}
		}
		
		suModel.Materials = append(suModel.Materials, suMat)
	}
	
	// Export nodes
	for _, rootID := range scene.RootNodes {
		if node, ok := scene.Nodes[rootID]; ok {
			entity := a.exportEntity(node, scene)
			suModel.Entities = append(suModel.Entities, *entity)
		}
	}
	
	encoder := json.NewEncoder(writer)
	encoder.SetIndent("", "  ")
	return encoder.Encode(suModel)
}

func (a *SketchUpAdapter) exportEntity(node *model.Node, scene *model.Scene) *SUEntity {
	entity := &SUEntity{
		Type: "group",
		Name: node.Name,
	}
	
	if entityType, ok := node.Metadata["sketchupType"].(string); ok {
		entity.Type = entityType
	}
	
	if layer, ok := node.Metadata["layer"].(string); ok {
		entity.Layer = layer
	}
	
	// Export transform
	entity.Transform = &SUTransform{
		Origin: [3]float64{
			node.Transform.Position.X,
			node.Transform.Position.Y,
			node.Transform.Position.Z,
		},
		XAxis: [3]float64{1, 0, 0},
		YAxis: [3]float64{0, 1, 0},
		ZAxis: [3]float64{0, 0, 1},
		Scale: [3]float64{
			node.Transform.Scale.X,
			node.Transform.Scale.Y,
			node.Transform.Scale.Z,
		},
	}
	
	// Export geometry
	if node.MeshID != "" {
		if mesh, ok := scene.Meshes[node.MeshID]; ok {
			geom := &SUGeometry{}
			
			for _, v := range mesh.Vertices {
				geom.Vertices = append(geom.Vertices, [3]float64{v.X, v.Y, v.Z})
			}
			
			// Convert indices to faces (triangles)
			for i := 0; i < len(mesh.Indices); i += 3 {
				if i+2 < len(mesh.Indices) {
					face := SUFace{
						Indices: []int{
							int(mesh.Indices[i]),
							int(mesh.Indices[i+1]),
							int(mesh.Indices[i+2]),
						},
						Normal: [3]float64{0, 0, 1},
					}
					
					// Use corresponding normal if available
					if i/3 < len(mesh.Normals) {
						normal := mesh.Normals[i/3]
						face.Normal = [3]float64{normal.X, normal.Y, normal.Z}
					}
					
					// Use corresponding UVs if available
					if i < len(mesh.UVs) {
						face.UVs = mesh.UVs[i : min(i+3, len(mesh.UVs))]
					}
					
					if mesh.MaterialID != "" {
						if mat, ok := scene.Materials[mesh.MaterialID]; ok {
							face.Material = mat.Name
							entity.Material = mat.Name
						}
					}
					
					geom.Faces = append(geom.Faces, face)
				}
			}
			
			entity.Geometry = geom
		}
	}
	
	return entity
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func generateID() string {
	return fmt.Sprintf("su_%d", len(fmt.Sprintf("%p", &struct{}{})))
}
