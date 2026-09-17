export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-xs text-white/50">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

      <p>
        This Privacy Policy explains what information LustHentai
        (&quot;LustHentai,&quot; &quot;we,&quot; &quot;us&quot;) collects when you use lusthentai.com (the
        &quot;Service&quot;), how we use it, and the choices you have. By using the
        Service you agree to the practices described here. This policy should
        be read alongside our <a href="/terms">Terms of Use</a>.
      </p>

      <h2>1. Information we collect</h2>
      <p>
        <strong>Account information.</strong> If you create an account,
        authentication is handled by our provider, Supabase: we store your
        email address and an authentication identifier (your password itself
        is never stored by us — Supabase handles it as a salted hash). You may
        optionally set a display name, handle, and avatar image.
      </p>
      <p>
        <strong>Activity data.</strong> If signed in, we store your watchlist,
        watch history, ratings, and any comments you post, so those features
        work across sessions and devices.
      </p>
      <p>
        <strong>Log and device data.</strong> Like most websites, our hosting
        and CDN providers automatically log standard technical data for every
        request — IP address, browser/device type, referring page, timestamps,
        and pages viewed — for security, abuse prevention, and performance
        monitoring.
      </p>
      <p>
        <strong>Cookies and similar technology.</strong> We use cookies for
        session authentication (keeping you signed in), and our analytics and
        advertising partners use cookies and similar technology (such as local
        storage) as described in Section 3. We do not use a separate
        &quot;marketing&quot; cookie of our own.
      </p>

      <h2>2. How we use this information</h2>
      <ul>
        <li>to operate core features — sign-in, watchlists, history, ratings, and comments;</li>
        <li>to secure the Service and prevent abuse, fraud, and unauthorized access;</li>
        <li>to understand aggregate usage (which pages are popular, how the site performs) via analytics;</li>
        <li>to serve and measure advertising, which funds the free Service (see Section 3);</li>
        <li>to respond to support, abuse, DMCA, or content-removal requests.</li>
      </ul>
      <p>We do not sell your personal information.</p>

      <h2>3. Advertising and analytics partners</h2>
      <p>
        The Service is free and funded by advertising. We use the following
        categories of third-party service providers, each of which may set
        its own cookies or collect data directly from your browser when you
        load a page:
      </p>
      <ul>
        <li><strong>Google Analytics</strong> — aggregate traffic and usage measurement.</li>
        <li><strong>ExoClick and other ad networks/affiliate partners</strong> — serve the banner, native, video, and interstitial ads that fund the Service. These networks may use cookies or similar identifiers to measure ad performance and, depending on the network, to personalize ads based on browsing activity across sites.</li>
      </ul>
      <p>
        These partners act as independent controllers of the data they collect
        through their own cookies — this policy covers our own practices, not
        theirs. You can control cookies through your browser settings, and opt
        out of Google&apos;s advertising cookies at{" "}
        <a href="https://adssettings.google.com" target="_blank" rel="noreferrer">
          adssettings.google.com
        </a>
        . Blocking cookies may affect how the Service functions.
      </p>

      <h2>4. Other service providers</h2>
      <p>
        We use the following infrastructure providers to operate the Service,
        each of which processes data on our behalf under its own security
        practices: Vercel (application hosting), Supabase (accounts and
        database), Cloudflare and Bunny.net (image and video content
        delivery).
      </p>

      <h2>5. Data retention</h2>
      <p>
        Account data (watchlist, history, ratings, comments) is kept for as
        long as your account exists. Deleting your account removes this data
        within a reasonable period, except where we&apos;re required to keep
        limited records for legal, security, or abuse-prevention purposes.
        Standard technical logs are retained for a limited time for security
        and debugging purposes and then routinely purged.
      </p>

      <h2>6. Your choices</h2>
      <ul>
        <li>You can update your profile (display name, avatar) at any time from <a href="/account">Account settings</a>.</li>
        <li>To delete your account and its associated data, email us (Section 8) — we don&apos;t yet have a self-service delete button, but we&apos;ll action a request promptly.</li>
        <li>You can use the Service without an account — watchlist, history, ratings, and comments simply won&apos;t be available.</li>
        <li>You can control or clear cookies through your browser at any time.</li>
      </ul>
      <p>
        If you&apos;re in a jurisdiction with statutory data-access, correction,
        deletion, or portability rights (for example under the GDPR or CCPA),
        you can exercise them the same way — email us and we&apos;ll respond
        within a reasonable time.
      </p>

      <h2>7. Children&apos;s privacy</h2>
      <p>
        The Service is restricted to adults 18 and older and is not directed
        at children. We do not knowingly collect information from anyone
        under 18. If you believe a minor has provided us information, contact
        us and we will delete it.
      </p>

      <h2>8. Contact</h2>
      <p>
        Questions or requests about this policy, or your data, can be sent to{" "}
        <a href="mailto:privacy@lusthentai.com">privacy@lusthentai.com</a>.
      </p>
      <p className="text-xs text-white/50">
        Before launch: set up the privacy@ mailbox (mirrors the dmca@ /
        abuse@ mailboxes referenced on the <a href="/dmca">DMCA</a> and{" "}
        <a href="/report-content">report content</a> pages).
      </p>
    </>
  );
}
