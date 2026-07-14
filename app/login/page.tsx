import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{
    next?: string;
  }>;
}) {
  const params = (await searchParams) || {};
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(201,162,75,.16),_transparent_34%),linear-gradient(180deg,#091015_0%,#06080b_100%)] px-4 py-10 text-[#e8e8e8]">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <LoginForm nextPath={params.next || "/"} />
      </div>
    </main>
  );
}
