# Image chạy hệ thống + Playwright worker (có sẵn Chromium và thư viện hệ thống)
FROM mcr.microsoft.com/playwright:v1.55.1-noble

ENV NODE_ENV=production \
    PW_CHANNEL=chromium \
    PORT=3000
WORKDIR /srv

# Cài dependency trước để tận dụng cache của Docker
COPY app/package*.json app/
COPY automation/package*.json automation/
RUN cd app && npm ci --omit=dev && cd ../automation && npm ci

COPY app app
COPY automation automation

# Chạy bằng user không phải root (image Playwright có sẵn user pwuser)
RUN mkdir -p app/data automation/specs/generated && chown -R pwuser:pwuser /srv
USER pwuser

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "app/src/server.js"]
