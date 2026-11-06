## Introduction

**Sony A6000/A6400 series:** [Part 1: Modernization](/hacking-sony-a6000-for-modernization/) · Part 2 (this post) · [Part 3: Tethered Raspberry Pi](/sony-camera-part3/) · [Research & Community Resources](/sony-a6000-a6400-research/)

This is a smaller continuation of the previous blog post on [hacking the Sony A6000 camera](/hacking-sony-a6000-for-modernization/) (come back for more updates).

<div class="guide-card" style="margin:2rem 0;padding:1.25rem 1.5rem 0.5rem;border:1px solid var(--color-accent, #9da2ff);border-radius:12px;background-color:var(--color-surface, #1e262f);box-shadow:0 0 0 4px rgba(157,162,255,0.10);">
<span style="display:inline-block;padding:2px 10px;border:1px solid var(--color-accent, #9da2ff);border-radius:999px;color:var(--color-accent, #9da2ff);font-size:0.75rem;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">Early release</span>
<h2 id="get-the-full-field-guide" style="margin-top:0.75rem;">Get the full field guide</h2>

<a href="https://dctmlab.taila665d5.ts.net/" aria-label="Get the Sony A6000 and A6400 Hacking Guide"><img src="/images/sony-guide-early-release.webp" alt="Pages from the Sony A6000 and A6400 Hacking Guide: the cover, the chapter 1 hack matrix, and the chapter 7 burst merge walkthrough" width="1600" height="900" decoding="async" style="width:100%;height:auto;border-radius:8px;" /></a>

The free apps, the USB-C battery hack and the FTP uploader from this post all made it into my field guide for the A6000 and A6400, along with what I learned since.

- Timelapse on both bodies: the A6400's built-in menu, and app or trigger options for the A6000
- Power options compared: the AC-PW20 dummy battery, battery grips and power banks, with the real charge math
- The discontinued PlayMemories apps, and where the archived copies live now that Sony's store is gone
- Only in the guide: the chapter 2 firmware backup and risk notes, and a troubleshooting index for the errors people hit most, like "No Tweaks found" and the A6400 dropping into charging mode

It launched at $39. During the early release it's **$23.47**, or **$18.47** if you tick the box promising to send me feedback after you've tried it (honor system). It's a 25-page PDF, emailed as soon as you pay.

<a href="https://dctmlab.taila665d5.ts.net/" style="display:inline-block;margin:8px 0;padding:10px 18px;border-radius:8px;background:var(--color-accent,#9da2ff);color:#1a2129;font-weight:700;text-decoration:none;">Get the guide for $23.47</a>

Full disclosure: this is my own guide, and the money comes to me. If it doesn't help you, reply to the delivery email within 30 days and I'll refund you. Some of the mods in it are irreversible, so read the risk notes before you start.

</div>

## Free Apps

To install time-lapse and an FTP Uploader with some additional hacks, this open source project was awesome https://github.com/ma1co/Sony-PMCA-RE. Download the executable from the releases, then it will provide you on the applications to install. I would also recommend the OpenMemories:Tweaks app as it allows changing some limits on the camera.


## USB-C Battery Hack

Batteries drain very quickly with this camera. The stock battery is around 1020mAh.  Swapping out batteries is common and tedious.  Getting [usb-c versions](https://amzn.to/4bBDFBc) of them helps with charging on the go but it's still annoying with cables.

After a bit of hacking the [power adapter](https://amzn.to/4afC0jy) version of this, I bundled everything up into a single battery shell with a [usb-c](https://amzn.to/44Kd0jk) female tail.  Nothing clever here other than taking apart the usb 5v to 8v adapter then adding that to the shell with a [usb-c](https://amzn.to/44Kd0jk) input.  The idea here is to use a large battery bank when taking very long time-lapse. Bulding a battery pack on the bottom is the next idea. Here is the build for the [power adapter](https://amzn.to/4afC0jy).

#### Battery Hack Gear

| Gear | Purpose | Buy |
|---|---|---|
| [USB-C NP-FW50 batteries](https://amzn.to/4bBDFBc) | Rechargeable on-the-go batteries | [Amazon](https://amzn.to/4bBDFBc) |
| [AC-PW20 power adapter](https://amzn.to/4afC0jy) | Dummy battery, cannibalized for the shell | [Amazon](https://amzn.to/4afC0jy) |
| [USB-C female tail](https://amzn.to/44Kd0jk) | Input for the external battery bank | [Amazon](https://amzn.to/44Kd0jk) |
| [Anker USB-C SD card reader](https://www.amazon.com/dp/B07NW8RPYN?tag=dctm-20) | Fast on-the-go card dumps | [Amazon](https://www.amazon.com/dp/B07NW8RPYN?tag=dctm-20) |

<iframe width="560" height="315" src="https://www.youtube.com/embed/uRE7KQktJBk?si=iQUhHBQ98gUw4M6L" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

## Data Transfers Hurdles

A follow up from my previous post.

### Using a Card Reader

On the go, I keep this [card reader](https://www.amazon.com/dp/B07NW8RPYN?tag=dctm-20) near the camera bag. It allows for the sd card to plugged into the computer or phone in a small package. Sometimes I just need a few pictures on my phone to edit and send.  All the other files get dumped.

### Using the FTP uploader within the camera

This idea of using the FTP uploader is great but it's very slow...  70 files in 13 minutes at full resolution JPEG files. If there is not a lot pictures this makes sense but typically taking the sd card out and data dumping is going to be much quicker still.

Using the FTP uploader app mentioned above, i use this bit of python code to dump it into directory that i care about.

`python -m pyftpdlib -u USER -P PASS -w`

Reference to this command. https://stackoverflow.com/questions/4994638/one-line-ftp-server-in-python