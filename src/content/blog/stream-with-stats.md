---
title: Creating a Time-lapse Stream with Stats
keywords:
  - ffmpeg
  - timelapse
  - streaming
  - video
draft: true
date: 2021-01-01
description: Using FFMPEG to create time-lapse videos with stats and text overlays.
image: https://images.unsplash.com/photo-1536240478700-b869ad10a2eb?w=500
alt: Video streaming setup
---

## Creating a Time-lapse with FFMPEG

```bash
ffmpeg -i img\*.jpg output.mpeg
```

Reference: https://hhsprings.bitbucket.io/docs/programming/examples/ffmpeg/drawing_texts/drawtext.html

Add text overlay positioned at the bottom right:

```bash
ffmpeg -i input.mp4 -vf "drawtext=text='Super User':x=w-tw-10:y=h-th-10:fontsize=24:fontcolor=white" -c:a copy output.mp4
```

Reference: https://superuser.com/questions/939357/position-text-on-bottom-right-corner

http://markushedlund.com/dev/gopro-ffmpeg-timelapse
