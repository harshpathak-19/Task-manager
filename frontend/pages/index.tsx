import { useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function Login() {
  const router = useRouter();

  useEffect(() => {
    // If already logged in, skip straight to the dashboard.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    });
  }, [router]);

  const loginWithGoogle = async () => {
    // Supabase handles the whole OAuth 2.0 / Google consent screen
    // flow for us — this just kicks it off and redirects back to
    // redirectTo once the user approves.
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white shadow-lg rounded-2xl p-10 max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Task Manager</h1>
        <p className="text-gray-500 mb-8">Sign in to create and manage tasks.</p>
        <button
          onClick={loginWithGoogle}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
        >
          Sign in with Google
        </button>
      </div>
    </main>
  );
}