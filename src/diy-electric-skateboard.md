The post goes through the adventure of building a safe and semi-inexpensive electric longboard aka esk8.

## The Build

### Deck and Trucks

The type of board will determine the size of the motor, case, and batteries. Passenger weight should also be a factor. I went with a [flexible long deck](https://amzn.to/2zezUVCS). The bigger the deck gives stability while riding and it's easier to mount components. I weigh 190lbs so having a better deck will be easier to ride.

Most skateboard truck hangers are not very long which made it difficult finding the right type. Space is needed to mount an electric motor with a gear attached to the wheel. Esk8 forums pointed to this 10 inch [truck](https://amzn.to/3f2e4DX) that have a square hanger. Paired with the [mounting kit](https://amzn.to/3f3lFlL), it worked perfectly for mounting a motor to it.

### Motor, Gears, and Wheels

This ESK8 [Calculator](http://calc.esk8.it/#{%22batt-type-lipo%22:1,%22batt-cells%22:8,%22motor-kv%22:200,%22system-efficiency%22:70,%22motor-pulley-teeth%22:16,%22wheel-pulley-teeth%22:48,%22wheel-size%22:80}|) was a great find! This will let you figure out the speed you want to achieve with wheels, electric motor, and batteries. 4s batteries are too low from experimenting. I suggest at least 8s at 4ah.

Here is a common [gears and belt kit](https://amzn.to/37jD6Mj). 48 Teeth Bore (the big gear): 22mm; 16 Teeth Bore: 8mm (the small gear). The belt also comes with it. [Replacement belts](https://amzn.to/2YigUy7) are a must as they do burn out!

[Electric motor](https://amzn.to/30o8rvJ). Lower the KV rating means the more powerful the electric motor. Around 170kv to 230kv is the sweet spot for electric esk8s. It's very important to know much voltage and amps that the motor is rated for. For example, this motor can take 70amps peak current with up to a 12s battery. That's 44.4 nominal voltage (12 batteries x 3.7 volts). The following calculation was close to the expected top speed I was looking for.
![](images/DiySkateboardCalc.png "Motor, battery, and gear ratio calculation")

![](images/truckWithMotor01.jpg "Top view of truck with motor mounted.")

![](images/truckWithMotor02.jpg "Side view of truck with motor mounted.")

### Electric Speed Controller

The foundation to building an esk8 is the electronic parts and layout. Here is a diagram of how it works. [More information here](https://www.electric-skateboard.builders/t/wiki-a-beginner-guide-to-diy-an-esk8/46844).
![Diagram of esk8 electronics](images/diagramSkateboard.jpg)

A speed controller controls the speed of the electric motor using PWM (pulse width modulation) signal. That will determine the speed the electric motor. I attempted using an inexpensive \$25 120A ESC (electric speed controller) for RC cars from a previous project. After 20 minutes, the ESC and batteries were too hot 🔥🔥🔥.

New solution! [VESC](https://vesc-project.com/), is a software configures electronic speed control that addresses common use cases with ESC made for scooters and skateboards at a reasonable price! The wizard was easy to follow with great documentation. Before buying any parts, checkout the [VESC calculator](https://vesc-project.com/calculators) to help purchase motors and batteries. You can purchase one from Amazon [here](https://amzn.to/2Yd5Nqd).

![VESC Hardware](images/vesc.jpg)

### Batteries

⚠️ Disclaimer!! Batteries are dangerous!⚠️ Be extra careful on handling and wiring them. There are 2 primary choices for batteries: lithium ion and lithium polymer (lipo). Similar in chemistry but used in different applications. Both fit the needs of this project. After using lipos for awhile, I switch it out with 2 x 10S2P batteries from hoverboards on ebay as I wanted a battery management systems aka BMS in to each battery pack with a standard charging mechanisms. The batteries are inexpensive with capacity at 4.4ah. Connecting 2 batteries in parallel increases it to 8.8ah which is near perfect for the VESC to push to the motor. Combing the 2 batteries in parallel make it a 10S4P.

![](images/hoverboardBattery.jpg "Hoverboard battery at 4400mah with an XT60 connector")
![https://amzn.to/2UFvYop](images/charger.jpg "Charging cable")

### Putting it all together

[Anti-Spark](https://www.amazon.com/gp/product/B0732S5V85/ref=as_li_ss_tl?ie=UTF8&psc=1&linkCode=ll1&tag=dctm-20&linkId=e497f6690184cf636639d3f85b71f4c1&language=en_US)

### Part list

- [Charging cable](https://amzn.to/2UFvYop)
- [Bamboo Skateboards Hard Good Blank Long Board](https://www.amazon.com/gp/product/B00I4KKPVM/ref=as_li_ss_tl?ie=UTF8&psc=1&linkCode=ll1&tag=dctm-20&linkId=89834a15bdf89d0203b903247a23e097&language=en_US)
- [Caliber Trucks Cal II 50° RKP Longboard Trucks - set of two](https://amzn.to/30o8rvJ)
- [Gears and belt kit from Amazon](https://www.amazon.com/Hitommy-17pcs-Pulley-Wheels-Electric/dp/B07RXV6H4L/ref=as_li_ss_tl?keywords=Drive+Kit+Parts+Pulley+And+Motor+Mount+For+80MM+Wheels+Electric+Skate+Board&qid=1576465899&s=sporting-goods&sr=1-1-catcorr&linkCode=ll1&tag=dctm-20&linkId=c8931c50e22ab88fe3879e599dc67805&language=en_US) or [from Banggood](https://www.banggood.com/17pcs-Drive-Kit-Parts-Pulley-And-Motor-Mount-For-80MM-Wheels-Electric-Skate-Board-p-1359469.html?rmmds=myorder&cur_warehouse=CN)
- [Caliber Trucks Mounting kit](https://amzn.to/3f3lFlL)
- [80mm wheels](https://www.amazon.com/Slick-Revolution-Electric-Skateboard-Longboard/dp/B07JPBJHRZ/ref=as_li_ss_tl?dchild=1&keywords=New+Electric+skateboard+wheels+82A&qid=1576444946&s=sporting-goods&sr=8-1-fkmr2&linkCode=ll1&tag=dctm-20&linkId=423002917c69a239a0660073e31f46cd&language=en_US)
- [Electric Speed Controller](https://amzn.to/37rCm7K)
- [Remote](https://amzn.to/2Yu4Olx)
- [Plastic box](https://www.amazon.com/gp/product/B07Y21LRWB/ref=as_li_ss_tl?ie=UTF8&psc=1&linkCode=ll1&tag=dctm-20&linkId=7be8fa2b85c063dcb9fd11567a3b7303&language=en_US)
- [Electric Motor](https://amzn.to/30o8rvJ)
- [XT90](https://amzn.to/2XUEWQE)
- [Hoverboard battery](https://www.ebay.com/itm/36V-4-4AH-Lithium-Ion-Battery-For-Smart-Self-balancing-Fits-6-5-8-10/362906463304?ssPageName=STRK%3AMEBIDX%3AIT&_trksid=p2057872.m2749.l2648)

## Conclusion

So how far does this go? How long does the battery last?
