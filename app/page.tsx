export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold tracking-tight">
          Faust OS
        </h1>

        <p className="mt-4 text-lg text-zinc-400">
          Business Operating System
        </p>

        <div className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
          <h2 className="text-2xl font-semibold">
            🚀 Project Initialized
          </h2>

          <p className="mt-3 text-zinc-500">
            Welcome, Henrry.
          </p>

          <p className="mt-1 text-zinc-500">
            Let's build something incredible.
          </p>
        </div>
      </div>
    </main>
  );
}