FROM golang:1.22 AS build
WORKDIR /src
COPY platform/exporter/ .
RUN go mod tidy && CGO_ENABLED=0 go build -o /exporter .

FROM gcr.io/distroless/static
COPY --from=build /exporter /exporter
EXPOSE 9100
ENTRYPOINT ["/exporter"]
