## Creating a Time-lapse with FFMPEG

https://hhsprings.bitbucket.io/docs/programming/examples/ffmpeg/drawing_texts/drawtext.html
```bash
ffmpeg -i img\*.jpg output.mpeg
```


https://superuser.com/questions/939357/position-text-on-bottom-right-corner
```bash
ffmpeg -i input.mp4 -vf "drawtext=text='Super User':x=w-tw-10:y=h-th-10:fontsize=24:fontcolor=white" -c:a copy output.mp4
```

http://markushedlund.com/dev/gopro-ffmpeg-timelapse
