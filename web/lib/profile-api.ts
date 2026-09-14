import { authenticatedApiFetch } from "@/lib/api/client";

export type Profile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  emailChangePending: boolean;
};

export type ProfileUpdate = Omit<Profile, "id" | "email" | "emailChangePending">;

export async function updateProfile(body: ProfileUpdate): Promise<Profile> {
  const response = await authenticatedApiFetch(
    "/profile",
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
    "We could not update your profile.",
  );
  return (await response.json()) as Profile;
}
