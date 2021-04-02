const express = require('express')
const app = require('express')()
const server = require('http').createServer(app)
const database = require('./models')
const { Op } = require('sequelize')
const mqtt = require('mqtt')
const filesystem = require('fs')
const path = require('path')
const { DateTime } = require('luxon')
const WebSocket = require('ws')

const settings = JSON.parse(
  filesystem.readFileSync(
    path.join(
      __dirname,
      'settings.json'
    ),
    'utf8'
  )
)

app.use(express.json())
app.use(express.static('public'))

server.listen(settings.server.port, () => {
  database.sequelize.sync()
  console.log(`listening on *:${settings.server.port}`)
})

const wss = new WebSocket.Server({ server: server, path:"/ws" })

wss.broadcast = (message) => {
  wss.clients.forEach((client) => {
    client.send(message)
  })
}

wss.on('connection', async (ws) => {
  const info = await getHamsterWheelInformation()

  ws.send(JSON.stringify(info))
})

const client = mqtt.connect(settings.connections.mqtt)

client.on('connect', () => {
  client.subscribe('hamster/wheel/measurements', () => {})
})

client.on('message', async (topic, message) => {
  if (topic !== 'hamster/wheel/measurements') {
    return
  }

  const measurement = JSON.parse(message.toString())
  await database.Measurement.create(measurement)
})

const getHamsterWheelInformation = async () => {
  const circumference = settings.wheel.diamaterInMeters * Math.PI
  const amountOfRotations = await database.Measurement.count()

  const now = DateTime.utc()
  const past = now.minus({ minutes: 1 })

  const rotationsPerMinute = await database.Measurement.count({
    where: {
      measuredAt: {
        [Op.between]: [
          past.toJSDate(),
          now.toJSDate()
        ]
      }
    }
  })

  const rotationsPerSecond = (rotationsPerMinute / 60)
  const angularVelocity = rotationsPerSecond * (2 * Math.PI)

  return {
    speedInKilometersPerHour: (angularVelocity * (settings.wheel.diamaterInMeters / 2)) * 3.6,
    rotationsPerMinute: rotationsPerMinute,
    distanceInMeters: amountOfRotations * circumference
  }
}

setInterval(async () => {
  const info = await getHamsterWheelInformation()
  wss.broadcast(JSON.stringify(info))
}, 5000)
