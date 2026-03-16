// src/components/LogoutButton.jsx
"use client";

import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";

export default function LogoutButton() {
  const handleLogout = async () => {
    try {
      // 1. Tell Supabase to securely destroy the session
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // 2. Force a hard redirect to clear Next.js cache and proxy state
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout Error:", error.message);
      alert("Failed to log out safely.");
    }
  };

  return (
    <Button 
      variant="outline" 
      onClick={handleLogout}
      className="w-full mt-auto bg-transparent border-slate-200 text-slate-700 hover:text-red-600 hover:bg-red-50 hover:border-red-100 transition-colors"
    >
      Sign Out
    </Button>
  );
}