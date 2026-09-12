import { cookies } from "next/headers";
import TrainerAdminHeader from "@/components/TrainerAdminHeader";
import SuperAdminHeader from "@/components/SuperAdminHeader";

// Decode the role out of the access_token (JWT payload) server-side, so we can
// keep super admins inside their own header shell when they visit the shared
// /trainer-admin/invites screen instead of stranding them on the trainer-admin
// header (whose other links would just bounce them back via middleware).
function roleFromToken(token) {
  try {
    const payload = token.split(".")[1];
    const json = Buffer.from(
      payload.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf8");
    return JSON.parse(json)?.role ?? null;
  } catch {
    return null;
  }
}

function viewRoleFromCookie(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw))?.role ?? null;
  } catch {
    try {
      return JSON.parse(raw)?.role ?? null;
    } catch {
      return null;
    }
  }
}

export default async function TrainerAdminLayout({ children }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  // A super admin who used "Switch" to view as a trainer admin gets the real
  // trainer-admin header; otherwise super admins keep their own shell (e.g. on
  // the shared /trainer-admin/invites screen).
  const viewRole = String(viewRoleFromCookie(cookieStore.get("user")?.value) || "").toLowerCase();
  const switchedToTA = viewRole === "trainer_admin" || viewRole === "admin";
  const Header =
    roleFromToken(token) === "super_admin" && !switchedToTA ? SuperAdminHeader : TrainerAdminHeader;

  return (
    <>
      <Header />
      {children}
    </>
  );
}
