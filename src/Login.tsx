import {
  Box,
  Text,
  TextInput,
  Button,
  Spinner,
  Divider,
  Modal,
  Collapsible,
  EmailIcon,
  KeyIcon,
  Toast,
  Switch
} from '@0xsequence/design-system'
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
import { useCallback } from 'react'
import { generateCodeVerifier, generateCodeChallenge, generateNonce } from './utils/pkce'

function Login() {
  const [email, setEmail] = useState('')
  const [playfabEmail, setPlayfabEmail] = useState('')
  const [playfabError, setPlayfabError] = useState('')
  const [playfabLoggingIn, setPlayfabLoggingIn] = useState(false)
  const [playfabPassword, setPlayfabPassword] = useState('')
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

  const handlePlayfabLogin = useCallback(
    () =>
      PlayFabClient.LoginWithEmailAddress(
        {
          Password: playfabPassword,
          Email: playfabEmail
        },
        async (error, response) => {
          if (error) {
            setPlayfabError(JSON.stringify(error))
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
              setPlayfabError('')
            } catch (e) {
              console.error('Error: ' + getMessageFromUnknownError(e))
              setPlayfabError(getMessageFromUnknownError(e))
            }
          }
          setPlayfabLoggingIn(false)
          setTimeout(() => setPlayfabError(''), 4000)
        }
      ),
    [playfabEmail, playfabPassword]
  )

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

  // Handle Facebook callback redirect
  useEffect(() => {
    // Check if we're on the callback URL
    if (window.location.pathname === '/facebook-callback') {
      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.get('code')
      const state = urlParams.get('state')
      const storedState = sessionStorage.getItem('facebook_state')
      const codeVerifier = sessionStorage.getItem('facebook_code_verifier')

      // Remove Facebook's #_=_ hash if present
      if (window.location.hash === '#_=_') {
        window.location.hash = ''
      }

      if (!code || !state || !storedState || !codeVerifier || state !== storedState) {
        console.error('Invalid callback parameters')
        return
      }

      const exchangeToken = async () => {
        try {
          const tokenResponse = await fetch(
            `https://graph.facebook.com/v11.0/oauth/access_token?${new URLSearchParams({
              client_id: import.meta.env.VITE_FACEBOOK_APP_ID,
              redirect_uri: window.location.origin + '/facebook-callback',
              code_verifier: codeVerifier,
              code
            })}`
          )

          if (!tokenResponse.ok) {
            throw new Error('Failed to exchange code for tokens')
          }

          const { id_token } = await tokenResponse.json()

          // Clean up session storage
          sessionStorage.removeItem('facebook_code_verifier')
          sessionStorage.removeItem('facebook_nonce')
          sessionStorage.removeItem('facebook_state')

          // Sign in with Sequence using the ID token
          const res = await sequence.signIn(
            {
              idToken: id_token
            },
            randomName()
          )

          console.log(`Wallet address: ${res.wallet}`)
          console.log(`Email address: ${res.email}`)
          router.navigate('/')
        } catch (error) {
          console.error('Failed to complete Facebook authentication:', error)
        }
      }

      exchangeToken()
    }
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

  const initiateFacebookLogin = async () => {
    try {
      const codeVerifier = generateCodeVerifier()
      const codeChallenge = await generateCodeChallenge(codeVerifier)
      const nonce = generateNonce()
      const state = generateNonce() // Use nonce generator for state too

      // Store PKCE values in session storage to use after redirect
      sessionStorage.setItem('facebook_code_verifier', codeVerifier)
      sessionStorage.setItem('facebook_nonce', nonce)
      sessionStorage.setItem('facebook_state', state)

      const params = new URLSearchParams({
        client_id: import.meta.env.VITE_FACEBOOK_APP_ID,
        scope: 'openid',
        response_type: 'code',
        redirect_uri: window.location.origin + '/facebook-callback',
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        nonce
      })

      const authUrl = `https://www.facebook.com/v11.0/dialog/oauth?${params.toString()}`

      // Open popup
      const popup = window.open(authUrl, 'facebook-login', 'width=600,height=700,left=400,top=100')

      if (!popup) {
        throw new Error('Popup was blocked. Please allow popups for this site.')
      }

      // Check if popup was closed before completing
      const checkPopupClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkPopupClosed)
          window.removeEventListener('message', messageHandler)
          console.error('Authentication was cancelled')
        }
      }, 1000)

      // Add message listener for popup callback
      const messageHandler = async (event: MessageEvent) => {
        // Only accept messages from our callback page
        if (event.data?.type === 'FACEBOOK_AUTH_CALLBACK') {
          window.removeEventListener('message', messageHandler)
          clearInterval(checkPopupClosed)

          const { code, state: returnedState } = event.data.payload

          if (!code || !returnedState || returnedState !== state) {
            console.error('Invalid callback parameters')
            return
          }

          try {
            const callbackUrl = window.location.origin + '/facebook-callback'
            // Exchange code for tokens
            const tokenResponse = await fetch(
              `https://graph.facebook.com/v11.0/oauth/access_token?${new URLSearchParams({
                client_id: import.meta.env.VITE_FACEBOOK_APP_ID,
                redirect_uri: callbackUrl,
                code_verifier: codeVerifier,
                code
              })}`
            )

            if (!tokenResponse.ok) {
              throw new Error('Failed to exchange code for tokens')
            }

            const { id_token } = await tokenResponse.json()

            // Clean up session storage
            sessionStorage.removeItem('facebook_code_verifier')
            sessionStorage.removeItem('facebook_nonce')
            sessionStorage.removeItem('facebook_state')

            // Sign in with Sequence using the ID token
            const res = await sequence.signIn(
              {
                idToken: id_token
              },
              randomName()
            )

            console.log(`Wallet address: ${res.wallet}`)
            console.log(`Email address: ${res.email}`)
            router.navigate('/')
          } catch (error) {
            console.error('Failed to complete Facebook authentication:', error)
          }
        }
      }

      window.addEventListener('message', messageHandler)
    } catch (error) {
      console.error('Failed to initiate Facebook login:', error)
    }
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
                {import.meta.env.VITE_FACEBOOK_APP_ID && (
                  <button
                    key="facebook"
                    onClick={initiateFacebookLogin}
                    style={{
                      backgroundColor: '#4267b2',
                      color: '#fff',
                      fontSize: '16px',
                      padding: '10px 20px',
                      border: 'none',
                      borderRadius: '4px',
                      width: '230px',
                      cursor: 'pointer'
                    }}
                  >
                    Continue with Facebook
                  </button>
                )}
              </Box>

              <Divider background="buttonGlass" width="full" />

              {import.meta.env.VITE_PLAYFAB_TITLE_ID && (
                <Collapsible label="Playfab Login">
                  <Box>
                    <Button label="Login with Google (through Playfab)" onClick={handleGooglePlayfabLogin} />
                  </Box>
                  <br />
                  <Collapsible label="Login with Playfab email/password">
                    <Box flexDirection="row" gap="4">
                      <TextInput
                        leftIcon={EmailIcon}
                        placeholder="email address"
                        onChange={(ev: { target: { value: SetStateAction<string> } }) => setPlayfabEmail(ev.target.value)}
                      />
                      <TextInput
                        leftIcon={KeyIcon}
                        placeholder="password"
                        type="password"
                        onChange={(ev: { target: { value: SetStateAction<string> } }) => setPlayfabPassword(ev.target.value)}
                        onKeyDown={(event: KeyboardEvent) => {
                          if (event.key === 'Enter') {
                            if (playfabLoggingIn) {
                              return
                            }
                            setPlayfabLoggingIn(true)
                            handlePlayfabLogin()
                          }
                        }}
                      />
                      <Button
                        pending={playfabLoggingIn}
                        label="Login"
                        onClick={() => {
                          if (playfabLoggingIn) {
                            return
                          }
                          setPlayfabLoggingIn(true)
                          handlePlayfabLogin()
                        }}
                      />
                    </Box>
                    {playfabError && <Toast title="Error" variant="error" isDismissible={true} description={playfabError} />}
                  </Collapsible>
                </Collapsible>
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
