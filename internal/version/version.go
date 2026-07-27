package version

var (
	Version = "0.1.0-dev"
	Commit  = "unknown"
	BuiltAt = "unknown"
)

type Info struct {
	Version string `json:"version"`
	Commit  string `json:"commit"`
	BuiltAt string `json:"builtAt"`
}

func Current() Info {
	return Info{Version: Version, Commit: Commit, BuiltAt: BuiltAt}
}
