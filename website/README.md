# website

landing page for unofficial are.na app

## video compression script

```sh

ffmpeg -y -i screen-recording.original.mp4 -vf "scale=1800:-2" -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -movflags +faststart -an screen-recording.mp4
```
