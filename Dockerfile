# Use official Node.js LTS Alpine image for high performance & minimal footprint
FROM node:20-alpine

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Set working directory
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy application source code
COPY . .

# Expose internal port
EXPOSE 3000

# Launch server
CMD ["node", "server.js"]
