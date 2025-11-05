import { test } from 'node:test'
import { deepStrictEqual, strictEqual } from 'node:assert'
import { cleanFilename, sha1 } from './lib.js'
import { buffer } from 'node:stream/consumers'
import mime from 'mime'

const hostpath = `http://127.0.0.1:32109`

test('upload-file', async () => {
    // node --test-name-pattern="^upload-file$" src/lib.test.js
    const filename = 'abc.txt'
    const data = Buffer.from('1234567890')
    const response = await fetch(`${hostpath}/upload`, {
        method: 'PUT',
        headers: {
            'x-filename': filename
        },
        body: data
    })
    const ret = await response.json()
    strictEqual(response.status, 200)
    strictEqual(ret.name, filename)
    strictEqual(ret.size, data.length)
    strictEqual(ret.sha1, sha1(data))
    strictEqual(ret.url, `${hostpath}/download/${sha1(data)}`)
})

test('download-file', async () => {
    // node --test-name-pattern="^download-file$" src/lib.test.js
    const filename = 'abc.txt'
    const data = Buffer.from('1234567890')
    const uploadResponse = await fetch(`${hostpath}/upload`, {
        method: 'PUT',
        headers: {
            'x-filename': filename
        },
        body: data
    })
    const uploadRet = await uploadResponse.json()
    const sha1Hash = uploadRet.sha1

    const downloadResponse = await fetch(`${hostpath}/download/${sha1Hash}`)
    const downloadedData = await buffer(downloadResponse.body)
    strictEqual(downloadResponse.status, 200)
    strictEqual(downloadResponse.headers.get('content-disposition'), `attachment; filename="${filename}"`)
    deepStrictEqual(downloadedData, data)
})

test('find-file-info', async () => {
    // node --test-name-pattern="^find-file-info$" src/lib.test.js
    const filename = 'abc.txt'
    const data = Buffer.from('1234567890')
    const uploadResponse = await fetch(`${hostpath}/upload`, {
        method: 'PUT',
        headers: {
            'x-filename': filename
        },
        body: data
    })
    const uploadRet = await uploadResponse.json()
    const sha1Hash = uploadRet.sha1

    const infoResponse = await fetch(`${hostpath}/info/${sha1Hash}`)
    const info = await infoResponse.json()
    strictEqual(infoResponse.status, 200)
    deepStrictEqual(info.data, uploadRet)
})

test('delete-file-info', async () => {
    // node --test-name-pattern="^delete-file-info$" src/lib.test.js
    const filename = 'abc.txt'
    const data = Buffer.from('1234567890')
    const uploadResponse = await fetch(`${hostpath}/upload`, {
        method: 'PUT',
        headers: {
            'x-filename': filename
        },
        body: data
    })
    const uploadRet = await uploadResponse.json()
    const sha1Hash = uploadRet.sha1

    const deleteResponse = await fetch(`${hostpath}/delete/${sha1Hash}`, {
        method: 'DELETE'
    })
    strictEqual(deleteResponse.status, 200)

    const infoResponse = await fetch(`${hostpath}/info/${sha1Hash}`)
    strictEqual(infoResponse.status, 404)
})

test('listDataCatalog', async () => {
    // node --test-name-pattern="^listDataCatalog$" src/lib.test.js
    const ret = await (await fetch(`${hostpath}/catalog`)).json()
    let catalog = ret.data
    deepStrictEqual(catalog, [
        { count: 284, name: '202503' },
        { count: 601, name: '202504' },
        { count: 67, name: '202505' }
    ])
})

test('listDataByCatalog', async () => {
    // node --test-name-pattern="^listDataByCatalog$" src/lib.test.js
    const ret = await (await fetch(`${hostpath}/catalog/202503`)).json()
    let files = ret.data
    strictEqual(files.length, 284)
})

test('mime', async () => {
    // node --test-name-pattern="^mime$" src/lib.test.js
    strictEqual(mime.getType(`20250626_en-GB-SoniaNeural_20250626151638118.wav`), 'audio/wav')
})

test('cleanFilename', async () => {
    // node --test-name-pattern="^cleanFilename$" src/lib.test.js
    let name = cleanFilename(`【含老师手打分】成都都都（天天天天）-2025级11班-应应应-应应应应：应应应应应应应-5B20443D8A4AC67FD661841F3766ACE8-bb08b373eb7145b18c28cd4be1ec9bf5-分项评分-(20251105-1)-分分分分-[初中-应应应-应应]-(20251105-3).xlsx`)
    strictEqual(name, `【含老师手打分】成都都都（天天天天）-2025级11班-应应应-应应应应：应应应应应应应-5B204...评分-(20251105-1)-分分分分-[初中-应应应-应应]-(20251105-3).xlsx`)
    strictEqual(cleanFilename(name), `【含老师手打分】成都都都（天天天天）-2025级11班-应应应-应应应应：应应应应应应应-5B204...评分-(20251105-1)-分分分分-[初中-应应应-应应]-(20251105-3).xlsx`)
})