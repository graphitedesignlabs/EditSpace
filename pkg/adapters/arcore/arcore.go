package arcore

import (
	"encoding/json"
	"fmt"
	"io"

	"github.com/graphitedesignlabs/optransform3d/pkg/model"
)

// ARCoreAdapter handles ARCore format
type ARCoreAdapter struct{}

// NewARCoreAdapter creates a new ARCore adapter
func NewARCoreAdapter() *ARCoreAdapter {
	return &ARCoreAdapter{}
}

// FormatName returns the format name
func (a *ARCoreAdapter) FormatName() string {
	return "ARCore"
}

// FileExtensions returns supported file extensions
func (a *ARCoreAdapter) FileExtensions() []string {
	return []string{".arcore.json", ".sfb.json"}
}

// ARCoreScene represents an ARCore scene
type ARCoreScene struct {
	Version string        `json:"version"`
	Model   *ARCoreModel  `json:"model"`
}

// ARCoreModel represents the root model
type ARCoreModel struct {
	Name      string        `json:"name"`
	Nodes     []ARCoreNode  `json:"nodes"`
	Materials []ARCoreMaterial `json:"materials,omitempty"`
}

// ARCoreNode represents an ARCore node
type ARCoreNode struct {
	Name         string           `json:"name"`
	Translation  [3]float64       `json:"translation,omitempty"`
	Rotation     [4]float64       `json:"rotation,omitempty"`
	Scale        [3]float64       `json:"scale,omitempty"`
	Mesh         *ARCoreMesh      `json:"mesh,omitempty"`
	Children     []ARCoreNode     `json:"children,omitempty"`
	Enabled      bool             `json:"enabled"`
	Renderable   *ARCoreRenderable `json:"renderable,omitempty"`
}

// ARCoreMesh represents ARCore mesh data
type ARCoreMesh struct {
	Positions   [][3]float64 `json:"positions"`
	Normals     [][3]float64 `json:"normals,omitempty"`
	TexCoords   [][2]float64 `json:"texCoords,omitempty"`
	Indices     []uint32     `json:"indices"`
}

// ARCoreRenderable represents ARCore renderable component
type ARCoreRenderable struct {
	Material  string  `json:"material,omitempty"`
	CastShadow bool   `json:"castShadow"`
	ReceiveShadow bool `json:"receiveShadow"`
}

// ARCoreMaterial represents ARCore material
type ARCoreMaterial struct {
	Name             string          `json:"name"`
	BaseColor        *ARCoreColor    `json:"baseColor,omitempty"`
	Metallic         float64         `json:"metallic,omitempty"`
	Roughness        float64         `json:"roughness,omitempty"`
	BaseColorTexture string          `json:"baseColorTexture,omitempty"`
	NormalTexture    string          `json:"normalTexture,omitempty"`
	MetallicRoughnessTexture string  `json:"metallicRoughnessTexture,omitempty"`
}

// ARCoreColor represents a color
type ARCoreColor struct {
	R float64 `json:"r"`
	G float64 `json:"g"`
	B float64 `json:"b"`
	A float64 `json:"a"`
}

// Import imports an ARCore scene
func (a *ARCoreAdapter) Import(reader io.Reader) (*model.Scene, error) {
	var arcoreScene ARCoreScene
	if err := json.NewDecoder(reader).Decode(&arcoreScene); err != nil {
		return nil, fmt.Errorf("failed to decode ARCore scene: %w", err)
	}

	scene := model.NewScene("ARCore Scene")
	
	if arcoreScene.Model != nil {
		scene.Name = arcoreScene.Model.Name
		
		// Import materials
		materialMap := make(map[string]string)
		for _, arcoreMat := range arcoreScene.Model.Materials {
			mat := &model.Material{
				ID:        generateID(),
				Name:      arcoreMat.Name,
				Metallic:  arcoreMat.Metallic,
				Roughness: arcoreMat.Roughness,
				TextureURI: arcoreMat.BaseColorTexture,
				NormalMapURI: arcoreMat.NormalTexture,
			}
			
			if arcoreMat.BaseColor != nil {
				mat.BaseColor = &model.Vector3{
					X: arcoreMat.BaseColor.R,
					Y: arcoreMat.BaseColor.G,
					Z: arcoreMat.BaseColor.B,
				}
			}
			
			scene.Materials[mat.ID] = mat
			materialMap[arcoreMat.Name] = mat.ID
		}
		
		// Import nodes
		for _, node := range arcoreScene.Model.Nodes {
			a.importNode(&node, scene, "", materialMap)
		}
	}
	
	return scene, nil
}

