package auth

import (
	"sync"
	"time"
)

type attemptWindow struct {
	count int
	start time.Time
}

type LoginLimiter struct {
	mu       sync.Mutex
	windows  map[string]attemptWindow
	limit    int
	duration time.Duration
	now      func() time.Time
}

func NewLoginLimiter(limit int, duration time.Duration) *LoginLimiter {
	return &LoginLimiter{windows: make(map[string]attemptWindow), limit: limit, duration: duration, now: time.Now}
}

func (l *LoginLimiter) Allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	window, exists := l.windows[key]
	if !exists || now.Sub(window.start) >= l.duration {
		l.windows[key] = attemptWindow{start: now}
		return true
	}
	return window.count < l.limit
}

func (l *LoginLimiter) Failure(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	window, exists := l.windows[key]
	if !exists || now.Sub(window.start) >= l.duration {
		window = attemptWindow{start: now}
	}
	window.count++
	l.windows[key] = window
}

func (l *LoginLimiter) Success(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.windows, key)
}
