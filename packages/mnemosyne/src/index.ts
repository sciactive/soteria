import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { program, Option } from 'commander';
import updateNotifier from 'update-notifier';
import { Camera } from 'v4l2-camera-ts';
import audify from 'audify';

const { RtAudio, RtAudioFormat } = audify;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'package.json')).toString()
);

type Conf = {
  crf: number;
  maxBitrate: number;
  audioDevice: string;
  videoDevice: string;
  server: string;
  updateCheck: boolean;
};

program
  .name(pkg.name)
  .description(pkg.description)
  .version(pkg.version, '-v, --version', 'Print the current version');

program
  .addOption(
    new Option(
      '--crf <crf>',
      'The Constant Rate Factor, which controls video quality. Set it as low as your CPU can handle. Technically 0-51, but set it to 17-28.'
    )
      .default(23)
      .argParser(parseFloat)
  )
  .addOption(
    new Option(
      '--max-bitrate <bitrate>',
      'The maximum bitrate of video to produce in kilobits.'
    )
      .default(1500)
      .argParser(parseFloat)
  )
  .option(
    '--audio-device <device>',
    'The name of the audio device.',
    'plughw:0,0'
  )
  .option(
    '--video-device <device>',
    'The filename of the video device.',
    '/dev/video0'
  )
  .option('-s, --server <host>', 'The address of the WebDAV server.')
  .option('--no-update-check', "Don't check for updates.");

program.addHelpText(
  'after',
  `
Environment Variables:
  CRF             Same as --crf.
  MAX_BITRATE     Same as --max-bitrate.
  AUDIO_DEVICE    Same as --audio-device.
  VIDEO_DEVICE    Same as --video-device.
  SERVER          Same as --server.
  UPDATE_CHECK    Same as --no-update-check when set to "false", "off" or "0".

Options given on the command line take precedence over options from an environment variable.`
);

program.addHelpText(
  'afterAll',
  `
Soteria repo: https://github.com/sciactive/soteria
Copyright (C) 2024 SciActive, Inc
https://sciactive.com/`
);

