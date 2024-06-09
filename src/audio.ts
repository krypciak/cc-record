import ffmpeg from 'fluent-ffmpeg'
import CCRecord from './plugin'

export class CCAudioRecorder {
    private fragmentSize!: number
    private ffmpegInstance!: ffmpeg.FfmpegCommand
    private justKilledPolitely: boolean = false

    private finishPromise!: Promise<void>

    audioPath!: string

    constructor(public ccrecord: CCRecord) {}

    async startRecording(fragmentSize: number, audioPath: string) {
        this.justKilledPolitely = false

        /* the fragment will end when CCVideoRecorder says so */
        fragmentSize += 5
        this.audioPath = audioPath

        this.fragmentSize = fragmentSize

        if (process.platform == 'linux') {
            this.ffmpegInstance = await this.recordLinux(audioPath, this.fragmentSize)
        }

        if (this.ffmpegInstance) {
            if (CCRecord.log) console.log(`${this.ccrecord.recordIndex}: started audio recording`)
        }
    }

    private async recordLinux(outFilePath: string, duration: number): Promise<ffmpeg.FfmpegCommand> {
        // ffmpeg -f pulse -i 71 -acodec copy output.wav
        //ffmpeg()
        async function getActiveSource(): Promise<number> {
            return new Promise<number>(resolve => {
                const { exec } = require('child_process')
                const command = `pactl list short sources | grep 'RUNNING' | awk '{print $1}' | head --lines 1`

                exec(command, (_error: any, stdout: any, _stderr: any) => {
                    resolve(Number(stdout))
                })
            })
        }
        const sourceId = await getActiveSource()

        let resolve: () => void
        this.finishPromise = new Promise<void>(r => {
            resolve = r
        })
        return ffmpeg()
            .on('error', err => {
                if (this.justKilledPolitely && !this.ccrecord.terminated) {
                    resolve()
                } else {
                    console.log('Audio recording: An error occurred: ' + err.message)
                    this.ccrecord.terminateAll()
                }
            })
            .on('end', () => {
                if (CCRecord.log) console.log('Audio writing finished!')
                if (!this.justKilledPolitely) this.ccrecord.startNewFragment()
                resolve()
            })
            .duration(duration)
            .addOptions(['-f pulse', `-i ${sourceId}`, '-acodec copy'])
            .saveToFile(outFilePath)
    }

    async stopRecording() {
        this.justKilledPolitely = true
        this.ffmpegInstance?.kill('SIGTERM')
        await this.finishPromise
    }

    async terminate() {
        this.ffmpegInstance?.kill('SIGKILL')
    }
}
