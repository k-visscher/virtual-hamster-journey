def no_debug():
    import esp

    esp.osdebug(None)


def connect():
    import network

    sta_if = network.WLAN(network.STA_IF)

    if not sta_if.isconnected():
        print("connecting to network...")

        sta_if.active(True)
        sta_if.connect("SSID", "PASSWORD")

        while not sta_if.isconnected():
            pass

    print("network config:", sta_if.ifconfig())


def set_time():
    import ntptime
    from utime import sleep_ms as sleep

    print("setting clock using ntp...")

    ntptime.host = "some.ntp.server.near.you.org"
    print("using {} as ntp server...".format(ntptime.host))

    success = False
    while not success:
        try:
            ntptime.settime()
            success = True
            print("set time using ntp successfully")
        except:
            print("failed to set time using ntp...")
            sleep(5000)


def set_clock_speed():
    import machine

    machine.freq(160000000)


no_debug()
set_clock_speed()
connect()
set_time()
