package version

var (
	Version = "0.2.0"
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
