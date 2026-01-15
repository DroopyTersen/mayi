export function EmptyPlayersState() {
  return (
    <div className="flex flex-col items-center justify-center text-muted-foreground py-8 gap-2">
      <svg
        className="w-10 h-10 opacity-30"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
        <path d="M12 11v4" strokeDasharray="2 2" />
      </svg>
      <p className="text-sm">Waiting for players to join...</p>
    </div>
  );
}
