package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/graphitedesignlabs/optransform3d/pkg/adapters"
	"github.com/graphitedesignlabs/optransform3d/pkg/adapters/arcore"
	"github.com/graphitedesignlabs/optransform3d/pkg/adapters/blender"
	"github.com/graphitedesignlabs/optransform3d/pkg/adapters/realitykit"
	"github.com/graphitedesignlabs/optransform3d/pkg/adapters/scenekit"
	"github.com/graphitedesignlabs/optransform3d/pkg/adapters/sketchup"
)

var (
	inputFile  = flag.String("input", "", "Input file path")
	outputFile = flag.String("output", "", "Output file path")
	fromFormat = flag.String("from", "", "Source format (blender, scenekit, realitykit, sketchup, arcore)")
	toFormat   = flag.String("to", "", "Target format (blender, scenekit, realitykit, sketchup, arcore)")
	listFormats = flag.Bool("list", false, "List available formats")
)

func main() {
	flag.Parse()

	// Initialize adapter registry
	registry := adapters.NewAdapterRegistry()
	registry.Register("blender", blender.NewBlenderAdapter())
	registry.Register("scenekit", scenekit.NewSceneKitAdapter())
	registry.Register("realitykit", realitykit.NewRealityKitAdapter())
	registry.Register("sketchup", sketchup.NewSketchUpAdapter())
	registry.Register("arcore", arcore.NewARCoreAdapter())

	if *listFormats {
		fmt.Println("Available formats:")
		for _, name := range registry.List() {
			adapter, _ := registry.Get(name)
			fmt.Printf("  %-15s - %s\n", name, adapter.FormatName())
			fmt.Printf("    Extensions: %v\n", adapter.FileExtensions())
		}
		return
	}

	if *inputFile == "" || *outputFile == "" || *fromFormat == "" || *toFormat == "" {
		fmt.Println("Usage: optrans3d -input <file> -output <file> -from <format> -to <format>")
		fmt.Println("       optrans3d -list")
		flag.PrintDefaults()
		os.Exit(1)
	}

	// Get adapters
	sourceAdapter, ok := registry.Get(*fromFormat)
	if !ok {
		fmt.Printf("Error: Unknown source format '%s'\n", *fromFormat)
		os.Exit(1)
	}

	targetAdapter, ok := registry.Get(*toFormat)
	if !ok {
		fmt.Printf("Error: Unknown target format '%s'\n", *toFormat)
		os.Exit(1)
	}

	// Import scene
	fmt.Printf("Importing from %s...\n", *inputFile)
	inputFileHandle, err := os.Open(*inputFile)
	if err != nil {
		fmt.Printf("Error opening input file: %v\n", err)
		os.Exit(1)
	}
	defer inputFileHandle.Close()

	scene, err := sourceAdapter.Import(inputFileHandle)
	if err != nil {
		fmt.Printf("Error importing scene: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Imported scene '%s' with %d nodes, %d meshes, %d materials\n",
		scene.Name, len(scene.Nodes), len(scene.Meshes), len(scene.Materials))

	// Export scene
	fmt.Printf("Exporting to %s...\n", *outputFile)
	outputFileHandle, err := os.Create(*outputFile)
	if err != nil {
		fmt.Printf("Error creating output file: %v\n", err)
		os.Exit(1)
	}
	defer outputFileHandle.Close()

	if err := targetAdapter.Export(scene, outputFileHandle); err != nil {
		fmt.Printf("Error exporting scene: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("Conversion complete!")
}
