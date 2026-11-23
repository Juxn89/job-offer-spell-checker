# Purpose: the one product image and the ledger runner's image. `product` is what the harness runs,
# what the README's preview runs and what deploy/ ships: the built server and page, production
# dependencies only, run as an unprivileged user. `tests` is the ledger runner: the Playwright image
# (its browsers built in) with the project's dependencies installed once, never at start (harness rule 1).

FROM node:22.23.5-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json esbuild.config.mjs ./
COPY src ./src
RUN npm run build

FROM node:22.23.5-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee AS product
ENV NODE_ENV=production
WORKDIR /srv
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /src/dist ./dist
USER node
EXPOSE 8080
CMD ["node", "dist/server/main.js"]

FROM mcr.microsoft.com/playwright:v1.65.0-noble AS tests
WORKDIR /opt/ledger
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund && npm cache clean --force && ln -s /opt/ledger/node_modules /node_modules
ENV PATH=/opt/ledger/node_modules/.bin:$PATH
WORKDIR /app
