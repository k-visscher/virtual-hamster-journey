import uasyncio as asyncio
import utime as time

async def _g():
    pass
_type_coro = type(_g())

def _launch(func):
    res = func()
    if isinstance(res, _type_coro):
        res = asyncio.create_task(res)
    return res

class A3144:
    def __init__(self, pin):
        self.pin = pin
        self._on_magnetic_field = None
        self.state = self.pin.value()
        asyncio.create_task(self.check_for_state_change())

    def on_magnetic_field(self, func):
        self._on_magnetic_field = func

    def __call__(self):
        return self.state

    async def check_for_state_change(self):
        while True:
            state = self.pin.value()
            if state != self.state:
                self.state = state
                if state == 0 and self._on_magnetic_field is not None:
                    _launch(self._on_magnetic_field)
            await asyncio.sleep_ms(25)
