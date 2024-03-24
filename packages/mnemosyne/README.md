# Soteria Mnemosyne: Upload Footage to a WebDAV Server

Soteria is a WebDAV based personal cloud security camera system.

Mnemosyne (named after the [Greek goddess of memory](https://en.wikipedia.org/wiki/Mnemosyne)) is a daemon that takes a feed from a webcam or other video device (or virtual device) and a microphone and uploads it in chunks to a WebDAV server.

# Installation

```sh
# Install dependencies.

# Ubuntu/Debian
sudo apt install ffmpeg libv4l-dev v4l-utils alsa-utils
# Fedora/Red Hat
sudo dnf install ffmpeg libv4l-devel v4l-utils alsa-utils

# Install Mnemosyne

npm i -s @soteria/mnemosyne
```

# Usage

## Audio

First you need to find your audio device. To list your audio devices:

```sh
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

In this case, I'm keeping the default sampling rate of 16000, so I want the 16kHz digital microphone (DMIC16kHz). It's on card 0 and it's device 7, so my audio device is:

```
plughw:0,7
```

You can adjust your sampling rate if you want more accurate sound recording. Common sampling rates are 16000 (VoIP), 44100 (audio CDs), and 48000 (professional audio recordings). A higher sampling rate means recording higher frequencies. 16000 sample rate can record up to ~8kHz (good enough for human speech), 44100 can record up to ~20kHz (everything most adults can hear), and 48000 can record up to ~22kHz (nearly everything any human can hear). Keep in mind, the higher the sampling rate, the more data will be used (but the difference isn't nearly as much as the difference when adjusting the video settings).

## Video

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

You also may want to adjust your Constant Rate Factor (CRF) and maximum bitrate. The defaults are 23 and 1500kbps, respectively. This will give you good quality video at 720p resolution and 30 fps. The higher you set the bitrate, the better quality you will get for a given CRF, but you will also use more data. Technically, CRF ranges from 0-51, but the range you'd actually want to use is around 17-28. Anything lower than 17 is just a waste of data, and anything above 28 results in too many compression artifacts.

You also may need to adjust your video resolution and framerate. The default resolution and framerate is 720p (1280x720) at 30fps. If your camera supports a higher resolution, like 1080p (1920x1080), you can set that resolution and increase your maximum bitrate, but this will use more data. Adjusting your framerate lower can compensate for this. You want to balance your resolution and framerate depending on what is more important to you, better image quality (higher resolution), capturing motion accurately (higher framerate), or minimizing data use (lower both).

The last thing you may need to configure is your pixel format. Mnemosyne supports three different pixel formats, YUYV (yuyv422), YU12 (yuv420p), and MJPG (mjpeg). YU12 is the default, and should work with most cameras. YUYV uses more data, so will require a higher bitrate for the same image quality, but will give you more accurate colors. MJPG may be supported by more cameras, but will use more CPU, as each frame needs to be decompressed. Most webcams will support YUYV and YU12 at lower framerates (like 10fps), but only YU12 at higher framerates (like 30fps). So depending on whether higher framerate or better color is more important to you, you may need to adjust your settings.

Please note that the width, height, framerate, and pixel format are all requested from the camera, but whether the camera actually follows that request is really up to the camera. Mnemosyne will print the video format received from the camera before it starts streaming.

## Running

Run Mnemosyne from the command line.

```sh
npx mnemosyne -s https://mywebdavserver.example.com --audio-device plughw:0,7 --video-device /dev/video0
```

Or you can specify more options. For example, if I want **very high quality** settings for a Logitech C920 at 1080p, I'll plug it in, find my devices and run Mnemosyne like this.

```sh
arecord --list-devices
```

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
card 1: C920 [HD Pro Webcam C920], device 0: USB Audio [USB Audio]
  Subdevices: 1/1
  Subdevice #0: subdevice #0
```

```sh
v4l2-ctl --list-devices
```

```
HD Pro Webcam C920 (usb-0000:00:14.0-3):
        /dev/video2
        /dev/video3
        /dev/media1

HD WebCam: HD WebCam (usb-0000:00:14.0-7):
        /dev/video0
        /dev/video1
        /dev/media0
```

```sh
npx mnemosyne -s https://mywebdavserver.example.com --audio-device plughw:1,0 --sampling-rate 44100 --video-device /dev/video2 --crf 17 --max-bitrate 4500 -w 1920 -h 1080 -f 30 --pixel-format YU12
```

This will use a **lot** of data.

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
