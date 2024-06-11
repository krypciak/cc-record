const fs: typeof import('fs') = (0, eval)("require('fs')")
const path: typeof import('path') = (0, eval)("require('path')")

import ffmpeg from 'fluent-ffmpeg'
import { loadAsync } from 'jszip'

import CCRecord from './plugin'

export async function deleteFiles(...files: string[]) {
    return Promise.all(files.map(file => fs.promises.unlink(file)))
}

async function doesFileExist(path: string): Promise<boolean> {
    return new Promise(resolve => {
        fs.promises
            .stat(path)
            .then(() => resolve(true))
            .catch(_err => resolve(false))
    })
}

/* FFmpeg */
let ffmpegPath!: string

async function isFFmpegInstalledNow(): Promise<boolean> {
    ffmpegPath = `${CCRecord.baseDataPath}/ffmpeg.exe`
    /* fix fluent-ffmpeg crashing */
    window.__dirname = process.cwd()

    return new Promise<boolean>(resolve => {
        ffmpeg.getAvailableFormats((err, _formats) => {
            resolve(!err)
        })
    })
}

export async function isFFmpegInstalled(): Promise<boolean> {
    if (await isFFmpegInstalledNow()) return true

    if (!(await doesFileExist(ffmpegPath))) return false
    if (process.platform != 'win32') return false

    ffmpeg.setFfmpegPath(ffmpegPath)

    return isFFmpegInstalledNow()
}

async function unpackFileFromZip(data: ArrayBuffer, fileName: string, outFilePath: string) {
    const zip = await loadAsync(data)

    const file = Object.values(zip.files).find(file => path.basename(file.name) == fileName)
    if (!file) throw new Error(`unpackFileFromZip: File ${fileName} not found`)

    const fileData = await file.async('uint8array')
    return fs.promises.writeFile(outFilePath, fileData)
}

export async function installFFmpegWindows() {
    const ffmpegZipPath = `${CCRecord.baseDataPath}/temp/ffmpeg.zip`
    let data: ArrayBuffer
    if (!(await doesFileExist(ffmpegZipPath))) {
        const url = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip'
        const resp = await fetch(url)
        data = await resp.arrayBuffer()
    } else {
        data = await fs.promises.readFile(ffmpegZipPath)
    }

    return unpackFileFromZip(data, 'ffmpeg.exe', ffmpegPath)
}

/* Windows Desktop Audio Recorder (wdar) https://github.com/krypciak/windows-desktop-audio-recorder */
export let wdarPath: string

export async function isWdarInstalled(): Promise<boolean> {
    wdarPath = `${CCRecord.baseDataPath}/windows-desktop-audio-recorder.exe`
    return doesFileExist(wdarPath)
}

export async function installWdar() {
    const wdarZipPath = `${CCRecord.baseDataPath}/temp/windows-desktop-audio-recorder.zip`
    let data: ArrayBuffer
    if (!(await doesFileExist(wdarZipPath))) {
        const url =
            'https://github.com/krypciak/windows-desktop-audio-recorder/releases/download/v1.0.0/windows-desktop-audio-recorder.zip'
        const resp = await fetch(url)
        data = await resp.arrayBuffer()
    } else {
        data = await fs.promises.readFile(wdarZipPath)
    }

    return unpackFileFromZip(data, 'windows-desktop-audio-recorder.exe', wdarPath)
}

/* send_ctrl_c (scc) (used to stop wdar) https://gist.github.com/rdp/f51fb274d69c5c31b6be */

export let sccPath: string

export async function isSccInstalled(): Promise<boolean> {
    sccPath = `${CCRecord.baseDataPath}/send_ctrl_c.exe`
    return doesFileExist(sccPath)
}

export async function installScc() {
    let data: ArrayBuffer
    const url = 'https://github.com/krypciak/windows-desktop-audio-recorder/releases/download/v1.0.0/send_ctrl_c.exe'
    const resp = await fetch(url)
    data = await resp.arrayBuffer()

    return fs.promises.writeFile(sccPath, Buffer.from(data))
}
