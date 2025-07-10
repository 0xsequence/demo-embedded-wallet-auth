import { createContext, ReactNode, useEffect, useRef, useState } from 'react'
import { router, sequence } from '../main'
import { randomName } from '../utils/indexer'
import { EmailConflictInfo } from '@0xsequence/waas'
import { EmailConflictWarning } from './views/EmailConflictWarningView'
import { Box, Text } from '@0xsequence/design-system'

const TWITTER_CLIENT_ID = import.meta.env.VITE_TWITTER_CLIENT_ID

export const TwitterClientIdContext = createContext<string | undefined>(undefined)

export function MaybeWithTwitter({ children }: { children: ReactNode }) {
  const [emailConflictInfo, setEmailConflictInfo] = useState<EmailConflictInfo | undefined>()
  const forceCreateFuncRef = useRef<(() => Promise<void>) | null>(null)

  useEffect(() => {
    return sequence.onEmailConflict(async (info, forceCreate) => {
      forceCreateFuncRef.current = forceCreate
      setEmailConflictInfo(info)
    })
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!params.get('state')?.startsWith('twitter-')) {
      return
    }

    const code = params.get('code')
    if (code) {
      ;(async () => {
        const res = await fetch(`${import.meta.env.VITE_TWITTER_TOKEN_API_URL || 'https://api.x.com'}/2/oauth2/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                code,
                client_id: TWITTER_CLIENT_ID,
                grant_type: 'authorization_code',
                redirect_uri: `${window.location.origin}/login`,
                code_verifier: 'challenge',
            }),
        })
        const data = await res.json()
      
        const walletAddress = await sequence.signIn({ xAccessToken: data.access_token }, randomName())

        console.log('Wallet address: ', walletAddress)
        
        // Clean up
        window.location.search = ''

        router.navigate('/')
      })()
    }
  }, [])

  if (emailConflictInfo) {
    return (
      <EmailConflictWarning
        info={emailConflictInfo}
        onCancel={() => {
          setEmailConflictInfo(undefined)
          router.navigate('/')
        }}
        onConfirm={async () => {
          setEmailConflictInfo(undefined)
          await forceCreateFuncRef.current?.()
        }}
      />
    )
  }

  if (window.location.search.includes('state=twitter-')) {
    return (
      <Box>
        <Text variant="normal" color="text80">
          Loading...
        </Text>
      </Box>
    )
  }

  if (TWITTER_CLIENT_ID) {
    return <TwitterClientIdContext.Provider value={TWITTER_CLIENT_ID}>{children}</TwitterClientIdContext.Provider>
  }
  return children
}

