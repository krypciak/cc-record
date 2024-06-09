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

/** does not require administrator privilages */
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

// private testCommandReturnStats(command: string): Promise<boolean> {
//     const { exec } = require('child_process')
//
//     return new Promise(resolve => {
//         exec(command, { encoding: 'utf8' }, (error: any, stdout: any) => {
//             console.log(error, stdout)
//             return !error
//         })
//     })
// }
