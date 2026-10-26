import DevRoleSwitcher from "@/components/DevRoleSwitcher";
import ViewAsBanner from "@/components/ViewAsBanner";

// Shared frame for all role-prefixed pages. Headers are per-role and live
// in /trainer/layout.jsx, /trainer-admin/layout.jsx, /super-admin/layout.jsx.
// ViewAsBanner sits above every header: it only renders while a super-admin
// "View as" session is active (see lib/viewAs.js).
export default function AppLayout({ children }) {
  return (
    <>
      <ViewAsBanner />
      <main className="mx-[25px] my-3">{children}</main>
      <DevRoleSwitcher />
    </>
  );
}
