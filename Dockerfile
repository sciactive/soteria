# syntax=docker/dockerfile:1

FROM node:lts-alpine

LABEL org.opencontainers.image.authors="https://sciactive.com"
LABEL org.opencontainers.image.title="Soteria"
LABEL org.opencontainers.image.description="A WebDAV based personal cloud security camera system."
LABEL org.opencontainers.image.version="1.0.0-alpha.1"
LABEL org.opencontainers.image.url="https://github.com/sciactive/soteria"
LABEL org.opencontainers.image.source="https://github.com/sciactive/soteria"
LABEL org.opencontainers.image.licenses="Apache-2.0"

# Node environment variables.
ENV NODE_ENV=production

# Soteria environment variables.
ENV UPDATE_CHECK=false

RUN npm i -g @soteria/mnemosyne@1.0.0-alpha.1 @soteria/lethe@1.0.0-alpha.1 @soteria/theia@1.0.0-alpha.1

CMD mnemosyne

# Note to future Hunter: This is the command to build for both amd64 and arm64 and push to Docker Hub.
# docker buildx build --platform linux/amd64,linux/arm64 -t sciactive/soteria:latest -t sciactive/soteria:1.0.0-alpha.1 --push .
# You need buildx and qemu: https://stackoverflow.com/a/76129784/664915