FROM registry.gian.ink/gian/nodejs-backend:20260519-125626

WORKDIR /app

COPY authServer.js financeServer.js dropServer.js db.js authelia.js ./

RUN mkdir -p /app/Databases /app/uploads

EXPOSE 3000 3001 3002

CMD ["node", "authServer.js"]
