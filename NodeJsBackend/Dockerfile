FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /app/Databases /app/uploads

EXPOSE 3000 3001 3002

CMD ["node", "authServer.js"]
