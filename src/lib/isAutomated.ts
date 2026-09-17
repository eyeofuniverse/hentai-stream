/**
 * Best-effort "this session is browser automation, not a human" check.
 *
 * No real visitor runs a headless browser — it has no window for a human to
 * look at, so the population is entirely scrapers, bots, monitoring services
 * and our own testing tools. `navigator.webdriver` is the standard tell: the
 * WebDriver spec requires every conforming automation tool (Selenium,
 * Puppeteer, Playwright) to set it, and none of our own tooling drives the
 * production site — QA runs against localhost/preview — so there's no
 * legitimate case here to exempt.
 *
 * This is a bar-raiser, not a guarantee: a bot that deliberately patches the
 * property away (stealth plugins) still passes. The scraper we've dealt with
 * so far hasn't varied its UA string at all, which isn't the behavior of an
 * operation that's also bothering to patch navigator.webdriver — so this is
 * expected to catch it, just not guaranteed to catch everything forever.
 */
export function isAutomated(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.webdriver === true;
}
