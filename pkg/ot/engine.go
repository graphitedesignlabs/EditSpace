package ot

import (
	"fmt"
	"sync"

	"github.com/graphitedesignlabs/optransform3d/pkg/model"
)

// Engine manages operational transformations
type Engine struct {
	mu         sync.RWMutex
	operations []*Operation
	scene      *model.Scene
}

// NewEngine creates a new OT engine
func NewEngine(scene *model.Scene) *Engine {
	return &Engine{
		operations: make([]*Operation, 0),
		scene:      scene,
	}
}

// ApplyOperation applies an operation to the scene
func (e *Engine) ApplyOperation(op *Operation) error {
	e.mu.Lock()
	defer e.mu.Unlock()
	
	if err := op.Apply(e.scene); err != nil {
		return err
	}
	
	e.operations = append(e.operations, op)
	return nil
}

// Transform transforms operations for concurrent editing
// This implements the core OT algorithm
func (e *Engine) Transform(clientOp *Operation, serverOps []*Operation) (*Operation, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	
	transformedOp := clientOp
	
	for _, serverOp := range serverOps {
		var err error
		transformedOp, err = TransformOperations(transformedOp, serverOp)
		if err != nil {
			return nil, err
		}
	}
	
	return transformedOp, nil
}

// TransformOperations transforms two concurrent operations
func TransformOperations(op1, op2 *Operation) (*Operation, error) {
	// If operations are from the same client, no transformation needed
	if op1.ClientID == op2.ClientID {
		return op1, nil
	}
	
	// Create a copy of op1 to transform
	transformed := &Operation{
		ID:        op1.ID,
		Type:      op1.Type,
		ClientID:  op1.ClientID,
		Timestamp: op1.Timestamp,
		TargetID:  op1.TargetID,
		Data:      make(map[string]interface{}),
		ParentOp:  op1.ParentOp,
		Version:   op1.Version,
	}
	
	for k, v := range op1.Data {
		transformed.Data[k] = v
	}
	
	// Apply transformation rules based on operation types
	switch {
	case op1.Type == OpRemoveNode && op2.Type == OpUpdateNode:
		// If op2 updates a node that op1 removes, op1 takes precedence
		if op1.TargetID == op2.TargetID {
			return transformed, nil
		}
	case op1.Type == OpUpdateNode && op2.Type == OpRemoveNode:
		// If op2 removes a node that op1 updates, convert op1 to no-op
		if op1.TargetID == op2.TargetID {
			return nil, fmt.Errorf("operation conflicts: target removed")
		}
	case op1.Type == OpTransform && op2.Type == OpTransform:
		// Both operations transform the same node
		if op1.TargetID == op2.TargetID {
			// Merge transformations based on timestamp
			if op2.Timestamp.Before(op1.Timestamp) {
				// op2 happened first, apply op1's changes on top
				return transformed, nil
			}
		}
	case op1.Type == OpMoveNode && op2.Type == OpMoveNode:
		// Both operations move the same node
		if op1.TargetID == op2.TargetID {
			// Later operation wins based on timestamp
			if op2.Timestamp.After(op1.Timestamp) {
				transformed.Data["oldParentId"] = op2.Data["newParentId"]
			}
		}
	case op1.Type == OpAddNode && op2.Type == OpAddNode:
		// Both operations add nodes - check for ID conflicts
		if node1, ok := op1.Data["node"].(map[string]interface{}); ok {
			if node2, ok := op2.Data["node"].(map[string]interface{}); ok {
				if node1["id"] == node2["id"] {
					// ID conflict - keep the one with earlier timestamp
					if op2.Timestamp.Before(op1.Timestamp) {
						return nil, fmt.Errorf("operation conflicts: duplicate node ID")
					}
				}
			}
		}
	}
	
	return transformed, nil
}

// GetScene returns the current scene state
func (e *Engine) GetScene() *model.Scene {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.scene.Clone()
}

// GetOperations returns all operations
func (e *Engine) GetOperations() []*Operation {
	e.mu.RLock()
	defer e.mu.RUnlock()
	ops := make([]*Operation, len(e.operations))
	copy(ops, e.operations)
	return ops
}

// GetOperationsSince returns operations after a given operation ID
func (e *Engine) GetOperationsSince(opID string) []*Operation {
	e.mu.RLock()
	defer e.mu.RUnlock()
	
	startIdx := -1
	for i, op := range e.operations {
		if op.ID == opID {
			startIdx = i + 1
			break
		}
	}
	
	if startIdx == -1 || startIdx >= len(e.operations) {
		return []*Operation{}
	}
	
	ops := make([]*Operation, len(e.operations)-startIdx)
	copy(ops, e.operations[startIdx:])
	return ops
}
