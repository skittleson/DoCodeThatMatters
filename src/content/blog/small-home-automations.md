---
title: Offline Smart Home 
keywords: 
    - offine internet of things
    - esp32
    - home automation
    - smart home
    - smart light
    - Tasmota
    - control plane
    - lua
date: 2026-06-23
description: Building a miminist mini smart home for common tasks.  Lessons and insights 
image: /images/control_ux.png
alt: running on a gl net router with minminal amount of code as possible.
priority: 0.9
draft: true
---

TLDR; alternative to home assistant using simple html/js for a tasmota control panel https://gist.github.com/skittleson/5027ed28c908b4426e07b6cf8eca8e9f


Currently building out a simple home automation setup for a family member.  I have spent a considerable amount of time thinking, experimenting, and building out a "hands off" experience.  There is some pretty important needs that require some consideration around air quality, light, and exhaust.  There is also some smart defaults that should occur.

So workinng the problem, this home has a router and cable modem.  The good news is openwrt which is very useful for expanding on.

## Things to automate

Basic things to automate here

- light switches
- fan switches
- vacuum (its tuya device)
- smart plugs (control of random devices)
- ceiling fans
- remote access to all of this
- human presence

## How are we going to do all of this

To be honest, I know some of this will be hacky but that's okay to get moving.

Openwrt router from gl.net. Its a flint 2. Only 50mb of space so I have to budget it. Some i'm using mosquitto mqtt package for for retaining messages, authorization and message propgration. Tailscale for remote access and health monitoring.


Tasmota is prefect for this so i'm using some Martin Jerry switches preloaded with it. They are mostly esp32 devices.  I dont need to think too much here on setup and have a ton of local compute now. I ordered the dimmers for a few rooms then rest were typically switches.  There was one spot i wanted a 4-way-switch since the location really needed it.  I ended up doing that over mqtt when a light turns off to send a message to the other switch.


I did purchase some Sonoff S31 smart plugs to be a watchdog for my cable modem.  That thing can be flaky and requires a hard reboot from time to time. I have no idea why, so i have a smart plug that is always on (PowerOnState 1 with Tasmota incase it restarts). I then i have small watchdog script on the router that checks the internet connection for how fast. 



<summary>
    A restart lua script
<detail>
    ```luascript
    ```
</detail>
</summary>


Other issue was the bathroom shower drain is an open drain. It can build up a smell in that space if the exhaust is not turned on. I'm sure there is a better way to prevent that but i did an approach that makes sense to me: turns the fan on for 5 mins every hour then turns it off. if you turn the fan on, it resets the timer to turn it on again in another hour. Kind of neat rule there.


## Where am i at with this work

I've done a lot to be concise and use proven hardware that can be swapped out at almost any given time.

I only have 40mb of space on this openwrt router which means python is pretty tight to run. So i had to replicate this in lua script using the python version as a guide.  I did have to use python lib to snif the network for tuya vacuum keys tho

## Insights

i built a ton of stuff but then i either refactor it, swapped it, and/or abandoned it. Thats the deal with doing these home improvement projects. Automation is no less.
