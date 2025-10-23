package scenekit

import (
	"encoding/json"
	"fmt"
	"io"

	"github.com/graphitedesignlabs/optransform3d/pkg/model"
)

// SceneKitAdapter handles SceneKit/ARKit format
type SceneKitAdapter struct{}

// NewSceneKitAdapter creates a new SceneKit adapter
func NewSceneKitAdapter() *SceneKitAdapter {
	return &SceneKitAdapter{}
}

// FormatName returns the format name
func (a *SceneKitAdapter) FormatName() string {
	return "SceneKit/ARKit"
}

// FileExtensions returns supported file extensions
func (a *SceneKitAdapter) FileExtensions() []string {
	return []string{".scn.json", ".arkit.json"}
}

// SCNScene represents a SceneKit scene
type SCNScene struct {
	Version string     `json:"version"`
	Root    *SCNNode   `json:"root"`
}

// SCNNode represents a SceneKit node
type SCNNode struct {
	Name       string      `json:"name,omitempty"`
	Position   [3]float64  `json:"position,omitempty"`
	Rotation   [4]float64  `json:"rotation,omitempty"`
	Scale      [3]float64  `json:"scale,omitempty"`
	Geometry   *SCNGeometry `json:"geometry,omitempty"`
	ChildNodes []*SCNNode   `json:"childNodes,omitempty"`
}

// SCNGeometry represents SceneKit geometry
type SCNGeometry struct {
	Type      string        `json:"type"`
	Vertices  [][3]float64  `json:"vertices"`
	Normals   [][3]float64  `json:"normals,omitempty"`
	TexCoords [][2]float64  `json:"texCoords,omitempty"`
	Indices   []int         `json:"indices"`
	Material  *SCNMaterial  `json:"material,omitempty"`
}

// SCNMaterial represents SceneKit material
type SCNMaterial struct {
	Name       string      `json:"name,omitempty"`
	Diffuse    *SCNColor   `json:"diffuse,omitempty"`
	Metalness  float64     `json:"metalness,omitempty"`
	Roughness  float64     `json:"roughness,omitempty"`
	DiffuseTexture string  `json:"diffuseTexture,omitempty"`
	NormalTexture  string  `json:"normalTexture,omitempty"`
}

// SCNColor represents a color
type SCNColor struct {
	R float64 `json:"r"`
	G float64 `json:"g"`
	B float64 `json:"b"`
	A float64 `json:"a"`
}

// Import imports a SceneKit scene
func (a *SceneKitAdapter) Import(reader io.Reader) (*model.Scene, error) {
	var scnScene SCNScene
	if err := json.NewDecoder(reader).Decode(&scnScene); err != nil {
		return nil, fmt.Errorf("failed to decode SceneKit scene: %w", err)
	}

	scene := model.NewScene("SceneKit Scene")
	
	if scnScene.Root != nil {
		a.importNode(scnScene.Root, scene, "")
	}
	
	return scene, nil
}