func (a *ARCoreAdapter) importNode(arcoreNode *ARCoreNode, scene *model.Scene, parentID string, materialMap map[string]string) string {
	nodeID := generateID()
	
	node := &model.Node{
		ID:   nodeID,
		Name: arcoreNode.Name,
		Transform: model.Transform{
			Position: model.Vector3{
				X: arcoreNode.Translation[0],
				Y: arcoreNode.Translation[1],
				Z: arcoreNode.Translation[2],
			},
			Rotation: model.Quaternion{
				X: arcoreNode.Rotation[0],
				Y: arcoreNode.Rotation[1],
				Z: arcoreNode.Rotation[2],
				W: arcoreNode.Rotation[3],
			},
			Scale: model.Vector3{
				X: arcoreNode.Scale[0],
				Y: arcoreNode.Scale[1],
				Z: arcoreNode.Scale[2],
			},
		},
		Children: []string{},
		Metadata: make(map[string]interface{}),
	}
	
	// Default values
	if node.Transform.Scale.X == 0 && node.Transform.Scale.Y == 0 && node.Transform.Scale.Z == 0 {
		node.Transform.Scale = model.Vector3{X: 1, Y: 1, Z: 1}
	}
	if node.Transform.Rotation.W == 0 && node.Transform.Rotation.X == 0 && 
	   node.Transform.Rotation.Y == 0 && node.Transform.Rotation.Z == 0 {
		node.Transform.Rotation.W = 1
	}
	
	node.Metadata["enabled"] = arcoreNode.Enabled
	
	// Import renderable info
	if arcoreNode.Renderable != nil {
		node.Metadata["castShadow"] = arcoreNode.Renderable.CastShadow
		node.Metadata["receiveShadow"] = arcoreNode.Renderable.ReceiveShadow
	}
	
	// Import mesh
	if arcoreNode.Mesh != nil {
		meshID := generateID()
		mesh := &model.Mesh{
			ID:   meshID,
			Name: arcoreNode.Name + "_mesh",
		}
		
		// Convert positions
		for _, pos := range arcoreNode.Mesh.Positions {
			mesh.Vertices = append(mesh.Vertices, model.Vector3{X: pos[0], Y: pos[1], Z: pos[2]})
		}
		
		// Convert normals
		for _, norm := range arcoreNode.Mesh.Normals {
			mesh.Normals = append(mesh.Normals, model.Vector3{X: norm[0], Y: norm[1], Z: norm[2]})
		}
		
		// Convert texture coordinates
		mesh.UVs = arcoreNode.Mesh.TexCoords
		
		// Convert indices
		mesh.Indices = arcoreNode.Mesh.Indices
		
		// Set material
		if arcoreNode.Renderable != nil && arcoreNode.Renderable.Material != "" {
			if matID, ok := materialMap[arcoreNode.Renderable.Material]; ok {
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
	
	// Import children
	for i := range arcoreNode.Children {
		a.importNode(&arcoreNode.Children[i], scene, nodeID, materialMap)
	}
	
	return nodeID
}

// Export exports a scene to ARCore format
func (a *ARCoreAdapter) Export(scene *model.Scene, writer io.Writer) error {
	arcoreScene := ARCoreScene{
		Version: "1.0",
		Model: &ARCoreModel{
			Name:      scene.Name,
			Nodes:     []ARCoreNode{},
			Materials: []ARCoreMaterial{},
		},
	}
	
	// Export materials
	for _, mat := range scene.Materials {
		arcoreMat := ARCoreMaterial{
			Name:             mat.Name,
			Metallic:         mat.Metallic,
			Roughness:        mat.Roughness,
			BaseColorTexture: mat.TextureURI,
			NormalTexture:    mat.NormalMapURI,
		}
		
		if mat.BaseColor != nil {
			arcoreMat.BaseColor = &ARCoreColor{
				R: mat.BaseColor.X,
				G: mat.BaseColor.Y,
				B: mat.BaseColor.Z,
				A: 1.0,
			}
		}
		
		arcoreScene.Model.Materials = append(arcoreScene.Model.Materials, arcoreMat)
	}
	
	// Export root nodes
	for _, rootID := range scene.RootNodes {
		if node, ok := scene.Nodes[rootID]; ok {
			arcoreNode := a.exportNode(node, scene)
			arcoreScene.Model.Nodes = append(arcoreScene.Model.Nodes, *arcoreNode)
		}
	}
	
	encoder := json.NewEncoder(writer)
	encoder.SetIndent("", "  ")
	return encoder.Encode(arcoreScene)
}

func (a *ARCoreAdapter) exportNode(node *model.Node, scene *model.Scene) *ARCoreNode {
	arcoreNode := &ARCoreNode{
		Name: node.Name,
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
		Children: []ARCoreNode{},
		Enabled:  true,
	}
	
	if enabled, ok := node.Metadata["enabled"].(bool); ok {
		arcoreNode.Enabled = enabled
	}
	
	// Export mesh
	if node.MeshID != "" {
		if mesh, ok := scene.Meshes[node.MeshID]; ok {
			arcoreMesh := &ARCoreMesh{
				Indices: mesh.Indices,
			}
			
			for _, v := range mesh.Vertices {
				arcoreMesh.Positions = append(arcoreMesh.Positions, [3]float64{v.X, v.Y, v.Z})
			}
			
			for _, n := range mesh.Normals {
				arcoreMesh.Normals = append(arcoreMesh.Normals, [3]float64{n.X, n.Y, n.Z})
			}
			
			arcoreMesh.TexCoords = mesh.UVs
			
			arcoreNode.Mesh = arcoreMesh
			
			// Export renderable
			renderable := &ARCoreRenderable{
				CastShadow:    true,
				ReceiveShadow: true,
			}
			
			if castShadow, ok := node.Metadata["castShadow"].(bool); ok {
				renderable.CastShadow = castShadow
			}
			if receiveShadow, ok := node.Metadata["receiveShadow"].(bool); ok {
				renderable.ReceiveShadow = receiveShadow
			}
			
			if mesh.MaterialID != "" {
				if mat, ok := scene.Materials[mesh.MaterialID]; ok {
					renderable.Material = mat.Name
				}
			}
			
			arcoreNode.Renderable = renderable
		}
	}
	
	// Export children
	for _, childID := range node.Children {
		if child, ok := scene.Nodes[childID]; ok {
			arcoreNode.Children = append(arcoreNode.Children, *a.exportNode(child, scene))
		}
	}
	
	return arcoreNode
}

func generateID() string {
	return fmt.Sprintf("arc_%d", len(fmt.Sprintf("%p", &struct{}{})))
}
