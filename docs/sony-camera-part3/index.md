## TLDR; 

[Code about this blog post](https://github.com/skittleson/pi_sony_remote). Drop the files over ssh into a raspberry pi zero with a micro usb cable then you should be set!

## Introduction

As in my other posts, i've made further progress with getting my camera to a modern era. This one is going to be taking advantage of using bit of mobile compute and finding some parts to make it ultra compact.  Also, I got a new a6400! a few new features that i really like. Before i go to far i do once to call out some of the biggest changes since my last posts ([hacking-sony-a6000-for-modernization.md](hacking-sony-a6000-for-modernization.md)) and 2 ([hacking-sony-a6000-more.md](hacking-sony-a6000-more.md)): no ssh into the device, the playmemories app is no longer so we cant get updated apps, and no more android subsystem. Looks like this has been rewritten by Sony.


So why is this post a bit different?  We are using additiional hardware for on-the-go capture gathering/viewing.  A raspberry pi zero w, gps on it, external battery, and some small cables.  What does this get us?  Gets us realtime shots, online/offline networking, and convience.


## The Dead Ends

Using the Sony App is kind of slow. I know they did a general good job on it. It's just really flaky to get going. I tried a bunch of ways but it could be my phone or the camera itself. Not sure but i dont see Sony making a ton of improvements on it.

- **Wi-Fi hotspot mode** dumb terminal, no internet, Camera SDK only returns thumbnails without the `setPostviewImageSize` hack (covered in Part 1)
- **USB mass storage** USB 2.0 is painfully slow for 7-10MB JPEGs; camera freezes if you don't eject safely
- **Sony Camera SDK full download** — the `setPostviewImageSize` trick gives one photo at a time; no enumerate API, no batch download, connection drops when leaving Smart Remote mode
- **FTP from camera** Part 2 showed this: 70 files in 13 minutes. Not a workflow.
- **gphoto2 with a laptop** works perfectly, not very mobile.


There is one really cool feature about gphoto2 in PC Mode tho... camera events. Every interaction shows you exactly what gets changed on the camera. We can use that to gain insights and determine what to do next. Just dont want to have a laptop with me.


## Architecture

```
Sony a6400 (PC Remote mode)
        │ USB
        ▼
   gphoto2 --capture-tethered
        │
        ▼
   ~/downloads/NNNNN.jpg
        │
        ├──► Bluetooth RFCOMM server
        └──► Copyparty HTTP server
```

- Three services: tethered capture, Bluetooth RFCOMM, copyparty HTTP
- Can run all three or any subset
- Camera always connected via USB in PC Remote mode

## Tethered Capture

**Goal:** The most fragile part of the system. Real engineering pain points.

Most Sony cameras support PC mode. The magic of this happens here.  ghoto2 can get those realtime events to stream over.  As well as the full image. its only there for temporary so we need to grab while its still possible to get it.

 I rebuilt gphoto2 from source. it takes awhile on the pi but more stable at 2.5.32+ . Use `setup.sh` to build from source. 


**The Lua monitor pattern (not a systemd Restart trap):**
- gphoto2 exits when the USB link blips
- systemd restart is fast enough to collide with the camera still holding the USB device → "Could not claim the USB device"
- Solution: Lua script maintains one persistent gphoto2 session; kills `gvfs-gphoto2-volume-monitor`, waits 5 seconds, relaunches
- systemd sees a healthy Lua process and never triggers its own restart logic
- Show the Lua loop snippet

**Sequential filenames:**
- gphoto2's `%Y%m%d%H%M%S.jpg` sorts wrong on mobile
- Use `--filenumber=N --filename %05n.%C` → `00001.jpg`, `00002.jpg`
- Lua script scans download directory for highest number before each session → no overwrites after crash/restart

**The `WorkingDirectory=/` silent failure trap:**
- gphoto2 writes a temp file to CWD before moving to target filename
- Default systemd CWD is `/`, not writable by service user
- Result: gphoto2 exits 0, photo never appears in download directory
- Fix: `WorkingDirectory=/home/dietpi/downloads` in systemd unit
- *This one wasted hours* — emphasize this

---

## The USB Mode-Switching Bug

**Goal:** The most annoying physical bug in the system. Not software — physics.

**References:**
- [`README.md`](https://github.com/skittleson/pi_sony_remote/blob/master/README.md) — troubleshooting section

- a6400 falls from PC Control mode (`054c:0caa`) to charging mode (`054c:0994`)
- Causes: marginal cable, insufficient Pi USB current, camera connected before USB stack is ready
- gphoto2 can't find the camera in charging mode
- **Fixes:** short quality cable, powered USB hub, 5-second sleep in Lua monitor for re-enumeration

## The Bluetooth Binary Protocol

**Goal:** The technical deep-dive. This is the HN-worthy section.

The easiest approach [`was to use RFCOMM`](https://github.com/skittleson/pi_sony_remote/blob/master/services/sony_camera_bt_server.py) but i know its a bit slower so compression is required.  I suspect this is why the Sony android is so slow. OBEX/OPP is bloated; HTTP over Bluetooth PAN/DUN is finicky on both sides

So a simple custom protocal was made, only 3 bytes of overhead per message! `[1 byte opcode] [2 bytes big-endian length] [payload]`

**Commands:**
- `0x01 LIST` — no payload, returns `0x81` with newline-delimited filenames
- `0x02 GET` — payload is `<quality byte><filename>`, returns `0x82` with JPEG data
- `0xFE` — error responses with ASCII messages (`FILE_NOT_FOUND`, `BAD_QUALITY`, etc.)

**Quality tiers (server-side compression with Pillow/LANCZOS):**

| Quality | Resize | JPEG quality | Typical size |
|---------|--------|-------------|-------------|
| 0 | None (original) | — | ~7-10 MB |
| 1 | Half-size | 75 | ~1 MB |
| 2 | 1200px wide | 75 | ~300 KB |
| 3 | 1200px wide | 40 | ~100 KB |

- Quality 3 = preview in under 10 seconds over Bluetooth
- Pi does the CPU work; phone receives final compressed JPEG


---

## Copyparty: Zero-Config LAN Browsing

**Goal:** Quick section — the alternative to Bluetooth for LAN setups.

**References:**
- [`copyparty-setup.sh`](https://github.com/skittleson/pi_sony_remote/blob/master/copyparty-setup.sh)

- `bash copyparty-setup.sh && sudo systemctl enable --now copyparty`
- No nginx, no Apache, no config files
- `http://<pi-ip>:8080` → full file browser with thumbnails and grid view
- Default login: `admin`/`admin`
- Use cases: booths, events, bigger screen without Bluetooth

---

## Lessons Learned

**Goal:** The section HN loves. Concrete takeaways from real pain.

1. **Build gphoto2 from source** — distro package is too old; plan for build time
2. **Use a Lua wrapper, not a raw systemd service** — gphoto2 exits; the Lua monitor handles the USB race condition that systemd restarts can't fix
3. **Set `WorkingDirectory` in your systemd unit** — the silent failure is the most expensive bug in this project
4. **Quality cable, powered hub, or neither** — USB mode-switching is physics, not software
5. **Compress server-side for Bluetooth** — Pi has the CPU; use it
6. **Three bytes beats HTTP on RFCOMM** — length-prefixed packets are simpler and faster
7. **Sequential filenames for mobile** — timestamps sort wrong on phone galleries

---

## Use Cases

**Goal:** Who is this for? Make it concrete.

- **Product photography** — camera on tripod, Pi on shelf, check phone over Bluetooth. No desk, no laptop cable.
- **Wildlife** — remote trigger, instant photo availability. You're in the field, not at a desk.
- **Events** — hands-free capture station. Attendees review on LAN browser, collect originals later.
- **Booths and displays** — self-contained photo station. Pi hides behind the setup. No laptop footprint = looks like magic.

---

## Conclusion

**Goal:** Wrap up and invite discussion.

- TL;DR: $35 Pi replaced a laptop in my tethered workflow
- Three services, one Lua monitor, one custom protocol — it works
- The parts that hurt (USB mode-switching, `WorkingDirectory=/`, gphoto2 version) are documented now
- The protocol is open — fork the repo, add remote shutter control over Bluetooth, tell me what you build
- Discussion prompts:
  - Anyone else reverse-engineer a camera protocol?
  - BLE vs RFCOMM for file transfer — which would you use?
  - What other cameras would this work on? (gphoto2 camera list is extensive)
  - The super-resolution hack from Part 1 — worth a Part 4?