---
title: Building a Custom HTTP Proxy in Rust for Mixed-OS Workflows
keywords:
  - rust
  - proxy
  - http proxy
  - linux
  - windows
  - popos
  - vpn
  - wsl2
  - mixed os
  - tokio
date: 2026-03-15
description: I built a Rust proxy to keep my traffic private and give me remote access to home devices. It's lightweight, no-app, works on any device that can point to a proxy.
image: /images/broken-window.jpeg
alt: Broken window glass with bullet impact hole
draft: false
---

TLDR; I built a Rust proxy to keep my traffic private and give me remote access to home devices. It's lightweight, no‑app, works on any device that can point to a proxy. I'll walk through the privacy benefits, how I use it for local services, and why I still use it even with a full‑tunnel VPN.

I wanted to switch to a miminalist OS… the catch‑22 is my work didn't support Linux (or a mac at the time), corp VPN, and a bunch of policies. I couldn't just switch and be done with it. So I got creative.

## The Problem

I wanted Linux as my daily driver. The work required Windows for the VPN and certain tools. WSL2 was okay, but it felt like fighting the OS half the time. USB devices, GUI apps, file operations in bulk. Things were just slow or wouldn't work the way I expected.

I needed a way to run Linux full time but still access my work's Windows environment seamlessly.

## First Attempts

I tried Squid proxy first. It worked… mostly. But I'd get random issues from time to time. Then I wrote a Python script to handle the proxying, which was better but felt hacky.

I knew I could do better. And I wanted to learn Rust anyway.

## The Rust Proxy

I built a transparent HTTP(S) forward proxy in Rust. It's nothing fancy, but it solves my specific problem:

- HTTP and HTTPS proxy support via CONNECT tunneling
- SSL/TLS error detection with helpful diagnostics (because corporate certs are a pain)
- Windows firewall integration (auto‑creates rules for the proxy port)
- Cross‑platform binaries (Windows, Linux, macOS)
- Configurable host, port, and logging levels

Here's the repo if you want to check it out: [rust\_reverse\_proxy](https://github.com/spencerkittleson/rust_reverse_proxy) I did use claude code to help me build it since i didnt have alot experience.

Why Rust? The performance has been said to be solid. The async architecture with tokio handles plenty of concurrent connections without causing any problems.

### Quick Start

```sh
# Download the latest release
wget https://github.com/spencerkittleson/rust_reverse_proxy/releases/latest/download/rust_proxy-linux-x64

# Run it
./rust_proxy-linux-x64 --host 0.0.0.0 --port 3129
```

Then point your system or app proxy settings to that host and port. Simple.

## PopOS Setup: The Real Work

The proxy was the easy part. Getting PopOS to play nice with my work setup? That took some doing.

### Docker Install (The Full Walkthrough)

Docker doesn't come pre-installed on PopOS, so here's exactly what I did:

```sh
# 1. Update system packages
sudo apt update && sudo apt upgrade -y

# 2. Install prerequisites
sudo apt install -y apt-transport-https ca-certificates curl gnupg lsb-release

# 3. Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 4. Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 5. Update and install
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 6. Start and enable
sudo systemctl start docker
sudo systemctl enable docker

# 7. Add user to docker group
sudo usermod -aG docker $USER

# 8. Verify
docker --version
docker compose version
```

Log out and back in (or run `newgrp docker`) to apply the group changes.

### GitHub Account Switching

I have both a personal and work GitHub account. Here's how I switch between them:

```sh
# For work
gh auth switch --user work_user

# For personal
gh auth switch --user personal_user
```

Would be nice if there was an alias or something, but this works.

### Flatpak x11 Fallback

Some Flatpak apps don't work well with Wayland. Here's how to force x11 for VSCodium:

```sh
flatpak override --user --nosocket=fallback-x11 --socket=x11 com.vscodium.codium
```

### .NET Linking

I keep a local .dotnet install but link it to the system path:

```sh
sudo ln -sf /home/spencerkittleson/.dotnet/dotnet /usr/bin/dotnet
```

### NVM for Node

```sh
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

## The PopOs fun window issues

PopOS isn't perfect. Here's what I had to fix:

### Gnome Tweaks

- Adjust services startup: `gnome-session-properties`
- Change workspaces quickly: `super + ctrl + up/down`
- Restart Gnome shell: press `alt + f2`, type "r", hit enter

### Bluetooth

I ditched the bluetooth adapter since it was old and caused issues with PopOs all the time. Disable the internal adapter when not needed:

```sh
# List devices
hciconfig

