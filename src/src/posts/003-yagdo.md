---
layout: post.hbs
title: Yet Another Garage Door Opener
keywords: raspberry pi, bluetooth
date: 2018-05-11
desc: Just another garage door opener using a raspberry pi
image: https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Raspberry-Pi-2-Bare-BR.jpg/330px-Raspberry-Pi-2-Bare-BR.jpg
imageAlt: Raspberry Pi!
priority: 0.9
---

Another tutorial for building a garage door opener with a raspberry pi. I've left the garage door opened too many times. Source: [https://github.com/skittleson/garage-pi](https://github.com/skittleson/garage-pi) This tutorial assumes you have a raspberry pi with wifi and the ability to ssh in.

## Goals

*   Use Docker so it can easily be shared/restored/etc!
*   A simple web API for control
    *   Use nodejs as much as possible for the build.
*   Toggle garage door
*   Status of garage door
*   Toggle light switch on the garage door
*   (optional) cheap camera to see what's going on.

## What you will need

*   Relay modules. I only needed one - [amazon_link asins='B072BY3KJF' template='DCTM-ProductLink' store='dctm-20' marketplace='US' link_id='6cbde9fe-24eb-11e8-9b42-d982a122532a']
*   Cheap containers to throw everything into - [amazon_link asins='B0009P67Y4' template='DCTM-ProductLink' store='dctm-20' marketplace='US' link_id='ebd2db78-249d-11e8-8f70-393eeed60487']
*   A replacement switch for garage door opener - [amazon_link asins='B000F5KF1O' template='DCTM-ProductLink' store='dctm-20' marketplace='US' link_id='a94c37a5-249d-11e8-b6c7-21ed03266eb6']
*   Using RPi 2 over a RPi 3\. Bluetooth seems to cause communication problems with the garage door openers. [amazon_link asins='B00LPESRUK' template='DCTM-ProductLink' store='dctm-20' marketplace='US' link_id='f67aafc1-24eb-11e8-bf26-9f336d65236e']
*   Low power wifi to prevent low interference [amazon_link asins='B003MTTJOY' template='DCTM-ProductLink' store='dctm-20' marketplace='US' link_id='0ce9f120-24ec-11e8-934c-23a7bb74c0de']
*   (optional) great camera for the price! This one has 4 mics and the camera has two zoom modes. [amazon_link asins='B0735KNH2X' template='DCTM-ProductLink' store='dctm-20' marketplace='US' link_id='3abcae4f-2582-11e8-a640-3780fc8261bf']

## Research & Discover

There are a ton of these garage door projects. I was inspired by many of them. The LiftMaster garage door system has anti-tamper hardware measures which almost ended the project before it started. I decided to take a gamble and buy another garage door opener circuit that directly connects to the garage door unit. Bingo! Two circuits can be connected at the same time. Docker permissions and finding a base image for the raspberry pi took a few hours. Lesson learned, hardware interaction with docker can take a few extra steps.

## Wiring

The relay module is stacked on top of the LiftMaster module then taped onto the Raspberry Pi. Note the relay connections are wired for normally opened. (click image to see larger version) Sealed up in a glad container (kinda hacky but it's cheap) [![](https://docodethatmatters.com/wp-content/uploads/2018/03/20180310_203216-e1520744997650-576x1024.jpg)](https://docodethatmatters.com/wp-content/uploads/2018/03/20180310_203216-e1520744997650.jpg) This is the LiftMaster circuit. The narrower end has the button for opening the garage. The larger end has the button for the garage door light. The middle points are for the circuit to connect to main garage door unit. [![LiftMaster circuit](https://docodethatmatters.com/wp-content/uploads/2018/03/20180225_135400-300x169.jpg)](https://docodethatmatters.com/wp-content/uploads/2018/03/20180225_135400.jpg) GPIO pin layout for the relays & reed switch not including power leads. ![](https://docodethatmatters.com/wp-content/uploads/2018/03/raspberry-pi-2-b-plus-gpio.png) Reed switch is connected to the part of the garage door (pin 18 and a ground). Once it moves away, then the reed switch is disconnected. ![](https://docodethatmatters.com/wp-content/uploads/2018/03/20180310_203724-e1520796040493-169x300.jpg) The entire setup. Messy but it's good enough. Cut some holes with a knife for wires and to hold it in place. The camera has been added with duck tape. Using a standard install of [motion](https://motion-project.github.io/motion_build.html) (no dockerfile tho). [![](https://docodethatmatters.com/wp-content/uploads/2018/03/20180310_203637-1-e1520796191804-576x1024.jpg)](https://docodethatmatters.com/wp-content/uploads/2018/03/20180310_203637-1.jpg)

## Install

Install docker on the raspberry pi. [https://www.raspberrypi.org/blog/docker-comes-to-raspberry-pi/](https://www.raspberrypi.org/blog/docker-comes-to-raspberry-pi/)

<pre class="lang:default decode:true">curl -sSL https://get.docker.com | sh</pre>

Clone the repo

<pre class="lang:default decode:true">git clone https://github.com/skittleson/garage-pi
cd garage-pi/</pre>

Run docker build for the image

<pre class="lang:default decode:true">docker build -t garage-pi .</pre>

Start the docker image in privileged mode. This will expose port 8090 for web access.

<pre class="lang:default decode:true">docker run -d --privileged -p 8090:8090 --name gpi garage-pi</pre>

Test it

<pre class="lang:default decode:true"> curl http://localhost:8090/api</pre>

Other api commands

*   Status: /api/garage/status
*   Garage Door Toggle: /api/garage/toggle
*   Light Toggle: /api/light/toggle
*   Exit: /api/exit

That's it!

## Code

Simulating the button press for the garage door opener circuit. Relay turns on for 500ms, then off. An interesting issue with the relay. As soon the gpio utility exports, it triggers it on. This code exports then unexports a pin that the relay is on.

<pre class="lang:js decode:true">let relayButtonPressAction = (pin) => {
    gpioExport(pin, 'out');
    gpioWrite(pin, 1);
    setTimeout(() => {
        gpioWrite(pin, 0);
        gpioUnexport(pin);
    }, 500);
}</pre>

There is one python file that checks the status of the garage door. The configuration was different enough where it needed to be done there. The reed switch should always be true until the door has been opened.

<pre class="lang:python decode:true">import sys
import RPi.GPIO as gpio

pin = int(sys.argv[1])

gpio.setmode(gpio.BCM)
gpio.setup(pin, gpio.IN, pull_up_down=gpio.PUD_UP)

status = gpio.input(pin)
sys.stdout.write(str(status))

gpio.cleanup()</pre>

Open for pull requests! I'm considering on moving all the gpio logic to python then using nodejs as the api router.

## Summary

Hardware side is built and working. The api has enough information to check and toggle the garage door. Going to create a script to watch the door status with [Node-red](https://nodered.org/) due to ease of configuration. This project took about 2 days with testing and debugging. Here is a screenshot of the node-red template. Still a work in progress! The [flow file](https://github.com/skittleson/garage-pi/blob/master/garage-pi-node-red-flow.json) is in the repo code. [![](https://docodethatmatters.com/wp-content/uploads/2018/03/node-red-template-2-253x300.png)](https://docodethatmatters.com/wp-content/uploads/2018/03/node-red-template-2.png)