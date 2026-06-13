import { redirect } from "next/navigation";

export default function TrainerAdminIndex() {
  redirect("/trainer-admin/trainers");
}
