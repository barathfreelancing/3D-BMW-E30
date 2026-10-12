const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer-core')

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

;(async () => {
  const port = process.argv[2] || '5175'
  const url = `http://localhost:${port}/`
  const logs = []
  let errors = []

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--enable-unsafe-swiftshader',
      '--use-gl=swiftshader',
    ],
  })

  try {
    const page = await browser.newPage()
    page.on('console', (m) => {
      const type = m.type()
      const text = m.text()
      logs.push(`${type} ${text}`)
    })
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
    page.on('requestfailed', (r) => errors.push('REQFAIL: ' + r.url() + ' / ' + (r.failure() && r.failure().errorText)))

    await page.goto(url, { waitUntil: 'load', timeout: 25000 })

    await new Promise((r) => setTimeout(r, 14000))

    const html = await page.content()
    const title = await page.title()

    logs.push('TITLE: ' + title)

    const loaderMatch = html.match(/<div class="loader[^"]*">[\s\S]{0,500}/m)
    logs.push('OVERLAY_BLOCK: ' + (loaderMatch ? loaderMatch[0].replace(/\s+/g, ' ').slice(0, 500) : 'no loader div found'))

    const bodyClass = html.match(/<body[^>]*class="([^"]*)"/)
    logs.push('BODY_CLASS: ' + (bodyClass ? bodyClass[1] : 'none'))

    const sceneInfo = await page
      .evaluate(() => {
        const out = {}
        const ov = document.querySelector('.loader')
        out.loaderGone = !ov || getComputedStyle(ov).display === 'none'
        out.loaderClasses = ov ? ov.className : 'none'
        out.loaderText = ov ? ov.innerText.slice(0, 200) : 'none'
        const scene = document.querySelector('.scene')
        out.sceneClass = scene ? scene.className : 'none'
        return out
      })
      .catch((e) => ({ error: String(e) }))
    logs.push('SCENE_INFO: ' + JSON.stringify(sceneInfo))

    await page.screenshot({ path: path.join(__dirname, 'shot.png'), fullPage: false })
    logs.push('SCREENSHOT: shot.png')
  } finally {
    await browser.close()
  }

  console.log('===== CONSOLE LOGS =====')
  console.log(logs.join('\n'))
  console.log('===== ERRORS =====')
  console.log(errors.length ? errors.join('\n') : 'none')
  console.log('===== DONE =====')
})().catch((e) => {
  console.error('LAUNCH ERROR:', e)
  process.exit(1)
})
