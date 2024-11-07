import { Box, Text, TextInput, Button, Spinner, Divider, Modal, Switch } from '@0xsequence/design-system'
import { SetStateAction, useEffect, useRef, useState } from 'react'
import { CredentialResponse, GoogleLogin, useGoogleLogin } from '@react-oauth/google'
import AppleSignin from 'react-apple-signin-auth'

import { router, sequence } from './main'

import { PINCodeInput } from './components/PINCodeInput'
import { Logo } from './components/Logo'
import { EmailConflictWarning } from './components/views/EmailConflictWarningView.tsx'

import { randomName } from './utils/indexer'
import { useEmailAuth } from './utils/useEmailAuth.ts'
import { StytchLogin } from './components/StytchLogin.tsx'
import { StytchLegacyLogin } from './components/StytchLegacyLogin.tsx'
import { EmailConflictInfo } from '@0xsequence/waas'
import { PlayFabClient } from 'playfab-sdk'
import { LoginRequest } from './LoginRequest.tsx'
import { getMessageFromUnknownError } from './utils/getMessageFromUnknownError.ts'

function Login() {
  const [email, setEmail] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const isEmailValid = inputRef.current?.validity.valid
  const [showEmailWarning, setEmailWarning] = useState(false)
  const [code, setCode] = useState<string[]>([])

  const [emailConflictInfo, setEmailConflictInfo] = useState<EmailConflictInfo | undefined>()
  const [isEmailConflictModalOpen, setIsEmailConflictModalOpen] = useState(false)
  const forceCreateFuncRef = useRef<(() => Promise<void>) | null>(null)

  sequence.onEmailConflict(async (info, forceCreate) => {
    forceCreateFuncRef.current = forceCreate
    setEmailConflictInfo(info)
    setIsEmailConflictModalOpen(true)
  })

  const handleGooglePlayfabLogin = useGoogleLogin({
    flow: 'implicit',
    onSuccess: tokenResponse => {
      PlayFabClient.LoginWithGoogleAccount(
        {
          AccessToken: tokenResponse.access_token, // This access token is generated after a user has signed into Google
          CreateAccount: true
        } as LoginRequest,
        async (error, response) => {
          if (error) {
            console.error('Error: ' + JSON.stringify(error))
          } else if (response.data.SessionTicket) {
            try {
              const seqRes = await sequence.signIn(
                {
                  playFabTitleId: import.meta.env.VITE_PLAYFAB_TITLE_ID,
                  playFabSessionTicket: response.data.SessionTicket
                },
                randomName()
              )
              console.log('Sequence response:', seqRes)
              router.navigate('/')
            } catch (e) {
              console.error('Error: ' + getMessageFromUnknownError(e))
            }
          }
        }
      )
    }
  })

  const {
    inProgress: emailAuthInProgress,
    loading: emailAuthLoading,
    initiateAuth: initiateEmailAuth,
    sendChallengeAnswer,
    cancel: cancelEmailAuth
  } = useEmailAuth({
    sessionName: randomName(),
    onSuccess: async ({ wallet }) => {
      console.log(`Wallet address: ${wallet}`)
      router.navigate('/')
    }
  })

  useEffect(() => {
    sequence.isSignedIn().then((signedIn: boolean) => {
      if (!signedIn) {
        router.navigate('/login')
      }
    })
  }, [])

  const handleGoogleLogin = async (tokenResponse: CredentialResponse) => {
    const res = await sequence.signIn(
      {
        idToken: tokenResponse.credential!
      },
      randomName()
    )

    console.log(`Wallet address: ${res.wallet}`)
    console.log(`Email address: ${res.email}`)
    router.navigate('/')
  }

  const appleRedirectUri = 'https://' + window.location.host
  const handleAppleLogin = async (response: { authorization: { id_token: string } }) => {
    const res = await sequence.signIn(
      {
        idToken: response.authorization.id_token
      },
      randomName()
    )

    console.log(`Wallet address: ${res.wallet}`)
    console.log(`Email address: ${res.email}`)
    router.navigate('/')
  }

  const handleGuestLogin = async () => {
    const signInResponse = await sequence.signIn({ guest: true }, randomName())
    console.log(`Wallet address: ${signInResponse.wallet}`)
    router.navigate('/')
  }

  const urlParams = new URLSearchParams(window.location.search)
  const isDevEnv = urlParams.get('env') === 'dev'
  const [useDevEnv, setUseDevEnv] = useState(isDevEnv)

  return (
    <>
      <Box marginY="0" marginX="auto" paddingX="6" style={{ maxWidth: '720px', marginTop: '80px', marginBottom: '80px' }}>
        <Box marginBottom="16" flexDirection="row">
          <Logo />
          <Box marginLeft="auto">
            <Switch
              label="Use dev env"
              checked={useDevEnv}
              onCheckedChange={() => {
                if (!useDevEnv) {
                  urlParams.set('env', 'dev')
                  window.location.search = urlParams.toString()
                } else {
                  urlParams.delete('env')
                  window.location.search = urlParams.toString()
                }
                setUseDevEnv(!useDevEnv)
              }}
            />
          </Box>
        </Box>

        <Box marginTop="6" marginBottom="4">
          <Text variant="large" color="text100" fontWeight="bold">
            Guest Login
          </Text>
        </Box>

        <Box gap="4">
          <Button label="Login as guest" onClick={handleGuestLogin} />
        </Box>

        <Divider background="buttonGlass" />

        <Box marginTop="6">
          <Text variant="large" color="text100" fontWeight="bold">
            Email Login
          </Text>
        </Box>

        {sendChallengeAnswer ? (
          <Box flexDirection="column">
            <Box marginTop="6">
              <Text marginTop="5" variant="normal" color="text80">
                Enter code received in email.
              </Text>
            </Box>
            <Box marginTop="4">
              <PINCodeInput value={code} digits={6} onChange={setCode} />
            </Box>

            <Box gap="2" marginY="4">
              {emailAuthLoading ? (
                <Spinner />
              ) : (
                <Button
                  variant="primary"
                  disabled={code.includes('')}
                  label="Verify"
                  onClick={() => sendChallengeAnswer(code.join(''))}
                  data-id="verifyButton"
                />
              )}
            </Box>
          </Box>
        ) : (
          <Box marginTop="5" marginBottom="4">
            <Text variant="normal" color="text80">
              Enter your email to recieve a code to login and create your wallet. <br />
              Please check your spam folder if you don&apos;t see it in your inbox.
            </Text>

            <Box marginTop="6">
              <TextInput
                name="email"
                type="email"
                onChange={(ev: { target: { value: SetStateAction<string> } }) => {
                  setEmail(ev.target.value)
                }}
                ref={inputRef}
                onKeyDown={(ev: { key: string }) => {
                  if (email && ev.key === 'Enter') {
                    initiateEmailAuth(email)
                  }
                }}
                onBlur={() => setEmailWarning(!!email && !isEmailValid)}
                value={email}
                placeholder="hello@example.com"
                required
                data-id="loginEmail"
              />
              {showEmailWarning && (
                <Text as="p" variant="small" color="negative" marginY="2">
                  Invalid email address
                </Text>
              )}
            </Box>
            <Box gap="2" marginY="4" alignItems="center" justifyContent="center">
              {emailAuthLoading ? (
                <Spinner />
              ) : (
                <Button
                  variant="primary"
                  disabled={!isEmailValid}
                  label="Continue"
                  onClick={() => initiateEmailAuth(email)}
                  data-id="continueButton"
                />
              )}
            </Box>
          </Box>
        )}

        <Divider background="buttonGlass" />

        <Box paddingY="4" gap="4" flexDirection="column" width="full">
          {!emailAuthInProgress && (
            <>
              <Box marginBottom="2">
                <Text variant="large" color="text100" fontWeight="bold">
                  Social Login
                </Text>
              </Box>
              <Box gap="4" flexDirection="column" width="fit">
                {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
                  <Box>
                    <GoogleLogin key="google" onSuccess={handleGoogleLogin} shape="circle" width={230} />
                  </Box>
                )}
                {import.meta.env.VITE_APPLE_CLIENT_ID && (
                  <AppleSignin
                    key="apple"
                    authOptions={{
                      clientId: import.meta.env.VITE_APPLE_CLIENT_ID,
                      scope: 'openid email',
                      redirectURI: appleRedirectUri,
                      usePopup: true
                    }}
                    onError={(error: unknown) => console.error(getMessageFromUnknownError(error))}
                    onSuccess={handleAppleLogin}
                    uiType="dark"
                  />
                )}
              </Box>

              <Divider background="buttonGlass" width="full" />

              {import.meta.env.VITE_PLAYFAB_TITLE_ID && (
                <Box>
                  <Box marginBottom="4">
                    <Text variant="large" color="text100" fontWeight="bold">
                      Playfab login
                    </Text>
                  </Box>

                  <Box>
                    <Button label="Login with Google (through Playfab)" onClick={handleGooglePlayfabLogin} />
                  </Box>
                </Box>
              )}

              {import.meta.env.VITE_STYTCH_PUBLIC_TOKEN && !import.meta.env.VITE_STYTCH_LEGACY_ISSUER && <StytchLogin />}

              {import.meta.env.VITE_STYTCH_PUBLIC_TOKEN && import.meta.env.VITE_STYTCH_LEGACY_ISSUER && <StytchLegacyLogin />}
            </>
          )}
        </Box>
      </Box>

      {isEmailConflictModalOpen && emailConflictInfo && (
        <Modal size="small" onClose={() => setIsEmailConflictModalOpen(false)}>
          <EmailConflictWarning
            info={emailConflictInfo}
            onCancel={() => {
              setIsEmailConflictModalOpen(false)
              setEmailConflictInfo(undefined)
              if (emailAuthInProgress) {
                setCode([])
                cancelEmailAuth()
                setEmail('')
              }
            }}
            onConfirm={async () => {
              setIsEmailConflictModalOpen(false)
              setEmailConflictInfo(undefined)
              await forceCreateFuncRef.current?.()
            }}
          />
        </Modal>
      )}
    </>
  )
}

export default Login
