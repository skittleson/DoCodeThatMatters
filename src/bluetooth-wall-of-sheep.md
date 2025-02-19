<!-- ---
title: "The Hidden Risks of Bluetooth: What Hackers Already Know"
keywords: 
    - bluetooth
    - ble
    - defcon 2024
    - BleakScanner
    - BleakClient
    - bleak
    - wall of sheep
    - python
date: 2024-09-07
description: An inspired project from DEFCON 2024 of the Wall of Sheep with ble devices
image: images/ble_wall_of_sheep.jpg
alt: A bluetooth device that can be discovered with simple scan.
priority: 0.9
--- -->

There are tons of these little BLE (Bluetooth Low Energy) devices everywhere.  
Some are encrypted, while others are not.  Some never move, some always seem to be always on the move.  
Inspired by a DEFCON ["Wall of Sheep"](https://www.wallofsheep.com/) of open WiFis, I went down discovery phase of these devices. 
Most Bluetooth Low Energy aka BLE devices can be tracked. Maybe that's obvious to most tech people but not others. There are devices that are intended to be one time pairing, and/or then there are devices that always just broadcast. The ones that are always broadcasting are of interest. 
We'll focus of the rest of this blog post.

## Scanning IS straightforward


[bleak](https://bleak.readthedocs.io/en/latest/installation.html)  is a common python library that can be imported in to do a quick basic scan.

```python
from bleak import cli
cli()
```

Some information is redacted here but we have devices! No real insights unfortunately.

```bash
68:00:00:00:00:00: R33-0405
68:00:00:00:00:00: R33-0405
4D:00:00:00:00:00: None
74:00:00:00:00:00: None
74:00:00:00:00:00: None
D6:00:00:00:00:00: N016Y
3A:00:00:00:00:00: None
29:00:00:00:00:00: None
63:00:00:00:00:00: None
7F:00:00:00:00:00: None
6F:00:00:00:00:00: None
A4:00:00:00:00:00: None
5A:00:00:00:00:00: None
```

## Detailed Scanning

![Wall of Sheep](images/ble_wall_of_sheep.jpg "Bluetooth 'Wall of Sheep'")

There is useful information here such as device company, services, and distance.

### Random MAC addresses preventable tracking (or do they). 

This is intended to hide a device.  Well, it kind of works where the device changes every two minutes or so.  Thats the flaw at the same time. if i know its an apple device broadcasting (which can be figured out knowning some basic information),  watch the device disappear and a new one appear within a minute, its likely the same device.  As long as the device is not moving... how do you know that? the RSSI pretty much stays the same.



### How can you track distances?

Official way... using a device transmission,  recieiving powers, and signal propagation (in a line of sight, walls, or heavy intefernce). https://stackoverflow.com/a/24245724

	distance = 10^((tx_power - rssi) / (10 * signal_propagation_constant))


How do you do it with a device's RSSI only?  Not possible BUT there is an approximation.

	rssi (float): The RSSI value in dBm.
	p0 (float): The RSSI value at 1 meter (reference distance). Default is -50 dBm.
	n (float): The path loss exponent. Default is 2 (free space).

	10 ** ((p0 - rssi) / (10 * n))

What's more interesting is device present that can hint at the other devices distance.

For example, if you know you are in a line of sight and one device is telling you 5 meters with and rssi of 40 likely the other device that has no tx but rssi of 40 is also within 5 meters.  THIS IS USEFUL


## Static Addressable BLE Devices

These devices usually have services and characteristics... more on that later.

Static devices that never ever move.  TVs, lights, temps, smart locks, etc.  the interesting thing about these are location indicators or human presence indicators.  For example, on all Samsung TVs the BLE doesnt show up until the TV is ON and disappears when OFF.  Which could give insight if someone is watching TV ( or that  a TV is on).

Static devices that DO move... like AirTags, Tiles,  and ble tags.  these are REALLY interesting... you can just track when someone is coming/going (as long as they have the tag)

### Services

These devices can have well known services / characteristics !  temp and humidity is fairly common.  battery service as well.   There is a really good app to call nr toolbox. Good to discover locally.  Auto resolving these can be tricky since most required a device to be notified.

### Insights

- Human presence. 
	- a TV being ON/OFF is a clear indicator if someone is home... or going to bed
	- AirTag/Tile seen then disappearing then reappearing at certain times of the day (when someone is coming home!)
- Resolving distances by using other devices around it that support transmission power.
- Exposure of semi-sensitive information such as device metadata and/or data.