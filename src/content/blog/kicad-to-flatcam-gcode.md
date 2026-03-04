---
title: KiCad to FlatCAM GCode Workflow
keywords:
  - KiCad
  - FlatCAM
  - PCB
  - gcode
  - CNC
draft: true
date: 2021-01-01
description: Notes on converting KiCad PCB designs to GCode via FlatCAM for CNC milling.
image: https://images.unsplash.com/photo-1518770660439-4636190af475?w=500
alt: PCB circuit board
---

Quick reference notes for converting KiCad PCB designs to GCode for CNC milling via FlatCAM.

## KiCad Settings

- Use larger traces
- No relief thermals on GNDs

## FlatCAM Double-Sided PCB

Reference: http://flatcam.org/manual/doubleside.html

- Mirror Axis: Y
- Point/Box: Gerber name
