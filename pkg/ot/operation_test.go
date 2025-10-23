package ot

import (
	"testing"

	"github.com/graphitedesignlabs/optransform3d/pkg/model"
)

func TestNewOperation(t *testing.T) {
	op := NewOperation(OpAddNode, "client1", "node1", map[string]interface{}{
		"test": "data",
	})
	
	if op.Type != OpAddNode {
		t.Errorf("Expected type OpAddNode, got %s", op.Type)
	}
	
	if op.ClientID != "client1" {
		t.Errorf("Expected client ID 'client1', got '%s'", op.ClientID)
	}
	
	if op.TargetID != "node1" {
		t.Errorf("Expected target ID 'node1', got '%s'", op.TargetID)
	}
	
	if op.Data["test"] != "data" {
		t.Error("Operation data not set correctly")
	}
}

func TestApplyAddNode(t *testing.T) {
	scene := model.NewScene("Test")
	node := &model.Node{
		ID:   "node1",
		Name: "Test Node",
		Transform: model.DefaultTransform(),
	}
	
	op := NewOperation(OpAddNode, "client1", "", map[string]interface{}{
		"node": node,
	})
	
	if err := op.Apply(scene); err != nil {
		t.Fatalf("Failed to apply operation: %v", err)
	}
	
	if _, exists := scene.Nodes["node1"]; !exists {
		t.Error("Node should be added to scene")
	}
	
	if len(scene.RootNodes) != 1 {
		t.Errorf("Expected 1 root node, got %d", len(scene.RootNodes))
	}
}

func TestApplyRemoveNode(t *testing.T) {
	scene := model.NewScene("Test")
	node := &model.Node{
		ID:   "node1",
		Name: "Test Node",
		Transform: model.DefaultTransform(),
	}
	scene.Nodes["node1"] = node
	scene.RootNodes = []string{"node1"}
	
	op := NewOperation(OpRemoveNode, "client1", "node1", map[string]interface{}{})
	
	if err := op.Apply(scene); err != nil {
		t.Fatalf("Failed to apply operation: %v", err)
	}
	
	if _, exists := scene.Nodes["node1"]; exists {
		t.Error("Node should be removed from scene")
	}
	
	if len(scene.RootNodes) != 0 {
		t.Errorf("Expected 0 root nodes, got %d", len(scene.RootNodes))
	}
}

func TestApplyTransform(t *testing.T) {
	scene := model.NewScene("Test")
	node := &model.Node{
		ID:   "node1",
		Name: "Test Node",
		Transform: model.DefaultTransform(),
	}
	scene.Nodes["node1"] = node
	
	newPosition := model.Vector3{X: 5, Y: 10, Z: 15}
	op := NewOperation(OpTransform, "client1", "node1", map[string]interface{}{
		"position": newPosition,
	})
	
	if err := op.Apply(scene); err != nil {
		t.Fatalf("Failed to apply operation: %v", err)
	}
	
	if node.Transform.Position.X != 5 || node.Transform.Position.Y != 10 || node.Transform.Position.Z != 15 {
		t.Error("Transform not applied correctly")
	}
}
