
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 selection:bg-accent selection:text-accent-foreground">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-foreground sm:text-6xl md:text-7xl">
          Hello, World!
        </h1>
        <p className="mt-4 text-lg text-muted-foreground sm:text-xl">
          Welcome to your new Next.js application.
        </p>
      </div>
    </main>
  );
}
