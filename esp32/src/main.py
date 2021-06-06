## IMPORTS

# machine
from machine import Pin as pin
from machine import SoftI2C as i2c

# json
from ujson import dumps as serialize

# time
from utime import localtime as time

# sensors
from sensors.bme280 import BME280 as bme280
from sensors.pms7003 import Pms7003 as pms7003
from sensors.a3144 import A3144 as a3144

# mqtt
from umqtt.robust import MQTTClient as mqtt_client

# threading
import uasyncio
from threading.queue import Queue as threadsafe_queue


## SETUP

# mqtt
client = mqtt_client("ffffffff-ffff-ffff-ffff-ffffffffffff", "127.0.0.1")
client.connect()

# queue
queue = threadsafe_queue()

# sensors
hall_effect_sensor = a3144(pin(0, pin.IN))
bme = bme280(i2c=i2c(scl=pin(22), sda=pin(21)))
pms = pms7003(uart=2)


# callbacks
async def on_wheel_rotation():
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
    await queue.put({"topic": "hamster/wheel/measurements", "payload": message})


async def measure_habitat_using_bme280():
    now = time()
    temperature, pressure, humidity = bme.read()
    message = serialize(
        {
            "sensor": "BME280",
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
    await queue.put({"topic": "hamster/habitat/measurements", "payload": message})


async def measure_habitat_using_pms7003():
    now = time()
    data = pms.read()
    message = serialize(
        {
            "sensor": "PMS7003",
            "particulateMatter10": data["PM1_0_ATM"],
            "particulateMatter25": data["PM2_5_ATM"],
            "particulateMatter100": data["PM10_0_ATM"],
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
    await queue.put({"topic": "hamster/habitat/measurements", "payload": message})


# tasks
def set_global_exception():
    def handle_exception(loop, context):
        import sys

        sys.print_exception(context["exception"])
        sys.exit()

    loop = uasyncio.get_event_loop()
    loop.set_exception_handler(handle_exception)


async def publish_mqtt_messages_task():
    while True:
        message = await queue.get()
        client.publish(message["topic"], message["payload"])


async def bme280_measurement_task():
    while True:
        await measure_habitat_using_bme280()
        await uasyncio.sleep(60)


async def pms7003_measurement_task():
    while True:
        await measure_habitat_using_pms7003()
        await uasyncio.sleep(60 * 5)

async def wheel_measurement_task():
    hall_effect_sensor.irq(on_wheel_rotation, pin.IRQ_FALLING)
    while True:
        await uasyncio.sleep(5)


async def main():
    set_global_exception()
    loop = uasyncio.get_event_loop()
    bme280_task = uasyncio.create_task(bme280_measurement_task())
    pms7003_task = uasyncio.create_task(pms7003_measurement_task())
    mqtt_task = uasyncio.create_task(publish_mqtt_messages_task())
    tasks = uasyncio.gather(bme280_task, pms7003_task, mqtt_task)
    loop.run_until_complete(tasks)

hall_effect_sensor.on_magnetic_field(on_wheel_rotation)
uasyncio.run(main())
