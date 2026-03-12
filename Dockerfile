FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/

# Install tsx for running TypeScript directly
RUN npm install tsx

# Create data directory (will be mounted as a volume)
RUN mkdir -p /app/data

CMD ["npx", "tsx", "src/index.ts"]
