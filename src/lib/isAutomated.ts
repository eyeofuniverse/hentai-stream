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
 * Beyond that flag, this also checks for the global properties a handful of
 * older/other automation frameworks add to the page and nothing else ever
 * does — PhantomJS, Nightmare.js, Chromium's own test-only
 * domAutomationController, and the pre-webdriver-flag Selenium markers. Every
 * one of these is a named property that exists ONLY because that specific
 * tool put it there — never as a side effect of a real browser, a privacy
 * setting, an extension, or an ad script — so none of them can false-positive
 * on a real visitor. Search engines are unaffected for the same reason on top
 * of their own: Googlebot's rendering service deliberately avoids every one
 * of these tells (including navigator.webdriver) precisely so it renders
 * pages the same way a real visitor's browser would, and traditional
 * (non-rendering) crawlers never execute this client-side code at all.
 *
 * This is a bar-raiser, not a guarantee: a bot that deliberately patches
 * navigator.webdriver away (stealth plugins) still passes all of these
 * checks too. The scraper we've dealt with so far hasn't varied its UA
 * string at all, which isn't the behavior of an operation that's also
 * bothering to evade fingerprinting — so this remains expected to catch
 * unsophisticated automation, just not guaranteed to catch everything.
 */
export function isAutomated(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  if (navigator.webdriver === true) return true;
  const w = window as unknown as Record<string, unknown>;
  const d = (typeof document !== "undefined" ? document : undefined) as unknown as Record<string, unknown> | undefined;
  return !!(
    w.callPhantom ||
    w._phantom ||
    w.__nightmare ||
    w.domAutomation ||
    w.domAutomationController ||
    (d &&
      (d.__selenium_unwrapped ||
        d.__webdriver_evaluate ||
        d.__driver_evaluate ||
        d.__webdriver_script_fn))
  );
}
