<!-- ---
title: Bluetooth Relay Toggle with batteries included
keywords:
  - raspberry pi
  - bluetooth
  - microcontroller
  - Arudino
  - ESP32
  - BLE GATT
  - BLE GATT Server
date: 2021-04-05
description: Build a Bluetooth relay toggle with no app included.
image: https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/BluetoothLogo.svg/330px-BluetoothLogo.svg.png
alt: Bluetooth technology
priority: 0.9
--- -->

[Web app BLE GATT](https://skittleson.github.io/BluetoothToggleRelayApp/) [GitHub source code for the app.](https://github.com/skittleson/BluetoothToggleRelayApp) [GitHub source for BLE GATT firmware for ESP32.](https://github.com/skittleson/BluetoothRelayToggle)

- Firmware for microcontroller that has the ability to trigger a relay with any device that a bluetooth connection.
- Firmware follows an open standard. Bluetooth GATT.
- Open source web app to mixup the design. PWA local caching.
- Support multi clients connecting.

## Firmware

The firmware follows a standard Bluetooth GATT server for a microcontroller.

- the builtin led is set.
- service and characteristic uuids are unique
- name of device is ToggleRelay
- `CHIP_CHARACTERISTIC_UUID` is the microcontrollers's chip id

[GitHub source](https://github.com/skittleson/BluetoothRelayToggle/blob/main/ToggleRelay.ino)

## App
