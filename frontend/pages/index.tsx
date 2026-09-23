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
    <main style={{ display: "flex", justifyContent: "center", marginTop: "20vh" }}>
      <div style={{ textAlign: "center" }}>
        <h1>Task Manager</h1>
        <p>Sign in to create and manage tasks.</p>
        <button onClick={loginWithGoogle} style={{ padding: "10px 20px", fontSize: 16 }}>
          Sign in with Google
        </button>
      </div>
    </main>
  );
}
