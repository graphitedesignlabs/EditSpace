package ot

import (
	"testing"

	"github.com/graphitedesignlabs/optransform3d/pkg/model"
)

func TestNewEngine(t *testing.T) {
	scene := model.NewScene("Test")
	engine := NewEngine(scene)
	
	if engine == nil {
		t.Fatal("Engine should not be nil")
	}
	
	if engine.scene != scene {
		t.Error("Engine should store the scene")
	}
}

func TestEngineApplyOperation(t *testing.T) {
	scene := model.NewScene("Test")
	engine := NewEngine(scene)
	
	node := &model.Node{
		ID:   "node1",
		Name: "Test Node",
		Transform: model.DefaultTransform(),
	}
	
	op := NewOperation(OpAddNode, "client1", "", map[string]interface{}{
		"node": node,
	})
	
	if err := engine.ApplyOperation(op); err != nil {
		t.Fatalf("Failed to apply operation: %v", err)
	}
	
	ops := engine.GetOperations()
	if len(ops) != 1 {
		t.Errorf("Expected 1 operation, got %d", len(ops))
	}
}

func TestTransformOperations(t *testing.T) {
	// Test transforming concurrent operations
	op1 := NewOperation(OpTransform, "client1", "node1", map[string]interface{}{
		"position": model.Vector3{X: 1, Y: 0, Z: 0},
	})
	
	op2 := NewOperation(OpTransform, "client2", "node1", map[string]interface{}{
		"rotation": model.Quaternion{X: 0, Y: 0, Z: 0, W: 1},
	})
	
	transformed, err := TransformOperations(op2, op1)
	if err != nil {
		t.Fatalf("Failed to transform operations: %v", err)
	}
	
	if transformed == nil {
		t.Error("Transformed operation should not be nil")
	}
	
	if transformed.ClientID != op2.ClientID {
		t.Error("Transformed operation should maintain client ID")
	}
}

func TestTransformConflictingOperations(t *testing.T) {
	// Test removing a node that another operation updates
	op1 := NewOperation(OpRemoveNode, "client1", "node1", map[string]interface{}{})
	op2 := NewOperation(OpUpdateNode, "client2", "node1", map[string]interface{}{
		"name": "Updated",
	})
	
	_, err := TransformOperations(op2, op1)
	if err == nil {
		t.Error("Should detect conflict when updating a removed node")
	}
}

func TestEngineGetOperationsSince(t *testing.T) {
	scene := model.NewScene("Test")
	engine := NewEngine(scene)
	
	// Add multiple operations
	for i := 0; i < 5; i++ {
		node := &model.Node{
			ID:   string(rune('a' + i)),
			Name: "Node",
			Transform: model.DefaultTransform(),
		}
		op := NewOperation(OpAddNode, "client1", "", map[string]interface{}{
			"node": node,
		})
		engine.ApplyOperation(op)
	}
	
	ops := engine.GetOperations()
	if len(ops) != 5 {
		t.Errorf("Expected 5 operations, got %d", len(ops))
	}
	
	// Get operations after the second one
	sincOps := engine.GetOperationsSince(ops[1].ID)
	if len(sincOps) != 3 {
		t.Errorf("Expected 3 operations since op[1], got %d", len(sincOps))
	}
}
