import { redirect } from "next/navigation";

// "Bucate la comandă" is now part of the unified ordering page ("Comandă acum").
export default function BucateRedirect() {
  redirect("/order");
}
