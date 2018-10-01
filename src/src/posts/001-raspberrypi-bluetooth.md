---
layout: post.hbs
title: Raspberry Pi – Bluetooth Proximity
keywords: raspberry pi, bluetooth
date: 2017-05-26
desc: Building bluetooth detection with a raspberry pi!
image: https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Raspberry-Pi-2-Bare-BR.jpg/330px-Raspberry-Pi-2-Bare-BR.jpg
imageAlt: Raspberry Pi!
priority: 0.9
---

Let's build a Bluetooth proximity detector! You only need a Raspberry Pi, USB Bluetooth, and a phone with Bluetooth enabled. This tutorial will show how to detect a known Bluetooth device that is within the range of the Raspberry Pi without pairing the devices.  
<br/>
**Step 1. Ensure USB Bluetooth is working on the Raspberry Pi.**  
Install `sudo apt-get install bluetooth`  
Check it Bluetooth status with this command: `hcitool dev`  
Should return the device's Bluetooth address: `Devices: hci0 00:00:00:00:00:17`  
<br/>
**Step 2. Getting the MAC address of a device.**
On an Android Phone version 6.0.1, Settings > System > About device > Status > Bluetooth address.  
<br/>
**Step 3. Test Connection to Client Device**  
Command: `sudo l2ping -c 2 00:11:22:AA:BB:CC`  
Result:  
`Ping: 00:11:22:AA:BB:CC from 00:00:00:00:00:17 (data size 44) ... 0 bytes from 00:11:22:AA:BB:CC id 0 time 7.32ms 0 bytes from 00:11:22:AA:BB:CC id 1 time 22.46ms`  
<br/>
