FROM node:18-slim 

WORKDIR /repos/klaytnAlert

COPY package.json ./

RUN npm install

COPY . .

EXPOSE 4000
CMD [ "node", "index.js" ]
