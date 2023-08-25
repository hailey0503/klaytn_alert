FROM node:latest

WORKDIR /repos/klaytnAlert

COPY package.json ./

RUN npm install

COPY . .

EXPOSE 4000
CMD [ "node", "index.js" ]
