package adapters

import (
	"io"

	"github.com/graphitedesignlabs/optransform3d/pkg/model"
)

// Adapter interface for importing and exporting 3D models
type Adapter interface {
	// Import reads a 3D model file and converts it to our Scene format
	Import(reader io.Reader) (*model.Scene, error)
	
	// Export writes a Scene to a 3D model file format
	Export(scene *model.Scene, writer io.Writer) error
	
	// FormatName returns the name of the format this adapter handles
	FormatName() string
	
	// FileExtensions returns the file extensions this adapter supports
	FileExtensions() []string
}

// AdapterRegistry manages available adapters
type AdapterRegistry struct {
	adapters map[string]Adapter
}

// NewAdapterRegistry creates a new adapter registry
func NewAdapterRegistry() *AdapterRegistry {
	return &AdapterRegistry{
		adapters: make(map[string]Adapter),
	}
}

// Register registers an adapter
func (r *AdapterRegistry) Register(name string, adapter Adapter) {
	r.adapters[name] = adapter
}

// Get retrieves an adapter by name
func (r *AdapterRegistry) Get(name string) (Adapter, bool) {
	adapter, exists := r.adapters[name]
	return adapter, exists
}

// List returns all registered adapter names
func (r *AdapterRegistry) List() []string {
	names := make([]string, 0, len(r.adapters))
	for name := range r.adapters {
		names = append(names, name)
	}
	return names
}
