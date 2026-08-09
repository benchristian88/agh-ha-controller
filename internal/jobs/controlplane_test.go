package jobs

import (
	"testing"
	"time"
)

func TestWorkerBackoffIsBounded(t *testing.T) {
	want := []time.Duration{time.Second, 2 * time.Second, 4 * time.Second, 8 * time.Second, 16 * time.Second, 30 * time.Second, 30 * time.Second}
	for index, expected := range want {
		if actual := workerBackoff(index + 1); actual != expected {
			t.Fatalf("workerBackoff(%d)=%v want %v", index+1, actual, expected)
		}
	}
}
