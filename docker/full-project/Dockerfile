FROM node:24-alpine3.22 AS base
WORKDIR /app
COPY . .
RUN npm install
EXPOSE 4500
CMD ["npm", "start"]