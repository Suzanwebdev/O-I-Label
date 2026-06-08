import { redirect } from "next/navigation";

export default function LegacyMaintenanceRedirect() {
  redirect("/closed/maintenance");
}
