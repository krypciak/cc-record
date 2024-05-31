import ffmpeg from 'fluent-ffmpeg'
import CCRecord from './plugin'

export class CCAudioRecorder {
    private fragmentSize!: number
    private ffmpegInstance!: ffmpeg.FfmpegCommand
    private justKilledPolitely: boolean = false

    private finishPromise!: Promise<void>

    audioPath!: string

    constructor(public ccrecord: CCRecord) {}

    startRecording(fragmentSize: number, audioPath: string) {
        this.justKilledPolitely = false

        /* the fragment will end when CCVideoRecorder says so */
        fragmentSize += 5
        this.audioPath = audioPath

        this.fragmentSize = fragmentSize

        /* fix fluent-ffmpeg crashing */
        window.__dirname = process.cwd()

        if (process.platform == 'linux') {
            this.ffmpegInstance = this.recordLinux(audioPath, this.fragmentSize)
        }

        if (this.ffmpegInstance) {
            console.log(`${this.ccrecord.recordIndex}: started audio recording`)
        }
    }

    private recordLinux(outFilePath: string, duration: number): ffmpeg.FfmpegCommand {
        // ffmpeg -f pulse -i 71 -acodec copy output.wav
        //ffmpeg()
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
                console.log('Audio writing finished!')
                if (!this.justKilledPolitely) this.ccrecord.startNewFragment()
                resolve()
            })
            .duration(duration)
            .addOptions(['-f pulse', '-i 71', '-acodec copy'])
            .saveToFile(outFilePath)
    }

    async stopRecording() {
        this.justKilledPolitely = true
        this.ffmpegInstance.kill('SIGTERM')
        await this.finishPromise
    }

    async terminate() {
        this.ffmpegInstance.kill('SIGKILL')
    }
}
