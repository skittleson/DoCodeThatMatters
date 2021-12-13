---
title: Common Apps for Devs over Chocolatey 
keywords: 
    - choco
    - Chocolatey
    - Automate software installs
    - Software Engineer on Windows
date: 2021-10-03
description: Automate software install for a software engineer on Windows
image: https://images.unsplash.com/photo-1610450949065-1f2841536c88?ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&ixlib=rb-1.2.1&auto=format&fit=crop&w=774&q=80
imageAlt: Chocolate bar
priority: 0.9
---

As a software engineer, starting with a clean slate in an OS is required often.  Usually using containers is the solution to that for development.  After some time even your primary OS suffers from **bit rot**.  For Windows, a factory reset gets that back into a clean state.  I use A LOT of apps and they can take up to day to install everything but no more!  So here is powershell script to get the common apps used on a regular basis.
   
Install chocolatey from [https://chocolatey.org/install](https://chocolatey.org/install)


    choco install -y 7zip arduino audacity autohotkey autoruns bleachbit cmder curl cyberduck ditto drawio ffmpeg Ghostscript.app gimp git gitkraken graphviz grep handbrake hwmonitor ilspy imagemagick inkscape jq keepass microsoft-windows-terminal nano nodejs notepadplusplus paint.net powertoys processhacker rainmeter rsync screentogif sharex sharpkeys SQLite sqlitebrowser sysinternals teracopy tortoisegit totalcommander transmission ultradefrag vlc vscode winmerge wireguard wireshark youtube-dl chocolateypackageupdater python dotnet visualstudio2019community oh-my-posh


For all available local packages

    choco list --localonly


See more at [https://chocolatey.org/](https://chocolatey.org/)