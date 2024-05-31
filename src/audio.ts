import { WritableAudioStream, audioClassesPrestart } from './audio-classes'

export async function audio() {
    audioClassesPrestart()
    const webAudio = new ig.FakeWebAudio()
    const stream = new WritableAudioStream()

    webAudio.context.pipe(stream)
    webAudio.context.resume()

    ig.SoundHandleWebAudio.inject({
        play(pos, settings) {
            // const ret = (this as any).parent(pos, settings)

            const backup_context = ig.soundManager.context
            const backup_playing = this._playing
            this._playing = false
            const backup_nodeSource = this._nodeSource
            this._nodeSource = null

            ig.soundManager.context = webAudio
            const ret = (this as any).parent(pos, settings)

            ig.soundManager.context = backup_context
            this._playing = backup_playing
            this._nodeSource = backup_nodeSource
            return ret
        },
    })
}
