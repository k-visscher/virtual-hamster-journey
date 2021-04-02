#!/bin/bash

while true
do
	measuredAt=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
	mqtt pub -t "hamster/wheel/measurements" -m "{ \"measuredAt\": \"$measuredAt\", \"amountOfRotations\": 1 }" -h "mqtt-server"
	sleep 0.01
done
