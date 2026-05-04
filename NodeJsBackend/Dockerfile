FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN apk add --no-cache --virtual .gyp python3 make g++ \
	&& npm ci --omit=dev \
	&& apk del .gyp

COPY authServer.js financeServer.js dropServer.js db.js ./

RUN mkdir -p /app/Databases /app/uploads

EXPOSE 3000 3001 3002

CMD ["node", "authServer.js"]
