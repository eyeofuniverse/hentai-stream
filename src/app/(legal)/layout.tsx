export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-sm leading-relaxed text-white/75 [&_h1]:mb-4 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-white [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:font-semibold [&_h2]:text-white [&_p]:mb-3 [&_a]:text-accent [&_a]:underline">
      {children}
    </main>
  );
}
