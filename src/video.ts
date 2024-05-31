import CCRecord from './plugin'

import * as Mp4Muxer from 'mp4-muxer'
const fs: typeof import('fs') = (0, eval)("require('fs')")

export class CCVideoRecorder {
    private lastFrameTime!: number
    private frameNumber!: number

    private canvas!: HTMLCanvasElement
    private context!: CanvasRenderingContext2D
    private drawing: boolean = false

    private muxer!: Mp4Muxer.Muxer<Mp4Muxer.ArrayBufferTarget>
    private muxerFinalized!: boolean
    private videoEncoder!: VideoEncoder

    private startDate!: number

    private fps!: number
    videoPath!: string

    constructor(public ccrecord: CCRecord) {
        this.canvas = document.createElement('canvas')

        const self = this
        ig.Game.inject({
            draw() {
                this.parent()

                if (self.drawing || !self.ccrecord.recording) return
                const now = Date.now()
                if (self.lastFrameTime + 1000 / self.fps < now) {
                    self.drawAndPushNewFrame(now)
                    self.lastFrameTime = now
                }
            },
        })
    }

    async startRecording(_fragmentSize: number, videoPath: string, bitrate: number, fps: number) {
        this.fps = fps
        this.videoPath = videoPath
        this.muxerFinalized = false
        this.frameNumber = 0
        this.lastFrameTime = 0

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
            bitrate,
            bitrateMode: 'variable',
            latencyMode: 'quality',
        })

        console.log(`${this.ccrecord.recordIndex}: started video recording`)
    }

    private drawAndPushNewFrame(now: number) {
        if (!this.videoEncoder) return

        this.drawFrameToCanvas(this.context)
        this.renderCanvasToVideoFrameAndEncode(this.canvas, this.videoEncoder, this.frameNumber, this.fps, now)
        this.frameNumber++
    }

    private async finalizeRecording() {
        // Forces all pending encodes to complete
        await this.videoEncoder.flush()

        if (!this.muxerFinalized) {
            this.muxerFinalized = true
            this.muxer.finalize()
        }
    }

    async stopRecording() {
        await this.finalizeRecording()
        const buffer = Buffer.from(this.muxer.target.buffer)

        return fs.promises.writeFile(this.videoPath, buffer)
    }

    terminate() {
        this.finalizeRecording()
    }

    private drawFrameToCanvas(ctx: CanvasRenderingContext2D) {
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

    private async renderCanvasToVideoFrameAndEncode(
        canvas: HTMLCanvasElement,
        videoEncoder: VideoEncoder,
        frameNumber: number,
        _fps: number,
        now: number
    ) {
        // Equally spaces frames out depending on frames per second
        // const timestamp = frameNumber * 1e6) / fps

        let timestamp = (now - this.startDate) * 1000
        if (frameNumber == 0) {
            timestamp = 0
            this.startDate = now
        }
        const frame = new VideoFrame(canvas, { timestamp })

        // The encode() method of the VideoEncoder interface asynchronously encodes a VideoFrame
        videoEncoder.encode(frame)

        // The close() method of the VideoFrame interface clears all states and releases the reference to the media resource.
        frame.close()
    }
}
