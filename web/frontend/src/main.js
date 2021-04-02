/* global WebSocket */

import 'ol/ol.css'
import 'github-fork-ribbon-css/gh-fork-ribbon.css'

import axios from 'axios'
import Map from './map'

const websocket = new WebSocket(`ws://${document.location.host}/ws`)
const map = new Map()
let routeHasBeenSet = false

websocket.onmessage = (event) => {
  (async () => {
    try {
      const data = JSON.parse(event.data)

      if (!routeHasBeenSet) {
        const gpxRoute = (await axios.get('route.gpx')).data
        await map.setGpxRoute(gpxRoute)
        routeHasBeenSet = true
      }

      map.updateJourneyInformation(
        data.distanceInMeters,
        data.rotationsPerMinute,
        data.speedInKilometersPerHour
      )
    } catch (e) {
      console.log('an error occured while updating the page: ' + e)
    }
  })()
}
