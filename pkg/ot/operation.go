package ot

import (
	"encoding/json"
	"time"

	"github.com/graphitedesignlabs/optransform3d/pkg/model"
)

// OperationType defines the type of operation
type OperationType string

const (
	// Node operations
	OpAddNode       OperationType = "addNode"
	OpRemoveNode    OperationType = "removeNode"
	OpUpdateNode    OperationType = "updateNode"
	OpMoveNode      OperationType = "moveNode"
	
	// Mesh operations
	OpAddMesh       OperationType = "addMesh"
	OpRemoveMesh    OperationType = "removeMesh"
	OpUpdateMesh    OperationType = "updateMesh"
	
	// Material operations
	OpAddMaterial    OperationType = "addMaterial"
	OpRemoveMaterial OperationType = "removeMaterial"
	OpUpdateMaterial OperationType = "updateMaterial"
	
	// Transform operations
	OpTransform     OperationType = "transform"
)

// Operation represents a single OT operation
type Operation struct {
	ID          string                 `json:"id"`
	Type        OperationType          `json:"type"`
	ClientID    string                 `json:"clientId"`
	Timestamp   time.Time              `json:"timestamp"`
	TargetID    string                 `json:"targetId"`
	Data        map[string]interface{} `json:"data"`
	ParentOp    string                 `json:"parentOp,omitempty"`
	Version     int                    `json:"version"`
}

// NewOperation creates a new operation
func NewOperation(opType OperationType, clientID string, targetID string, data map[string]interface{}) *Operation {
	return &Operation{
		ID:        generateOpID(),
		Type:      opType,
		ClientID:  clientID,
		Timestamp: time.Now(),
		TargetID:  targetID,
		Data:      data,
		Version:   1,
	}
}

// Apply applies the operation to a scene
func (op *Operation) Apply(scene *model.Scene) error {
	switch op.Type {
	case OpAddNode:
		return op.applyAddNode(scene)
	case OpRemoveNode:
		return op.applyRemoveNode(scene)
	case OpUpdateNode:
		return op.applyUpdateNode(scene)
	case OpMoveNode:
		return op.applyMoveNode(scene)
	case OpAddMesh:
		return op.applyAddMesh(scene)
	case OpRemoveMesh:
		return op.applyRemoveMesh(scene)
	case OpUpdateMesh:
		return op.applyUpdateMesh(scene)
	case OpAddMaterial:
		return op.applyAddMaterial(scene)
	case OpRemoveMaterial:
		return op.applyRemoveMaterial(scene)
	case OpUpdateMaterial:
		return op.applyUpdateMaterial(scene)
	case OpTransform:
		return op.applyTransform(scene)
	}
	return nil
}

func (op *Operation) applyAddNode(scene *model.Scene) error {
	nodeData, _ := json.Marshal(op.Data["node"])
	node := &model.Node{}
	json.Unmarshal(nodeData, node)
	scene.Nodes[node.ID] = node
	
	if parentID, ok := op.Data["parentId"].(string); ok && parentID != "" {
		if parent, exists := scene.Nodes[parentID]; exists {
			parent.Children = append(parent.Children, node.ID)
		}
	} else {
		scene.RootNodes = append(scene.RootNodes, node.ID)
	}
	scene.ModifiedAt = time.Now()
	return nil
}

func (op *Operation) applyRemoveNode(scene *model.Scene) error {
	delete(scene.Nodes, op.TargetID)
	
	// Remove from parent's children or root nodes
	for _, node := range scene.Nodes {
		for i, childID := range node.Children {
			if childID == op.TargetID {
				node.Children = append(node.Children[:i], node.Children[i+1:]...)
				break
			}
		}
	}
	
	for i, rootID := range scene.RootNodes {
		if rootID == op.TargetID {
			scene.RootNodes = append(scene.RootNodes[:i], scene.RootNodes[i+1:]...)
			break
		}
	}
	scene.ModifiedAt = time.Now()
	return nil
}

func (op *Operation) applyUpdateNode(scene *model.Scene) error {
	if node, exists := scene.Nodes[op.TargetID]; exists {
		if name, ok := op.Data["name"].(string); ok {
			node.Name = name
		}
		if metadata, ok := op.Data["metadata"].(map[string]interface{}); ok {
			node.Metadata = metadata
		}
		scene.ModifiedAt = time.Now()
	}
	return nil
}

