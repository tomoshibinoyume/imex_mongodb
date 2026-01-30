import NextAuth from "next-auth"
import Auth0Provider from "next-auth/providers/auth0"
import { authOptions } from "@/lib/authOptions"
// import { getServerSession } from "next-auth";
const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
// console.log('api/auth/[...nextauth]');
