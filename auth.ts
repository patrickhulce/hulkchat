import NextAuth, { type DefaultSession } from 'next-auth'
import Google from 'next-auth/providers/google'

async function sha1(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)

  const hashBuffer = await crypto.subtle.digest('SHA-1', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')

  return hashHex
}

declare module 'next-auth' {
  interface Session {
    user: {
      /** The user's id. */
      id: string
    } & DefaultSession['user']
  }
}

export const {
  handlers: { GET, POST },
  auth,
  CSRF_experimental // will be removed in future
} = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET
    })
  ],
  callbacks: {
    async jwt({ token, profile }) {
      if (profile) {
        token.id = token.id || profile.id
        token.image = profile.picture
      }

      if (typeof token.id !== 'string') {
        token.id = await sha1(token.email || 'anonymous')
      }

      return token
    },
    authorized({ auth }) {
      return !!auth?.user // this ensures there is a logged in user for -every- request
    }
  },
  pages: {
    signIn: '/sign-in' // overrides the next-auth default signin page https://authjs.dev/guides/basics/pages
  }
})
