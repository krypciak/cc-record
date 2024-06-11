import ffmpeg, { FfmpegCommand } from 'fluent-ffmpeg'
import CCRecord from './plugin'
import { sccPath, wdarPath } from './fs-misc'

type Killable = {
    kill(...args: any[]): void
}

const exec = (require('child_process') as typeof import('child_process')).exec

export class CCAudioRecorder {
    private fragmentSize!: number
    private justKilledPolitely: boolean = false

    private childProcess?: Killable

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
            this.childProcess = await this.recordLinux(audioPath, this.fragmentSize)
        } else if (process.platform == 'win32') {
            this.childProcess = await this.recordWindows(audioPath, this.fragmentSize)
        }

        if (CCRecord.log) console.log(`${this.ccrecord.recordIndex}: started audio recording`)
    }

    private async recordLinux(outFilePath: string, duration: number): Promise<FfmpegCommand> {
        async function getActiveSource(): Promise<number> {
            return new Promise<number>(resolve => {
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

    private async recordWindows(outFilePath: string, duration: number): Promise<Killable> {
        let resolve: () => void
        this.finishPromise = new Promise<void>(r => {
            resolve = r
        })

        const child = exec(
            `.\\${wdarPath.replace(/\//g, '\\')} --output ${outFilePath} --time ${duration}`,
            (_error: any, _stdout: string, _stderr: any) => {
                // console.log('\nerror: ', _error, '\nstdout: ', _stdout, '\n_stderr: ', _stderr)
                resolve()
            }
        )
        return {
            kill(msg: string, ..._args) {
                if (msg == 'SIGTERM') {
                    exec(`.\\${sccPath.replace(/\//g, '\\')} ${child.pid}`)
                } else if (msg == 'SIGKILL') {
                    exec(`taskkill /im windows-desktop-audio-recorder.exe /t /f`)
                }
            },
        }
    }

    async stopRecording() {
        this.justKilledPolitely = true
        this.childProcess?.kill('SIGTERM')

        await this.finishPromise
    }

    async terminate() {
        this.childProcess?.kill('SIGKILL')
    }
}
