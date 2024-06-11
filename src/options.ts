import type { Options } from 'ccmodmanager/types/mod-options'
import CCRecord from './plugin'

export const qualitySliderData: Record<number, number> = {
    5: 4_000_000,
    4: 3_000_000,
    3: 2_000_000,
    2: 1_000_000,
    1: 500_000,
}

export let Opts: ReturnType<typeof modmanager.registerAndGetModOptions<ReturnType<typeof registerOpts>>>

export function registerOpts(ccrecord: CCRecord) {
    const opts = {
        general: {
            settings: {
                title: 'General',
                tabIcon: 'general',
            },
            headers: {
                general: {
                    automaticlyRecord: {
                        type: 'CHECKBOX',
                        init: false,
                        name: 'Automaticly start recording',
                        description: 'Start recording automaticly when game start',
                    },
                    uploadRecordings: {
                        type: 'CHECKBOX',
                        init: false,

                        name: 'Upload recordings',
                        description: 'Automaticly upload recordings to the CrossedEyes mod developer.',
                    },
                    quality: {
                        type: 'OBJECT_SLIDER',
                        data: qualitySliderData,
                        init: qualitySliderData[2],

                        name: 'Recording quality',
                        description: 'The higher the number, the better the quality, but the higher the file size',
                    },
                    recordKeybinding: {
                        type: 'CONTROLS',
                        init: { key1: ig.KEY.F9 },
                        global: true,
                        hidden: true,

                        pressEvent() {
                            if (ccrecord.recording) {
                                ccrecord.finalizeFragment()
                                for (const e of ccrecord.recordingEventListeners) e(false)

                                sc.BUTTON_SOUND.toggle_off.play()
                            } else {
                                ccrecord.initialRecordStart()
                                for (const e of ccrecord.recordingEventListeners) e(true)

                                sc.BUTTON_SOUND.toggle_on.play()
                            }
                        },

                        name: 'Toggle recording',
                        description: 'Turns on/off the recording.',
                    },
                },
            },
        },
    } as const satisfies Options

    Opts = modmanager.registerAndGetModOptions(
        {
            modId: 'cc-record',
            title: 'cc-record',
            // helpMenu: Lang.help.options,
        },
        opts
    )
    return opts
}
