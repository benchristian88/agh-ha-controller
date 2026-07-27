# Source this file from the repository root for the disposable Release 0.1
# environment. These values are public test fixtures and must never be reused
# outside local testing.
export APP_ENV=development
export HTTP_ADDR=:8080
export DATABASE_URL='postgres://aghha:aghha-local-test@127.0.0.1:55432/aghha?sslmode=disable'
export TEST_DATABASE_URL="$DATABASE_URL"
export SESSION_SECRET='c3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nz'
export CREDENTIAL_ENCRYPTION_KEY='MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI='
export PUBLIC_BASE_URL='http://127.0.0.1:8080'
export LOG_LEVEL=debug
export SESSION_DURATION=12h
export NODE_HEALTH_INTERVAL=5s
export NODE_REQUEST_TIMEOUT=2s
export AUTO_MIGRATE=true
export WEB_DIST_DIR=web/dist
export TEST_NODE_A_URL='http://127.0.0.1:3101'
export TEST_NODE_B_URL='http://127.0.0.1:3102'
export TEST_NODE_USERNAME=agh-admin
export TEST_NODE_PASSWORD=node-secret-value
