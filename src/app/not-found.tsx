import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-headline tracking-tighter">Page not found</h1>
      <p className="text-muted-foreground text-sm max-w-md">
        The page you are looking for does not exist or was moved.
      </p>
      <Link
        href="/"
        className="text-primary underline underline-offset-4 text-sm font-medium"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
