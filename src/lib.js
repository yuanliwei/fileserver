import dayjs from "dayjs"
import { createHash } from "node:crypto"
import { mkdir, rename, writeFile } from "node:fs/promises"
import sqlite3 from 'sqlite3'
import { Database, open } from 'sqlite'
import { createWriteStream, existsSync } from "node:fs"
import { fileURLToPath, pathToFileURL } from "node:url"
import { IncomingMessage } from "node:http"
import { pipeline } from "node:stream/promises"
import { Transform } from "node:stream"

/**
 * @import {BinaryLike} from 'crypto'
 */

export const sleep = (/** @type {number} */ timeout) => new Promise((resolve) => setTimeout(resolve, timeout))

export const md5 = (/** @type {BinaryLike} */ s) => createHash("md5").update(s).digest('hex')
export const sha1 = (/** @type {BinaryLike} */ s) => createHash("sha1").update(s).digest('hex')

export let rootDirData = new URL('../data/', import.meta.url)

/**
 * @param {string} dir
 */
export function changeRootDataDir(dir) {
    if (dir) {
        rootDirData = pathToFileURL(dir)
    }
}

export function getRootDataDir() {
    return fileURLToPath(rootDirData)
}

/**
 * @param {string} filename
 */
export function cleanFilename(filename) {
    const illegalCharsRegex = /[<>:"\/\\|?*]/g
    const cleanedFilename = filename.replace(illegalCharsRegex, '')

    // 计算字符串的字节长度
    const getByteLength = (str) => {
        return new Blob([str]).size
    }

    const MAX_BYTE_LENGTH = 240

    // 如果字节长度不超过限制，直接返回
    if (getByteLength(cleanedFilename) <= MAX_BYTE_LENGTH) {
        return cleanedFilename
    }

    // 使用二分查找找到合适的截断长度
    let left = 0
    let right = Math.floor(cleanedFilename.length / 2)

    while (left <= right) {
        const halfLength = Math.floor((left + right) / 2)
        const leftPart = cleanedFilename.substring(0, halfLength)
        const rightPart = cleanedFilename.substring(cleanedFilename.length - halfLength)
        const result = leftPart + '...' + rightPart

        if (getByteLength(result) <= MAX_BYTE_LENGTH) {
            // 检查是否可以尝试更长的版本
            const nextHalfLength = halfLength + 1
            const nextLeftPart = cleanedFilename.substring(0, nextHalfLength)
            const nextRightPart = cleanedFilename.substring(cleanedFilename.length - nextHalfLength)
            const nextResult = nextLeftPart + '...' + nextRightPart

            if (getByteLength(nextResult) <= MAX_BYTE_LENGTH) {
                left = halfLength + 1
            } else {
                return result
            }
        } else {
            right = halfLength - 1
        }
    }

    // 如果二分查找失败，使用安全的截断方式
    let safeResult = ''
    for (let i = 0; i < Math.floor(cleanedFilename.length / 2); i++) {
        const leftPart = cleanedFilename.substring(0, i)
        const rightPart = cleanedFilename.substring(cleanedFilename.length - i)
        const candidate = leftPart + '...' + rightPart

        if (getByteLength(candidate) <= MAX_BYTE_LENGTH) {
            safeResult = candidate
        } else {
            break
        }
    }

    return safeResult || (cleanedFilename.substring(0, MAX_BYTE_LENGTH - 3) + '...')
}

/**
 * @param {string} sha1
 * @param {string} filename
 */
export async function buildFilePath(sha1, filename) {
    let dir = new URL(`${dayjs().format('YYYYMM')}/${sha1}/`, rootDirData)
    let file = new URL(cleanFilename(filename), dir)
    await mkdir(dir, { recursive: true })
    return file
}

/**
 * @typedef {{
 * sha1:string;
 * url:string;
 * size:number;
 * name:string;
 * path:string;
 * time:number;
 * }} FILEINFO
 */

export function guid() {
    let buffer = new Uint8Array(16)
    if (globalThis.crypto) {
        crypto.getRandomValues(buffer)
    } else {
        for (let i = 0; i < buffer.length; i++) {
            buffer[i] = Math.floor(Math.random() * 256)
        }
    }
    return [...buffer].map((item) => (item > 15 ? '' : '0') + item.toString(16)).join('')
}

export async function createTmpFile() {
    let filepath = await buildFilePath("tmp", guid())
    return filepath
}

/**
 * @param {string} origin
 * @param {string} filename
 * @param {IncomingMessage} req
 */
export async function saveFileToDisk(origin, filename, req) {
    filename = cleanFilename(filename)
    let tmpfile = await createTmpFile()
    let hash = createHash("sha1")
    let size = 0
    await pipeline(req, new Transform({
        transform(chunk, _, callback) {
            this.push(chunk)
            hash.update(chunk)
            size += chunk.length
            callback()
        }
    }), createWriteStream(tmpfile))
    let hashValue = hash.digest('hex')
    let filepath = await buildFilePath(hashValue, filename)
    await rename(tmpfile, filepath)
    let url = `${origin}/download/${hashValue}`
    /** @type{FILEINFO} */
    let info = { url, size, sha1: hashValue, name: filename, path: fileURLToPath(filepath), time: Date.now() }
    await saveFileInfo(info)
    return info
}

/** @type{Database} */
let database = null

export async function initDbAndTables() {
    let exists = existsSync(rootDirData)
    if (!exists) {
        await mkdir(rootDirData, { recursive: true })
    }
    database = await open({
        filename: fileURLToPath(new URL('data.db', rootDirData)),
        driver: sqlite3.Database
    })

    await database.run(`CREATE TABLE IF NOT EXISTS "fileinfo" ( "sha1" TEXT NOT NULL UNIQUE, "url" TEXT, "name" TEXT, "path" BLOB, "size" NUMBER, "time" NUMBER, PRIMARY KEY("sha1") );`)
    await database.run(`CREATE INDEX IF NOT EXISTS fileinfo_time_idx ON fileinfo(time);`);
}

/**
 * @param {string} sha1 
 * @returns {Promise<FILEINFO>}
 */
export async function findFileInfo(sha1) {
    if (!database) {
        throw new Error("Database is not initialized")
    }
    const fileInfo = await database.get(`SELECT * FROM fileinfo WHERE sha1 = ?`, [sha1])
    return fileInfo
}

/**
 * @param {FILEINFO} info
 */
export async function saveFileInfo(info) {
    if (!database) {
        throw new Error("Database is not initialized")
    }
    await database.run(`INSERT INTO fileinfo (sha1, url, name, path, size, time) VALUES (?, ?, ?, ?, ?, ?)
                         ON CONFLICT(sha1) DO UPDATE SET url = excluded.url, name = excluded.name, path = excluded.path, size = excluded.size, time = excluded.time`,
        [info.sha1, info.url, info.name, info.path, info.size, info.time])
}

/**
 * @param {string} sha1
 */
export async function deleteFileInfo(sha1) {
    if (!database) {
        throw new Error("Database is not initialized")
    }
    await database.run(`DELETE FROM fileinfo WHERE sha1 = ?`, [sha1])
}

/**
 * @returns {Promise<{name:string;count:number;}[]>}
 */
export async function listDataCatalog() {
    if (!database) {
        throw new Error("Database is not initialized")
    }
    const list = await database.all(`SELECT strftime('%Y%m', time/1000, 'unixepoch') AS name_,
        COUNT(*) AS count FROM fileinfo GROUP BY name_ ORDER BY name_;`)
    return list.map(o => ({ name: o.name_, count: o.count }))
}

/**
 * @param {string | number | dayjs.Dayjs | Date} date
 * @returns {Promise<FILEINFO[]>}
 */
export async function listDataByCatalog(date) {
    if (!database) {
        throw new Error("Database is not initialized")
    }
    let from = dayjs(date, 'YYYYMM').toDate().getTime()
    let to = dayjs(date, 'YYYYMM').add(1, 'month').toDate().getTime()
    const list = await database.all(`SELECT * FROM fileinfo where time >= ? and time < ? ORDER BY time;`, [from, to])
    return list
}

