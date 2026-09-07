export const metadata = { title: "Report content" };

export default function ReportContentPage() {
  return (
    <>
      <h1>Report content</h1>
      <p>
        Use the <strong>Report broken video</strong> link on any watch page for
        dead links. For anything more serious:
      </p>
      <h2>Illegal or non-consensual content</h2>
      <p>
        Email <a href="mailto:abuse@example.com">abuse@example.com</a> with the
        page URL and the reason. Content that appears to depict a minor in a
        sexual context is removed immediately on report, pending review. Suspected
        child sexual abuse material should also be reported to{" "}
        <a href="https://report.cybertip.org" target="_blank" rel="noreferrer">
          NCMEC
        </a>{" "}
        (US) or{" "}
        <a href="https://www.iwf.org.uk/report" target="_blank" rel="noreferrer">
          the IWF
        </a>{" "}
        (UK).
      </p>
      <h2>Copyright</h2>
      <p>
        See the <a href="/dmca">DMCA page</a>.
      </p>
    </>
  );
}
