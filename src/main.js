import Koa from "koa"
import Router from 'koa-router'
import log4js from 'log4js'
import { createServer } from "node:http"
import { changeRootDataDir, deleteFileInfo, findFileInfo, getRootDataDir, initDbAndTables, listDataByCatalog, listDataCatalog, saveFileToDisk } from "./lib.js"
import { createReadStream } from "node:fs"
import mime from "mime"

const RELEASE_FILE_SERVER = process.env.RELEASE_FILE_SERVER
const ROOT_DIR_DATA = process.env.ROOT_DIR_DATA

if (RELEASE_FILE_SERVER) {
    log4js.configure({
        appenders: { stdout: { type: "stdout", layout: { type: 'pattern', pattern: '%p %m %f{2}:%l:%o' } } },
        categories: { default: { appenders: ["stdout"], level: "debug", enableCallStack: true } },
    })
} else {
    log4js.configure({
        appenders: { stdout: { type: "stdout", layout: { type: 'pattern', pattern: '[%d{yyyy-MM-dd hh:mm:ss,SSS}] %[%p %m%] %f{2}:%l:%o' } } },
        categories: { default: { appenders: ["stdout"], level: "debug", enableCallStack: true } },
    })
}

/** @type{*} */
const _log4js_ = log4js.getLogger()
_log4js_['table'] = globalThis.console.table
/** @type{Omit<Console,'log'>} */
const console = _log4js_

const router = new Router()

async function start() {
    changeRootDataDir(ROOT_DIR_DATA)
    await initDbAndTables()

    const app = new Koa()
    const ignoreLogRequestPath = ['/status', '/front/health-status']
    app.use(async (ctx, next) => {
        const ip = ctx.req.socket.remoteAddress

        if (!ignoreLogRequestPath.includes(ctx.originalUrl)) {
            console.info(ip, ctx.method, ctx.originalUrl)
        }

        ctx.set('Access-Control-Allow-Origin', '*')
        ctx.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
        ctx.set('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE, OPTIONS')

        try {
            await next()
        } catch (err) {
            console.error(err)
            ctx.response.status = err.statusCode || err.status || 500
            ctx.response.body = err.stack
        }
    })

    app.use(router.routes())
    app.use(router.allowedMethods())

    console.info('ROOT_DIR_DATA', getRootDataDir())
    let port = process.env.PORT || 32109
    createServer(app.callback()).listen(port)
    console.info(`service start at ${port}`)
}

setTimeout(start, 1)

router.get('/status', async (ctx) => {
    ctx.body = {
        code: "success",
        msg: {},
    }
})

router.get('/front/health-status', async (ctx) => {
    ctx.body = {
        msg: "success",
        code: 0,
        data: {
        },
    }
})

router.put('/upload', async (ctx) => {
    let filename = decodeURIComponent(ctx.header['x-filename'].toString())
    let ret = await saveFileToDisk(ctx.origin, filename, ctx.req)
    console.info(JSON.stringify(ret))
    ctx.body = ret
})

router.delete('/delete/:sha1', async (ctx) => {
    const sha1 = ctx.params.sha1
    await deleteFileInfo(sha1)
    ctx.body = { code: 0, msg: 'success' }
})

router.get('/info/:sha1', async (ctx) => {
    const sha1 = ctx.params.sha1
    let info = await findFileInfo(sha1)
    if (!info) {
        ctx.status = 404
        ctx.body = { code: 1, msg: 'File not found' }
        return
    }
    ctx.body = { code: 0, msg: 'success', data: info }
})

router.get('/download/:sha1', async (ctx) => {
    const sha1 = ctx.params.sha1
    let info = await findFileInfo(sha1)
    if (!info) {
        ctx.status = 404
        ctx.body = { code: 1, msg: 'File not found' }
        return
    }
    ctx.set('Content-Disposition', `attachment; filename="${encodeURIComponent(info.name)}"`)
    ctx.set('content-type', mime.getType(info.name))
    ctx.body = createReadStream(info.path)
})

router.get('/catalog', async (ctx) => {
    let catalog = await listDataCatalog()
    ctx.body = { code: 0, msg: 'success', data: catalog }
})

router.get('/catalog/:date', async (ctx) => {
    const date = ctx.params.date
    let files = await listDataByCatalog(date)
    ctx.body = { code: 0, msg: 'success', data: files }
})