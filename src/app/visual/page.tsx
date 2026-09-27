import { redirect } from "next/navigation";

// Keep older shared links useful while the photo-based Designer replaces the
// separate vector visualization page.
export default function VisualPage() {
  redirect("/designer-studio#designerPhotoTitle");
}
