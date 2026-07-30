# Build context is the monorepo root (see infra/render.yaml `dockerContext: .`)
# because the API depends on the local packages/shared workspace.

FROM node:20-alpine AS build
WORKDIR /repo

# Prisma's engine binaries are Rust binaries dynamically linked against
# libssl. Alpine ships no OpenSSL by default, so without this `prisma
# generate` (here) and `prisma migrate deploy` (runtime stage, run by
# render.yaml's preDeployCommand) fail with a garbled "Could not parse
# schema engine response" error instead of a clear "library not found".
RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
RUN npm install

COPY packages/shared packages/shared
COPY apps/api apps/api

RUN npm run build --workspace packages/shared
RUN npm run build --workspace apps/api

FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
RUN apk add --no-cache openssl

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/shared ./packages/shared
COPY --from=build /repo/apps/api ./apps/api

WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["node", "dist/index.js"]
