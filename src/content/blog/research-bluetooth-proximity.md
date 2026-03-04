---
title: Research on Bluetooth Proximity
keywords: 
    - bluetooth proximity research
    - bluetooth
    - hcitool
    - l2ping
date: 2019-10-19
description: Research on bluetooth proximity using open tools such as hcitool, l2ping, and hcidump
image: https://images.unsplash.com/photo-1570993492891-ac6f259ce777?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1650&q=80
alt: A bluetooth device that can be discovered with simple scan.
priority: 0.9
---

My research on bluetooth proximity using open tools such as `hcitool`,`btmgmt`, `l2ping`, and `hcidump`. A follow up to [Raspberry Pi – Bluetooth Proximity](raspberry-pi-bluetooth-proximity) blog post.

## Commands

Replace `<MAC>` with a bluetooth mac address.

### Scan for Bluetooth LE Devices:

`timeout --signal=SIGINT 30 hcitool lescan`

### Get Bluetooth LE Devices with RSSI values:

`btmgmt find`

Response:

```bash
    hci0 dev_found: <SOME_MAC> type LE Random rssi -92 flags 0x0000
    AD flags 0x1a
    eir_len 14
    hci0 dev_found: <SOME_MAC> type LE Random rssi -97 flags 0x0000
    AD flags 0x1a
    eir_len 18
    hci0 dev_found: <SOME_MAC> type LE Random rssi -77 flags 0x0000
    AD flags 0x06
    name N016Y
    hci0 dev_found: <SOME_MAC> type LE Public rssi -100 flags 0x0004
    AD flags 0x00
    eir_len 28
    hci0 dev_found: <SOME_MAC> type LE Random rssi -94 flags 0x0000
```

### Ping bluetooth enable device without pairing:

`l2ping -c 3 <MAC>`

Response:

    Ping: <MAC> from <THIS DEVICE> (data size 44) ...
    44 bytes <MAC> id 0 time 6.05ms
    44 bytes <MAC> id 1 time 9.90ms
    ♥2 sent, 2 received, 0% loss

### Dump all data of a paired bluetooth device:

`hcidump -a`

### To request authorization from device:

`hcitool cc <MAC>; hcitool auth <MAC>`

### Attempt connection then get RSSI value:

`hcitool cc <MAC> && hcitool con && hcitool rssi <MAC>`

Response:

```bash
Connections:
        < ACL <MAC> handle 12 state 7 lm MASTER
RSSI return value: -4
```

This attempts to connect which doesn't work but the RSSI value is now present for device.

### Attempt to get RSSI value without trying to connect to device:

`hcitool cmd 0x05 0x0005 0x00 0x00 <MAC>`

## Some Resources

<http://techiesanswer.com/ubuntu-command-line/unix-bluetoothctl-and-bluetooth-sendto-tools-to-send-file/>
<https://www.jaredwolff.com/get-started-with-bluetooth-low-energy/#show1>
<https://raspberry-projects.com/pi/pi-operating-systems/raspbian/bluetooth/bluetooth-commands>
[access terminal over bluetooth](https://askubuntu.com/questions/248817/how-to-i-connect-a-raw-serial-terminal-to-a-bluetooth-connection)
<https://ieeexplore.ieee.org/document/7124822>
<https://pdfs.semanticscholar.org/a0b3/67e1ade049f80ff787e1c1b2e9bbc7de6795.pdf>
<https://stackoverflow.com/a/56522568/2414540>
<https://www.raspberrypi.org/forums/viewtopic.php?t=47466>
