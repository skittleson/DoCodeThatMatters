I'm frustrated on over-the-shelf sprinkler systems for home owners. They are complicated to use, outdated, and can't customize at a good price. The open source community has solved this!  After testing serveral solutions, this was easiest, reliable and most customizable. So let's make it!

![Zen](https://images.unsplash.com/photo-1594067413494-c6c476454685?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1650&q=80)

## Build a Watering sprinkler for less, better and for low effort

The primary objective is customizing the watering sprinkler to toggle based on special conditions like time, humditity, and perhaps temperature. 

### Must Haves

* ✅ IoT device runs when the internet is down (or network is down). 
* ✅ Manual toggling watering state. 
* ✅ Backup / Restore settings
* 🚧 If sunrise/sunset with a temperature restriction then start watering. To prevent freezing. 

### Wants

* ✅ Measure water time, humidity, and temperature (All off-the-shelf sprinklers do this with various features)
* ✅ Local network control with no data submitted to third party. 
* ✅ graphing and ability to analyze the data. 
* 🚧 Watering runaway protection. 
* ⏳ If humidity is at percentage then skip watering today (Most over-the-shelf sprinklers do this). 
* ⏳ If weather forecast is rainy then skip watering. Notify me when this occurs. (Most off-the-shelf sprinklers can do this sort of)
* ⏳ (Optional) Send to notification to any platform I want (AWS, Gmail, IFTTT, Alexa, etc... )

## Research

No over-the-shelf sprinkler system for a reasonable price can do ALL of this! How to do this for less, better, and low effort? The best solution is a mixed of inexpensive hardware and customizable open source software. Yes, there is some learning here but it's only the initial effort that can be a hurdle. 

### Hardware

At the lowest level, the IoT hardware should run on it's own, inexpensive, and must do the following:

* Toggling power on/off
* Current humidity and temperature
* Customize toggling on/off based on special conditions. 

\$20 USD over-the-shelf Sonoff hardware that does those 2 out of 3. There is alternatives but this is a good start. Two options to hook it up to an existing water system, splice into 110 volt power cord or cut a splice into a power extension cord. 

[![Sonoff device](images/sonoff_temp. jpg)](https://amzn.to/3jKFeT8) 

### Software

The device can be flashed with open source software [Tasmota](https://tasmota.github.io/docs/). I won't go into too much detail but he it solves the following:

* Local network controlled
* Runs even when the internet is down
* Highly customizable and battle tested for years. 

Here is a video on how to flash and setup the device when you get it (this is really common with this device). 

<iframe width="560" height="315" src="https://www.youtube.com/embed/LwZltnda4v8" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

### Setup Time

Using the Tasmota Web Console Command line

* Set your timezone using standard GMT offset: `Timezone -7` . 
* Test your time with `time` 
* Update your location (use can use https://www.latlong.net/)
    - Run `Latitude 0.00` for latitude
    - Run `Longitude 0.00` for longitude
* Run `STATUS 7` to see sunrise / sunset with local time

### Setup Timers

Using the Tasmota Timer Web UI, 4 timers will be created. Two timers for starting/stoping the watering at sunrise. Two timers for same at sunset. 

❓ Why use the Web UI when Tasmota can do this via command line? 

⭐ Makes it easily adjustable in Web UI vs using the Tasmota command line. 

Setup a sunrise starting timer for to run for 15 minutes. Be sure to put check in `Enable Timers` , `Arm` , and `Repeat` . 

![Sunrise Starting Timer](images/sprinklerTimer1. png)

Setup the sunset starting timer the same. 

Now to stop the watering. Setup Timer 3 for like this. 

![Sunrise Stoping Timer](images/sprinklerTimer3. png)

A offset is used to stop the watering from occuring because it's sunrise/sunset + 15 minutes. The documentation states the following:

> When Mode 1 or Mode 2 is used, Latitude and Longitude become available. In that case the Time value is always used as an offset so make sure to set it to 00:00 if no offset is wante

Using the Tasmota Web Console Command line, type in the timers to verify:
`Timer1` , `Timer2` , `Timer3` and `Timer4` . 

It should look like 

``` 
14:35:44 CMD: Timer1
14:35:44 MQT: stat/tasmota_6A24DE/RESULT = {"Timer1":{"Arm":1,"Mode":1,"Time":"00:00","Window":0,"Days":"1111111","Repeat":1,"Output":1,"Action":1}}
14:35:47 CMD: Timer2
14:35:47 MQT: stat/tasmota_6A24DE/RESULT = {"Timer2":{"Arm":1,"Mode":2,"Time":"00:00","Window":0,"Days":"1111111","Repeat":1,"Output":1,"Action":1}}
14:35:50 CMD: Timer3
14:35:50 MQT: stat/tasmota_6A24DE/RESULT = {"Timer3":{"Arm":1,"Mode":1,"Time":"00:20","Window":0,"Days":"1111111","Repeat":1,"Output":1,"Action":0}}
14:35:52 CMD: Timer4
14:35:52 MQT: stat/tasmota_6A24DE/RESULT = {"Timer4":{"Arm":1,"Mode":2,"Time":"00:20","Window":0,"Days":"1111111","Repeat":1,"Output":1,"Action":0}}
```

## Extending to other Platforms (Optional)

Using a simple flow in NodeRed, i've added support for a UI and Alexa control with tracking usage via Graphana. Using the MQTT message `tele/tasmota_YOURDEVICE/SENSOR` , the data is formatted and sent to a [local Graphana instance](https://grafana.com/tutorials/install-grafana-on-raspberry-pi/#3) on a Raspberry PI. 

![Nodered with Alexa support](images/sprinklerNodeRedWithAlexa. png)

![Nodered with Alexa support](images/sprinklerNodeRedUI. png)

Simple tracking the ON/OFF state of tasmota mqtt messages

![Nodered with Alexa support](images/sprinklerGraphana. png)

### Setup Rules (Optional)

Here are two more timers (or rules)  wanted:

* WIP - before sunrise, check the temperature. if it's too cold, send a MQTT message and disable start timers
* WIP - before sunrise, check the humditity

## UPDATE 

I took on the challenge of creating PCB with a Esp8266 microcontroller, screen, and a BME280 (temperature, humidity, and pressure) 

## Resources

* https://tasmota.github.io/docs/Commands/
* https://tasmota.github.io/docs/Timers/
