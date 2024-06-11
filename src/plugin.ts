import { PluginClass } from 'ultimate-crosscode-typedefs/modloader/mod'
import type { Mod1 } from 'ccmodmanager/types/types'
import { Opts, registerOpts } from './options'
import { CCAudioRecorder } from './audio'
import { CCVideoRecorder } from './video'
import { postLinkToRequestBin, uploadFile } from './upload'
import {
    deleteFiles,
    installFFmpegWindows,
    installScc,
    installWdar,
    isFFmpegInstalled,
    isSccInstalled,
    isWdarInstalled as isWdarInstalled,
} from './fs-misc'

import ffmpeg from 'fluent-ffmpeg'

const fs: typeof import('fs') = (0, eval)("require('fs')")

declare global {
    namespace sc {
        var ccrecord: CCRecord
    }
}

export default class CCRecord implements PluginClass {
    static dir: string
    static mod: Mod1
    static baseDataPath: string
    static log: boolean = true

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

        fs.promises.mkdir(`${CCRecord.baseDataPath}/temp`, { recursive: true })
        fs.promises.mkdir(`${CCRecord.baseDataPath}/video`, { recursive: true })
    }

    canLoad: boolean = !!window.VideoEncoder
    videoRecorder!: CCVideoRecorder
    audioRecorder!: CCAudioRecorder

    prestart(): void | Promise<void> {
        if (!this.canLoad) {
            console.error('cc-record requires NW.js >= v0.57.0')
            return
        }

        registerOpts(this)

        this.videoRecorder = new CCVideoRecorder(this)
        this.audioRecorder = new CCAudioRecorder(this)
    }

    poststart(): void | Promise<void> {
        if (!this.canLoad) return

        if (Opts.automaticlyRecord) {
            this.initialRecordStart()
        }
    }

    recordIndex: number = 0
    recording: boolean = false
    terminated: boolean = false

    private playTerminatedSound() {
        setTimeout(() => {
            sc.BUTTON_SOUND.denied.play()
            setTimeout(() => {
                sc.BUTTON_SOUND.denied.play()
                setTimeout(() => {
                    sc.BUTTON_SOUND.denied.play()
                }, 100)
            }, 100)
        }, 300)
    }

    private async installNecceseryPrograms() {
        const promises: Promise<void>[] = []
        if (!(await isFFmpegInstalled())) {
            if (process.platform == 'win32') {
                promises.push(installFFmpegWindows())
            } else {
                sc.Dialogs.showErrorDialog('FFmpeg is not installed.\ncc-record cannot work without FFmpeg installed.')
                this.terminated = true
                return
            }
        }

        if (process.platform == 'win32') {
            if (!(await isWdarInstalled())) {
                promises.push(installWdar())
            }
            if (!(await isSccInstalled())) {
                promises.push(installScc())
            }
        }
        await Promise.all(promises)
    }

    async initialRecordStart() {
        await this.installNecceseryPrograms()

        if (this.terminated) {
            this.playTerminatedSound()
            return
        }

        this.startRecording()
    }

    private async startRecording() {
        if (this.terminated) return
        this.recording = true

        /** in seconds */
        const fragmentSize = 60 * 1

        const vidPath = `${CCRecord.baseDataPath}/temp/video${this.recordIndex}.mp4`
        const videoBitrate = Opts.quality
        this.videoRecorder.startRecording(fragmentSize, vidPath, videoBitrate, 30)

        let audioPath = `${CCRecord.baseDataPath}/temp/audio${this.recordIndex}.`
        if (process.platform == 'win32') audioPath += 'mp3'
        else if (process.platform == 'linux') audioPath += 'wav'
        this.audioRecorder.startRecording(fragmentSize, audioPath)
    }

    async stopRecording() {
        this.recording = false

        await Promise.all([this.videoRecorder.stopRecording(), this.audioRecorder.stopRecording()])
    }

    async terminateAll() {
        this.playTerminatedSound()
        if (this.terminated) return
        this.terminated = true

        this.recording = false
        for (const e of this.recordingEventListeners) e(false)

        if (CCRecord.log) console.log('termintaing all!!')
        await Promise.all([this.videoRecorder.terminate(), this.audioRecorder.terminate()])
    }

    async finalizeFragment() {
        if (this.terminated) return
        await this.stopRecording()

        const index = this.recordIndex
        const videoPath = this.videoRecorder.videoPath
        const audioPath = this.audioRecorder.audioPath

        let date = new Date().toJSON()
        date = date.substring(0, date.length - 5).replace(/:/g, '-')
        const outPath = `${CCRecord.baseDataPath}/video/${date}-${index}.mp4`
        this.combineVideoAndAudio(this.videoRecorder.videoPath, this.audioRecorder.audioPath, outPath)
            .catch(err => {
                console.log(`${index}: Combining: An error occurred:`, err.message)
                this.terminateAll()
            })
            .then(() => {
                if (CCRecord.log) console.log(`${index}: Combining files finished!`)
                deleteFiles(videoPath, audioPath)

                if (!Opts.uploadRecordings) return

                uploadFile(outPath).then(videoUrl => {
                    console.log('uploaded recording to', videoUrl)
                    postLinkToRequestBin(videoUrl).then(() => {
                        if (CCRecord.log) console.log('posted')
                    })
                })
            })

        this.recordIndex++
    }

    async startNewFragment() {
        if (this.terminated) return
        await this.finalizeFragment()

        // if (this.recordIndex >= 1) return
        this.startRecording()
    }

    async combineVideoAndAudio(videoPath: string, audioPath: string, outPath: string) {
        // console.log('combining', videoPath, 'and', audioPath)

        return new Promise<void>((resolve, reject) => {
            ffmpeg()
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
}
