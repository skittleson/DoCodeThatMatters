Many devices (such as a tv) only broadcast Bluetooth low energy while they are on then disappears when it turns off. That means anyone standing outside your house with a laptop can tell when you're watching TV, when you get up, and when you go to bed. No pairing, no password, nothing to hack.

I built a tool to explore exactly this: [bluetooth-wos](https://github.com/skittleson/bluetooth-wos), a terminal scanner (inspired by DEFCON's Wall of Sheep) that sort of fingerprints nearby BLE devices past their randomized MACs, estimates their distance from signal strength, and uses known device to calibrate the rest. This post walks through how it works and how to stop your own devices from leaking this stuff.

**TL;DR** BLE devices leak more than you'd think. [I built a tool](https://github.com/skittleson/bluetooth-wos) that can scan and fingerprint devices past their randomized MACs, estimate distance from signal strength, and use one known device to calibrate the rest.

--------

I've seen enough security-based issues to understand this could be a problem. Lately I've been interested in when devices come and go: 1. visitors around me 2. how many people are in this area 3. security reasons (should this device be here?) 4. why is this device no longer present?

## How I scan: explore the devices around you now

From your phone use [nRF Connect](https://play.google.com/store/apps/details?id=no.nordicsemi.android.nrfconnectdevicemanager&hl=en&gl=US).  Easily scan devices around you.  Allows looking through [service](https://bitbucket.org/bluetooth-SIG/public/raw/025ac280519f8ad3967f79ee45bd921a76003113/assigned_numbers/uuids/service_uuids.yaml) and characteristics data (such as temperature, humidity, battery levels).


[now try it with a python lib called bleak](https://bleak.readthedocs.io/en/latest/installation.html) is a common python library that can be imported to do a quick basic scan.  

  pip install bleak. 

Copy and past this into your python REPL.

```python
import asyncio
from bleak import BleakScanner

def detection_callback(dev, adv_data):
    name = dev.name or 'None'
    rssi = getattr(adv_data, 'rssi', None) if adv_data else None
    tx_power = None
    if adv_data:
        tx_power = getattr(adv_data, 'tx_power', None)
        if tx_power is None:
            tx_power = getattr(adv_data, 'TxPower', None)
    parts = [dev.address, name]
    if rssi is not None:
        parts.append(f'RSSI={rssi}')
    if tx_power is not None:
        parts.append(f'TX={tx_power}')
    print(' '.join(parts))

async def main():
    scanner = BleakScanner(detection_callback=detection_callback)
    await scanner.start()
    await asyncio.sleep(10)
    await scanner.stop()

asyncio.run(main())

```

Output:

```bash
4F:0C:EE:XX:XX:XX 4F-0C-EE-XX-XX-XX RSSI=-77 TX=17
40:47:4E:XX:XX:XX 40-47-4E-XX-XX-XX RSSI=-72
4F:0C:EE:XX:XX:XX 4F-0C-EE-XX-XX-XX RSSI=-76 TX=17
34:48:7C:XX:XX:XX 34-48-7C-XX-XX-XX RSSI=-60
38:01:95:XX:XX:XX [TV] UN75J630D RSSI=-62
CC:6E:A4:XX:XX:XX [TV] Samsung Q7 Series (55) RSSI=-52
FC:4F:93:XX:XX:XX FC-4F-93-XX-XX-XX RSSI=-70
38:01:95:XX:XX:XX [TV] UN75J630D RSSI=-59
DE:D7:84:XX:XX:XX DE-D7-84-XX-XX-XX RSSI=-91
3C:06:0B:XX:XX:XX 3C-06-0B-XX-XX-XX RSSI=-51
29:2D:CF:XX:XX:XX 29-2D-CF-XX-XX-XX RSSI=-71
CC:6E:A4:XX:XX:XX [TV] Samsung Q7 Series (55) RSSI=-50
4F:7A:96:XX:XX:XX 4F-7A-96-XX-XX-XX RSSI=-98 TX=12
46:04:4C:XX:XX:XX 46-04-4C-XX-XX-XX RSSI=-85
C0:22:16:XX:XX:XX C0-22-16-XX-XX-XX RSSI=-73
38:01:95:XX:XX:XX [TV] UN75J630D RSSI=-57
C0:98:97:XX:XX:XX C0-98-97-XX-XX-XX RSSI=-93
38:01:95:XX:XX:XX [TV] UN75J630D RSSI=-57
7D:34:9B:XX:XX:XX 7D-34-9B-XX-XX-XX RSSI=-98 TX=8
38:01:95:XX:XX:XX [TV] UN75J630D RSSI=-58
5B:6F:9C:XX:XX:XX 5B-6F-9C-XX-XX-XX RSSI=-73
CC:6E:A4:XX:XX:XX [TV] Samsung Q7 Series (55) RSSI=-50
>>>
```

At first glance, this might seem harmless but combined with a persistent scan, tracking becomes easy.

## Persistent Scanning Tool

[Not being satisfied with such simple scan, I wrote this tool](https://github.com/skittleson/bluetooth-wos) that gives device company, services, characteristics, and distance. I've mostly used this tool for basic tracking, device distance estimations, and spotting when new devices show up. I have a long list of ideas to add to it such as no-person detection, mqtt publish, home assistant integration, etc.  It also very much inspired by the Defcon's wall of sheep. 

BUT for the rest of this post I'll mostly look at tracking and prevention.

## Beating MAC randomization

Random MAC addresses help, but they will not fully protect you. A MAC changing every few minutes doesn't mean you can't be tracked. We still see some pretty interesting information such as manufacturer data, and there are ways to overcome the rotation. For example, the name of the device or the RSSI (Received Signal Strength Indicator) value staying the same for long periods of time lets you re-link a "new" MAC to the same physical device.

### Company / Manufacturer of each device

A [public source of company identifiers](https://bitbucket.org/bluetooth-SIG/public/raw/025ac280519f8ad3967f79ee45bd921a76003113/assigned_numbers/company_identifiers/company_identifiers.yaml) which can be helpful to identify common devices. Easier to find exploits and/or features.

### Services

These devices can have well known bluetooth gatt services / characteristics! Temperature, humidity, and battery service are common.  Auto resolving these can be tricky since most require a device to "notify". 

## Ranging: how far away is a device?

![Device distances on a cartesian plane](/images/distance_diagram.png)

The official way is to use the device transmission power, receiving power, and signal propagation (this value changes in a line of sight, walls, or heavy interference see [quick reference](https://stackoverflow.com/a/24245724) and [research paper](https://www.semanticscholar.org/paper/Evaluation-of-the-reliability-of-RSSI-for-indoor-Dong-Dargie/9e1bb0d0a75570c54c4c144c8a08e8b54721149a)).


	distance = 10^((tx_power - rssi) / (10 * signal_propagation_constant))

Signal propagation constant is based on the environment like walls, interference, metal, and really anything that can stop a signal. The range is usually between 2-10, with 2 being in an open space and 10 with heavy interference. Typical modern drywall homes tend to see n = 4–6 for straight-line-of-sight paths. I use 8 in a modern home — that's a conservative value, better suited for heavily obstructed multi-wall paths. 

How do you do it with a device's RSSI only?  Not nearly as accurate BUT there is an approximation.

	RSSI = C - 10n × log₁₀(distance)

### Calibrating unknown devices against known ones

This is a practical part of this post and why i think its the most useful; finding device distance with a known constant device. The tool collects all devices that DO have a known TX power, builds a log-linear regression model of `log10(distance)` vs RSSI, then uses that model to estimate distances for the devices that don't. The reference TX power is derived from the known device rather than assuming some common default value.

A quick illustrative example. Say one device advertises its TX power and the model puts it at roughly 5 meters at an RSSI of -60. Another nearby device with no TX power is coming in at about -62. Since it sits on almost the same point of the fitted curve, the model estimates it at a similar range: call it ~5-6 meters. Drop to an RSSI of -75 and the same model pushes the estimate out toward ~12-15 meters. One calibrated anchor, and suddenly every anonymous device on the scan has a rough position. These are rough estimates! Not precise ranging since RSSI is noisy. Every device with `*` next to it is ranged.

## Presence detection: who's home, and when

### Static BLE Devices = Surveillance Tools

Static devices that never ever move: TVs, lights, temps, smart locks, etc. The interesting thing about these is they are location indicators and/or human presence indicators. For example many TVs with BLE doesn't show up until the TV is ON and disappears when OFF. This could give insight into whether someone is watching TV (or simply that a TV is on). Which means it also leaks when a house goes quiet and everyone heads to bed. I assume this is a way to save power or turn off the functionality when it's not needed.

Static devices that DO move... like AirTags, Tiles, and BLE tags are REALLY interesting since this allows tracking of coming/going. Those MACs don't change often (usually 15 minutes) since they are meant to be found. You can see this feature is now showing up as a problem since Apple/Google now notify you when a device you don't know is following you.

Put all these together in a persistent scan turns turns into a presence log:

- **Human presence**
	- a TV being ON/OFF is a clear indicator of whether someone is home... or going to bed
	- an AirTag/Tile seen, then disappearing, then reappearing at certain times of the day (when someone is coming home!)
- The ability to get distances using other devices that have transmission power.
- Exposure of semi-sensitive information via device metadata.
- How many individuals are within the area.

## Can you detect someone scanning for devices?

It depends on *how* they're scanning. Passive scanning, like listening, is invisible. The radio is just receiving so there is not much to detect. Active scanning is possible to detect since a scanner will send `SCAN_REQ` to advertisers. This is very low level, so you're not going to be able to capture it with a phone or laptop easily. Verdict here: nearly impossible to detect.

## Insights of real data

Most identifying named devices
1. [TV] Samsung Q7 Series (55) — specific 55" QLED, present the whole capture, ~0.41 m
2. [TV] UN75J630D — specific 75" Samsung model, whole capture, ~0.62 m
3. COROS PACE 3 676710 — running watch with an embedded serial, wrist distance
4. soundcore AeroFit 2 Pro — specific Anker open-ear earbuds
5. Samsung SmartTag2 ×4, Philips Hue ×2
The two TV model numbers and the watch serial are the most privacy-revealing static strings.
Residents vs. passers-by (sharply bimodal)
- 341 devices seen in a single instant → passers-by / neighbors / the Fast Pair swarm.
- 26 devices = ~80% of all observations; only 7 persist the full 85 min → fixed infrastructure + the owner's carried gear.
Proximity — the owner's own kit
Sub-meter, whole-session devices: Soundcore earbuds (0.27 m, −45 dBm), both TVs (0.4–0.6 m), COROS watch (0.75 m, min 0.24 m). A tail of Apple/Samsung fingerprints sit at 2–3 m with RSSI bottoming at −100 dBm → adjacent rooms / neighbors.
The standout behavioral event (device correlation)
The tool caught one person walking in and putting in earbuds at 23:59:
- The LE advertiser rotated MAC 3× while approaching: 2.12 m → 2.02 m → 0.27 m
- The classic Bluetooth audio profile lit up at the exact same second and identical 101-observation window as the final LE fingerprint — earbuds switched on and worn at the desk.

## How to protect yourself

This section matters as much as the scanning. Reduce your exposure with the following concrete steps:

- **Disable Bluetooth on devices that don't need it.** TVs are the big one — if you're not using BLE remotes/casting, turn it off in the TV's settings. Same for smart plugs, bulbs, and anything that broadcasts 24/7.
- **Use Airplane Mode in sensitive areas.** It stops your phone (and its accessories) from advertising altogether. Toggle it when you don't want to be trackable.
- **Turn on unknown-tracker alerts.** Both Apple and Google now warn you when an unfamiliar AirTag/Tile-style tracker is following you.
	- iOS: alerts are on by default; you can also run *Settings → Privacy & Security → Safety Check*.
	- Android: *Settings → Safety & emergency → Unknown tracker alerts* (and the standalone "Find My Device" scanning).
- **Audit what's broadcasting.** Run a scanner (nRF Connect, or the tool above) around your own home to find surprising devices around you and lock them down.

## References

 - https://www.beaconzone.co.uk/blog/category/rssi/
 - [bleak](https://bleak.readthedocs.io/en/latest/installation.html)
 - https://www.appelsiini.net/2017/trilateration-with-n-points/