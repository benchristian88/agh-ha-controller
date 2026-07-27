FROM golang:1.24-alpine AS build

WORKDIR /src
COPY go.mod go.sum ./
COPY tests/support/aghstub ./tests/support/aghstub
RUN CGO_ENABLED=0 go build -trimpath -o /out/aghstub ./tests/support/aghstub

FROM alpine:3.22

RUN adduser -D -H -u 10001 aghstub
COPY --from=build /out/aghstub /usr/local/bin/aghstub
USER aghstub
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/aghstub"]