func (a *SceneKitAdapter) importNode(scnNode *SCNNode, scene *model.Scene, parentID string) string {
	nodeID := generateID()
	
	node := &model.Node{
		ID:   nodeID,
		Name: scnNode.Name,
		Transform: model.Transform{
			Position: model.Vector3{X: scnNode.Position[0], Y: scnNode.Position[1], Z: scnNode.Position[2]},
			Rotation: model.Quaternion{X: scnNode.Rotation[0], Y: scnNode.Rotation[1], Z: scnNode.Rotation[2], W: scnNode.Rotation[3]},
			Scale:    model.Vector3{X: scnNode.Scale[0], Y: scnNode.Scale[1], Z: scnNode.Scale[2]},
		},
		Children: []string{},
		Metadata: make(map[string]interface{}),
	}
	
	// Default scale if not set
	if node.Transform.Scale.X == 0 && node.Transform.Scale.Y == 0 && node.Transform.Scale.Z == 0 {
		node.Transform.Scale = model.Vector3{X: 1, Y: 1, Z: 1}
	}
	
	// Import geometry
	if scnNode.Geometry != nil {
		meshID := generateID()
		mesh := &model.Mesh{
			ID:   meshID,
			Name: scnNode.Name + "_geometry",
		}
		
		// Convert vertices
		for _, v := range scnNode.Geometry.Vertices {
			mesh.Vertices = append(mesh.Vertices, model.Vector3{X: v[0], Y: v[1], Z: v[2]})
		}
		
		// Convert normals
		for _, n := range scnNode.Geometry.Normals {
			mesh.Normals = append(mesh.Normals, model.Vector3{X: n[0], Y: n[1], Z: n[2]})
		}
		
		// Convert texture coordinates
		mesh.UVs = scnNode.Geometry.TexCoords
		
		// Convert indices
		for _, idx := range scnNode.Geometry.Indices {
			mesh.Indices = append(mesh.Indices, uint32(idx))
		}
		
		// Import material
		if scnNode.Geometry.Material != nil {
			materialID := generateID()
			mat := &model.Material{
				ID:       materialID,
				Name:     scnNode.Geometry.Material.Name,
				Metallic: scnNode.Geometry.Material.Metalness,
				Roughness: scnNode.Geometry.Material.Roughness,
				TextureURI: scnNode.Geometry.Material.DiffuseTexture,
				NormalMapURI: scnNode.Geometry.Material.NormalTexture,
			}
			
			if scnNode.Geometry.Material.Diffuse != nil {
				mat.BaseColor = &model.Vector3{
					X: scnNode.Geometry.Material.Diffuse.R,
					Y: scnNode.Geometry.Material.Diffuse.G,
					Z: scnNode.Geometry.Material.Diffuse.B,
				}
			}
			
			scene.Materials[materialID] = mat
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
	
	// Import child nodes
	for _, child := range scnNode.ChildNodes {
		a.importNode(child, scene, nodeID)
	}
	
	return nodeID
}

// Export exports a scene to SceneKit format
func (a *SceneKitAdapter) Export(scene *model.Scene, writer io.Writer) error {
	scnScene := SCNScene{
		Version: "1.0",
		Root: &SCNNode{
			Name:       scene.Name,
			ChildNodes: []*SCNNode{},
		},
	}
	
	// Export root nodes
	for _, rootID := range scene.RootNodes {
		if node, ok := scene.Nodes[rootID]; ok {
			scnNode := a.exportNode(node, scene)
			scnScene.Root.ChildNodes = append(scnScene.Root.ChildNodes, scnNode)
		}
	}
	
	encoder := json.NewEncoder(writer)
	encoder.SetIndent("", "  ")
	return encoder.Encode(scnScene)
}

func (a *SceneKitAdapter) exportNode(node *model.Node, scene *model.Scene) *SCNNode {
	scnNode := &SCNNode{
		Name:     node.Name,
		Position: [3]float64{node.Transform.Position.X, node.Transform.Position.Y, node.Transform.Position.Z},
		Rotation: [4]float64{node.Transform.Rotation.X, node.Transform.Rotation.Y, node.Transform.Rotation.Z, node.Transform.Rotation.W},
		Scale:    [3]float64{node.Transform.Scale.X, node.Transform.Scale.Y, node.Transform.Scale.Z},
		ChildNodes: []*SCNNode{},
	}
	
	// Export geometry
	if node.MeshID != "" {
		if mesh, ok := scene.Meshes[node.MeshID]; ok {
			geom := &SCNGeometry{
				Type: "mesh",
			}
			
			for _, v := range mesh.Vertices {
				geom.Vertices = append(geom.Vertices, [3]float64{v.X, v.Y, v.Z})
			}
			
			for _, n := range mesh.Normals {
				geom.Normals = append(geom.Normals, [3]float64{n.X, n.Y, n.Z})
			}
			
			geom.TexCoords = mesh.UVs
			
			for _, idx := range mesh.Indices {
				geom.Indices = append(geom.Indices, int(idx))
			}
			
			// Export material
			if mesh.MaterialID != "" {
				if mat, ok := scene.Materials[mesh.MaterialID]; ok {
					scnMat := &SCNMaterial{
						Name:      mat.Name,
						Metalness: mat.Metallic,
						Roughness: mat.Roughness,
						DiffuseTexture: mat.TextureURI,
						NormalTexture: mat.NormalMapURI,
					}
					
					if mat.BaseColor != nil {
						scnMat.Diffuse = &SCNColor{
							R: mat.BaseColor.X,
							G: mat.BaseColor.Y,
							B: mat.BaseColor.Z,
							A: 1.0,
						}
					}
					
					geom.Material = scnMat
				}
			}
			
			scnNode.Geometry = geom
		}
	}
	
	// Export children
	for _, childID := range node.Children {
		if child, ok := scene.Nodes[childID]; ok {
			scnNode.ChildNodes = append(scnNode.ChildNodes, a.exportNode(child, scene))
		}
	}
	
	return scnNode
}

func generateID() string {
	return fmt.Sprintf("scn_%d", len(fmt.Sprintf("%p", &struct{}{})))
}
