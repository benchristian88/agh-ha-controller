# Controller API Design

## Base path

```text
/api/v1
```

## Response conventions

Successful resources return JSON.

Errors use:

```json
{
  "error": {
    "code": "NODE_UNREACHABLE",
    "message": "The AdGuard Home node could not be reached.",
    "requestId": "..."
  }
}
```

## Initial endpoints

### Authentication

```text
POST   /auth/login
POST   /auth/logout
GET    /auth/me
```

### Clusters

```text
GET    /clusters
POST   /clusters
GET    /clusters/{clusterId}
PATCH  /clusters/{clusterId}
```

### Nodes

```text
GET    /clusters/{clusterId}/nodes
POST   /clusters/{clusterId}/nodes
GET    /nodes/{nodeId}
PATCH  /nodes/{nodeId}
DELETE /nodes/{nodeId}
POST   /nodes/{nodeId}/test-connection
POST   /nodes/{nodeId}/observe
```

### Configuration

```text
GET    /clusters/{clusterId}/configuration/draft
PUT    /clusters/{clusterId}/configuration/draft
POST   /clusters/{clusterId}/configuration/validate
POST   /clusters/{clusterId}/revisions
GET    /clusters/{clusterId}/revisions
GET    /revisions/{revisionId}
GET    /revisions/{revisionId}/diff
```

### Deployments

```text
POST   /clusters/{clusterId}/deployments
GET    /clusters/{clusterId}/deployments
GET    /deployments/{deploymentId}
POST   /deployments/{deploymentId}/cancel
POST   /clusters/{clusterId}/rollback
```

### Drift

```text
GET    /clusters/{clusterId}/drift
GET    /drift/{driftId}
POST   /drift/{driftId}/restore
POST   /drift/{driftId}/adopt
POST   /drift/{driftId}/ignore
```

### Statistics and query log

```text
GET    /clusters/{clusterId}/statistics
GET    /clusters/{clusterId}/query-events
```

### Audit

```text
GET    /audit-events
```

## Concurrency

Mutable resources should accept an ETag or version field.

Stale updates return HTTP 409.

## Long-running work

Deployments and observations return resources that can be polled.

A later release may add server-sent events or WebSockets for live progress.
