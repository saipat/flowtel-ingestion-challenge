FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci || npm i

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# Copy schema into a known runtime location
COPY src/db/schema.sql ./schema.sql

ENV SCHEMA_PATH=/app/schema.sql

CMD ["node", "dist/index.js"]