import CCRecord from './plugin'

const automaticlyRecordId = 'ccrecordAutomaticlyRecord'
const uploadRecordingsId = 'ccrecordUploadRecordings'
const qualityId = 'ccrecordQuality'
const recordingKeybindingId = 'keys-ccrecordKeybinding'

type Opts = {
    [automaticlyRecordId]: Readonly<boolean>
    [uploadRecordingsId]: Readonly<boolean>
    [qualityId]: Readonly<number>
}

export const Opts = {} as Opts

export const qualitySliderData: Record<number, number> = {
    5: 4_000_000,
    4: 3_000_000,
    3: 2_000_000,
    2: 1_000_000,
    1: 500_000,
}

const headerId = 'recorder'
export function initOptionsPrestart(ccrecord: CCRecord) {
    sc.OPTIONS_DEFINITION[automaticlyRecordId] = {
        type: 'CHECKBOX',
        init: false,
        cat: sc.OPTION_CATEGORY.VIDEO,
        header: headerId,
        hasDivider: true,
    }
    Object.defineProperty(Opts, automaticlyRecordId, {
        get: () => sc.options.get(automaticlyRecordId),
    })

    sc.OPTIONS_DEFINITION[uploadRecordingsId] = {
        type: 'CHECKBOX',
        init: false,
        cat: sc.OPTION_CATEGORY.VIDEO,
        header: headerId,
    }
    Object.defineProperty(Opts, uploadRecordingsId, {
        get: () => sc.options.get(uploadRecordingsId),
    })

    sc.OPTIONS_DEFINITION[qualityId] = {
        type: 'OBJECT_SLIDER',
        init: 2,
        data: qualitySliderData,
        cat: sc.OPTION_CATEGORY.VIDEO,
        header: headerId,
    }
    Object.defineProperty(Opts, qualityId, {
        get: () => sc.options.get(qualityId),
    })

    sc.GlobalInput.inject({
        onPreUpdate() {
            this.parent()

            if (!ig.input.pressed(recordingKeybindingId)) return
            if (ccrecord.recording) {
                ccrecord.finalizeFragment()
                for (const e of ccrecord.recordingEventListeners) e(false)

                sc.BUTTON_SOUND.toggle_off.play()
            } else {
                ccrecord.startRecording()
                for (const e of ccrecord.recordingEventListeners) e(true)
                
                sc.BUTTON_SOUND.toggle_on.play()
            }
        },
    })
}
export function initOptionsPoststart() {
    ig.lang.labels.sc.gui.options.headers[headerId] = 'recorder'

    ig.lang.labels.sc.gui.options[automaticlyRecordId] = {
        name: 'Automaticly start recording',
        description: 'Start recording automaticly when game start',
    }
    ig.lang.labels.sc.gui.options[uploadRecordingsId] = {
        name: 'Automaticly upload recordings',
        description: 'Automaticly upload recordings to the CrossedEyes mod developer.',
    }
    ig.lang.labels.sc.gui.options[qualityId] = {
        name: 'Recording quality',
        description: 'The higher the number, the better the quality, but the higher the file size',
    }

    ig.input.bind(ig.KEY.F9, recordingKeybindingId)
}
