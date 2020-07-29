After years of home automation, 
I'm frustrated on over-the-shelf sprinkler systems for a home owner has to deal with. They are complicated to use, outdated, and can't customize at a good price. Let's fix that!

IMAGE

## Build a Sprinkler for less and better with low effort

The primary problem is customizing the sprinkler to toggle based on special conditions. I live in southern California where water and electricity is not cheap. So customizing it for where I live is an important. Here are some use cases and special conditions.

- If humidity is at a certain percentage then skip watering today (Most over-the-shelf sprinklers do this).
- If weather forecast is rainy then skip watering. Notify me when this occurs. (Most off-the-shelf sprinklers can do this sort of)
- If sunrise/sunset with a temperature restriction then start watering.
- Measure water, humidity, and temperature (All off-the-shelf sprinklers do this with various features)
- Manual toggling with different supported interfaces.
- IoT device runs when the internet is down (or network is down).
- (Optional) Send to notification to any platform I want (AWS, Gmail, IFTTT, Alexa, etc...)
- (Optional) Local network control with no data submitted to third party.
- (Optional) graphing and ability to analyze the data.

No over-the-shelf sprinkler system for a reasonable price can do this! How to do this for less, better, and low effort? The best solution is a mixed of inexpensive hardware and customizable open source software. Yes, there is some learning here but it's only the initial effort that can be a hurdle.

### The IoT hardware

At the lowest level, the IoT hardware should run on it's own, inexpensive, and must do the following:

- Toggling power on/off
- Current humidity and temperature
- Customize toggling on/off based on special conditions.

\$20 USD over-the-shelf Sonoff hardware that does those 2 out of 3. There is alternatives but this is a good start. Two options to hook it up to an existing water system, splice into 110 volt power cord or cut a splice into a power extension cord.

[![Sonoff ](images/sonoff_temp.jpg)](https://amzn.to/3jKFeT8).

## The software

The device can be flashed with open source software [Tasmota](https://tasmota.github.io/docs/). I won't go into too much detail but he it solves the following:

- Local network controlled
- Runs even when the internet is down
- Highly customizable and battle tested for years.

Here is a video on how to flash the device when you get it (this is really common with this device).

<iframe width="560" height="315" src="https://www.youtube.com/embed/LwZltnda4v8" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

### Rules

## Extending to other Platforms

- NodeRed
- AWS IoT
- Alexa

## Conclusion
