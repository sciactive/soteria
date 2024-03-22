# Soteria Mnemosyne: Upload Footage to a WebDAV Server

Soteria is a WebDAV based personal cloud security camera system.

Mnemosyne (named after the [Greek goddess of memory](https://en.wikipedia.org/wiki/Mnemosyne)) is a daemon that takes a feed from a webcam or other video device (or virtual device) and uploads it in chunks to a WebDAV server.

# Installation

```sh
sudo apt install libv4l-dev
# or
sudo dnf install libv4l-devel

# sudo apt-get install libavcodec-dev libavformat-dev libavdevice-dev libavfilter-dev libavutil-dev libpostproc-dev libswresample-dev libswscale-dev
# # or
# sudo dnf install libavcodec-free libavcodec-free-devel libavformat-free libavformat-free-devel libavdevice-free libavdevice-free-devel libavfilter-free libavfilter-free-devel libavutil-free libavutil-free-devel libpostproc-free libpostproc-free-devel libswresample-free libswresample-free-devel libswscale-free libswscale-free-devel

npm i -s @soteria/mnemosyne
```

# Usage

Run Mnemosyne from the command line.

```sh
npx mnemosyne
```

# Formats

Any [v4l2](https://docs.kernel.org/userspace-api/media/v4l/videodev.html#videodev) compatible format.

- [MJPEG](https://docs.kernel.org/userspace-api/media/v4l/pixfmt-reserved.html#v4l2-pix-fmt-mjpeg)
- [H264](https://docs.kernel.org/userspace-api/media/v4l/pixfmt-compressed.html#v4l2-pix-fmt-h264)

# License

Copyright 2024 SciActive Inc

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
