# syntax=docker/dockerfile:1

# ---- Build stage: install dependencies and produce the production bundle ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Runtime stage: serve the built app on 0.0.0.0:8000 ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# vite (a devDependency) provides the preview server used by "npm start",
# so node_modules from the build stage is carried over as-is.
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/vite.config.ts ./vite.config.ts
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist

USER node

EXPOSE 8000

CMD ["npm", "start"]