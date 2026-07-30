package api

import (
	"encoding/json"
	"testing"
)

func TestConfigurationInventoryResponseOmitsMissingDraft(t *testing.T) {
	body, err := json.Marshal(configurationInventoryResponse{
		SchemaVersion: 1,
		Snapshots:     nil,
		Capabilities:  nil,
	})
	if err != nil {
		t.Fatal(err)
	}
	var response map[string]json.RawMessage
	if err := json.Unmarshal(body, &response); err != nil {
		t.Fatal(err)
	}
	if _, exists := response["draft"]; exists {
		t.Fatalf("missing draft must be omitted, response was %s", body)
	}
}
