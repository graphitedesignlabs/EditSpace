package main

import (
	"fmt"
	"os"

	"github.com/graphitedesignlabs/optransform3d/pkg/adapters"
	"github.com/graphitedesignlabs/optransform3d/pkg/adapters/arcore"
	"github.com/graphitedesignlabs/optransform3d/pkg/adapters/blender"
	"github.com/graphitedesignlabs/optransform3d/pkg/adapters/realitykit"
	"github.com/graphitedesignlabs/optransform3d/pkg/adapters/scenekit"
	"github.com/graphitedesignlabs/optransform3d/pkg/adapters/sketchup"
	"github.com/graphitedesignlabs/optransform3d/pkg/model"
	"github.com/graphitedesignlabs/optransform3d/pkg/ot"
)

func main() {
	// Create a new scene
	scene := model.NewScene("Collaborative 3D Scene")

	// Add a material
	material := &model.Material{
		ID:        "mat1",
		Name:      "Blue Material",
		BaseColor: &model.Vector3{X: 0.2, Y: 0.4, Z: 0.8},
		Metallic:  0.5,
		Roughness: 0.3,
	}
	scene.Materials[material.ID] = material

	// Add a simple cube mesh
	mesh := &model.Mesh{
		ID:   "mesh1",
		Name: "Cube",
		Vertices: []model.Vector3{
			{X: -1, Y: -1, Z: -1}, {X: 1, Y: -1, Z: -1},
			{X: 1, Y: 1, Z: -1}, {X: -1, Y: 1, Z: -1},
			{X: -1, Y: -1, Z: 1}, {X: 1, Y: -1, Z: 1},
			{X: 1, Y: 1, Z: 1}, {X: -1, Y: 1, Z: 1},
		},
		Indices:    []uint32{0, 1, 2, 2, 3, 0, 4, 5, 6, 6, 7, 4},
		MaterialID: material.ID,
	}
	scene.Meshes[mesh.ID] = mesh

	// Add a node with the mesh
	node := &model.Node{
		ID:   "node1",
		Name: "Cube Node",
		Transform: model.Transform{
			Position: model.Vector3{X: 0, Y: 0, Z: 0},
			Rotation: model.Quaternion{X: 0, Y: 0, Z: 0, W: 1},
			Scale:    model.Vector3{X: 1, Y: 1, Z: 1},
		},
		MeshID:   mesh.ID,
		Children: []string{},
		Metadata: make(map[string]interface{}),
	}
	scene.Nodes[node.ID] = node
	scene.RootNodes = append(scene.RootNodes, node.ID)

	fmt.Println("Created scene:", scene.Name)
	fmt.Println("Nodes:", len(scene.Nodes))
	fmt.Println("Meshes:", len(scene.Meshes))
	fmt.Println("Materials:", len(scene.Materials))

	// Initialize OT engine
	engine := ot.NewEngine(scene)

	// Simulate Client 1 operation: Move the cube
	op1 := ot.NewOperation(
		ot.OpTransform,
		"client1",
		node.ID,
		map[string]interface{}{
			"position": model.Vector3{X: 2, Y: 0, Z: 0},
		},
	)

	// Simulate Client 2 operation: Rotate the cube (concurrent)
	op2 := ot.NewOperation(
		ot.OpTransform,
		"client2",
		node.ID,
		map[string]interface{}{
			"rotation": model.Quaternion{X: 0.707, Y: 0, Z: 0, W: 0.707},
		},
	)

	fmt.Println("\n=== Demonstrating Operational Transformation ===")
	fmt.Println("Client 1 moves cube to (2, 0, 0)")
	fmt.Println("Client 2 rotates cube (concurrent operation)")

	// Apply operations with OT
	if err := engine.ApplyOperation(op1); err != nil {
		fmt.Println("Error applying op1:", err)
	}

	// Transform op2 based on op1, then apply
	transformedOp2, err := ot.TransformOperations(op2, op1)
	if err != nil {
		fmt.Println("Error transforming operations:", err)
	} else {
		if err := engine.ApplyOperation(transformedOp2); err != nil {
			fmt.Println("Error applying transformed op2:", err)
		}
	}

	// Get updated scene
	updatedScene := engine.GetScene()
	updatedNode := updatedScene.Nodes[node.ID]
	fmt.Printf("\nFinal transform - Position: (%.1f, %.1f, %.1f), Rotation: (%.3f, %.3f, %.3f, %.3f)\n",
		updatedNode.Transform.Position.X,
		updatedNode.Transform.Position.Y,
		updatedNode.Transform.Position.Z,
		updatedNode.Transform.Rotation.X,
		updatedNode.Transform.Rotation.Y,
		updatedNode.Transform.Rotation.Z,
		updatedNode.Transform.Rotation.W,
	)

	// Initialize adapter registry
	registry := adapters.NewAdapterRegistry()
	registry.Register("blender", blender.NewBlenderAdapter())
	registry.Register("scenekit", scenekit.NewSceneKitAdapter())
	registry.Register("realitykit", realitykit.NewRealityKitAdapter())
	registry.Register("sketchup", sketchup.NewSketchUpAdapter())
	registry.Register("arcore", arcore.NewARCoreAdapter())

	fmt.Println("\n=== Available Adapters ===")
	for _, name := range registry.List() {
		adapter, _ := registry.Get(name)
		fmt.Printf("- %s (format: %s)\n", name, adapter.FormatName())
	}

	// Export to different formats
	fmt.Println("\n=== Exporting to Different Formats ===")

	// Export to Blender
	blenderFile, _ := os.Create("/tmp/scene.blend.json")
	defer blenderFile.Close()
	blenderAdapter, _ := registry.Get("blender")
	if err := blenderAdapter.Export(updatedScene, blenderFile); err != nil {
		fmt.Println("Error exporting to Blender:", err)
	} else {
		fmt.Println("✓ Exported to Blender format: /tmp/scene.blend.json")
	}

	// Export to SceneKit
	sceneKitFile, _ := os.Create("/tmp/scene.scn.json")
	defer sceneKitFile.Close()
	sceneKitAdapter, _ := registry.Get("scenekit")
	if err := sceneKitAdapter.Export(updatedScene, sceneKitFile); err != nil {
		fmt.Println("Error exporting to SceneKit:", err)
	} else {
		fmt.Println("✓ Exported to SceneKit/ARKit format: /tmp/scene.scn.json")
	}

	// Export to RealityKit
	realityKitFile, _ := os.Create("/tmp/scene.reality.json")
	defer realityKitFile.Close()
	realityKitAdapter, _ := registry.Get("realitykit")
	if err := realityKitAdapter.Export(updatedScene, realityKitFile); err != nil {
		fmt.Println("Error exporting to RealityKit:", err)
	} else {
		fmt.Println("✓ Exported to RealityKit format: /tmp/scene.reality.json")
	}

	// Export to SketchUp
	sketchUpFile, _ := os.Create("/tmp/scene.skp.json")
	defer sketchUpFile.Close()
	sketchUpAdapter, _ := registry.Get("sketchup")
	if err := sketchUpAdapter.Export(updatedScene, sketchUpFile); err != nil {
		fmt.Println("Error exporting to SketchUp:", err)
	} else {
		fmt.Println("✓ Exported to SketchUp format: /tmp/scene.skp.json")
	}

	// Export to ARCore
	arCoreFile, _ := os.Create("/tmp/scene.arcore.json")
	defer arCoreFile.Close()
	arCoreAdapter, _ := registry.Get("arcore")
	if err := arCoreAdapter.Export(updatedScene, arCoreFile); err != nil {
		fmt.Println("Error exporting to ARCore:", err)
	} else {
		fmt.Println("✓ Exported to ARCore format: /tmp/scene.arcore.json")
	}

	fmt.Println("\n=== Import/Export Round-trip Test ===")
	// Test round-trip: Export to Blender and import back
	blenderFile.Seek(0, 0)
	importedScene, err := blenderAdapter.Import(blenderFile)
	if err != nil {
		fmt.Println("Error importing from Blender:", err)
	} else {
		fmt.Printf("✓ Successfully imported scene '%s' with %d nodes\n",
			importedScene.Name, len(importedScene.Nodes))
	}
}
