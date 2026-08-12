package main

import (
	"context"
	"flag"
	"fmt"
	"os"

	"github.com/benchristian88/atlas-dns/internal/database"
)

func main() {
	direction := flag.String("direction", "up", "migration direction: up or down")
	flag.Parse()
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		fmt.Fprintln(os.Stderr, "DATABASE_URL is required")
		os.Exit(2)
	}
	ctx := context.Background()
	store, err := database.Open(ctx, databaseURL)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	defer store.Close()
	switch *direction {
	case "up":
		err = database.ApplyMigrations(ctx, store.Pool())
	case "down":
		err = database.RollbackLastMigration(ctx, store.Pool())
	default:
		fmt.Fprintln(os.Stderr, "direction must be up or down")
		os.Exit(2)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
