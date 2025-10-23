package model

import (
	"testing"
)

func TestNewScene(t *testing.T) {
	scene := NewScene("Test Scene")
	
	if scene.Name != "Test Scene" {
		t.Errorf("Expected scene name 'Test Scene', got '%s'", scene.Name)
	}
	
	if scene.Nodes == nil {
		t.Error("Scene nodes should not be nil")
	}
	
	if scene.Meshes == nil {
		t.Error("Scene meshes should not be nil")
	}
	
	if scene.Materials == nil {
		t.Error("Scene materials should not be nil")
	}
}

func TestSceneClone(t *testing.T) {
	scene := NewScene("Original")
	node := &Node{
		ID:   "node1",
		Name: "Test Node",
		Transform: DefaultTransform(),
	}
	scene.Nodes["node1"] = node
	
	clone := scene.Clone()
	
	if clone.Name != scene.Name {
		t.Error("Clone should have the same name")
	}
	
	if len(clone.Nodes) != len(scene.Nodes) {
		t.Error("Clone should have the same number of nodes")
	}
	
	// Modify clone - should not affect original
	clone.Name = "Modified"
	if scene.Name == "Modified" {
		t.Error("Modifying clone should not affect original")
	}
}

func TestDefaultTransform(t *testing.T) {
	transform := DefaultTransform()
	
	if transform.Position.X != 0 || transform.Position.Y != 0 || transform.Position.Z != 0 {
		t.Error("Default position should be (0, 0, 0)")
	}
	
	if transform.Rotation.W != 1 {
		t.Error("Default rotation should be identity quaternion")
	}
	
	if transform.Scale.X != 1 || transform.Scale.Y != 1 || transform.Scale.Z != 1 {
		t.Error("Default scale should be (1, 1, 1)")
	}
}
