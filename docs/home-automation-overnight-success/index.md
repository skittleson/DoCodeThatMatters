> **AI;DR:** I wrote the first draft, AI helped me edit and rewrite it, and I made the final pass. The rules, setups, and talks are my own.

TLDR; Every core smart device in my house does not depend on a vendor's server. If the internet goes down, everything works (downgraded experience perhaps).  It has been my rule for 10 years and it has been challenging to follow. I've given two talks about it.  Check out each slide by slide.

## Why local


My Nest integration worked one day until it didn't.  They had changed the api (around the same time Google acquired them). I have a few more examples in these talks that show a samsung fridge and a grill controller that needs wifi to show temperature.  I don't/shouldn't need wifi and/or vendor service to interact with hardware.

So everything that matters runs on hardware I own. Mostly on Tasmota on esp8266/esp32 boards, MQTT broker, and Node-RED on a Raspberry Pi. I do use some cloud services for enhancements like Alexa and a few AWS ones BUT those are secondary.  If the internet is down, the switches all work like normal.

## The rules

From the first talk:

1. No internet, no problem. Core stuff has to work with the internet unplugged.
2. Don't remove the old way while adding the new one.
3. Be agile. 
4. Check your automations.
5. Exceptions must be exceptional.

Added after year five, once more people lived in the house:

6. A cloud device needs an API with logs or it doesn't get installed. I don't want a black box in the house.
7. Configuration lives in one place instead of five vendor apps.
8. More than one way to do something. An app, Alexa, a QR code, or an NFC tag. 
9. If I keep doing the same steps, it becomes routine (node red or on the tasmota device itself).
10. Devices talk pub/sub over MQTT instead of point to point.
11. No batteries unless they last a year or more between changes. 

I get asked about the [the Tasmota sprinkler controller](/automate-sprinkler-with-tasmota/) the most as well as the garage door setup. Both have been running for years with no real changes. 

## Talk One: Home Automation

![Home Automation, for fun and convenience](/images/home-automation/t1-01.webp "Title slide: Home Automation, for fun and convenience")

Nobody needs any of this. I like building things that just work in the background. Each automation is a small puzzle.  Its a hobby.

![Connected Everything collage of icons](/images/home-automation/t1-02.webp "Connected Everything: the modern everything-is-online mess")


Everything seems to want to reach out to the cloud. Laptops, phones, etc make sense. However my thermostats and locks... smart devices need to be questioned since they could be critical useful in your home.  They may go out of business so be mindful what your signing up.

![Nest thermostat, Amazon smart plug, and Yale smart lock keypad](/images/home-automation/t1-03.webp "The retail starting point: Nest, an Amazon smart plug, and a Yale lock")

Many start start with these devices: thermostat, smart plug, smart lock. Each can have its own account and app.  Usually people will try to combine devices into the same ecosystem when possible.

![Privacy, Integration/Flexibility, and Cost triangle](/images/home-automation/t1-04.webp "Privacy, Integration and Flexibility, Cost: pick your tradeoffs")

Know this triangle: cloud cam is cheap and easy but in exchange for costs you privacy. A smart plug I flash myself takes longer to set up, but I can hook it into anything. Figure out where a device lands before buying it.

![A light switch taped on with a note reading Leave Switch On, This is BAD](/images/home-automation/t1-05.webp "This is bad: a switch taped in the on position so automation can take over")

This is bad behavior. Don't tape switches to the on position.

![Wemo Wi-Fi Light Switch retail box](/images/home-automation/t1-06.webp "A Wemo Wi-Fi light switch, the in-wall alternative to a taped switch")

The better fix is an in-wall Wi-Fi switch. It still works like a normal switch and I can automate it. More work to install than a smart plug. Nobody has to change their habits.

![No Internet, No Problem: scissors cutting an ethernet cable](/images/home-automation/t1-07.webp "No internet, no problem")

Rule one: if the internet goes down, my lights still turn on.

![Must Be Agile: sticky notes on a planning board](/images/home-automation/t1-08.webp "Must be agile")

