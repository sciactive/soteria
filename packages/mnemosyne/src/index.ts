import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { program } from 'commander';
import updateNotifier from 'update-notifier';
import LibAV from '@soteria/libav.js';
import { Camera } from 'v4l2-camera-ts';
import {
  load as LibAVWebCodecsLoad,
  VideoEncoder,
  VideoFrame,
  AudioEncoder,
} from 'libavjs-webcodecs-polyfill';
import { Muxer, StreamTarget } from 'webm-muxer';
import './CustomEventPolyfill.js';
import './GeometryPolyfills.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'package.json')).toString()
);

type Conf = {
  server: string;
  updateCheck: boolean;
};

program
  .name(pkg.name)
  .description(pkg.description)
  .version(pkg.version, '-v, --version', 'Print the current version');

// program.command('list-codecs').action(async () => {
//   const libav = await LibAV.LibAV();

//   let descriptor = await libav.avcodec_descriptor_next(0);

//   while (descriptor != 0) {
//     // const id = await libav.avcodec_find_encoder(descriptor);
//     // const name = await libav.avcodec_get_name(descriptor);
//     console.log(descriptor);
//     descriptor = await libav.avcodec_descriptor_next(descriptor);
//   }

//   process.exit(0);
// });

program
  .option('-s, --server <host>', 'The address of the WebDAV server.')
  .option('--no-update-check', "Don't check for updates.");

program.addHelpText(
  'after',
  `
Environment Variables:
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
  async function main() {
    // Parse args.
    await program.parseAsync();
    const options = program.opts();
    let { server, updateCheck } = {
      server: process.env.SERVER,
      updateCheck: !['false', 'off', '0'].includes(
        (process.env.UPDATE_CHECK || '').toLowerCase()
      ),
      ...options,
    } as Conf;

    if (updateCheck) {
      updateNotifier({ pkg }).notify({ defer: false });
    }

    if (server == null) {
      throw new Error('WebDAV server address is required.');
    }

    // var wasmdataurl =
    //   'data:application/wasm;base64,' +
    //   (await fsp.readFile(wasmurl)).toString('base64');
    // var wasmfileurl = 'file://' + wasmurl;

    await LibAVWebCodecsLoad({
      LibAV: LibAV,
      polyfill: false,
      libavOptions: {
        noworker: true,
        nowasm: true,
        // variant: 'vp9-opus',
        // wasmurl: wasmfileurl,
      },
    });

    const cam = new Camera();

    cam.open('/dev/video2');

    // the format can only be set before starting
    cam.setFormat({
      width: 1280,
      height: 720,
      pixelFormatStr: 'YU12',
      // pixelFormatStr: 'YV12',
      // pixelFormatStr: 'YUYV',
      // pixelFormatStr: '422P',
      fps: { numerator: 1, denominator: 10 },
    });
    // const fmt = new v4l2_format();
    // fmt.type = v4l2_buf_type.V4L2_BUF_TYPE_VIDEO_CAPTURE;

    // fmt.fmt.pix.width = 1280;
    // fmt.fmt.pix.height = 720;
    // fmt.fmt.pix.pixelformat = format.stringToFourcc('YUYV');

    // // @ts-ignore
    // v4l2_ioctl(cam._fd, ioctl.VIDIOC_S_FMT, fmt.ref());

    // const parm = new v4l2_streamparm();

    // parm.type = v4l2_buf_type.V4L2_BUF_TYPE_VIDEO_CAPTURE;
    // parm.parm.capture.timeperframe.numerator = 1;
    // parm.parm.capture.timeperframe.denominator = 30;

    // // @ts-ignore
    // v4l2_ioctl(cam._fd, ioctl.VIDIOC_S_PARM, parm.ref());

    const format = cam.queryFormat();
    console.log(format);

    // allocate memory-mapped buffers and turn the stream on
    cam.start(32);

    const fhandle = await fsp.open(`./test/video.webm`, 'w');
    const writeStream = fhandle.createWriteStream();

    let currentPosition = 0;
    let muxer = new Muxer({
      target: new StreamTarget({
        chunked: false,
        onHeader(data, position) {
          if (position !== currentPosition) {
            console.log('out of position header');
          }
          console.log('header', { position });
          currentPosition += data.length;
          writeStream.write(data);
        },
        onData(data, position) {
          if (position !== currentPosition) {
            console.log('out of position data');
          }
          console.log('data', { position });
          currentPosition += data.length;
          writeStream.write(data);
        },
        onCluster(data, position, timestamp) {
          if (position !== currentPosition) {
            console.log('out of position cluster');
          }
          console.log('cluster', { position, timestamp });
          currentPosition += data.length;
          writeStream.write(data);
        },
      }),
      video: {
        codec: 'V_VP9',
        width: format.width,
        height: format.height,
      },
      streaming: false,
      type: 'webm',
    });

    let videoEncoder = new VideoEncoder({
      output: (chunk, meta) => {
        muxer.addVideoChunk(chunk, meta as EncodedVideoChunkMetadata);
      },
      error: (e) => console.error(e),
    });

    videoEncoder.configure({
      codec: 'vp09.00.41.08.0',
      // codec: 'vp09.01.41.08.2',

      width: format.width,
      height: format.height,
      bitrate: 3000 * 1000,
      framerate: format.fpsDenominator / format.fpsNumerator,
      BitrateMode: 'constant',

      hardwareAcceleration: 'prefer-hardware',
      latencyMode: 'realtime',
    });

    for (let i = 0; i < 200; i++) {
      // asynchronously wait until the camera fd is readable
      // and then exchange one of the memory-mapped buffers
      console.log(i, 'start');
      const frame = await cam.getNextFrame();
      console.log(i, 'after frame');

      const videoFrame = new VideoFrame(Buffer.from(frame), {
        format: 'I420',
        // format: 'I422',
        colorSpace: {
          transfer: 'bt709',
        },
        codedWidth: format.width,
        codedHeight: format.height,
        timestamp: Math.floor(
          i * ((format.fpsNumerator / format.fpsDenominator) * 1000000)
        ),
        duration: Math.floor(
          (format.fpsNumerator / format.fpsDenominator) * 1000000
        ),
      });
      console.log(i, 'after videoframe');

      videoEncoder.encode(videoFrame);
      console.log(i, 'after encode');

      // if (i % 24) {
      //   cam.stop();
      //   cam.start();
      //   console.log(i, 'after restart cam');
      // }
    }

    // turn the stream off and unmap all buffers
    cam.stop();
    cam.close();

    console.log('flushing');
    await videoEncoder.flush();

    console.log('finalizing');
    muxer.finalize();

    writeStream.end();

    // let { buffer } = muxer.target; // Buffer contains final MP4 file
    // await fsp.writeFile(`./test/video.webm`, new Uint8Array(buffer));
  }

  main();
} catch (e: any) {
  console.error('Error:', e.message);
  process.exit(1);
}
