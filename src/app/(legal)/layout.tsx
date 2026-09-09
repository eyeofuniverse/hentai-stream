export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-14 text-sm leading-relaxed text-white/70 lg:px-8 [&_a]:text-accent [&_a]:underline [&_h1]:mb-6 [&_h1]:font-display [&_h1]:text-2xl [&_h1]:font-extrabold [&_h1]:tracking-tight [&_h1]:text-white [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-white [&_li]:mb-1.5 [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-3.5 [&_strong]:text-white/90">
      {children}
    </main>
  );
}
