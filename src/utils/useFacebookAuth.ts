import { useEffect, useState } from 'react'
import { generateCodeVerifier, generateCodeChallenge, generateNonce } from './pkce'

interface FacebookAuthConfig {
  appId: string
  onSuccess?: (idToken: string) => void
  onError?: (error: Error) => void
}

export function useFacebookAuth(config: FacebookAuthConfig) {
  const [inProgress, setInProgress] = useState(false)

  useEffect(() => {
    // Check if this is a callback from Facebook
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const error = params.get('error')
    const errorDescription = params.get('error_description')

    // Only process if this appears to be a Facebook callback
    if (code || error) {
      const storedState = sessionStorage.getItem('facebook_state')
      const codeVerifier = sessionStorage.getItem('facebook_code_verifier')

      // Clean up session storage
      sessionStorage.removeItem('facebook_code_verifier')
      sessionStorage.removeItem('facebook_nonce')
      sessionStorage.removeItem('facebook_state')

      // Handle errors or invalid params
      if (error || !code || !state) {
        window.opener?.postMessage(
          {
            type: 'FACEBOOK_AUTH_ERROR',
            error: errorDescription || 'Authentication failed'
          },
          '*'
        )
        window.close()
        return
      }

      // Verify state
      if (state !== storedState) {
        window.opener?.postMessage(
          {
            type: 'FACEBOOK_AUTH_ERROR',
            error: 'Invalid state parameter'
          },
          '*'
        )
        window.close()
        return
      }

      // Send code back to parent window and close popup
      window.opener?.postMessage(
        {
          type: 'FACEBOOK_AUTH_CODE',
          payload: {
            code,
            codeVerifier: codeVerifier!
          }
        },
        '*'
      )
      window.close()
    }
  }, []) // Only run on first render

  const initiateFacebookLogin = async (): Promise<void> => {
    try {
      setInProgress(true)

      const codeVerifier = generateCodeVerifier()
      const codeChallenge = await generateCodeChallenge(codeVerifier)
      const nonce = generateNonce()
      const state = generateNonce()

      // Store PKCE values in session storage to use after redirect
      sessionStorage.setItem('facebook_code_verifier', codeVerifier)
      sessionStorage.setItem('facebook_nonce', nonce)
      sessionStorage.setItem('facebook_state', state)

      const params = new URLSearchParams({
        client_id: config.appId,
        scope: 'openid',
        response_type: 'code',
        redirect_uri: `${window.location.origin}/login`,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        nonce
      })

      const authUrl = `https://www.facebook.com/v11.0/dialog/oauth?${params.toString()}`

      // Open popup
      const popup = window.open(authUrl, 'facebook-login', 'width=600,height=700,left=400,top=100')

      if (!popup) {
        setInProgress(false)
        throw new Error('Popup was blocked. Please allow popups for this site.')
      }

      // Add message listener for popup callback
      const messageHandler = async (event: MessageEvent) => {
        if (event.data?.type === 'FACEBOOK_AUTH_CODE') {
          const { code, codeVerifier } = event.data.payload

          window.removeEventListener('message', messageHandler)
          clearInterval(checkPopupClosed)

          try {
            // Exchange code for tokens
            const tokenResponse = await fetch(
              `https://graph.facebook.com/v11.0/oauth/access_token?${new URLSearchParams({
                client_id: config.appId,
                redirect_uri: `${window.location.origin}/login`,
                code_verifier: codeVerifier,
                code
              })}`
            )

            if (!tokenResponse.ok) {
              throw new Error('Failed to exchange code for tokens')
            }

            const { id_token } = await tokenResponse.json()
            config.onSuccess?.(id_token)
          } catch (error) {
            config.onError?.(error instanceof Error ? error : new Error('Failed to complete Facebook authentication'))
          } finally {
            setInProgress(false)
          }
        } else if (event.data?.type === 'FACEBOOK_AUTH_ERROR') {
          window.removeEventListener('message', messageHandler)
          clearInterval(checkPopupClosed)
          config.onError?.(new Error(event.data.error))
          setInProgress(false)
        }
      }

      window.addEventListener('message', messageHandler)

      // Check if popup was closed before completing
      const checkPopupClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkPopupClosed)
          window.removeEventListener('message', messageHandler)
          config.onError?.(new Error('Authentication was cancelled'))
          setInProgress(false)
        }
      }, 1000)
    } catch (error) {
      setInProgress(false)
      config.onError?.(error instanceof Error ? error : new Error('Failed to initiate Facebook login'))
    }
  }

  return {
    initiateFacebookLogin,
    inProgress
  }
}
