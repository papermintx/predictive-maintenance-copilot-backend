# Stage 1: Build
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma Client (with placeholder DATABASE_URL)
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npx prisma generate

# Build the application
RUN npm run build

# Verify dist folder exists
RUN ls -la dist/

# Stage 2: Production
FROM node:20-alpine AS production

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies only
RUN npm ci --only=production

# Copy Prisma Client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy built application from builder (including public assets that Nest CLI copies)
COPY --from=builder /app/dist ./dist

# Also copy public folder to root for static serving
COPY --from=builder /app/public ./public

# Expose port (Cloud Run will set PORT env variable)
EXPOSE 8080

# Start the application
CMD ["node", "dist/src/main.js"]
