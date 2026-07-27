package domain

import "testing"

func TestNormaliseNodeURL(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name    string
		value   string
		policy  CertificatePolicy
		want    string
		wantErr bool
	}{
		{name: "https", value: "https://node.example.test/", policy: CertificateSystemTrust, want: "https://node.example.test"},
		{name: "http explicit", value: "http://192.0.2.2", policy: CertificateInsecureHTTP, want: "http://192.0.2.2"},
		{name: "http implicit", value: "http://192.0.2.2", policy: CertificateSystemTrust, wantErr: true},
		{name: "credentials", value: "https://user:password@node.test", policy: CertificateSystemTrust, wantErr: true},
		{name: "query", value: "https://node.test?password=value", policy: CertificateSystemTrust, wantErr: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			got, err := NormaliseNodeURL(test.value, test.policy)
			if (err != nil) != test.wantErr {
				t.Fatalf("NormaliseNodeURL() error = %v, wantErr %v", err, test.wantErr)
			}
			if got != test.want {
				t.Errorf("NormaliseNodeURL() = %q, want %q", got, test.want)
			}
		})
	}
}
