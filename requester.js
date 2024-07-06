const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth")
const fs = require("fs");

let chromiumPath = process.platform === "linux" ? "/usr/bin/chromium-browser" : null;
if (chromiumPath && !fs.existsSync(chromiumPath)) console.error("[node_characterai] Puppeteer - Warning: the specified Chromium path for puppeteer could not be located. If the script does not work properly, you may need to specify a path to the Chromium binary file/executable.");

class Requester {
    browser = undefined;
    page = undefined;

    #initialized = false;
    #hasDisplayed = false;

    headless = "new";
    puppeteerPath = undefined;
    puppeteerLaunchArgs = [
        "--fast-start",
        "--disable-extensions",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--no-gpu",
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
        "--override-plugin-power-saver-for-testing=never",
        "--disable-extensions-http-throttling",
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.3"
    ];
    puppeteerNoDefaultTimeout = false;
    puppeteerProtocolTimeout = 0;
    usePlus = false;
    console = true;
    forceWaitingRoom = false;

    constructor() {}
    isInitialized() {
        return this.#initialized;
    }
    async waitForWaitingRoom(page) {
        // Enable force waiting room to ensure you check for waiting room even on C.AI+
        if (!this.usePlus || (this.usePlus && this.forceWaitingRoom)) {
            return new Promise(async (resolve) => {
                try {
                    let interval;
                    let pass = true;

                    const minute = 60000; // Update every minute

                    // Keep waiting until false
                    async function check() {
                        if (pass) {
                            pass = false;

                            const waitingRoomTimeLeft = await page.evaluate(async() => {
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
                            }, minute);

                            const waiting = (waitingRoomTimeLeft != null);
                            if (waiting) {
                                console.warn(`[node_characterai] Puppeteer - Currently in cloudflare's waiting room. Time left: ${waitingRoomTimeLeft}`);
                            } else {
                                resolve();
                                clearInterval(interval);
                            }
                            pass = true;
                        };
                    }

                    interval = setInterval(check, minute);
                    await check();
                } catch (error) {
                    console.error("[node_characterai] Puppeteer - There was a fatal error while checking for cloudflare's waiting room");
                    console.error(error);
                }
            });
        }
    }
    async initialize() {
        if (!this.isInitialized());

        // Handle chromium tabs cleanup
        process.on('exit', () => {
            this.uninitialize();
        });

        if(this.console) console.log("[node_characterai] Puppeteer - This is an experimental feature. Please report any issues on github.");

        puppeteer.use(StealthPlugin());
        const browser = await puppeteer.launch({
            headless: this.headless,
            args: this.puppeteerLaunchArgs,
            protocolTimeout: this.puppeteerProtocolTimeout || 0, // Props to monckey100
            executablePath: this.puppeteerPath || null
        });
        this.browser = browser;

        let page = await browser.pages();
        page = page[0];
        this.page = page;

        await page.setRequestInterception(false);

        page.setViewport({
            width: 1920 + Math.floor(Math.random() * 100),
            height: 3000 + Math.floor(Math.random() * 100),
            deviceScaleFactor: 1,
            hasTouch: false,
            isLandscape: false,
            isMobile: false,
        });
        await page.setJavaScriptEnabled(true);
        await page.setDefaultNavigationTimeout(0);

        const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
        await page.setUserAgent(userAgent);

        // Special thanks to @Parking-Master for this fix
        await page.deleteCookie();
        const client = await page.target().createCDPSession();
        await client.send("Network.clearBrowserCookies");
        await client.send("Network.clearBrowserCache");
        await page.goto("https://beta.character.ai/favicon.ico");
        await page.evaluate(() => localStorage.clear());

        // If there is no waiting room, the script will continue anyway
        await this.waitForWaitingRoom(page);

        if(this.console) console.log("[node_characterai] Puppeteer - Done with setup");
    }

    async request(url, options) {
        const page = this.page;

        const method = options.method;

        const body = (method == "GET" ? {} : options.body);
        const headers = options.headers;

        let response;

        try {
            const payload = {
                method: method,
                headers: headers,
                body: body
            }

            await page.setRequestInterception(false);
            if (!this.#hasDisplayed) {
                if(this.console) console.log("[node_characterai] Puppeteer - Eval-fetching is an experimental feature and may be slower. Please report any issues on github")
                this.#hasDisplayed = true;
            }

            if (url.endsWith("/streaming/")) {
                // Bless @roogue & @drizzle-mizzle for the code here!
                response = await page.evaluate(async (payload, url) => {
                    const response = await fetch(url, payload);

                    const data = await response.text();
                    const matches = data.match(/\{.*\}/g);
                    const responseText = matches[matches.length - 1];

                    let result = {
                        code: 500
                    };

                    if (!matches) result = null;
                    else {
                        result.code = 200;
                        result.response = responseText;
                    };
                    return result;
                }, payload, url);

                response.status = () => response.code; // compatibilty reasons
                response.text = () => response.response; // compatibilty reasons
            } else {
                await page.setRequestInterception(true);
                let initialRequest = true;

                page.once("request", request => {
                    var data = {
                        "method": method,
                        "postData": body,
                        "headers": headers
                    };

                    if (request.isNavigationRequest() && !initialRequest) {
                        return request.abort();
                    }

                    try {
                        initialRequest = false;
                        request.continue(data);
                    } catch (error) {
                        console.error("[node_characterai] Puppeteer - Non fatal error: " + error);
                    }
                });
                response = await page.goto(url, { waitUntil: "domcontentloaded" });
            }
        } catch (error) {
            console.error("[node_characterai] Puppeteer - " + error)
        }

        return response;
    }

    async uninitialize() {
        // Handle chromium tabs cleanup
        try {
            this.browser.close();
        } catch {}
    }
};

module.exports = Requester;
