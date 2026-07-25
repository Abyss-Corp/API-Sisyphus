# STAGE 1 — no real build step needed (static ES modules), but keep the
# two-stage layout so CI conventions / future build steps drop in cleanly.
FROM node:18-alpine AS builder
WORKDIR /app
COPY . .
RUN echo "Build stage complete."

# STAGE 2
FROM nginx:1.25-alpine

RUN rm -rf /usr/share/nginx/html/*

COPY --from=builder /app/index.html /usr/share/nginx/html/
COPY --from=builder /app/css /usr/share/nginx/html/css
COPY --from=builder /app/js /usr/share/nginx/html/js

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
