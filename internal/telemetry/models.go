package telemetry

import (
	"strings"
	"time"
)

// Range is an exact statistics window requested from AdGuard Home.
type Range string

const (
	Range24Hours Range = "24h"
	Range7Days   Range = "7d"
	Range30Days  Range = "30d"
)

func ParseRange(value string) (Range, bool) {
	switch Range(strings.TrimSpace(value)) {
	case Range24Hours:
		return Range24Hours, true
	case Range7Days:
		return Range7Days, true
	case Range30Days:
		return Range30Days, true
	default:
		return "", false
	}
}

func (r Range) Duration() time.Duration {
	switch r {
	case Range24Hours:
		return 24 * time.Hour
	case Range7Days:
		return 7 * 24 * time.Hour
	case Range30Days:
		return 30 * 24 * time.Hour
	default:
		return 0
	}
}

func SupportedRanges() []Range { return []Range{Range24Hours, Range7Days, Range30Days} }

const (
	ErrorRangeExceedsNodeRetention = "STATISTICS_RANGE_EXCEEDS_NODE_RETENTION"
	ErrorStatisticsDisabled        = "STATISTICS_DISABLED"
)

type SourceConfig struct {
	Enabled   bool
	Retention time.Duration
}

func RangesWithinRetention(retention time.Duration) []Range {
	ranges := make([]Range, 0, len(SupportedRanges()))
	for _, value := range SupportedRanges() {
		if value.Duration() <= retention {
			ranges = append(ranges, value)
		}
	}
	return ranges
}

type RankedValue struct {
	Key   string  `json:"key"`
	Value float64 `json:"value"`
}

// SourceSnapshot is the validated, normalized representation of one node
// response. It intentionally excludes the raw payload and credentials.
type SourceSnapshot struct {
	TimeUnit                   string
	DNSQueries                 int64
	BlockedFiltering           int64
	ReplacedSafeBrowsing       int64
	ReplacedSafeSearch         int64
	ReplacedParental           int64
	AverageProcessingSeconds   float64
	TopQueriedDomains          []RankedValue
	TopBlockedDomains          []RankedValue
	TopClients                 []RankedValue
	TopUpstreamResponses       []RankedValue
	TopUpstreamAverageSeconds  []RankedValue
	DNSQueriesSeries           []int64
	BlockedFilteringSeries     []int64
	ReplacedSafeBrowsingSeries []int64
	ReplacedParentalSeries     []int64
}

type Snapshot struct {
	ID              string
	ClusterID       string
	NodeID          string
	NodeName        string
	NodeVersion     string
	Range           Range
	SourceStartedAt time.Time
	SourceEndedAt   time.Time
	CollectedAt     time.Time
	SourceSnapshot
}

type PollAttempt struct {
	ID              string
	ClusterID       string
	NodeID          string
	StartedAt       time.Time
	CompletedAt     time.Time
	Status          string
	ErrorCode       string
	RangeErrors     map[Range]string
	ExpectedRanges  int
	CollectedRanges int
}

type NodeAttempt struct {
	NodeID              string
	Status              string
	ErrorCode           string
	RangeErrors         map[Range]string
	StartedAt           time.Time
	CompletedAt         time.Time
	LastSuccessAt       *time.Time
	CollectedRanges     int
	ConsecutiveFailures int
}
