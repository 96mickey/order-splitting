#  Stage 1: Install Dependencies
FROM node:20.15.1-bookworm-slim AS deps

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install production dependencies only
# Using npm ci --omit=dev for faster, reliable, reproducible builds
RUN npm ci --omit=dev --build-from-source=bcrypt && \
    npm cache clean --force

# Handle .env file from Docker secret (if provided during build)
# Usage: docker build --secret id=env_file,src=.env -t auth-service .
# RUN --mount=type=secret,id=env_file \
#     if [ -f /run/secrets/env_file ]; then \
#       cp /run/secrets/env_file .env; \
#     else \
#       echo "# .env file not provided during build" > .env; \
#     fi

#  Stage 2: Production Runtime (Distroless)
FROM gcr.io/distroless/nodejs20-debian12:nonroot

# Metadata labels
LABEL maintainer="rushabh.s@orocorp.in"
LABEL description="Auth Microservice - Production Build"

# Set default timezone (can be overridden via environment variable)
ENV TZ=Asia/Kolkata

WORKDIR /app

# Copy production dependencies from deps stage
COPY --from=deps --chown=nonroot:nonroot /app/node_modules ./node_modules
# Copy timezone data from deps stage
COPY --from=deps --chown=nonroot:nonroot /usr/share/zoneinfo/Asia/Kolkata /etc/localtime

# Copy timezone data from deps stage (full zoneinfo for flexibility)
# COPY --from=deps --chown=nonroot:nonroot /usr/share/zoneinfo /usr/share/zoneinfo

# Copy package files
COPY --chown=nonroot:nonroot package.json package-lock.json ./

# Copy application code and .env file
COPY . .

# Expose application port
EXPOSE 3010

# Set environment to production
ENV NODE_ENV=production

# Run the application
# Distroless automatically runs: node <CMD>
CMD ["index.js"]
