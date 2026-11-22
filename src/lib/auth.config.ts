import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/types";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isPublic =
        pathname.startsWith("/login") ||
        pathname.startsWith("/invite") ||
        pathname.startsWith("/t/") ||
        pathname.startsWith("/api/webhooks/") ||
        pathname.startsWith("/api/auth");
      if (isPublic) return true;
      return Boolean(auth?.user);
    },
    jwt({ token, user }) {
      if (user) {
        const nextUser = user as { id?: string; role?: Role };
        token.id = String(nextUser.id ?? "");
        token.role = nextUser.role ?? "TEAM_MEMBER";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? "");
        session.user.role = (token.role as Role) ?? "TEAM_MEMBER";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
