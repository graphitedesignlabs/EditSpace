package blender

import (
	"encoding/json"
	"fmt"
	"io"

	"github.com/graphitedesignlabs/optransform3d/pkg/model"
)

// BlenderAdapter handles Blender format
type BlenderAdapter struct{}

// NewBlenderAdapter creates a new Blender adapter
func NewBlenderAdapter() *BlenderAdapter {
	return &BlenderAdapter{}
}

// FormatName returns the format name
func (a *BlenderAdapter) FormatName() string {
	return "Blender"
}

// FileExtensions returns supported file extensions
func (a *BlenderAdapter) FileExtensions() []string {
	return []string{".blend.json"}
}

// BlenderScene represents Blender's scene structure
type BlenderScene struct {
	Name     string          `json:"name"`
	Objects  []BlenderObject `json:"objects"`
	Materials []BlenderMaterial `json:"materials,omitempty"`
}

// BlenderObject represents a Blender object
type BlenderObject struct {
	Name     string         `json:"name"`
	Type     string         `json:"type"`
	Location [3]float64     `json:"location"`
	Rotation [4]float64     `json:"rotation"`
	Scale    [3]float64     `json:"scale"`
	Mesh     *BlenderMesh   `json:"mesh,omitempty"`
	Material string         `json:"material,omitempty"`
	Children []string       `json:"children,omitempty"`
	Parent   string         `json:"parent,omitempty"`
}

// BlenderMesh represents Blender mesh data
type BlenderMesh struct {
	Vertices [][3]float64 `json:"vertices"`
	Normals  [][3]float64 `json:"normals,omitempty"`
	UVs      [][2]float64 `json:"uvs,omitempty"`
	Faces    [][]int      `json:"faces"`
}

// BlenderMaterial represents Blender material
type BlenderMaterial struct {
	Name      string     `json:"name"`
	BaseColor [3]float64 `json:"base_color,omitempty"`
	Metallic  float64    `json:"metallic,omitempty"`
	Roughness float64    `json:"roughness,omitempty"`
	Texture   string     `json:"texture,omitempty"`
}

// Import imports a Blender scene
func (a *BlenderAdapter) Import(reader io.Reader) (*model.Scene, error) {
	var blenderScene BlenderScene
	if err := json.NewDecoder(reader).Decode(&blenderScene); err != nil {
		return nil, fmt.Errorf("failed to decode Blender scene: %w", err)
	}

	scene := model.NewScene(blenderScene.Name)
	
	// Import materials
	materialMap := make(map[string]string)
	for _, bmat := range blenderScene.Materials {
		mat := &model.Material{
			ID:        generateID(),
			Name:      bmat.Name,
			BaseColor: &model.Vector3{X: bmat.BaseColor[0], Y: bmat.BaseColor[1], Z: bmat.BaseColor[2]},
			Metallic:  bmat.Metallic,
			Roughness: bmat.Roughness,
			TextureURI: bmat.Texture,
		}
		scene.Materials[mat.ID] = mat
		materialMap[bmat.Name] = mat.ID
	}
	
	// Import objects
	meshMap := make(map[string]string)
	nodeMap := make(map[string]string)
	
	for _, bobj := range blenderScene.Objects {
		nodeID := generateID()
		nodeMap[bobj.Name] = nodeID
		
		node := &model.Node{
			ID:   nodeID,
			Name: bobj.Name,
			Transform: model.Transform{
				Position: model.Vector3{X: bobj.Location[0], Y: bobj.Location[1], Z: bobj.Location[2]},
				Rotation: model.Quaternion{X: bobj.Rotation[0], Y: bobj.Rotation[1], Z: bobj.Rotation[2], W: bobj.Rotation[3]},
				Scale:    model.Vector3{X: bobj.Scale[0], Y: bobj.Scale[1], Z: bobj.Scale[2]},
			},
			Metadata: make(map[string]interface{}),
		}
		
		node.Metadata["blenderType"] = bobj.Type
		
		// Import mesh if present
		if bobj.Mesh != nil {
			meshID := generateID()
			meshMap[bobj.Name] = meshID
			
			mesh := &model.Mesh{
				ID:   meshID,
				Name: bobj.Name + "_mesh",
			}
			
			// Convert vertices
			for _, v := range bobj.Mesh.Vertices {
				mesh.Vertices = append(mesh.Vertices, model.Vector3{X: v[0], Y: v[1], Z: v[2]})
			}
			
			// Convert normals
			for _, n := range bobj.Mesh.Normals {
				mesh.Normals = append(mesh.Normals, model.Vector3{X: n[0], Y: n[1], Z: n[2]})
			}
			
			// Convert UVs
			mesh.UVs = bobj.Mesh.UVs
			
			// Convert faces to indices
			for _, face := range bobj.Mesh.Faces {
				for _, idx := range face {
					mesh.Indices = append(mesh.Indices, uint32(idx))
				}
			}
			
			if matID, ok := materialMap[bobj.Material]; ok {
				mesh.MaterialID = matID
			}
			
			scene.Meshes[meshID] = mesh
			node.MeshID = meshID
		}
		
		scene.Nodes[nodeID] = node
	}
	
	// Build hierarchy
	for _, bobj := range blenderScene.Objects {
		nodeID := nodeMap[bobj.Name]
		if bobj.Parent != "" {
			if parentID, ok := nodeMap[bobj.Parent]; ok {
				parent := scene.Nodes[parentID]
				parent.Children = append(parent.Children, nodeID)
			}
		} else {
			scene.RootNodes = append(scene.RootNodes, nodeID)
		}
	}
	
	return scene, nil
}

