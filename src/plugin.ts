import { Mod, PluginClass } from 'ultimate-crosscode-typedefs/modloader/mod'

export type Mod1 = Mod & {
    isCCModPacked: boolean
    findAllAssets?(): void /* only there for ccl2, used to set isCCL3 */
} & (
        | {
              isCCL3: true
              id: string
              findAllAssets(): void
          }
        | {
              isCCL3: false
              name: string
              filemanager: {
                  findFiles(dir: string, exts: string[]): Promise<string[]>
              }
              getAsset(path: string): string
              runtimeAssets: Record<string, string>
          }
    )

const fs: typeof import('fs') = (0, eval)("require('fs')")

import * as Mp4Muxer from 'mp4-muxer'
import { audio } from './audio'

export default class CCRecord implements PluginClass {
    static dir: string
    static mod: Mod1
    static baseDataPath: string

    constructor(mod: Mod1) {
        CCRecord.dir = mod.baseDirectory
        CCRecord.mod = mod
        CCRecord.mod.isCCL3 = mod.findAllAssets ? true : false
        CCRecord.mod.isCCModPacked = mod.baseDirectory.endsWith('.ccmod/')

        CCRecord.baseDataPath = `assets/mod-data/cc-record`
    }

    recording: boolean = true
    fps: number = 30

    lastFrameTime: number = 0
    frameNumber: number = 0

    fileWritePromises: Promise<void>[] = []
    canvas!: HTMLCanvasElement
    context!: CanvasRenderingContext2D
    drawing: boolean = false

    muxer!: Mp4Muxer.Muxer<Mp4Muxer.ArrayBufferTarget>
    videoEncoder!: VideoEncoder

    startDate!: number

    prestart(): void | Promise<void> {
        this.canvas = document.createElement('canvas') // document.getElementById('canvas')! as HTMLCanvasElement
        this.context = this.canvas.getContext('2d')!

        const self = this
        ig.Game.inject({
            draw() {
                this.parent()

                if (self.drawing || !self.recording) return
                const now = Date.now()
                if (self.lastFrameTime + 1000 / self.fps < now) {
                    self.takeScreenshot(now)
                    self.lastFrameTime = now
                }
            },
        })

        audio()
    }
    poststart(): void | Promise<void> {
        // this.initRecording()
    }

    takeScreenshot(now: number) {
        if (!this.videoEncoder) return

        this.drawFrameToCanvas(this.context)
        this.renderCanvasToVideoFrameAndEncode(this.canvas, this.videoEncoder, this.frameNumber, this.fps, now)
        this.frameNumber++

        if (this.frameNumber >= this.fps * 20) {
            this.finalizeVideo()
        }
    }

    async initRecording() {
        this.canvas.width = ig.system.width
        this.canvas.height = ig.system.height

        this.context = this.canvas.getContext('2d', {
            // Desynchronizes the canvas paint cycle from the event loop
            // Should be less necessary with OffscreenCanvas, but with a real canvas you will want this
            desynchronized: true,
        })!

        this.muxer = new Mp4Muxer.Muxer({
            target: new Mp4Muxer.ArrayBufferTarget(),

            video: {
                // If you change this, make sure to change the VideoEncoder codec as well
                codec: 'avc',
                width: this.canvas.width,
                height: this.canvas.height,
            },

            // mp4-muxer docs claim you should always use this with ArrayBufferTarget
            fastStart: 'in-memory',
        })

        this.videoEncoder = new VideoEncoder({
            output: (chunk, meta) => this.muxer.addVideoChunk(chunk, meta),
            error: e => console.error(e),
        })

        // This codec should work in most browsers
        // See https://dmnsgn.github.io/media-codecs for list of codecs and see if your browser supports
        this.videoEncoder.configure({
            // codec: 'avc1.42001f',
            codec: 'avc1.42003e',
            width: this.canvas.width,
            height: this.canvas.height,
            bitrate: 1_000_000,
            bitrateMode: 'variable',
            latencyMode: 'quality',
        })
    }

    async finalizeVideo() {
        this.recording = false
        // Forces all pending encodes to complete
        await this.videoEncoder.flush()

        this.muxer.finalize()

        let buffer = Buffer.from(this.muxer.target.buffer)

        const vidPath = `${CCRecord.baseDataPath}/vid.mp4`
        fs.promises.writeFile(vidPath, buffer).then(() => {
            console.log('written', vidPath)
        })
    }

    drawFrameToCanvas(ctx: CanvasRenderingContext2D) {
        const oldContext = ig.system.context
        const oldContextScale = ig.system.contextScale

        ig.system.context = ctx
        ig.system.contextScale = 1
        this.drawing = true

        ig.game.draw()

        ig.system.context = oldContext
        ig.system.contextScale = oldContextScale

        this.drawing = false
    }

    async renderCanvasToVideoFrameAndEncode(canvas: HTMLCanvasElement, videoEncoder: VideoEncoder, frameNumber: number, _fps: number, now: number) {
        // Equally spaces frames out depending on frames per second
        // const timestamp = frameNumber * 1e6) / fps

        let timestamp = (now - this.startDate) * 1000
        if (frameNumber == 0) {
            timestamp = 0
            this.startDate = now
        }
        let frame = new VideoFrame(canvas, {
            timestamp,
        })

        // The encode() method of the VideoEncoder interface asynchronously encodes a VideoFrame
        videoEncoder.encode(frame)

        // The close() method of the VideoFrame interface clears all states and releases the reference to the media resource.
        frame.close()
    }
}
