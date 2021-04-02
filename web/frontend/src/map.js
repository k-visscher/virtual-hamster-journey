import OpenLayerMap from 'ol/Map'
import View from 'ol/View'
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer'
import { fromLonLat } from 'ol/proj'
import { boundingExtent } from 'ol/extent'
import { Stroke, Style } from 'ol/style'
import { Control, defaults } from 'ol/control'
import Feature from 'ol/Feature'

import GPX from 'ol/format/GPX'
import VectorSource from 'ol/source/Vector'
import OSM from 'ol/source/OSM'
import MultiLineString from 'ol/geom/MultiLineString'

import LatLonSpherical from 'geodesy/latlon-spherical.js'

import xml2js from 'xml2js'

const greenStrokeStyle = new Style({
  stroke: new Stroke({
    color: '#00FF00',
    width: 3
  })
})

const redStrokeStyle = new Style({
  stroke: new Stroke({
    color: '#FF0000',
    width: 3
  })
})

export default class Map {
  constructor () {
    this.routeCoordinates = null
    this.boundingBoxCoordinates = null
    this.hamsterPositionCoordinates = null

    this.backgroundLayer = new TileLayer({
      source: new OSM()
    })

    this.routeLayer = new VectorLayer({
      source: new VectorSource(),
      style: redStrokeStyle
    })

    this.trackLayer = new VectorLayer({
      source: new VectorSource(),
      style: greenStrokeStyle
    })

    this.map = new OpenLayerMap({
      layers: [
        this.backgroundLayer,
        this.routeLayer,
        this.trackLayer
      ],
      controls: defaults({ attribution: false }),
      target: document.getElementById('map'),
      view: new View({
        center: [0, 0],
        zoom: 0
      })
    })

    /* containers */
    const journeyInformationContainer = document.getElementById('journey-information-container')
    const habitatInformationContainer = document.getElementById('habitat-information-container')

    this.map.addControl(new Control({ element: journeyInformationContainer }))
    this.map.addControl(new Control({ element: habitatInformationContainer }))

    /* buttons */
    const centerRouteButton = document.getElementById('focus-route-button')
    centerRouteButton.addEventListener('click', (_) => {
      this.centerRoute()
    })

    const centerHamsterButton = document.getElementById('focus-hamster-button')
    centerHamsterButton.addEventListener('click', (_) => {
      this.centerHamster()
    })

    this.map.addControl(new Control({ element: centerRouteButton }))
    this.map.addControl(new Control({ element: centerHamsterButton }))
    /* labels */
    const githubLabel = document.getElementById('github-corner')

    this.map.addControl(new Control({ element: githubLabel }))
  }

  async setGpxRoute (gpx) {
    this.routeLayer
      .getSource()
      .clear()

    this.routeLayer
      .getSource()
      .addFeatures(
        (new GPX()).readFeatures(gpx, { featureProjection: 'EPSG:3857' })
      )

    const parseGpx = (data) => {
      return new Promise((resolve, reject) => {
        xml2js.parseString(data, (error, ok) => {
          if (error) {
            return resolve(error)
          }
          return resolve(ok)
        })
      })
    }

    gpx = await (parseGpx(gpx))

    const coordinates = gpx
      .gpx
      .trk[0]
      .trkseg[0]
      .trkpt.map(
        trkpt => new LatLonSpherical(
          Number(trkpt.$.lat),
          Number(trkpt.$.lon)
        )
      )

    let distance = 0
    let mostNorthCoordinate = coordinates[0]
    let mostSouthCoordinate = coordinates[0]
    let mostWestCoordinate = coordinates[0]
    let mostEastCoordinate = coordinates[0]

    coordinates.forEach((coordinateA, index) => {
      let coordinateB

      if (index === coordinates.length - 1) {
        coordinateB = coordinateA
        coordinateA = coordinates[coordinates.length - 2]
      } else {
        coordinateB = coordinates[index + 1]
      }

      [coordinateA, coordinateB].forEach((coordinate) => {
        mostNorthCoordinate = coordinate.lat > mostNorthCoordinate.lat ? coordinate : mostNorthCoordinate
        mostSouthCoordinate = coordinate.lat < mostSouthCoordinate.lat ? coordinate : mostSouthCoordinate
        mostWestCoordinate = coordinate.lon < mostWestCoordinate.lon ? coordinate : mostWestCoordinate
        mostEastCoordinate = coordinate.lon > mostEastCoordinate.lon ? coordinate : mostEastCoordinate
      })

      distance += coordinateA.distanceTo(coordinateB)
      coordinateB.distance = distance
    })

    this.routeCoordinates = coordinates
    this.boundingBoxCoordinates = [mostNorthCoordinate, mostSouthCoordinate, mostWestCoordinate, mostEastCoordinate]
    this.centerRoute()
  }

