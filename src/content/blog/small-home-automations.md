---
title: Smart Home That Runs on a Router, No Cloud Needed 
keywords: 
    - offline internet of things
    - esp32
    - home automation
    - smart home
    - smart light
    - Tasmota
    - control plane
    - lua
date: 2026-06-23
description: Building a mini smart home for common tasks.  Lessons and insights 
image: /images/control_ux.png
alt: Running on a openwrt router with minimal amount of code as possible.
priority: 0.9
draft: true
---

TLDR; alternative to home assistant, I built a small home automation using off-the-shelf parts and a dashboard using simple html/js. [Full github gist](https://gist.github.com/skittleson/5027ed28c908b4426e07b6cf8eca8e9f)

**What was done:** A router running OpenWrt + MQTT is enough: no server, no Pi, no cloud. Tasmota rules handle most logic on the devices themselves. 50MB of storage forced me to use Lua instead of Python, which worked fine. Everything is modular: swap a switch, change a rule, done.


I built a home automation system that runs entirely a router with 50MB of storage and no cloud services (Tailscale was an exception). It's been running for 2 months. The goal was a "hands off" experience to a single user for lights, fans, vacuum, air quality. All working without asking the user to do anything other then going to a simple html web app.


## Things to automate

- light switches (on a sunset, off at midnight)
- fan switches (never on too long to prevent burn out)
- vacuum (its Tuya device but it has local access)
- smart plugs
- ceiling fans
- remote access to all of this
- human presence

## How are we going to do all of this

To be honest, I know some of this will be hacky but that's okay to us get moving in the right direction. Here is the part list.

| Component | Purpose | Buy |
|---|---|---|
| [GL.iNet Flint 2 router](https://www.amazon.com/dp/B0BZL2DLL1?tag=dctm-20) | Runs OpenWrt + MQTT broker locally | [Amazon](https://www.amazon.com/dp/B0BZL2DLL1?tag=dctm-20) |
| [Martin Jerry smart switches](https://amzn.to/49xMQnw) | Tasmota-loaded ESP32 light/fan switches | [Amazon](https://amzn.to/49xMQnw) |
| [Sonoff S31 smart plugs](https://www.amazon.com/dp/B073F9T9TM?tag=dctm-20) | Power watchdog for the cable modem | [Amazon](https://www.amazon.com/dp/B073F9T9TM?tag=dctm-20) |
[Cheap tuya vacuum](https://amzn.to/4pQVtk9) | To clean the floor | [Amazon](https://amzn.to/4pQVtk9) |
[Cheap Tablet](https://amzn.to/4zcyjcj) | Mounted to wall for dashboard | [Amazon](https://amzn.to/4zcyjcj) |
[Fan humidity switches](https://amzn.to/4g7vYaJ) | Trigger when humidity is too hight | [Amazon](https://amzn.to/4g7vYaJ) |

Openwrt router from gl.net (flint 2.). Its a  Only 50mb of space so I have to budget it. Some i'm using mosquito mqtt package for for retaining messages, authorization and message deliveries. Tailscale for remote access and health monitoring.


Tasmota is prefect for offline access so i'm using some Martin Jerry switches preloaded with it since these are easy to install. Mostly esp32 devices.  I dont need to think too much here on setup and have a ton of local compute now. I ordered the dimmers for a few rooms then rest were typically switches.  There was one spot i wanted a [4-way-switch but i ran into problems](https://docodethatmatters.com/the-infinite-echo-state-mirror-bug/). However, I did get to work even with a few quirks. It was done over mqtt when a light turns off to send a message to the other switch.


Using Sonoff S31 smart plugs to be a watch dog for the cable modem.  That thing can be flaky and requires a hard reboot from time to time. I have no idea why, so i have a smart plug that is always on (PowerOnState 1 with Tasmota in case it restarts). Then a small watchdog script on the router that checks the internet connection. I can see the speed in the dashboard. If it looks like the device is malfunctioning, i can reboot it. I have a smart plug running tasmota that once it's turned off, it turns back on in 3 seconds. Simple and effective in case someone pushes the button. 

    Rule1 ON Power1#State=0 DO SetPower1 1 IN 3 ENDON
    Rule1 1


### MQTT Server

I really needed a durable message queue.  MQTT is easy and has native support with Tasmota. Works good enough but here is a full breakdown on the setup if your interested.
<details>
    <summary>Full AI generated guide for mqtt setup on openwrt router</summary>

#### Platform

- OpenWrt `23.05-SNAPSHOT` (TIP-devel build), `ipq60xx/generic`, aarch64
- Broker runs directly **on the router itself** — no separate Pi/server

#### Install (opkg)

```sh
opkg update
opkg install mosquitto-ssl mosquitto-client-ssl luci-app-mosquitto
```

This pulls in `libmosquitto-ssl` as a dependency. Installed versions:

| Package | Version |
| --- | --- |
| mosquitto-ssl | 2.0.18-2 |
| mosquitto-client-ssl | 2.0.18-2 |
| libmosquitto-ssl | 2.0.18-2 |
| luci-app-mosquitto | git-25.088.25299-77109ee |

#### Config — UCI-managed (not raw mosquitto.conf)

`luci-app-mosquitto` drives Mosquitto through UCI (`/etc/config/mosquitto`,
`option use_uci '1'`), NOT by hand-editing `/etc/mosquitto/mosquitto.conf`.
The raw conf file just has stock comments + one injected `listener 1883
0.0.0.0` line — the real config lives here:

```
config mosquitto 'mosquitto'
    option log_dest 'stderr stdout syslog'
    option allow_anonymous '1'

config persistence 'persistence'
    option persistence '1'
    option location '/etc/mosquitto/data/'
    option file 'mosquitto.db'
    option autosave_interval '30'

config listener 'default'
    option port '1883'
    option host '0.0.0.0'
    option protocol 'mqtt'
```

Edit via LuCI (`luci-app-mosquitto` page) or `uci set mosquitto.mosquitto.allow_anonymous='1'; uci commit mosquitto; /etc/init.d/mosquitto restart`.

#### Enable at boot

```sh
/etc/init.d/mosquitto enable   # creates /etc/rc.d/S80mosquitto symlink
/etc/init.d/mosquitto start
```

#### Verify

```sh
/etc/init.d/mosquitto status   # -> running
netstat -tlnp | grep 1883      # -> 0.0.0.0:1883 and :::1883, mosquitto
mosquitto_sub -h 192.168.22.1 -t 'test/#' -v &
mosquitto_pub -h 192.168.22.1 -t 'test/topic' -m hello
```

### ⚠️ Known gap — no auth, no TLS

- `allow_anonymous '1'` — any device on the LAN can publish/subscribe to
  any topic, no username/password
- SSL variant of mosquitto is installed but **not configured** — only the
  plain `1883` listener exists, no `8883`/TLS listener, no cert/key set
- No password file (`password_file`), no ACL file
- No explicit firewall rule for 1883 — relies on default OpenWrt
  LAN-input-accept; the port is not blocked but also not intentionally
  opened

Given this router also drives the Tasmota switches (hallway/bathroom/exterior
lights, RF fan control) via MQTT, anonymous+no-TLS means any device on the
WiFi can toggle those. To lock down:

```sh
opkg install mosquitto-client-ssl   # already installed
touch /etc/mosquitto/pwfile
mosquitto_passwd -b /etc/mosquitto/pwfile <user> <password>
uci set mosquitto.mosquitto.allow_anonymous='0'
uci set mosquitto.default.password_file='/etc/mosquitto/pwfile'   # or a listener-scoped option per luci-app-mosquitto's schema
uci commit mosquitto
/etc/init.d/mosquitto restart
```

</details>

### Air Quality and Mold Prevention

Other issue was the bathroom shower drain is an open drain. It can build up a smell in that space if the exhaust is not turned on. I'm sure there is a better way to prevent that but I did an approach that makes sense to me: turns the fan on for 5 mins every hour then turns it off. if you turn the fan on, it resets the timer to turn it on again in another hour. Kind of neat rule there.

    Rule1 ON Rules#Timer=2 DO Backlog Power1 1; RuleTimer1 300; RuleTimer2 3600 ENDON ON Rules#Timer=1 DO Power1 0 ENDON

Then enable it via `rule1 1`. A cool side affect of this is if someone turns it on 30 mins into the hour cycle, it resets. 


The vanity also has a fan with a humidity detection so it has a rule for humidity but i still want to make sure it turns off after 20 minutes of being on.

    Rule2 ON Power1#State=1 DO RuleTimer1 1200 ENDON ON Rules#Timer=1 DO Power1 0 ENDON ON Power1#State=0 DO RuleTimer1 0 ENDON

Then enable it via `rule2 1`.  I have a shower fan that will also need the same treatment since this is already on the vanity which im not sure if it should ever trigger. Basically states that if the humdity is over 80, turn on the fan else under 75, turn it off.

    ON HDC1080#Humidity>80 DO power 1 ENDON ON HDC1080#Humidity<75 DO power 0 ENDON

Last thing, there is paint you can get that prevents mold. I'd recommend it once everything has been cleaned extremely well.  One more idea that has worked out well was auto closing door hinges. Keeps those little rooms isolated and easier to control.

## Remote access

I'm using tailscale to monitor this router remotely but don't want to see all the devices on my tailscale network. However, i do want to access the devices sometimes. My approach is to login to the router when needed to make it part of my active network, ssh proxy into the network, or considering a simple proxy on the router to access the devices.


## Where is this at project

I've done a lot with proven hardware that can be swapped out at almost any given time. I only have 50mb of space on this openwrt router which means python is pretty tight to run.  It was fun restriction to push boundaries on. Using lua script instead of python version was also tricky since conversion wasn't always straightforward.  I did have to use python lib to sniff the network for Tuya vacuum keys to begin with tho.  

It's been running for 2 months with zero downtime.


## The Rules

After a decade of doing home automatons, i've settled on these rules (mostly) (Even give a few presentations on this!). You don't want to be in situation where is grandma/grandpa/parents are calling you to turn on  a light.  Applying these rules to this project with constraints I had was difficult. 

### Must rules

- **Preserve existing functionality if it's the norm.** If a light switch already works, automation shouldn't break that first way of using it.
- **IoT devices must operate without the internet.** If the network dies, your lights should still turn on. Bonus if they work without power too.
- **Must be flexible in configuration.** Rigid setups break when life changes. You should be able to adjust behavior without rewriting everything.

### Should rules

- **Do periodic reviews of automations.** What made sense six months ago may not make sense now. Revisit rules regularly.
- **When breaking a rule, make it exceptional.** If a must rule is violated, document why and make it clear that the exception is deliberate, not accidental.

### Extended rules

- **Have an API when using cloud-connected devices, with logs.** If you rely on a cloud service, demand access and visibility. No black boxes.
- **Keep common configurations in one location.** Don't scatter settings across three apps. One source of truth makes changes painless.
- **Provide multiple ways to interact with the smart home.** App, Alexa, QR codes, NFC tags — give people options, don't lock them into one interface.
- **Identify common tasks that can become routines.** If you're doing the same sequence of actions, automate it into a routine.
- **Use pub/sub events such as MQTT.** Decouple devices from each other. Point-to-point systems create dependency chains that break.
- **Only use batteries if the device can last a year or more.** Batteries are a maintenance tax. If a device dies in three months, it's not worth the convenience.

## Conclusion with Insights

The tight 50MB restriction forced me to use Lua instead of Python, which was a good constraint. Most of what people buy for home automation a server, a Raspberry Pi, and/or a cloud account. A router, off-the-shelf devices, and a handful of Tasmota rules does the job. When it breaks, I can reconfigure everything in under an hour. That's the part I like most: easy to swap, easy to remove.
