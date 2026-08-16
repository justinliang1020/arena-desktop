# icon

Start a with a `arena.png` image

## MacOS Icons

Quick macOS .icns creation:

### Create iconset directory

mkdir icon/arena.iconset

### Copy your PNG at various sizes (ideally you'd have proper sizes)

sips -z 512 512 icon/arena.png --out icon/arena.iconset/icon_512x512.png
sips -z 256 256 icon/arena.png --out icon/arena.iconset/icon_256x256.png
sips -z 128 128 icon/arena.png --out icon/arena.iconset/icon_128x128.png

### Convert to icns

iconutil -c icns icon/arena.iconset -o icon/arena.icns
