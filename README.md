[![Build Status](https://drone.wlan1.net/api/badges/James9074/MEAN-App/status.svg)](https://drone.wlan1.net/James9074/MEAN-App)

# Faith By Deeds
Built with node, deployed with docker

## Building/Dev
```
$ cp .env.sample .env   #edit these vars!
$ docker-compose build
$ docker-compose up -d
```

# Drone Secrets

Swap out James9074/MEAN-App for your git repo
```
export DRONE_SERVER=https://drone.some-company.net
export DRONE_TOKEN=myDroneToken
drone secret add James9074/MEAN-App DOCKER_PASSWORD dockerhub-pw
drone secret add James9074/MEAN-App DOCKER_USERNAME dockerhub-username
drone secret add James9074/MEAN-App DOCKER_EMAIL dockerhub-email
drone secret add James9074/MEAN-App APP_REPO dockerhubRepo/appName
drone secret add James9074/MEAN-App SLACK_WEBHOOK https://hooks.slack.com/services/my-slack-hook
drone secret add James9074/MEAN-App SLACK_TOKEN my-slack-token
drone secret add James9074/MEAN-App RANCHER_URL https://rancher.some-company.net
drone secret add James9074/MEAN-App RANCHER_ACCESS_KEY my-access-key
drone secret add James9074/MEAN-App RANCHER_SECRET_KEY rancher-secret
drone secret add James9074/MEAN-App MONGODB_DOCKER_VOLUME /data/faithbydeeds/mongodb
```
