import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { program } from 'commander';
import updateNotifier from 'update-notifier';
import { Camera } from 'v4l2-camera-ts';
import NodeMic from 'node-mic';
import JMuxer from 'jmuxer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'package.json')).toString()
);

type Conf = {
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
  let { audioDevice, videoDevice, server, updateCheck } = {
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
    console.log(format);

    const [ffmpegInputOptions, ffmpegTruncateFrame] =
      format.pixelFormatStr === 'YUYV'
        ? ['-f rawvideo -pix_fmt:v yuyv422', true]
        : format.pixelFormatStr === 'YU12'
        ? ['-f rawvideo -pix_fmt:v yuv420p', true]
        : format.pixelFormatStr === 'MJPG'
        ? [`-f jpeg_pipe`, false]
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

    // Muxer

    const muxer = new JMuxer({
      node: 'stream',
      mode: 'both',
      debug: true,
      fps: format.fpsDenominator / format.fpsNumerator,
    });
    const muxStream = muxer.createStream();

    // Audio

    // Audio transcoding stream.
    const ffmpegAudioArgs = `-f s16le -ar 16000 -ac 1 -i - -f adts -c:a aac -`;
    console.log('FFMPEG Audio Args:', ffmpegAudioArgs);
    const ffmpegAudio = spawn('ffmpeg', ffmpegAudioArgs.split(/\s+/));
    ffmpegAudio.stdout.on('data', (data) => {
      muxer.feed({
        audio: new Uint8Array(data),
      });
    });
    ffmpegAudio.stderr.on('data', (data) => {
      console.error(`audio: ${data}`);
    });
    ffmpegAudio.on('close', (code) => {
      console.log(`audio ffmpeg exited with code ${code}`);
      muxStream.end();
    });

    // Audio input stream.
    const mic = new NodeMic({
      bitwidth: 16,
      endian: 'little',
      rate: 16000,
      channels: 1,
      threshold: 6,
      device: audioDevice,
    });
    const micStream = mic.getAudioStream();
    micStream.on('data', async (data) => {
      if (!ffmpegAudio.stdin.write(data)) {
        await new Promise((resolve) => {
          ffmpegAudio.stdin.once('drain', resolve);
        });
      }
    });
    micStream.on('error', (err) => {
      console.log(`mic error: ${err.message}`);
    });

    // Video

    // Video transcoding stream.
    const ffmpegVideoArgs = `${ffmpegInputOptions} -video_size ${
      format.width
    }x${format.height} -framerate ${
      format.fpsDenominator / format.fpsNumerator
    } -s:v ${format.width}x${format.height} -r:v ${
      format.fpsDenominator / format.fpsNumerator
    } -i - -f h264 -c:v libx264 -preset veryfast -tune zerolatency -crf 22 -bsf:v h264_mp4toannexb -`;
    console.log('FFMPEG Video Args:', ffmpegVideoArgs);
    const ffmpegVideo = spawn('ffmpeg', ffmpegVideoArgs.split(/\s+/));
    ffmpegVideo.stdout.on('data', (data) => {
      muxer.feed({
        video: new Uint8Array(data),
      });
    });
    ffmpegVideo.stderr.on('data', (data) => {
      console.error(`video: ${data}`);
    });
    ffmpegVideo.on('close', (code) => {
      console.log(`video ffmpeg exited with code ${code}`);
      muxStream.end();
    });

    // Muxer stream.
    muxStream.on('data', (data) => {
      if (!writeStream.write(data)) {
        ffmpegVideo.stdout.pause();
        ffmpegAudio.stdout.pause();
        writeStream.once('drain', () => {
          ffmpegVideo.stdout.resume();
          ffmpegAudio.stdout.resume();
        });
      }
    });
    muxStream.on('error', (data) => {
      console.error(`muxerr: ${data}`);
    });
    muxStream.on('close', () => {
      writeStream.end();
    });

    // Allocate memory-mapped buffers and turn the stream on
    cam.start(32);
    mic.start();

    for (let i = 0; i < 200; i++) {
      // Asynchronously wait until the camera fd is readable and then exchange
      // one of the memory-mapped buffers
      const frame = await cam.getNextFrame();

      // Truncate the buffer to the right image size if needed.
      let buffer = Buffer.from(
        !ffmpegTruncateFrame || frame.length === format.sizeImage
          ? frame
          : frame.subarray(0, format.sizeImage)
      );

      if (!ffmpegVideo.stdin.write(buffer)) {
        await new Promise((resolve) => {
          ffmpegVideo.stdin.once('drain', resolve);
        });
      }
    }

    // Turn the stream off and unmap all buffers.
    cam.stop();
    mic.stop();
    cam.close();

    // End the transcode streams.
    ffmpegVideo.stdin.end();
    ffmpegAudio.stdin.end();
  }

  main();
} catch (e: any) {
  console.error('Error:', e.message);
  process.exit(1);
}
