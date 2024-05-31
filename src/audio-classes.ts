import * as wae from '@descript/web-audio-js'

export class CustomAudioContext extends wae.StreamAudioContext {
    constructor() {
        super()
    }
}

export class WritableAudioStream implements WritableStream {
    locked: boolean = false

    getWriter(): WritableStreamDefaultWriter<any> {
        return new WritableStreamDefaultWriter(this)
    }

    async write(chunk: Buffer) {
        const view = new Uint8Array(chunk)
        for (let i = 0; i < view.length; i++) {
            if (view[i] != 0) {
                console.log('WritableAudioStream write:', view)
                return
            }
        }
        // return new Promise((resolve, reject) => {
        //     // const buffer = new ArrayBuffer(1)
        //     // const view = new Uint8Array(buffer)
        //     // view[0] = chunk
        //     // const decoded = decoder.decode(view, { stream: true })
        //     // const listItem = document.createElement('li')
        //     // listItem.textContent = `Chunk decoded: ${decoded}`
        //     // list.appendChild(listItem)
        //     // result += decoded
        //     resolve()
        // })
    }
    async close() {
        console.log('WritableAudioStream close')
        // const listItem = document.createElement('li')
        // listItem.textContent = `[MESSAGE RECEIVED] ${result}`
        // list.appendChild(listItem)
    }
    async abort(err: any) {
        console.error('WritableAudioStream abort:', err)
    }

    constructor() {
        // const queuingStrategy = new CountQueuingStrategy({ highWaterMark: 1 })
    }
}

/* ---------------- */
declare global {
    namespace ig {
        // @ts-expect-error
        interface FakeWebAudio extends ig.WebAudio {
            context: CustomAudioContext

            createBufferGain(
                this: this,
                buffer: wae.impl.AudioBufferSourceNode,
                volume?: number,
                playbackRate?: number
            ): ig.FakeWebAudioBufferGain
        }
        interface FakeWebAudioConstructor extends ImpactClass<FakeWebAudio> {
            new (): ig.FakeWebAudio
        }
        var FakeWebAudio: FakeWebAudioConstructor
    }
}
function init_ig_FakeWebAudio() {
    ig.FakeWebAudio = ig.WebAudio.extend({
        createBufferGain(buffer: wae.impl.AudioBufferSourceNode, volume?: number, playbackRate?: number) {
            return new ig.FakeWebAudioBufferGain(this.context, buffer, volume, playbackRate)
        },
        _createContext() {
            return new CustomAudioContext()
        },
    })
}
/* ---------------- */
declare global {
    namespace ig {
        // @ts-expect-error
        interface FakeWebAudioBufferGain extends ig.WebAudioBufferGain {
            context: CustomAudioContext
            bufferNode: wae.api.AudioBufferSourceNode
            gainNode: wae.api.GainNode
        }
        interface FakeWebAudioBufferGainConstructor extends ImpactClass<FakeWebAudioBufferGain> {
            new (
                context: CustomAudioContext,
                buffer: wae.impl.AudioBufferSourceNode,
                volume?: number,
                playbackRate?: number
            ): ig.FakeWebAudioBufferGain
        }
        var FakeWebAudioBufferGain: FakeWebAudioBufferGainConstructor
    }
}
function init_ig_FakeWebAudioBufferGain() {
    ig.FakeWebAudioBufferGain = ig.Class.extend({
        init(context, buffer, volume, playbackRate) {
            this.context = context
            this.bufferNode = this.context.createBufferSource()
            this.bufferNode.buffer = buffer
            this.bufferNode.playbackRate.value = playbackRate || 1
            this.gainNode = this.context.createGain()
            volume !== void 0 && this.setVolume(volume)
            this.bufferNode.connect(this.gainNode)
        },
        connect(node) {
            this.gainNode.connect(node)
        },
        disconnect(node) {
            this.gainNode!.disconnect(node)
        },
        setLoop(loop) {
            this.bufferNode.loop = loop
        },
        setVolume(volume) {
            this.gainNode!.gain.value = volume
        },
        play(when, offset) {
            const bufferNode = this.bufferNode
            if (!bufferNode.playbackState) {
                offset < 0 && (offset = 0)
                bufferNode.start ? bufferNode.start(when || 0, offset || 0) : bufferNode.noteOn(when || 0, offset || 0)
            }
        },
        stop(node) {
            var b = this.bufferNode
            b.playbackState && (b.stop ? b.stop(node) : b.noteOff(node))
        },
    })
}
/* ---------------- */
function inject_ig_SoundManager() {
    ig.SoundManager.inject({
        connectSound(connectObj) {
            if (!(connectObj instanceof ig.FakeWebAudioBufferGain)) return this.parent(connectObj)

            if (connectObj) {
                connectObj.connect(connectObj.gainNode)
            }

            console.log('ig.SoundManager#connectSound', connectObj)
        },
    })
}

export function audioClassesPrestart() {
    init_ig_FakeWebAudio()
    init_ig_FakeWebAudioBufferGain()
    inject_ig_SoundManager()
}
