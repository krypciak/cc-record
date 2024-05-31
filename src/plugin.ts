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

import { CCAudioRecorder } from './audio'
import { CCVideoRecorder } from './video'

import ffmpeg from 'fluent-ffmpeg'
const fs: typeof import('fs') = (0, eval)("require('fs')")

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

    videoRecorder!: CCVideoRecorder
    audioRecorder!: CCAudioRecorder

    prestart(): void | Promise<void> {
        this.videoRecorder = new CCVideoRecorder(this)
        this.audioRecorder = new CCAudioRecorder(this)
    }

    poststart(): void | Promise<void> {
        this.startRecording()
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
        this.videoRecorder.startRecording(fragmentSize, vidPath, 1_000_000, 30)

        const audioPath = `${CCRecord.baseDataPath}/audio${this.recordIndex}.wav`
        this.audioRecorder.startRecording(fragmentSize, audioPath)
    }

    async stopRecording() {
        this.recording = false
        await Promise.all([this.videoRecorder.stopRecording(), this.audioRecorder.stopRecording()])
    }

    async terminateAll() {
        if (this.terminated) return

        console.log('termintaing all!!')
        this.terminated = true
        this.recording = false
        await Promise.all([this.videoRecorder.terminate(), this.audioRecorder.terminate()])
    }

    /** it's called from CCVideoRecorder#drawAndPushNewFrame */
    async startNewFragment() {
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
        // if (this.recordIndex >= 1) return
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
