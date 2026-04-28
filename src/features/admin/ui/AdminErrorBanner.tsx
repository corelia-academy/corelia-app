export function AdminErrorBanner({ message }: { message: string }) {
  return (
    <div className="mt-6 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  );
}

