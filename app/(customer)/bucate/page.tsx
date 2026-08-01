import { redirect } from "next/navigation";

// "Bucate la comandă" is now part of the unified menu page.
export default function BucateRedirect() {
  redirect("/meniu");
}
