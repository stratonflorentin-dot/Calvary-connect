import { redirect } from "next/navigation";

export default function NewMeetingPage() {
  redirect("/hr/meetings?new=1");
}