try {
  // Parse args.
  program.parse();
  const options = program.opts();
  let { crf, maxBitrate, audioDevice, videoDevice, server, updateCheck } = {
    crf: process.env.CRF && parseInt(process.env.CRF),
    maxBitrate: process.env.MAX_BITRATE && parseInt(process.env.MAX_BITRATE),
    server: process.env.SERVER,
    updateCheck: !['false', 'off', '0'].includes(
      (process.env.UPDATE_CHECK || '').toLowerCase()
    ),
    ...options,
    ...(process.env.AUDIO_DEVICE != null
      ? {
          audioDevice: process.env.AUDIO_DEVICE,
        }
      : {}),
    ...(process.env.VIDEO_DEVICE != null
      ? {
          videoDevice: process.env.VIDEO_DEVICE,
        }
      : {}),
  } as Conf;

  if (updateCheck) {
    updateNotifier({ pkg }).notify({ defer: false });
  }

  if (server == null) {
    throw new Error('WebDAV server address is required.');
  }

  async function main() {
    // Figure out where our pipes go.
    const tmpdir = os.tmpdir();
    const mnemosynedir = path.resolve(tmpdir, 'mnemosyne');
    try {
      await fsp.mkdir(mnemosynedir);
    } catch (e: any) {
      // ignore
    }
    const audiopipe = path.resolve(mnemosynedir, `${process.pid}-audio`);
    const videopipe = path.resolve(mnemosynedir, `${process.pid}-video`);

    const audioSockets: net.Socket[] = [];
    const audioServer = net.createServer();
    await new Promise<void>((resolve) =>
      audioServer.listen(audiopipe, resolve)
    );
    audioServer.on('connection', (socket) => {
      audioSockets.push(socket);
      socket.on('error', (err) => {
        console.error('Socket Error:', err);
      });
      socket.on('close', () => {
        const idx = audioSockets.indexOf(socket);
        if (idx !== -1) {
          audioSockets.splice(idx, 1);
        }
      });
    });
    // audioServer.on('close', async () => {
    //   await fsp.unlink(audiopipe);
    // });

    const videoSockets: net.Socket[] = [];
    const videoServer = net.createServer();
    await new Promise<void>((resolve) =>
      videoServer.listen(videopipe, resolve)
    );
    videoServer.on('connection', (socket) => {
      videoSockets.push(socket);
      socket.on('error', (err) => {
        console.error('Socket Error:', err);
      });
      socket.on('close', () => {
        const idx = videoSockets.indexOf(socket);
        if (idx !== -1) {
          videoSockets.splice(idx, 1);
        }
      });
    });
    // videoServer.on('close', async () => {
    //   await fsp.unlink(videopipe);
    // });

    // First, open the camera, because we need the framerate for the muxer.
    const cam = new Camera();
    cam.open(videoDevice);
    cam.setFormat({
      width: 1280,
      height: 720,
      pixelFormatStr: 'YU12',
      fps: { numerator: 1, denominator: 30 },
    });

    const format = cam.queryFormat();
    console.log('Video Format:', format);

    const [ffmpegInputOptions, ffmpegTruncateFrame] =
      format.pixelFormatStr === 'YUYV'
        ? ['-f:v rawvideo -pix_fmt:v yuyv422', true]
        : format.pixelFormatStr === 'YU12'
        ? ['-f:v rawvideo -pix_fmt:v yuv420p', true]
        : format.pixelFormatStr === 'MJPG'
        ? [`-f:v jpeg_pipe`, false]
        : [null, false];

    if (ffmpegInputOptions == null) {
      console.error("Error: Couldn't set pixel format to a supported format.");
      process.exit(1);
    }

    // Open the output stream.
    const fhandle = await fsp.open(`./test.mp4`, 'w');
    const writeStream = fhandle.createWriteStream();
    writeStream.on('finish', () => {
      console.log('Stream finished.');
    });
    writeStream.on('close', async () => {
      console.log('Stream closed.');
      await fhandle.close();
      console.log('File handle closed.');
    });

    // Audio input stream.
    const mic = new RtAudio();

    const defaultInputDeviceID = mic.getDefaultInputDevice();
    const audioDevices = mic.getDevices();
    const defaultInputDevice = audioDevices.find(
      (dev) => dev.id === defaultInputDeviceID
    );

    if (defaultInputDevice == null) {
      console.error("Error: Couldn't find default audio input device.");
      process.exit(1);
    }

    if (!defaultInputDevice.sampleRates.includes(16000)) {
      console.error(
        "Error: Default audio input device doesn't support 16kHz sample rate."
      );
      process.exit(1);
    }

    console.log('Audio Device:', defaultInputDevice);

    // Audio transcoding options.
    const ffmpegAudioArgs = `-f:a s16le -ar 16000 -ac 1 -i unix:${audiopipe}`;
    console.log('FFMPEG Audio Args:', ffmpegAudioArgs);

    // Video transcoding options.
    const ffmpegVideoArgs = `${ffmpegInputOptions} -s:v ${format.width}x${
      format.height
    } -r:v ${format.fpsDenominator / format.fpsNumerator} -i unix:${videopipe}`;
    console.log('FFMPEG Video Args:', ffmpegVideoArgs);

    // Output options.
    const ffmpegOutputArgs = `-map 0:a:0 -map 1:v:0 -f mp4 -c:a aac -c:v libx264 -preset veryfast -tune zerolatency -crf ${crf} -maxrate ${maxBitrate}k -bufsize ${
      maxBitrate * 2
    }k -g ${Math.floor(
      (format.fpsDenominator / format.fpsNumerator) * 2
    )} -movflags frag_keyframe+empty_moov`; // -isync 0
    console.log('FFMPEG Output Args:', ffmpegOutputArgs);

    // Transcoding process.
    const ffmpegArgs = [
      '-hide_banner',
      '-probesize',
      '32',
      // '-nostdin',
      ...ffmpegAudioArgs.split(/\s+/),
      ...ffmpegVideoArgs.split(/\s+/),
      ...ffmpegOutputArgs.split(/\s+/),
      // '-filter:a',
      // "asetpts='(RTCTIME - RTCSTART) / (TB * 1000000)'",
      '-filter:v',
      "setpts='(RTCTIME - RTCSTART) / (TB * 1000000)'",
      // "drawtext='fontfile=/usr/share/fonts/liberation-mono/LiberationMono-Bold.ttf: text=\"%{localtime\\:%T}\": fontcolor=white@0.8: x=7: y=460'",
      'pipe:1',
    ];
    console.log('FFMPEG Args:', ffmpegArgs.join(' '));
    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    ffmpeg.stdout.on('data', (data) => {
      console.log('output chunk length:', data.length);
      if (!writeStream.write(data)) {
        ffmpeg.stdout.pause();
        writeStream.once('drain', () => {
          ffmpeg.stdout.resume();
        });
      }
    });
    ffmpeg.stderr.on('data', (data) => {
      console.error(`ffmpeg: ${data}`);
    });
    ffmpeg.on('close', (code) => {
      console.log(`ffmpeg exited with code ${code}`);
      writeStream.end();
    });

    // Open the input/output stream.
    mic.openStream(
      null,
      {
        deviceId: defaultInputDeviceID,
        nChannels: 1,
        firstChannel: 0,
      },
      RtAudioFormat.RTAUDIO_SINT16,
      16000,
      (format.fpsNumerator / format.fpsDenominator) * 16000,
      'Mnemosyne',
      (data) => {
        for (let socket of audioSockets) {
          if (!socket.writableEnded) {
            socket.write(data);
          }
        }
      },
      null
    );

    // Allocate memory-mapped buffers and turn the stream on.
    cam.start();
    // Turn the stream on.
    mic.start();

    const start = new Date().getTime();
    const end = start + 1 * 60 * 1000;

    console.time('Frame Time');
    let frames = 0;
    while (new Date().getTime() < end) {
      // Asynchronously wait until the camera fd is readable and then exchange
      // one of the memory-mapped buffers
      const frame = await cam.getNextFrame();
      frames++;
      console.timeLog('Frame Time');
      console.log(
        'Input Frame Rate:',
        frames / ((new Date().getTime() - start) / 1000)
      );

      // Truncate the buffer to the right image size if needed.
      let buffer = Buffer.from(
        !ffmpegTruncateFrame || frame.length === format.sizeImage
          ? frame
          : frame.subarray(0, format.sizeImage)
      );

      for (let socket of videoSockets) {
        if (!socket.writableEnded) {
          socket.write(buffer);
        }
      }
    }
    console.timeEnd('Frame Time');

    // Turn the streams off and unmap all buffers.
    cam.stop();
    mic.stop();
    mic.clearOutputQueue();
    cam.close();
    mic.closeStream();

    // Close all sockets.
    for (let socket of audioSockets) {
      socket.end();
    }
    for (let socket of videoSockets) {
      socket.end();
    }

    // End the pipes.
    audioServer.close();
    videoServer.close();

    // End the transcode stream.
    ffmpeg.stdin.end();
  }

  main();
} catch (e: any) {
  console.error('Error:', e.message);
  process.exit(1);
}
