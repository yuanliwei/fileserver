import { test } from 'node:test'
import { deepStrictEqual, strictEqual } from 'node:assert'
import { sha1 } from './lib.js'
import { buffer } from 'node:stream/consumers'

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
    const ret = await(await fetch(`${hostpath}/catalog`)).json()
    let catalog = ret.data
    deepStrictEqual(catalog, [
        { count: 284, name: '202503' },
        { count: 601, name: '202504' },
        { count: 67, name: '202505' }
    ])
})

test('listDataByCatalog', async () => {
    // node --test-name-pattern="^listDataByCatalog$" src/lib.test.js
    const ret = await(await fetch(`${hostpath}/catalog/202503`)).json()
    let files = ret.data
    strictEqual(files.length, 284)
})