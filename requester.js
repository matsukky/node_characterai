const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const fs = require('fs');

chromium.use(stealth);

let chromiumPath = process.platform === "linux" ? "/usr/bin/chromium-browser" : null;
if (chromiumPath && !fs.existsSync(chromiumPath)) console.error("[node_characterai] Warning: the specified Chromium path could not be located. If the script does not work properly, you may need to specify a path to the Chromium binary file/executable.");

class Requester {
    browser = undefined;
    context = undefined;
    page = undefined;

    #initialized = false;
    #hasDisplayed = false;

    headless = true;
    playwrightPath = undefined;
    playwrightLaunchArgs = [
        "--fast-start",
        "--disable-extensions",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--no-gpu",
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
        "--override-plugin-power-saver-for-testing=never",
        "--disable-extensions-http-throttling"
    ];
    usePlus = false;
    console = true;
    forceWaitingRoom = false;

    constructor() {}

    isInitialized() {
        return this.#initialized;
    }

    async waitForWaitingRoom(page) {
        if (!this.usePlus || (this.usePlus && this.forceWaitingRoom)) {
            return new Promise(async (resolve) => {
                try {
                    let interval;
                    let pass = true;

                    const minute = 60000; // Update every minute

                    async function check() {
                        if (pass) {
                            pass = false;

                            const waitingRoomTimeLeft = await page.evaluate(() => {
                                try {
                                    const contentContainer = document.querySelector(".content-container");
                                    const sections = contentContainer.querySelectorAll("section");
                                    const h2Element = sections[1].querySelector("h2");
                                    const h2Text = h2Element.innerText;
                                    const regex = /\d+/g;
                                    const matches = h2Text.match(regex);

                                    if (matches) return matches[0];
                                } catch (error) {
                                    return;
                                }
                            });

                            const waiting = (waitingRoomTimeLeft != null);
                            if (waiting) {
                                console.warn(`[node_characterai] Currently in cloudflare's waiting room. Time left: ${waitingRoomTimeLeft}`);
                            } else {
                                resolve();
                                clearInterval(interval);
                            }
                            pass = true;
                        }
                    }

                    interval = setInterval(check, minute);
                    await check();
                } catch (error) {
                    console.error("[node_characterai] There was a fatal error while checking for cloudflare's waiting room");
                    console.error(error);
                }
            });
        }
    }

    async initialize() {
        if (!this.isInitialized()) {
            process.on('exit', () => {
                this.uninitialize();
            });

            if (this.console) console.log("[node_characterai] This is an experimental feature. Please report any issues on github.");

            const browser = await chromium.launch({
                headless: this.headless,
                args: this.playwrightLaunchArgs,
                executablePath: this.playwrightPath || undefined
            });
            this.browser = browser;

            const context = await browser.newContext({
                viewport: {
                    width: 1920 + Math.floor(Math.random() * 100),
                    height: 3000 + Math.floor(Math.random() * 100)
                },
                userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            });
            this.context = context;

            const page = await context.newPage();
            this.page = page;

            await context.clearCookies();
            await page.goto("https://beta.character.ai/favicon.ico");
            await page.evaluate(() => localStorage.clear());

            await this.waitForWaitingRoom(page);

            if (this.console) console.log("[node_characterai] Playwright - Done with setup");

            this.#initialized = true;
        }
    }

    async request(url, options) {
        const page = this.page;

        const method = options.method;
        const body = (method == "GET" ? undefined : options.body);
        const headers = options.headers;

        let response;

        try {
            if (!this.#hasDisplayed) {
                if (this.console) console.log("[node_characterai] Playwright - Eval-fetching is an experimental feature and may be slower. Please report any issues on github");
                this.#hasDisplayed = true;
            }

            if (url.endsWith("/streaming/")) {
                response = await page.evaluate(async (url, method, headers, body) => {
                    const response = await fetch(url, { method, headers, body });
                    const data = await response.text();
                    const matches = data.match(/\{.*\}/g);
                    const responseText = matches[matches.length - 1];

                    let result = { code: 500 };

                    if (!matches) result = null;
                    else {
                        result.code = 200;
                        result.response = responseText;
                    }
                    return result;
                }, url, method, headers, body);

                response.status = () => response.code;
                response.text = () => response.response;
            } else {
                response = await page.goto(url, { 
                    waitUntil: "domcontentloaded",
                    method: method,
                    headers: headers,
                    data: body
                });
            }
        } catch (error) {
            console.error("[node_characterai] Playwright - " + error);
        }

        return response;
    }

    async uninitialize() {
        try {
            await this.browser.close();
        } catch {}
    }
}

module.exports = Requester;