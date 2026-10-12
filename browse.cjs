const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer-core')

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

;(async () => {
  const port = process.argv[2] || '5180'
  const host = process.argv[3] || '127.0.0.1'
  const url = `http://${host}:${port}/`
  const logs = []
  let errors = []

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-gl=swiftshader'],
  })

  try {
    const page = await browser.newPage()
    page.on('console', (m) => logs.push(`${m.type()} ${m.text()}`))
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

    await page.goto(url, { waitUntil: 'load', timeout: 25000 })
    await new Promise((r) => setTimeout(r, 14000))

    const dump = await page.evaluate(() => {
      const out = {}
      const e = window.__e30
      if (e) {
        const canvas = document.querySelector('.scene canvas')
        const ctx = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
        out.contextFound = !!ctx
        if (ctx) {
          try {
            const dbg = ctx.getDebugInfo()
            out.debugVendor = dbg.getParameter(dbg.VENDOR)
            out.debugRenderer = dbg.getParameter(dbg.RENDERER)
            out.debugVersion = dbg.getParameter(dbg.VERSION)
          } catch (err) { out.debugErr = String(err) }
          out.drawingBufferWidth = ctx.getParameter(ctx.DRAWING_BUFFER_WIDTH)
          out.drawingBufferHeight = ctx.getParameter(ctx.DRAWING_BUFFER_HEIGHT)
        }
        out.canvasWidth = canvas.width
        out.canvasHeight = canvas.height
        out.sceneChildren = e.scene.children.map((c) => ({
          name: c.name, type: c.type, isMesh: c.isMesh,
          children: c.children.map((cc) => ({ name: cc.name, type: cc.type, isMesh: cc.isMesh }))
        }))
        out.sceneChildrenCount = e.scene.children.length
        out.cameraType = e.camera.type
        out.cameraPos = [e.camera.position.x, e.camera.position.y, e.camera.position.z]
        out.cameraFov = e.camera.fov
        out.sceneBackground = e.scene.background ? String(e.scene.background) : 'none'
        out.sceneAutoClear = e.scene.autoClear
        out.rendererAutoClear = e.gl.autoClear
        out.rendererType = e.gl.constructor.name
        try {
          const col = e.gl.getClearColor()
          out.clearColor = [col.r, col.g, col.b, col.a]
        } catch (err) { out.clearColorErr = String(err) }
        // Force a green clear + render and check
        try {
          e.gl.setClearColor(0x00ff00, 1.0)
          e.gl.clear()
          out.clearColorSet = 'done'
        } catch (err) { out.clearColorSet = 'err: ' + String(err) }
      }
      return out
    })
    console.log('===== DUMP =====')
    console.log(JSON.stringify(dump, null, 2))
  } finally {
    await browser.close()
  }
})().catch((e) => {
  console.error('LAUNCH ERROR:', e)
  process.exit(1)
})