---
title: Raspberry Pi – Bluetooth Proximity
keywords:
  - Bluetooth proximity detector
  - Raspberry Pi
  - USB Bluetooth adapter
  - Bluetooth device detection
  - MAC address
date: 2017-05-26
modified: 2023-01-25
description: Build a Bluetooth proximity detector using Raspberry Pi. Tutorial shows how to detect nearby Bluetooth devices without pairing.
image: https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Raspberry-Pi-2-Bare-BR.jpg/330px-Raspberry-Pi-2-Bare-BR.jpg
alt: Raspberry Pi!
priority: 0.9
---

Let's create a Bluetooth proximity detector using a Raspberry Pi, USB Bluetooth adapter, and a phone with Bluetooth enabled. This tutorial will guide you through the process of detecting a known Bluetooth device within range of the Raspberry Pi, without the need for pairing the devices.

**Step 1. Ensure USB Bluetooth is working on the Raspberry Pi.**  
Install `sudo apt-get install bluetooth`  
Check it Bluetooth status with this command: `hcitool dev`  
Should return the device's Bluetooth address: `Devices: hci0 00:00:00:00:00:17`

**Step 2. Getting the MAC address of a device.**
On an Android Phone version 6.0.1, Settings > System > About device > Status > Bluetooth address.

**Step 3. Test Connection to Client Device**  
Command: `sudo l2ping -c 2 00:11:22:AA:BB:CC`  
Result:  
`Ping: 00:11:22:AA:BB:CC from 00:00:00:00:00:17 (data size 44) ... 0 bytes from 00:11:22:AA:BB:CC id 0 time 7.32ms 0 bytes from 00:11:22:AA:BB:CC id 1 time 22.46ms`

**[Checkout some of the additional commands in this blog post](/research-bluetooth-proximity)**