func (op *Operation) applyMoveNode(scene *model.Scene) error {
	newParentID, _ := op.Data["newParentId"].(string)
	oldParentID, _ := op.Data["oldParentId"].(string)
	
	// Remove from old parent
	if oldParentID != "" {
		if oldParent, exists := scene.Nodes[oldParentID]; exists {
			for i, childID := range oldParent.Children {
				if childID == op.TargetID {
					oldParent.Children = append(oldParent.Children[:i], oldParent.Children[i+1:]...)
					break
				}
			}
		}
	} else {
		for i, rootID := range scene.RootNodes {
			if rootID == op.TargetID {
				scene.RootNodes = append(scene.RootNodes[:i], scene.RootNodes[i+1:]...)
				break
			}
		}
	}
	
	// Add to new parent
	if newParentID != "" {
		if newParent, exists := scene.Nodes[newParentID]; exists {
			newParent.Children = append(newParent.Children, op.TargetID)
		}
	} else {
		scene.RootNodes = append(scene.RootNodes, op.TargetID)
	}
	scene.ModifiedAt = time.Now()
	return nil
}

func (op *Operation) applyAddMesh(scene *model.Scene) error {
	meshData, _ := json.Marshal(op.Data["mesh"])
	mesh := &model.Mesh{}
	json.Unmarshal(meshData, mesh)
	scene.Meshes[mesh.ID] = mesh
	scene.ModifiedAt = time.Now()
	return nil
}

func (op *Operation) applyRemoveMesh(scene *model.Scene) error {
	delete(scene.Meshes, op.TargetID)
	scene.ModifiedAt = time.Now()
	return nil
}

func (op *Operation) applyUpdateMesh(scene *model.Scene) error {
	if mesh, exists := scene.Meshes[op.TargetID]; exists {
		if vertices, ok := op.Data["vertices"]; ok {
			vertData, _ := json.Marshal(vertices)
			json.Unmarshal(vertData, &mesh.Vertices)
		}
		if normals, ok := op.Data["normals"]; ok {
			normData, _ := json.Marshal(normals)
			json.Unmarshal(normData, &mesh.Normals)
		}
		scene.ModifiedAt = time.Now()
	}
	return nil
}

func (op *Operation) applyAddMaterial(scene *model.Scene) error {
	materialData, _ := json.Marshal(op.Data["material"])
	material := &model.Material{}
	json.Unmarshal(materialData, material)
	scene.Materials[material.ID] = material
	scene.ModifiedAt = time.Now()
	return nil
}

func (op *Operation) applyRemoveMaterial(scene *model.Scene) error {
	delete(scene.Materials, op.TargetID)
	scene.ModifiedAt = time.Now()
	return nil
}

func (op *Operation) applyUpdateMaterial(scene *model.Scene) error {
	if material, exists := scene.Materials[op.TargetID]; exists {
		if baseColor, ok := op.Data["baseColor"]; ok {
			colorData, _ := json.Marshal(baseColor)
			color := &model.Vector3{}
			json.Unmarshal(colorData, color)
			material.BaseColor = color
		}
		if metallic, ok := op.Data["metallic"].(float64); ok {
			material.Metallic = metallic
		}
		if roughness, ok := op.Data["roughness"].(float64); ok {
			material.Roughness = roughness
		}
		scene.ModifiedAt = time.Now()
	}
	return nil
}

func (op *Operation) applyTransform(scene *model.Scene) error {
	if node, exists := scene.Nodes[op.TargetID]; exists {
		if position, ok := op.Data["position"]; ok {
			posData, _ := json.Marshal(position)
			json.Unmarshal(posData, &node.Transform.Position)
		}
		if rotation, ok := op.Data["rotation"]; ok {
			rotData, _ := json.Marshal(rotation)
			json.Unmarshal(rotData, &node.Transform.Rotation)
		}
		if scale, ok := op.Data["scale"]; ok {
			scaleData, _ := json.Marshal(scale)
			json.Unmarshal(scaleData, &node.Transform.Scale)
		}
		scene.ModifiedAt = time.Now()
	}
	return nil
}

func generateOpID() string {
	return time.Now().Format("20060102150405.000000")
}
