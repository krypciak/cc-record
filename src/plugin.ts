import { PluginClass } from 'ultimate-crosscode-typedefs/modloader/mod'
import { Opts, initOptionsPoststart, initOptionsPrestart, qualitySliderData } from './options'
import { CCAudioRecorder } from './audio'
import { CCVideoRecorder } from './video'

import ffmpeg from 'fluent-ffmpeg'
import { Mod1 } from './types'
const fs: typeof import('fs') = (0, eval)("require('fs')")

export default class CCRecord implements PluginClass {
    static dir: string
    static mod: Mod1
    static baseDataPath: string

    /** also used by CrossedEyes */
    recordingEventListeners: ((status: boolean) => void)[] = []

    constructor(mod: Mod1) {
        CCRecord.dir = mod.baseDirectory
        CCRecord.mod = mod
        CCRecord.mod.isCCL3 = mod.findAllAssets ? true : false
        CCRecord.mod.isCCModPacked = mod.baseDirectory.endsWith('.ccmod/')

        CCRecord.baseDataPath = `assets/mod-data/cc-record`

        window.sc ??= {} as any
        sc.ccrecord = this
    }

    videoRecorder!: CCVideoRecorder
    audioRecorder!: CCAudioRecorder

    prestart(): void | Promise<void> {
        initOptionsPrestart(this)

        this.videoRecorder = new CCVideoRecorder(this)
        this.audioRecorder = new CCAudioRecorder(this)
    }

    poststart(): void | Promise<void> {
        initOptionsPoststart()
        if (Opts.ccrecordAutomaticlyRecord) {
            this.startRecording()
        }
    }

    recordIndex: number = 0
    recording: boolean = false
    terminated: boolean = false

    async startRecording() {
        if (this.terminated) return

        this.recording = true

        /** in seconds */
        const fragmentSize = 60 * 5

        const vidPath = `${CCRecord.baseDataPath}/video${this.recordIndex}.mp4`
        const videoBitrate = qualitySliderData[Opts.ccrecordQuality]
        console.log(videoBitrate)
        this.videoRecorder.startRecording(fragmentSize, vidPath, videoBitrate, 30)

        const audioPath = `${CCRecord.baseDataPath}/audio${this.recordIndex}.wav`
        this.audioRecorder.startRecording(fragmentSize, audioPath)
    }

    async stopRecording() {
        this.recording = false

        await Promise.all([this.videoRecorder.stopRecording(), this.audioRecorder.stopRecording()])
    }

    async terminateAll() {
        if (this.terminated) return
        this.terminated = true

        this.recording = false
        for (const e of this.recordingEventListeners) e(false)

        console.log('termintaing all!!')
        await Promise.all([this.videoRecorder.terminate(), this.audioRecorder.terminate()])
    }

    async finalizeFragment() {
        if (this.terminated) return
        await this.stopRecording()

        const index = this.recordIndex
        const videoPath = this.videoRecorder.videoPath
        const audioPath = this.audioRecorder.audioPath
        const outPath = `${CCRecord.baseDataPath}/final${index}.mp4`
        this.combineVideoAndAudio(this.videoRecorder.videoPath, this.audioRecorder.audioPath, outPath)
            .catch(err => {
                console.log(`${index}: Combining: An error occurred:`, err.message)
                this.terminateAll()
            })
            .then(() => {
                console.log(`${index}: Combining files finished!`)
                this.deleteFiles(videoPath, audioPath)
            })

        this.recordIndex++
    }

    /** it's called from CCVideoRecorder#drawAndPushNewFrame */
    async startNewFragment() {
        if (this.terminated) return
        await this.finalizeFragment()

        if (this.recordIndex >= 1) return
        this.startRecording()
    }

    async combineVideoAndAudio(videoPath: string, audioPath: string, outPath: string) {
        // console.log('combining', videoPath, 'and', audioPath)

        let cmd: ffmpeg.FfmpegCommand
        return new Promise<void>((resolve, reject) => {
            cmd = ffmpeg()
                .on('error', function (err) {
                    reject(err)
                })
                .on('end', function () {
                    resolve()
                })
                .addOptions([
                    `-i ${videoPath}`,
                    `-i ${audioPath}`,
                    '-c:v copy',
                    '-c:a aac',
                    '-hide_banner',
                    '-loglevel warning',
                ])
                .saveToFile(outPath)
        })
    }

    async deleteFiles(...files: string[]) {
        return Promise.all(files.map(file => fs.promises.unlink(file)))
    }
}
