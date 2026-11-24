import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@/lib/auth.config";
import { dbConnect } from "@/lib/db";
import { User } from "@/models/user";
import { normalizeRole, type Role } from "@/types";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        await dbConnect();
        const user = await User.findOne({ email, isActive: true }).lean();
        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: String(user._id),
          email: user.email,
          name: user.name,
          role: normalizeRole(String(user.role)),
        };
      },
    }),
  ],
  secret: process.env.AUTH_SECRET,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        const nextUser = user as { id?: string; role?: Role; name?: string | null; email?: string | null };
        token.id = String(nextUser.id ?? "");
        token.role = normalizeRole(nextUser.role);
        token.inactive = false;
        if (nextUser.name) token.name = nextUser.name;
        if (nextUser.email) token.email = nextUser.email;
      }

      if (token.id) {
        try {
          await dbConnect();
          const fresh = await User.findById(token.id).select("role isActive name email").lean();
          if (!fresh?.isActive) {
            token.inactive = true;
          } else {
            token.inactive = false;
            token.role = normalizeRole(String(fresh.role));
            token.name = fresh.name;
            token.email = fresh.email;
          }
        } catch {
          // Keep the last known role if the database is briefly unavailable.
        }
      }

      return token;
    },
    session({ session, token }) {
      if (!session.user) return session;
      if (token.inactive || !token.id) {
        session.user.id = "";
        return session;
      }
      session.user.id = String(token.id);
      session.user.role = normalizeRole(token.role as string | undefined);
      if (token.name) session.user.name = String(token.name);
      if (token.email) session.user.email = String(token.email);
      return session;
    },
  },
});