Being agile means willing to understand that changes will come that you must in your system.

![Node-RED flow for Garage Cool Off logic](/images/home-automation/t1-09.webp "Garage Cool Off flow: checks if the door is closed before running the fan")

A small workflow to keep my garage cool in the summer time. I've had to change it multiple times.

![Node-RED garage sensor flow feeding Grafana, plus an Opens counter and On Status chart](/images/home-automation/t1-10.webp "Garage door sensor state feeding Grafana, with an opens-count and on-status history")

I have a reed switch wired up to the tasmota esp32 that controls the garage door with global state.  I use grafana to monitor the state changes.  I want to know if the garage door was left open so i could get message to me that its been open for too long. 

![Node-RED scheduled injects feeding a Garden Water Pump node](/images/home-automation/t1-11.webp "Check automations: four scheduled triggers feeding the garden water pump")

Scheduled triggers on a single pump. Be careful here, automations fighting over one device can happen and has caused me problems. Make it a habit to check every so often.

![Captain Jack Sparrow meme: The Rules, more of what you'd call guidelines than actual rules](/images/home-automation/t1-12.webp "The Rules: more of what you'd call guidelines than actual rules")

Broken many of these rules so now i refer to them as guidelines!

![Node-RED logo, a Phillips Hue IFTTT-style applet, and an Alexa routine editor](/images/home-automation/t1-13.webp "Node-RED, a community applet for blinking Hue lights on low phone battery, and an Alexa routine")

Three ways to do "event in, action out." Node-RED is my main tool. Alexa routines and IFTTT-style applets cover the stuff I don't want to build myself.

![MQTT publish/subscribe diagram with a temperature sensor, broker, and two subscribers](/images/home-automation/t1-14.webp "MQTT: one publisher, one broker, two subscribers getting the same message")

MQTT keeps things decoupled as a pub sub event system. The temperature sensor publishes and doesn't care who's listening. So a phone and a backend can both subscribe without the sensor doing anything extra. The sprinkler controller in [the Tasmota post](/automate-sprinkler-with-tasmota/) works the same way.

![Sonoff Mini Wi-Fi DIY smart switch and a Node-RED fireplace flow](/images/home-automation/t1-15.webp "A Sonoff Mini wired into the fireplace, controlled from a UI node and an Alexa trigger")

A Sonoff Mini fits inside the fireplace wiring, and the dashboard or Alexa can flip it. A fake fire you can turn on by voice is a good party trick.

![Sprinkler controller wiring, a 3D PCB render, the Tasmota web UI, scheduled nodes, and a bare PCB layout](/images/home-automation/t1-16.webp "The sprinkler build end to end: enclosure wiring, PCB design, Tasmota UI, schedule flow, and the bare board")

The whole sprinkler build: the relay and ESP module in the enclosure, the 3D board render, the Tasmota UI with BME280 sensor readings, the Node-RED schedule feeding the pump, and the finished PCB layout. [The sprinkler post](/automate-sprinkler-with-tasmota/) has the full writeup, including why I picked Tasmota over custom firmware. It's a bit hacky but I love it :D

![The Rules Guidelines Recap bullet list](/images/home-automation/t1-17.webp "The rules, guidelines, recap: don't swap the new way in before the old way is gone, no internet no problem, must be agile, check automations, exceptions must be exceptional")

Talk one in five lines. The one I break most is the first, don't introduce a new way while removing the old one, and I regret it every time. The last one stops me from breaking the others for no good reason. "I was in a hurry" doesn't count.

![Memorable Home Automations bullet list](/images/home-automation/t1-18.webp "A grab bag: heart-rate light blinking, fireplace sim, rain-skip watering, phone-presence garage, AWS services, 3D printer status lights")

![Questions? Feedback!](/images/home-automation/t1-19.webp "Closing slide for talk one: Questions? Feedback!")

That was talk one. Most of the "memorable automations" later broke in some new way or got replaced, so there's a sequel.

## Talk Two: Home Automation, The Sequel

![Home Automation, The Sequel](/images/home-automation/t2-01.webp "Title slide for the follow-up talk: Home Automation, The Sequel")

Enough time passed between the talks that I had a new list of problems.

![Meme: When robots take over the world, Marvin the android saying he could calculate your chance of survival but you won't like it](/images/home-automation/t2-02.webp "When robots take over the world: a nod to how much more is now automated")

More devices means more decisions made without me. It's a little unsettling but mostly harmless.

![Recap section divider](/images/home-automation/t2-03.webp "Recap")

![Connected Everything collage, reused from talk one](/images/home-automation/t2-04.webp "The same Connected Everything slide from talk one, as the recap anchor")

![A printer-pickup note taped to a pole, a Samsung fridge showing a certificate warning, and a Camp Chef grill WiFi controller](/images/home-automation/t2-05.webp "IoT in the wild: a handwritten printer note, a fridge throwing a cert error, a smart grill controller")

Everyone else is dealing with this too from what I can see.

![The Rules bullet list recap](/images/home-automation/t2-06.webp "The Rules, restated: keep existing functionality, IoT must work without internet, be flexible, review periodically, exceptions must be exceptional")

The same rules from talk one (worded a bit tighter).

![What has changed? That's why I'm here today](/images/home-automation/t2-07.webp "What has changed? That's why I'm here today")

The rules stayed the same but more were added.

![Einstein quote: We cannot solve our problems with the same thinking we used when we created them](/images/home-automation/t2-08.webp "We cannot solve our problems with the same thinking we used when we created them")

My setup assumed one person lived in the house.

![Some of those problems: more foot traffic, more keys needed, longer absences, water flooding](/images/home-automation/t2-09.webp "Some of those problems: more foot traffic, more people needing keys, longer trips away, and a water flooding scare")

More people meant traffic pattern differences and additional access keys.  Also, I would be longer away. So i needed two additional systems water flooding detection and presence detection.

![Captain Jack Sparrow meme again: The Extended Rules, still guidelines](/images/home-automation/t2-10.webp "The Extended Rules: still guidelines")

Same joke, new rules.

![The Extended Rules bullet list](/images/home-automation/t2-11.webp "The extended rules: APIs with logs, central config, multiple interaction methods, routines, pub/sub, battery-life minimums")

These are rules 6 to 11 at the top of the post.

![Examples section divider](/images/home-automation/t2-12.webp "Examples")

Now the builds!

![A DIY motorized outdoor rig, a UV grow light over plant leaves, and a purple UV strip under cabinets](/images/home-automation/t2-13.webp "New builds: a motorized outdoor device, a plant grow light, and a closet UV sanitizing light")

A motor and PVC pipe rig for outdoor lighting, a UV grow light clipped to a houseplant, and a UV strip under the cabinets for sanitizing.

![Sprinkler build collage, reused from talk one](/images/home-automation/t2-14.webp "The sprinkler build again, still running the same way years later")

Same sprinkler slide as talk one.

![A wall-mounted presence sensor, a robot vacuum on carpet, and an AirGradient air quality sensor kit with dashboard](/images/home-automation/t2-15.webp "New sensors: a wall-mounted presence unit, a robot vacuum, and a DIY AirGradient air quality kit")

A sensor that sits on a credenza, a robot vacuum that runs on its own, and an AirGradient kit I put together from a CO2 sensor, a particulate sensor and a microcontroller, with its own dashboard. The air quality kit gives me the most peace of mind of anything here.

![Wall-mounted tablet dashboard next to a Nest thermostat set to 80](/images/home-automation/t2-16.webp "The wall dashboard: garage, locks, lights, all on one screen next to the thermostat")

This dashboard replaced more apps than anything else: garage door, side door unlock, front lock, all lights on or off, brightness, a coffee bar color picker, and warm-to-cool for the living room. It's one cheap tablet next to the thermostat, so nobody digs through five apps.

![A large wall-mounted TV with warm backlighting glowing against the wall](/images/home-automation/t2-17.webp "Bias lighting behind the TV, automated to match whatever's on screen")

The lights behind the TV run through the same system instead of their own remote.

![A Schlage deadbolt with a physical key and a black touchscreen smart lock with multiple unlock methods](/images/home-automation/t2-18.webp "Two generations of smart lock: a retrofit deadbolt and a full touchscreen keypad lock")

The smart locks came out of the more-people-more-keys problem. The newer one takes a password, the app, a keycard or a regular key, so everyone uses what they're comfortable with.

![Hardware section divider](/images/home-automation/t2-19.webp "Hardware")

The parts bin, for anyone who wants to build this.

![ESP32 D1 mini board, a dual-outlet smart plug, and a Raspberry Pi 4](/images/home-automation/t2-20.webp "Core compute: an ESP32 D1 mini, a smart plug, and a Raspberry Pi 4")

The ESP32 D1 mini handles anything custom. The smart plug is the off-the-shelf shortcut when I don't need custom. The Pi 4 runs Node-RED and Grafana.

![A 100ft RGB LED strip kit, a tray of TO-220 power transistors, and relay modules with header pins](/images/home-automation/t2-21.webp "LED strips, power transistors, and relay modules for anything that needs switching")

LED strips for ambient lighting, power transistors for higher-current loads, and small relay modules so a microcontroller can switch mains voltage safely.

![A resistor kit, a DIY wire and cable color kit, and an electrolytic capacitor kit](/images/home-automation/t2-22.webp "The passive components drawer: resistors, color-coded wire, and capacitors")

The rest of the bin: a resistor assortment, color-coded wire so I can trace a circuit later, and a capacitor kit for smoothing and timing.

![Software bullet list: NodeRed, Grafana, Tasmota, Telegram, Python, Javascript, Vendor specific Apps](/images/home-automation/t2-23.webp "The software stack: Node-RED, Grafana, Tasmota, Telegram, Python, JavaScript, and whatever vendor app I can't avoid")

Node-RED for the logic, Grafana to see what's happening, Tasmota on anything I flash, Telegram for notifications, and Python or JavaScript for glue code that doesn't fit in a flow.

![Node-RED flow for the Garage tab with sensors, Tasmota topics, Telegram notifications, and light counters](/images/home-automation/t2-24.webp "The current garage flow: sensors, Tasmota commands, Telegram alerts, and a light-on counter")

The garage flow today. The door sensor and reed switch feed Grafana and a global closed state. Toggle nodes publish straight to Tasmota command topics. Notifications go to Telegram and an audio chime, and a light-on counter resets at midnight. The tabs across the top (Lights, Sensors, Garage, Sprinkler, NFC Tags, Door Lock Security) show how much it has grown since the single garage cooling flow in talk one.

![Grafana dashboard grid with humidity, temp, dew point, pressure, gas, air quality, energy, opens, and on-status panels](/images/home-automation/t2-25.webp "The full Grafana dashboard: climate, energy, and device activity all on one screen")

This is the "is everything okay" dashboard: humidity, temperature, dew point, pressure and gas on one side, and energy use, door opens and on-status history on the other. I built it because I got tired of guessing.

![UX section divider](/images/home-automation/t2-26.webp "UX")

Dashboards and Grafana panels work for me. Everyone else in the house just wants the light on.

![Close-up of the wall dashboard status screen, a sheet of NFC tags with a QR code, and an Echo Dot](/images/home-automation/t2-27.webp "Interaction methods: the wall dashboard up close, NFC tags and a QR code, and an Echo Dot")

The "more than one way in" rule in hardware: the wall tablet for whoever is standing there, NFC tags and a QR code to tap, and an Echo Dot for anyone who would rather talk to the house.

![Tools section divider](/images/home-automation/t2-28.webp "Tools")

The tools I build and debug all of this with.

![A soldering iron and stand, a 3D printer mid-print, a digital multimeter, and a precision screwdriver kit](/images/home-automation/t2-29.webp "The workbench: a soldering iron, a 3D printer, a multimeter, and a screwdriver kit")

A soldering iron for permanent connections, a 3D printer for enclosures and brackets you can't buy, a multimeter for when something isn't working, and a precision screwdriver kit for devices the manufacturer didn't want opened.

![Questions? Feedback!](/images/home-automation/t2-30.webp "Closing slide for talk two: Questions? Feedback!")

That's both talks, five years apart. The rules barely changed. The list of problems kept growing.

A third talk is coming, built around agentic use cases. The same rules should hold when an AI agent is the one flipping the switches, and I expect to add a few.

## What readers told me

I shared the "no internet, no problem" rule on LinkedIn and asked for the most pointless internet dependency people had found in a device. Dozens of people answered. A Hacker News thread added more.

### Everyone has one

Most examples were basic functions locked behind an app, an account, or a server:

- A fridge whose temperature can't be changed because of a bug in the manufacturer's phone app.
- A TV that can't even switch inputs when the internet is down, and another that has to be signed in before it works as a plain HDMI monitor. One reader's older smart TV has dead apps but still works as a regular TV, which is how a device should fail.
- A heating system whose app doesn't work from the local network.
- A kitchen vent and a dishwasher that need the internet even when you control them from Home Assistant.
- A smart plug that can't be set up on an isolated network.
- Noise-cancelling headphones that search for a Bluetooth device forever, so you can't just turn on the noise cancelling.
- Synthesizers and MIDI keyboards that need a cloud login for first use or firmware updates.
- A meat thermometer that only worked through its app and stopped working when the company went out of business.

The meat thermometer bothers me most. The hardware outlived the company. It stopped working anyway.

### Rules readers added

- Offline first, with the internet for extras. A device should do its main job on its own.
- Treat every third-party dependency as a risk. APIs change, so plan a local fallback or a clear degraded mode. One mobile developer works the same way: the core action works offline or from cache, and only the extras wait for a connection.
- Decide what must work offline. My answer is turning things on and off, temperature and safety controls, and anything a guest has to use without learning an app. As one reader said, if a visitor can't turn something on or adjust the temperature without an app account, the design has failed.
- A stricter version of my first two rules: everything core works with the Wi-Fi or the automation server shut down, and smart features never take away the dumb ones. The wall switch should control the light directly and let automation flip it. A switch that only sends a request to the automation fails. That reader says my sprinkler controller fails this bar too. The only sprinkler controller they'd found with a local API and full control on the device itself was RainMachine, which is gone.
- Clean up when you throw things away. Remove a connected printer from your account first. An abandoned connected device can be an easy way in for an attacker.

### Practical tips

- Use local protocols. One reader recommends Zigbee and Z-Wave over Wi-Fi, because a switch that doesn't need the cloud tends to behave the same year after year. Another uses Zigbee for the smart plugs that can't be set up without internet.
- Let an LLM find the firmware. One reader buys the cheapest hardware that does the job, ignores reviews that complain about the app, and asks an LLM for local-first custom firmware once it arrives. That has worked for their switches, a thermostat, an air quality monitor, a thermometer, and a window fan. They'd have paid about 2.5x for hardware that was local out of the box.
- Old Nest thermostats have a way out. [No Longer Evil](https://nolongerevil.com/) is open source firmware for Nest Gen 1 and Gen 2 thermostats.
- Smart TVs can be tamed. Reset the TV and never connect it to the network, and the input problem goes away.
- Remote access is the cost of staying local. I use Tailscale on the router and keep the individual devices off the tailnet. One reader ran OpenVPN on OpenWrt, which worked but felt clunky, and is now trying Tailscale.
- There's a gap to fill. One reader would happily pay for a pre-built, open "works with everything" Raspberry Pi image with MQTT. DietPi and OpenWrt come close and have a small footprint, but you need some understanding to get going. Another wanted a hub that ships with the house, like a water heater or a router. Home Assistant sells hub hardware that's close to that.
- Right to repair is the bigger fight. Readers pointed to the right-to-repair movement and groups like the [FULU Foundation](https://www.fulu.org/), which work to keep companies from locking you out of what you bought.

### Counterpoints

Connectivity has real uses. A connected meat thermometer lets you watch the game while the steak cooks. The same reader also had an oven decide to update its software in the middle of cooking. One reader pointed out the business model behind all of this: companies would rather sell you a service than a product. Another expects the shift away from internet-connected devices to come from resilience worries rather than consumer complaints, since enough connected homes make a target. And one skips connected appliances entirely, keeping only computers and phones online.

## Devices I've used

<small>(This section has Amazon affiliate links. If you buy through them, I may earn a small commission at no extra cost to you.)</small>

These are the parts from my home automation builds, grouped by project.

### Sprinkler controller

| Gear | Purpose | Buy |
|---|---|---|
| [HiLetgo ESP8266 NodeMCU board (3 pack)](https://www.amazon.com/dp/B081CSJV2V?tag=dctm-20) | Wi-Fi microcontroller that runs Tasmota | [Amazon](https://www.amazon.com/dp/B081CSJV2V?tag=dctm-20) |
| [SSD1306 OLED screen](https://amzn.to/3oTJUZj) | Status display for the sprinkler state | [Amazon](https://amzn.to/3oTJUZj) |
| [Inkbird SSR-40DA solid state relay](https://www.amazon.com/dp/B00HV974KC?tag=dctm-20) | Switches the 24 VAC sprinkler valve | [Amazon](https://www.amazon.com/dp/B00HV974KC?tag=dctm-20) |
| [BME280 sensor](https://amzn.to/365HD4Z) | Temperature, humidity and pressure | [Amazon](https://amzn.to/365HD4Z) |
| [24 VAC power supply](https://amzn.to/3DcQpiY) | Powers the sprinkler valve | [Amazon](https://amzn.to/3DcQpiY) |

### Lights, switches and plugs

| Gear | Purpose | Buy |
|---|---|---|
| [Martin Jerry smart dimmer switch (Tasmota pre-flashed)](https://amzn.to/435hVLR) | Wall light switch that runs Tasmota out of the box | [Amazon](https://amzn.to/435hVLR) |
| [Martin Jerry humidity fan switch](https://amzn.to/49xMQnw) | Runs the bathroom fan when humidity gets too high | [Amazon](https://amzn.to/49xMQnw) |
| [Sonoff S31 smart plug](https://www.amazon.com/dp/B08TNF4835?tag=dctm-20) | Power watchdog for the cable modem | [Amazon](https://www.amazon.com/dp/B08TNF4835?tag=dctm-20) |
| [Serial-to-USB adapter](https://amzn.to/3sW2QaW) | Connects an ESP8266 to your PC for flashing Tasmota | [Amazon](https://amzn.to/3sW2QaW) |

### Garage door

| Gear | Purpose | Buy |
|---|---|---|
| [Raspberry Pi 3](https://amzn.to/2RMxQc5) | Runs Docker and the web API | [Amazon](https://amzn.to/2RMxQc5) |
| [SunFounder 2-channel 5V relay module](https://www.amazon.com/dp/B00E0NTPP4?tag=dctm-20) | Simulates the button press to toggle the door | [Amazon](https://www.amazon.com/dp/B00E0NTPP4?tag=dctm-20) |
| [LiftMaster wired control panel (78LM, replaces the 41A5273-1)](https://amzn.to/2pShUrK) | Bypasses the anti-tamper wiring | [Amazon](https://amzn.to/2pShUrK) |

### Around the house

| Gear | Purpose | Buy |
|---|---|---|
| [GL.iNet Flint 2 router (GL-MT6000)](https://www.amazon.com/dp/B0CP7S3117?tag=dctm-20) | Runs OpenWrt and an MQTT broker locally | [Amazon](https://www.amazon.com/dp/B0CP7S3117?tag=dctm-20) |
| [Cheap tablet](https://amzn.to/4zcyjcj) | Mounted on the wall as the dashboard | [Amazon](https://amzn.to/4zcyjcj) |
| [Lefant robot vacuum](https://amzn.to/4pQVtk9) | Cleans the floors | [Amazon](https://amzn.to/4pQVtk9) |