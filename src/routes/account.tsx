import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/SiteLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My account | Bella Vitae Medical Clinic" },
      {
        name: "description",
        content: "Update your profile details and password at Bella Vitae Medical Clinic.",
      },
      { property: "og:title", content: "My account | Bella Vitae Medical Clinic" },
      { property: "og:description", content: "Manage your Bella Vitae profile and password." },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user, role, loading } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setFullName(data.full_name ?? "");
        setPhone(data.phone ?? "");
        setSpecialty(data.specialty ?? "");
      });
  }, [user]);

  if (loading) {
    return (
      <SiteLayout>
        <p className="mx-auto max-w-2xl px-4 py-16 text-muted-foreground">Loading…</p>
      </SiteLayout>
    );
  }

  if (!user) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <h1 className="text-2xl font-bold text-primary">You are not signed in</h1>
          <Link to="/auth" className="mt-4 inline-block text-primary hover:underline">
            Go to sign in
          </Link>
        </div>
      </SiteLayout>
    );
  }

  const saveProfile = async () => {
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), phone: phone.trim(), specialty: specialty.trim() || null })
      .eq("id", user.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile updated");
  };

  const changePassword = async () => {
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
      return;
    }
    setPassword("");
    toast.success("Password changed");
  };

  return (
    <SiteLayout>
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-3xl font-bold text-primary">My account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {user.email} · role: <strong>{role}</strong>
        </p>

        <div className="mt-8 space-y-3 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Profile</h2>
          <Field label="Full name" value={fullName} onChange={setFullName} />
          <Field label="Phone" value={phone} onChange={setPhone} />
          {role !== "patient" ? (
            <Field label="Specialty / job title" value={specialty} onChange={setSpecialty} />
          ) : null}
          <button
            onClick={saveProfile}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Save profile
          </button>
        </div>

        <div className="mt-6 space-y-3 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Change password</h2>
          <Field label="New password" type="password" value={password} onChange={setPassword} />
          <button
            onClick={changePassword}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Update password
          </button>
        </div>
      </div>
    </SiteLayout>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}