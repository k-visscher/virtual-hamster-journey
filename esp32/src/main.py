from machine import Pin as pin
from machine import I2C
from ujson import dumps as serialize
from utime import localtime as time
from utime import sleep_ms as sleep
from bme280 import BME280 as bme280
from umqtt.robust import MQTTClient as mqtt_client

client = mqtt_client("ffffffff-ffff-ffff-ffff-ffffffffffff", "127.0.0.1")
client.connect()

sensor_pin = pin(0, pin.IN)

i2c = I2C(scl=pin(22), sda=pin(21))
bme = bme280(i2c=i2c)


def wheel_rotation(_):
    now = time()
    message = serialize(
        {
            "amountOfRotations": 1,
            "measuredAt": "{:04d}-{:02d}-{:02d}T{:02d}:{:02d}:{:02d}Z".format(
                now[0],
                now[1],
                now[2],
                now[3],
                now[4],
                now[5],
            ),
        }
    )
    client.publish("hamster/wheel/measurements", message)


def measure_habitat():
    now = time()
    temperature, pressure, humidity = bme.data()
    message = serialize(
        {
            "temperature": temperature,
            "pressure": pressure,
            "humidity": humidity,
            "measuredAt": "{:04d}-{:02d}-{:02d}T{:02d}:{:02d}:{:02d}Z".format(
                now[0],
                now[1],
                now[2],
                now[3],
                now[4],
                now[5],
            ),
        }
    )
    client.publish("hamster/habitat/measurements", message)


sensor_pin.irq(wheel_rotation, pin.IRQ_FALLING)

while True:
    measure_habitat()
    sleep(5000)
