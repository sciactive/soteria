# Soteria Mnemosyne: Upload Footage to a WebDAV Server

Soteria is a WebDAV based personal cloud security camera system.

Mnemosyne (named after the [Greek goddess of memory](https://en.wikipedia.org/wiki/Mnemosyne)) is a daemon that takes a feed from a webcam or other video device (or virtual device) and uploads it in chunks to a WebDAV server.

# Installation

```sh
# Install dependencies.

# Ubuntu/Debian
sudo apt install ffmpeg libv4l-dev v4l-utils
# Fedora/Red Hat
sudo dnf install ffmpeg libv4l-devel v4l-utils

# Install Mnemosyne

npm i -s @soteria/mnemosyne
```

# Usage

First you need to find your audio device. To list your audio devices:

```sh
# TODO: update this to whatever audify expects
arecord --list-devices
```

You'll see something like:

```
**** List of CAPTURE Hardware Devices ****
card 0: sofhdadsp [sof-hda-dsp], device 0: HDA Analog (*) []
  Subdevices: 1/1
  Subdevice #0: subdevice #0
card 0: sofhdadsp [sof-hda-dsp], device 6: DMIC (*) []
  Subdevices: 1/1
  Subdevice #0: subdevice #0
card 0: sofhdadsp [sof-hda-dsp], device 7: DMIC16kHz (*) []
  Subdevices: 1/1
  Subdevice #0: subdevice #0
```

In this case, I want the 16kHz digital microphone (DMIC16kHz). It's on card 0 and it's device 7, so my audio device is:

```
plughw:0,7
```

Now you need to find your video device. To list your video devices:

```sh
v4l2-ctl --list-devices
```

You'll see something like:

```
HD WebCam: HD WebCam (usb-0000:00:14.0-7):
        /dev/video0
        /dev/video1
        /dev/media0
```

In this case, I want the HD WebCam. It's available as /dev/video0, so my video device is:

```
/dev/video0
```

Run Mnemosyne from the command line.

```sh
npx mnemosyne -s https://mywebdavserver.example.com --audio-device plughw:0,7 --video-device /dev/video0
```

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
