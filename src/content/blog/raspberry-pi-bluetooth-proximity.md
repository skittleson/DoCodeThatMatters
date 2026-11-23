---
title: "How Do I Detect Nearby Bluetooth Devices with a Raspberry Pi?"
keywords:
  - Bluetooth proximity detector
  - Raspberry Pi
  - USB Bluetooth adapter
  - Bluetooth device detection
  - MAC address
date: 2017-05-26
modified: 2026-11-23
description: Build a Bluetooth proximity detector on a Raspberry Pi with hcitool and l2ping — detect nearby devices without pairing. Try it today.
image: https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Raspberry-Pi-2-Bare-BR.jpg/330px-Raspberry-Pi-2-Bare-BR.jpg
alt: Raspberry Pi!
priority: 0.9
faq:
  - q: "How do I detect Bluetooth devices nearby with a Raspberry Pi without pairing?"
    a: "Install the Bluetooth stack with `sudo apt-get install bluetooth`, then run `hcitool dev` to confirm the adapter is there — it returns a device address such as `Devices: hci0 00:00:00:00:00:17`. With a USB Bluetooth adapter attached, the Raspberry Pi can then probe for nearby devices within range without pairing."
  - q: "How do I get a Bluetooth device MAC address to use with l2ping on a Raspberry Pi?"
    a: "On an Android phone (version 6.0.1), open Settings > System > About device > Status > Bluetooth address to read the MAC. Then run `sudo l2ping -c 2 <MAC>` (for example `sudo l2ping -c 2 00:11:22:AA:BB:CC`) and watch for two round-trip replies."
  - q: "How do I confirm a nearby Bluetooth device is within range?"
    a: "Run `sudo l2ping -c 2 <MAC>` — e.g. `sudo l2ping -c 2 00:11:22:AA:BB:CC`. Healthy replies look like `0 bytes from 00:11:22:AA:BB:CC id 0 time 7.32ms 0 bytes from 00:11:22:AA:BB:CC id 1 time 22.46ms`, confirming the device is within range with no pairing required."
---


A quick 2017-era build, but the same steps still work today — see [what a real scan of my house found](/i-scanned-the-ble-devices-around-my-house/) for a modern 2026 take with bleak and a persistent scanner.

Let's create a Bluetooth proximity detector using a Raspberry Pi, USB Bluetooth adapter, and a phone with Bluetooth enabled. This tutorial will guide you through the process of detecting a known Bluetooth device within range of the Raspberry Pi, without the need for pairing the devices.

**Step 1. How do I confirm USB Bluetooth is working on the Raspberry Pi?**  
Install `sudo apt-get install bluetooth`  
Check the Bluetooth status with this command: `hcitool dev`  
Should return the device's Bluetooth address: `Devices: hci0 00:00:00:00:00:17`

**Step 2. How do I get the MAC address of a Bluetooth device?**
On an Android Phone version 6.0.1, Settings > System > About device > Status > Bluetooth address.

**Step 3. How do I confirm a device is within range?**  
Command: `sudo l2ping -c 2 00:11:22:AA:BB:CC`  
Result:  
`Ping: 00:11:22:AA:BB:CC from 00:00:00:00:00:17 (data size 44) ... 0 bytes from 00:11:22:AA:BB:CC id 0 time 7.32ms 0 bytes from 00:11:22:AA:BB:CC id 1 time 22.46ms`

**[Checkout some of the additional commands in this blog post](/research-bluetooth-proximity)**
