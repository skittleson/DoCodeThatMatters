---
title: DIY Electric Skateboard Build Guide
keywords:
  - electric skateboard
  - esk8
  - VESC
  - longboard
  - DIY
date: 2020-06-01
description: Build a safe and inexpensive electric longboard at home with off-the-shelf components.
image: /images/truckWithMotor01.jpg
alt: Electric skateboard truck with motor mounted
draft: true
---

Electric longboard that can be built at home for fun! The post goes through the adventure of building a safe and inexpensive electric longboard aka esk8.

## The Build

### Deck and Trucks

The deck style will determine the size of the motor, case, and batteries. Passenger weight should also be a factor. I picked a [flexible longboard deck](https://amzn.to/2zezUVCS). It's a bigger deck that provides stability while riding while making it easier to mount components.

Most skateboard truck hangers are not long which limits the selection. Space is needed to mount an electric motor with an attached gear to the wheel. Several Esk8 forums posts pointed to this 10 inch [truck](https://amzn.to/3f2e4DX) that has a square hanger. This solid metal [mounting kit](https://amzn.to/3f3lFlL) is designed to work with this style of truck.

### Electric Speed Controller

Also known as the ESC. The foundation to building an electrical skateboard is the electronic parts, constraints, and physical layout of components. Here is an electrical diagram of the build. [More information here](https://www.electric-skateboard.builders/t/wiki-a-beginner-guide-to-diy-an-esk8/46844).
![Diagram of esk8 electronics](/images/diagramSkateboard.jpg)

An electrical speed controller can control the speed of an electric motor using a signal provided by a remote. This signal acts as throttle for the electric motor. First attempt was an inexpensive $25 120A ESC (electric speed controller) for RC projects.  While it worked the ESC got too hot.  It wasn't designed for the amount amps pushing through and the motor was over sized.  These RC ESCs have simple configurations.

An open source project, [VESC](https://vesc-project.com/), is a software controlled electronic speed control made for scooters, skateboards, and bikes all for a reasonable price!  Configuration is done through software with a wizard that is easy to follow with great documentation. Before buying any parts, checkout the [VESC calculator](https://vesc-project.com/calculators) to help purchase motors and batteries. You can purchase one from Amazon [here](https://amzn.to/2Yd5Nqd).

![VESC Hardware](/images/vesc.jpg)

### Batteries

Batteries are dangerous! Be extra careful on handling and wiring them. There are 2 primary choices for batteries: lithium ion and lithium polymer (lipo). Similar in chemistry but used in different applications. Both can work in this project. In earlier experiments, lipos were used since they are smaller and available. In the 2nd prototype, two 10s2p batteries from hover boards were used.

![Hoverboard battery at 4400mah with an XT60 connector](/images/hoverboardBattery.jpg)

### Motor, Gears, and Wheels

This ESK8 [Calculator](http://calc.esk8.it/) was a great find! This will let you figure out the speed you want to achieve with wheels, electric motor, and batteries.

Here is a common [gears and belt kit](https://amzn.to/37jD6Mj). 48 Teeth Bore (the big gear): 22mm; 16 Teeth Bore: 8mm (the small gear).

![38 teeth rear gear](/images/FreeCAD_5GwuSzs725.png)

![Motor, battery, and gear ratio calculation](/images/DiySkateboardCalc.png)

![Top view of truck with motor mounted.](/images/truckWithMotor01.jpg)

![Side view of truck with motor mounted.](/images/truckWithMotor02.jpg)

## Common Questions

**Q:** So how fast and distance can this go on a single charge?
**A:** About 20 miles on a single charge. 25mph.

**Q:** Why not just buy?
**A:** It's fun to build stuff and I know how it works in case it needs repair.

## Conclusion
