---
title: "Building a Custom HTTP Proxy in Rust for Mixed-OS Workflows"
keywords:
  - rust
  - proxy
  - http
  - https
  - networking
  - linux
  - windows
  - mixed-OS
  - development workflow
  - popos
  - wsl2
  - developer tools
  - transparent proxy
slug: building-custom-http-proxy-rust-mixed-os-workflows
date: 2026-03-16
description: "How I built a Rust-powered transparent HTTP(S) proxy to seamlessly route my Linux traffic through a Windows work machine, with PopOS setup, Docker config, and Chromium proxy tips."
image: https://media.istockphoto.com/id/157193805/photo/broken-glass-window-bullet-shooting-impact-hole-cracks.jpg?s=2048x2048&w=is&k=20&c=0s4HTmGr7zR9kj5D32185ockkai9kykI0R_li8nGWn8=
alt: "Broken window glass with bullet impact hole"
priority: 0.9
---

TLDR; I've been a Microsoft fan boy for years. Windows stopped being fun tho. The constant upselling of in my desktop environment, the digital clutter that never gets organized, the cost of OneDrive, and bitrot got old.

I wanted to switch to a miminalist OS... the catch-22 is my work didn't support Linux (or a mac at the time), corp VPN, and a bunch of policies. I couldn't just switch and be done with it. So I got creative.

## The Problem

I wanted Linux as my daily driver. The work required Windows for the VPN and certain tools. WSL2 was okay, but it felt like fighting the OS half the time. USB devices, GUI apps, file operations in bulk. Things were just slow or wouldn't work the way I expected. 

I needed a way to run Linux full time but still access my work's Windows environment seamlessly.

## First Attempts

I tried Squid proxy first. It worked... mostly. But I'd get random issues from time to time. Then I wrote a Python script to handle the proxying, which was better but felt hacky.

I knew I could do better. And I wanted to learn Rust anyway.

## The Rust Proxy

I built a transparent HTTP(S) forward proxy in Rust. It's nothing fancy, but it solves my specific problem:

- HTTP and HTTPS proxy support via CONNECT tunneling
- SSL/TLS error detection with helpful diagnostics (because corporate certs are a pain)
- Windows firewall integration (auto-creates rules for the proxy port)
- Cross-platform binaries (Windows, Linux, macOS)
- Configurable host, port, and logging levels

Here's the repo if you want to check it out: [rust_reverse_proxy](https://github.com/spencerkittleson/rust_reverse_proxy)  I did use claude code to help me build it since i didnt have alot experience.

Why Rust? The performance has been said to be solid. The async architecture with tokio handles plenty of concurrent connections without causing any problems.

### Quick Start

```bash
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

```bash
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

```bash
# For work
gh auth switch --user work_user

# For personal
gh auth switch --user personal_user
```

Would be nice if there was an alias or something, but this works.

### Flatpak x11 Fallback

Some Flatpak apps don't work well with Wayland. Here's how to force x11 for VSCodium:

```bash
flatpak override --user --nosocket=fallback-x11 --socket=x11 com.vscodium.codium
```

### .NET Linking

I keep a local .dotnet install but link it to the system path:

```bash
sudo ln -sf /home/spencerkittleson/.dotnet/dotnet /usr/bin/dotnet
```

### NVM for Node

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

## The PopOs fun  window issues

PopOS isn't perfect. Here's what I had to fix:

### Gnome Tweaks

- Adjust services startup: `gnome-session-properties`
- Change workspaces quickly: `super + ctrl + up/down`
- Restart Gnome shell: press `alt + f2`, type "r", hit enter

### Bluetooth

I ditched the bluetooth adapter since it was old and caused issues with PopOs all the time. Disable the internal adapter when not needed:
```bash
# List devices
hciconfig

# Take one down
sudo hciconfig hci0 down
```

### Audio Power Saving

This was a common fix for audio issues:
```bash
# Temporary
echo "0" | sudo tee /sys/module/snd_hda_intel/parameters/power_save

# Permanent
sudo tee /etc/modprobe.d/audio_disable_powersave.conf <<< "options snd_hda_intel power_save=0"
```

### Wireplumber Suspend

Prevent unwanted suspend:
```bash
sudo sed -i 's/--\["session.suspend-timeout-seconds"\] = 5/\["session.suspend-timeout-seconds"\] = 0/' /usr/share/wireplumber/main.lua.d/50-alsa-config.lua
systemctl restart --user pipewire.service
```

### VSCodium GPU

If it's crashing:
```bash
codium --disable-gpu
```

## Chromium Proxy Setup

This is the part that actually makes everything usable. I run different work apps through different proxies. Here's how I launch Chromium with specific proxy settings:

```bash
# Basic proxy
flatpak run --command=/app/bin/chromium org.chromium.Chromium --profile-directory=Default --proxy-server="http://192.168.8.204:3129;https://192.168.8.204:3129" & disown

# With certificate errors ignored (useful for internal corporate certs)
flatpak run --command=/app/bin/chromium org.chromium.Chromium --profile-directory=Default --proxy-server="http://192.168.8.204:3129;https://192.168.8.204:3129" --ignore-certificate-errors & disown
```

I have multiple of these for different work contexts. It's not elegant but it works.

## The Router Setup

I use a travel router to connect my Linux machine to the work Windows machine via ethernet. It's basically a home lab but for work. The router runs Wi-Fi 7, which is nice since my work laptops are from 2019 and don't support it. Since I'm proxying all traffic through the work laptop, this gives me low latency and fast file transfers.

## 15 Months In

It's been over a year now. Here's where I'm at:

- Running PopOS full time on my personal machine
- Work machine is only PopOS Cosmic
- The Rust proxy handles all my traffic routing to a Windows PC
- I use the proxy to split internet traffic - work stuff goes through corp VPN, everything else direct
- No more OneDrive - I use the web version, git, or my knowledge management system

Would I do anything differently? Maybe not have spent so much time optimizing Windows when all of work systems deploy to linux container in production anyways. The ecosystem lock-in is real. Once you're in, it's hard to get out. But with some creativity and a custom code, you can make mixed-OS workflows work for you.
