FROM node:6.9.3

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY package.json /usr/src/app/

COPY . /usr/src/app
RUN npm install --silent && npm install -g nodemon

EXPOSE 3000

CMD [ "npm", "start" ]
