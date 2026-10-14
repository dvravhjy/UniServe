FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
ARG VITE_UNIVERSITY_NAME
ENV VITE_API_URL=$VITE_API_URL VITE_UNIVERSITY_NAME=$VITE_UNIVERSITY_NAME
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
