"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { User } from "@/models/user";
import bcrypt from "bcryptjs";

export async function loginAction(_prev: { error?: string } | undefined, formData: FormData) {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/",
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password" };
    }
    throw error;
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function acceptInviteAction(
  token: string,
  _prev: { error?: string } | undefined,
  formData: FormData,
) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters" };
  if (password !== confirm) return { error: "Passwords do not match" };

  await dbConnect();
  const user = await User.findOne({ inviteToken: token });
  if (!user) return { error: "This link is invalid" };

  user.passwordHash = await bcrypt.hash(password, 10);
  user.isActive = true;
  await user.save();

  try {
    await signIn("credentials", {
      email: user.email,
      password,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Account ready. Please sign in." };
    }
    throw error;
  }
  return {};
}
