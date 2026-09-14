import { MoodAnalyticsSection } from "@/components/profile/mood-analytics-section";
import { ProfileShell } from "@/components/profile/profile-shell";

export default function AnalyticsPage() {
  return <ProfileShell activeSection="analytics"><MoodAnalyticsSection /></ProfileShell>;
}
