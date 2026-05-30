FROM node:20-alpine

WORKDIR /app

COPY Backend/package*.json ./

RUN npm install --production

COPY Backend/ .

EXPOSE 3000

CMD ["node", "src/server.js"]
