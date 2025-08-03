# Stage 1: Build the application
FROM node:18 AS builder
WORKDIR /app
COPY package*.json ./
# Install all dependencies (including dev for the build)
RUN npm install
COPY . .
# Build the TypeScript application
RUN npm run build

# Stage 2: Production image
FROM node:18-slim
WORKDIR /app
COPY package*.json ./
# Install only production dependencies
RUN npm install --only=production
# Copy the built application from the builder stage
COPY --from=builder /app/dist ./dist

# Cloud Run dynamically assigns the PORT.
EXPOSE 8080

# Command to run the application
CMD [ "node", "dist/index.js" ]