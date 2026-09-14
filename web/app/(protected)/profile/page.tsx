import { GeneralProfileSection } from "@/components/profile/general-profile-section";
import { ProfileShell } from "@/components/profile/profile-shell";
import { requireUser } from "@/lib/auth/require-user";
import type { Profile } from "@/lib/profile-api";

function metadataValue(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" ? value : "";
}

export default async function ProfilePage() {
  const claims = await requireUser();
  const metadata = claims.user_metadata && typeof claims.user_metadata === "object"
    ? (claims.user_metadata as Record<string, unknown>)
    : {};
  const initialProfile: Profile = {
    id: typeof claims.sub === "string" ? claims.sub : "",
    email: typeof claims.email === "string" ? claims.email : "",
    firstName: metadataValue(metadata, "first_name"),
    lastName: metadataValue(metadata, "last_name"),
    username: metadataValue(metadata, "username"),
    phone: metadataValue(metadata, "phone"),
    addressLine1: metadataValue(metadata, "address_line_1"),
    addressLine2: metadataValue(metadata, "address_line_2"),
    city: metadataValue(metadata, "city"),
    region: metadataValue(metadata, "region"),
    postalCode: metadataValue(metadata, "postal_code"),
    country: metadataValue(metadata, "country"),
    emailChangePending: false,
  };

  return (
    <ProfileShell activeSection="general">
      <GeneralProfileSection initialProfile={initialProfile} />
    </ProfileShell>
  );
}
