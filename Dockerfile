# Engram MCP server — stdio image for registry/Glama introspection.
# Runs ONLY the MCP server (no REST API, no dashboard build needed).
FROM node:20-bookworm-slim

WORKDIR /app

# better-sqlite3 ships prebuilt binaries for common platforms, but keep a
# toolchain available so it can compile from source if no prebuild matches.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Install production deps only. The React dashboard is not needed for the
# MCP (stdio) interface, so we skip `npm run build` entirely.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# App source needed at runtime for the MCP server.
COPY bin ./bin
COPY src ./src

ENV NODE_ENV=production
# Embeddings model + SQLite DB live here (lazy-created on first use).
ENV ENGRAM_DATA_DIR=/data
VOLUME ["/data"]

# Engram speaks MCP over stdio; clients/registries introspect via list-tools.
ENTRYPOINT ["node", "bin/engram.js", "start", "--mcp-only"]
