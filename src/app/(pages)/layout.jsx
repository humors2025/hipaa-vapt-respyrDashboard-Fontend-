import DevRoleSwitcher from "@/components/DevRoleSwitcher";

// Shared frame for all role-prefixed pages. Headers are per-role and live
// in /trainer/layout.jsx, /trainer-admin/layout.jsx, /super-admin/layout.jsx.
export default function AppLayout({ children }) {
  return (
    <>
      <main className="mx-[25px] my-3">{children}</main>
      <DevRoleSwitcher />
    </>
  );
}
