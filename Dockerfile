FROM node:16-alpine

WORKDIR /app

RUN npm i -g pm2

COPY package*.json ./

RUN npm i

COPY . .

EXPOSE 3001

CMD ["pm2-runtime", "process.yml"]