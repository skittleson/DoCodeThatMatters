> TLDR; I want live telemetry off my Onewheel Pint S without the phone app. The unlock handshake turned out to be a static 20-byte secret, so I captured it once from the official app and replay it from Python.

Pitch, RPM, amps, pack voltage and temps, straight to a CSV file at about 200 Hz, from a laptop. The gate is the handshake Future Motion added, and it turns out to be a **static 20-byte signature bound to the board**. Not a per-session key. The official app sends the same secret every time it connects, so anything that knows those bytes gets the same access.

This is part 1 of building a small device I can mount on the board itself so I can look down at the stats while riding.

![Onewheel Pint S on a wood-chip path at golden hour](/images/onewheel-golden-hour.jpg)

## What the board exposes

The board talks plain BLE GATT with about 30 characteristics, mostly 2-byte big-endian values, under one primary service with a UUID that has been stable since version 1 (thank you online forums!).

![The same board in flat afternoon light before the session got started](/images/onewheel-daytime.jpg)

```
e659f300-ea98-11e3-ac10-0800200c9a66
```

Every characteristic shares that base. Only the 4-digit prefix changes. Here is the useful subset:

| Prefix | Signal | Notes |
|--------|--------|-------|
| `f307` | Pitch | int16, `(v - 0x8000)/10` degrees |
| `f308` | Roll | same scaling |
| `f30b` | RPM | uint16; mph ≈ rpm × 0.0124 on a Pint |
| `f310` | Temperature | low byte = controller °C, high byte = motor °C |
| `f312` | BatteryVoltage | uint16 centivolts (÷10 = V) |
| `f320` | CurrentAmps | int16 signed; positive = accel, negative = regen |
| `f30f` | StatusError | low byte = state machine, high byte = fault bitmask |
| `f3fe` | UartSerialRead | **challenge from board** (20 bytes) |
| `f3ff` | UartSerialWrite | **your response** (20 bytes) |

Without unlock, the Pint S returns `0x0000` for almost everything and stops sending live notifications after a few seconds. Battery %, hardware rev, and serial number stay readable. The live signals don't.

---

## The handshake

Starting with the XR (and continuing on Pint / Pint X / GT), Future Motion added a challenge response:

1. A few seconds after you connect, the board pushes a 20-byte challenge on `f3fe`.
2. You have about 30 s to write a correct 20-byte response on `f3ff`.
3. Miss it and the board locks down live data.

The XR algorithm is open-sourced (the `gemurf` Go project, ~150 lines):

```python
response = b"\x43\x52\x58" + md5(b"\x43\x52\x58" + challenge[3:]).digest()[:16] + checksum
```

Where `checksum` is the XOR of the 19 preceding bytes. It's deterministic, with no per-session key involved.

**The Pint changed this.** The response algorithm is different, and Future Motion tightened it. There are working implementations floating around, mostly Java (pOnewheel) and a few Go ports. I never found a Python version I was happy with.

---

## How I got past it

My first assumption was that I'd have to reverse the Pint handshake the way people reversed the XR one. I spent a couple hours reading the existing Go and Java implementations before I realized I could just snoop on the official app. I needed to watch what it sends.

### Capturing the unlock

Android has a built-in Bluetooth packet logger, which does most of the work:

```
Settings → Developer Options → Enable Bluetooth HCI snoop log
```

Toggle BT off/on, open the Onewheel app, let it connect and unlock, then pull the log:

```bash
adb bugreport bugreport.zip
unzip -p bugreport.zip "FS/data/misc/bluetooth/logs/btsnoop_hci.log" > captures/snoop.log
```

Open it in Wireshark and filter on the two GATT handles for `f3fe` and `f3ff`:

```
btatt && (btatt.handle == 0xXX || btatt.handle == 0xYY)
```

I burned a while here filtering on the wrong handle before I matched the UUIDs up to the right ATT handles. Wireshark shows you handles, not the pretty `f3fe`/`f3ff` names. Once the filter was right, you get a 20-byte `Handle Value Notification` (the challenge), then within a second a 20-byte `Write Request` back. That write is the token.

What surprised me was that the response didn't change. I captured a second session from a different central, my laptop instead of my phone. Different device, different connection, a fresh challenge. Same 20 bytes going back. The response isn't computed per session at all. It's a **static signature bound to the board**, and the app just re-sends it every time it connects.

### Replaying it from Python

With `bleak` (the standard Python BLE library on Linux/BlueZ), the unlock is three lines:

```python
client = BleakClient(address)
await client.connect()
await client.write_gatt_char(F3FF, UNLOCK_MAGIC, response=True)
```

Notifications start flowing within a second. I captured 4,738 events over 23 seconds at about 200 Hz on the primary channel, pitch through temp.

---

## The code

Everything lives in [onewheel-py](https://github.com/skittleson/onewheel-py). Python 3.10+, `bleak`, runs on any Linux with BlueZ ≥ 5.50.

```bash
pip install bleak
python src/discover.py          # scan + dump GATT table
python src/read_static.py       # one-shot read (no unlock needed)
python src/unlock_pint.py       # unlock + live stream to CSV
```

The unlock token and board MAC live in a `.env` file (gitignored). Nothing board-specific is committed.

---

## What this gets you

Once it's unlocked, I can log a full ride to CSV and plot it after. Pitch, RPM, signed current, pack voltage, per-cell voltages, controller and motor temps, status bitfield, last error code, lifetime amp-hours. The app shows you battery % and "all good." Everything else is in the raw GATT stream, and I can check for cell imbalance or thermal derating that it doesn't surface.

---

## Caveats

- The unlock token is **board-specific**. Change boards, redo the snoop capture.
- Future Motion could change the algorithm in a firmware update. The XR one has been stable for years; the Pint one might be too. But the data lives on the board, not in their cloud. If they ever gate telemetry behind a login or kill the API, this method still works as long as the handshake stays the same.
- This is not a jailbreak. I'm not writing to flash or modifying firmware. I'm completing the same handshake the official app does, from a different central.
- Do not write to `f302` (riding mode) or the light characteristics while riding. You can nose-dive yourself.

---

## Why I bothered

I've put 100+ hours on this board. I wanted to know what the motor does on a hill climb, whether it hits the current limit or the cells sag unevenly before the app shows a warning.

The board is talking BLE. You just need to know which characteristic to write to.

## Tools and gear

- [USB Bluetooth adapter](https://link.amazon/B0diKZrtS?tag=dctm-20). A dedicated dongle makes BlueZ scanning and the `bleak` client more reliable than a laptop's built-in radio.
- [Raspberry Pi 5](https://link.amazon/B0bHT2yp5?tag=dctm-20). This becomes the base for part 2, a small display on the board for the live stats.