  centerRoute () {
    if (!this.routeCoordinates || !this.boundingBoxCoordinates) {
      return
    }

    this.map
      .getView()
      .fit(
        boundingExtent(
          this.boundingBoxCoordinates.map(
            coordinate => fromLonLat([coordinate.lon, coordinate.lat])
          )
        )
      )
  }

  centerHamster () {
    if (!this.routeCoordinates || !this.boundingBoxCoordinates || !this.hamsterPositionCoordinates) {
      return
    }
    const view = this.map.getView()
    view.setCenter(this.hamsterPositionCoordinates)
    view.setZoom(20)
  }

  updateJourneyInformation (distanceTraveled, rotationsPerMinute, speedInKilometersPerHour) {
    if (!this.routeCoordinates || !this.boundingBoxCoordinates) {
      return
    }

    const distanceToTravel = this.routeCoordinates[this.routeCoordinates.length - 1].distance

    const distanceTraveledLabel = document.getElementById('distance-traveled-label')
    distanceTraveledLabel.textContent = `distance traveled: ${(distanceTraveled / 1000).toFixed(2)} km`

    const distanceToTravelLabel = document.getElementById('distance-to-travel-label')
    distanceToTravelLabel.textContent = `distance to travel: ${(distanceToTravel / 1000).toFixed(2)} km`

    const distanceToGoLabel = document.getElementById('distance-to-go-label')
    distanceToGoLabel.textContent = `distance to go: ${((distanceToTravel - distanceTraveled) / 1000).toFixed(2)} km`

    const rotationsPerMinuteLabel = document.getElementById('rotations-per-minute-label')
    rotationsPerMinuteLabel.textContent = `rotations per minute: ${rotationsPerMinute}`

    const speedInKilometersPerHourLabel = document.getElementById('speed-in-kilometers-per-hour-label')
    speedInKilometersPerHourLabel.textContent = `speed: ${speedInKilometersPerHour.toFixed(2)} km/h`

    let lines

    if (distanceTraveled >= distanceToTravel) {
      this.trackLayer.getSource().clear()
      this.routeLayer.setStyle(greenStrokeStyle)
      const lastCoordinate =  this.routeCoordinates[this.routeCoordinates.length - 1]
      this.hamsterPositionCoordinates = fromLonLat([lastCoordinate.lon, lastCoordinate.lat])
    } else {
      const visitedCoordinates = this.routeCoordinates.slice(
        0,
        this.routeCoordinates.filter(point => point.distance < distanceTraveled).length + 1
      )

      lines = visitedCoordinates.map((currentCoordinate, index) => {
        const coordinateA = [currentCoordinate.lon, currentCoordinate.lat]
        let coordinateB

        if (index === visitedCoordinates.length - 1) {
          const nextCoordinate = this.routeCoordinates[visitedCoordinates.length]
          const intermediateCoordinate = currentCoordinate.intermediatePointTo(
            nextCoordinate,
            (distanceTraveled - currentCoordinate.distance) / (nextCoordinate.distance - currentCoordinate.distance)
          )
          coordinateB = [intermediateCoordinate.lon, intermediateCoordinate.lat]
        } else {
          const nextCoordinate = visitedCoordinates[index + 1]
          coordinateB = [nextCoordinate.lon, nextCoordinate.lat]
        }

        return [coordinateA, coordinateB].map(x => fromLonLat(x))
      })
    }

    this.hamsterPositionCoordinates = lines[lines.length - 1][1]

    this.trackLayer.getSource().clear()
    this.trackLayer.getSource().addFeature(new Feature({
      geometry: new MultiLineString(lines)
    }))
    this.map.render()
  }

  updateHabitatInformation (temperature, humidity) {
    const temperatureLabel = document.getElementById('temperature-label')
    temperatureLabel.textContent = `temperature: ${temperature.toFixed(2)} °C`

    const humidityLabel = document.getElementById('humidity-label')
    humidityLabel.textContent = `humidity: ${humidity.toFixed(2)}%`
  }
}