# Take one down
sudo hciconfig hci0 down
```

### Audio Power Saving

This was a common fix for audio issues:

```sh
# Temporary
echo "0" | sudo tee /sys/module/snd_hda_intel/parameters/power_save

# Permanent
sudo tee /etc/modprobe.d/audio_disable_powersave.conf <<< "options snd_hda_intel power_save=0"
```

### Wireplumber Suspend

Prevent unwanted suspend:

```sh
sudo sed -i 's/--\["session.suspend-time-seconds\] = 5/\["session.suspend-time-seconds\] = 0/' /usr/share/wireplumber/main.lua.d/50-alsa-config.lua
systemctl restart --user pipewire.service
```

### VSCodium GPU

If it's crashing:

```sh
codium --disable-gpu
```

## Chromium Proxy Setup

This is the part that actually makes everything usable. I run different work apps through different proxies. Here's how I launch Chromium with specific proxy settings:

```sh
# Basic proxy
flatpak run --command=/app/bin/chromium org.chromium.Chromium --profile-directory=Default --proxy-server="http://192.168.8.204:3129;https://192.168.8.204:3129" & disown

# With certificate errors ignored (useful for internal corporate certs)
flatpak run --command=/app/bin/chromium org.chromium.Chromium --profile-directory=Default --proxy-server="http://192.168.8.204:3129;https://192.168.8.204:3129" --ignore-certificate-errors & disown
```

I have multiple of these for different work contexts. It's not elegant but it works.

## Flatpak Sandbox Chrome Alias

For convenience, you can set an alias that launches Chromium in a sandboxed Flatpak instance with the proxy already configured:

```sh
alias proxy="flatpak run --command=/app/bin/chromium org.chromium.Chromium --profile-directory=Default --proxy-server='http://192.168.8.204:3129;https://192.168.8.204:3129' --ignore-certificate-errors & disown"
```

This keeps the proxy settings isolated from your regular Chrome installation and ensures the sandboxed instance respects the corporate certificate chain.

## The Router Setup

I use a travel router to connect my Linux machine to the work Windows machine via ethernet. It's basically a home lab but for work. The router runs Wi‑Fi 7, which is nice since my work laptops are from 2019 and don't support it. Since I'm proxying all traffic through the work laptop, this gives me low latency and fast file transfers.

## 15 Months In

It's been over a year now. Here's where I'm at:

- Running PopOS full time on my personal machine
- Work machine is only PopOS Cosmic
- The Rust proxy handles all my traffic routing to a Windows PC
- I use the proxy to split internet traffic - work stuff goes through corp VPN, everything else direct
- No more OneDrive - I use the web version, git, or my knowledge management system

Would I do anything differently? Maybe not have spent so much time optimizing Windows when all of work systems deploy to linux container in production anyways. The ecosystem lock‑in is real. Once you're in, it's hard to get out. But with some creativity and a custom code, you can make mixed‑OS workflows work for you.

## Work VPN Conflicts

I use a full‑tunnel work VPN, which can be problematic for development. NPM, NuGet, and pip can be extremely slow because all traffic is forced through the corporate network. SSL certificates can also be an issue: with a full VPN, an intermediate certificate is installed and becomes part of the chain. I'm not a TLS expert, but it can cause headaches.

Companies may not even like proxies installed on the PC or allow them in general use. Route tables and routing traffic become interesting. I use a proxy in two different ways depending on the use case. I've been using an HTTPS proxy for over a year. It solved a few major issues for me. In the age of WireGuard and Tailscale, you might wonder why I still use it.

## Conclusion

- **Keep it simple.** A single, lightweight proxy can solve a lot of headaches without the bloat of a full VPN client.
- **Don't over‑optimize.** I spent a lot of time tweaking Windows, but the real win was the Linux side. Focus on the part that actually matters to you.
- **Document early.** The notes you keep for yourself become the next blog post. I'm still adding to this file, and that's why it's a living document.
- **Stay curious.** The tech landscape changes fast. What worked for me last year might be obsolete next year, so keep experimenting.

Bottom line: if you're juggling a corporate VPN and a personal workflow, a transparent forward proxy is a surprisingly powerful tool. It keeps your traffic private, gives you remote access to home services, and lets you sidestep the slowdowns of a full‑tunnel VPN. Give it a shot and see how it changes your day‑to‑day dev life.
