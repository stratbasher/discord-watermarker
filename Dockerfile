# Stage 1: Install Node dependencies
FROM node:24-alpine AS node-deps
WORKDIR /app
COPY package.json ./
COPY package-lock.json ./
RUN npm install --omit=dev

# Final image
FROM node:24-alpine
WORKDIR /app

RUN apk add --no-cache dumb-init fontconfig ttf-dejavu

COPY --from=node-deps /app/node_modules ./node_modules
COPY src ./src

RUN mkdir -p /app/data /app/logs /app/tmp

USER node
ENV NODE_ENV=production

CMD ["dumb-init", "node", "src/index.js"]