// Export exports a scene to Blender format
func (a *BlenderAdapter) Export(scene *model.Scene, writer io.Writer) error {
	blenderScene := BlenderScene{
		Name:    scene.Name,
		Objects: []BlenderObject{},
		Materials: []BlenderMaterial{},
	}
	
	// Export materials
	for _, mat := range scene.Materials {
		bmat := BlenderMaterial{
			Name:      mat.Name,
			Metallic:  mat.Metallic,
			Roughness: mat.Roughness,
			Texture:   mat.TextureURI,
		}
		if mat.BaseColor != nil {
			bmat.BaseColor = [3]float64{mat.BaseColor.X, mat.BaseColor.Y, mat.BaseColor.Z}
		}
		blenderScene.Materials = append(blenderScene.Materials, bmat)
	}
	
	// Export nodes
	nodeToParent := make(map[string]string)
	for _, node := range scene.Nodes {
		for _, childID := range node.Children {
			nodeToParent[childID] = node.Name
		}
	}
	
	for _, node := range scene.Nodes {
		bobj := BlenderObject{
			Name:     node.Name,
			Type:     "MESH",
			Location: [3]float64{node.Transform.Position.X, node.Transform.Position.Y, node.Transform.Position.Z},
			Rotation: [4]float64{node.Transform.Rotation.X, node.Transform.Rotation.Y, node.Transform.Rotation.Z, node.Transform.Rotation.W},
			Scale:    [3]float64{node.Transform.Scale.X, node.Transform.Scale.Y, node.Transform.Scale.Z},
		}
		
		if objType, ok := node.Metadata["blenderType"].(string); ok {
			bobj.Type = objType
		}
		
		if parentName, ok := nodeToParent[node.ID]; ok {
			bobj.Parent = parentName
		}
		
		// Export mesh
		if node.MeshID != "" {
			if mesh, ok := scene.Meshes[node.MeshID]; ok {
				bmesh := &BlenderMesh{}
				
				for _, v := range mesh.Vertices {
					bmesh.Vertices = append(bmesh.Vertices, [3]float64{v.X, v.Y, v.Z})
				}
				
				for _, n := range mesh.Normals {
					bmesh.Normals = append(bmesh.Normals, [3]float64{n.X, n.Y, n.Z})
				}
				
				bmesh.UVs = mesh.UVs
				
				// Convert indices back to faces (triangles)
				for i := 0; i < len(mesh.Indices); i += 3 {
					if i+2 < len(mesh.Indices) {
						face := []int{int(mesh.Indices[i]), int(mesh.Indices[i+1]), int(mesh.Indices[i+2])}
						bmesh.Faces = append(bmesh.Faces, face)
					}
				}
				
				bobj.Mesh = bmesh
				
				if mesh.MaterialID != "" {
					if mat, ok := scene.Materials[mesh.MaterialID]; ok {
						bobj.Material = mat.Name
					}
				}
			}
		}
		
		blenderScene.Objects = append(blenderScene.Objects, bobj)
	}
	
	encoder := json.NewEncoder(writer)
	encoder.SetIndent("", "  ")
	return encoder.Encode(blenderScene)
}

func generateID() string {
	return fmt.Sprintf("id_%d", len(fmt.Sprintf("%p", &struct{}{})))
}
