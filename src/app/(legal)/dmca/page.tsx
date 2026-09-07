export const metadata = { title: "DMCA / Copyright" };

export default function DmcaPage() {
  return (
    <>
      <h1>DMCA / Copyright Policy</h1>
      <p>
        HentaiStream is an index of links to material hosted by third parties. We
        store no video files. If you are a rights holder and believe content
        indexed here infringes your copyright, send a notice to{" "}
        <a href="mailto:dmca@example.com">dmca@example.com</a> including:
      </p>
      <p>
        1. Identification of the copyrighted work.<br />
        2. The URL(s) on this site that link to the material.<br />
        3. Your contact information.<br />
        4. A statement that you have a good-faith belief the use is unauthorized.
        <br />
        5. A statement, under penalty of perjury, that the information is accurate
        and you are authorized to act for the rights holder.<br />
        6. Your physical or electronic signature.
      </p>
      <p>
        Valid notices are actioned within 48 hours — we disable the offending
        links. We maintain a repeat-infringer policy and terminate the accounts of
        users who repeatedly submit infringing links.
      </p>
      <h2>Counter-notice</h2>
      <p>
        If your submission was removed in error, send a counter-notice to the same
        address with the same elements plus consent to jurisdiction.
      </p>
      <p className="text-xs text-white/40">
        Replace the placeholder address and register a DMCA agent with the U.S.
        Copyright Office before launch.
      </p>
    </>
  );
}
