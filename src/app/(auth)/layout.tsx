export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: "var(--neo-bg)" }}
    >
      <div className="w-full max-w-sm px-4">{children}</div>
    </div>
  );
}
