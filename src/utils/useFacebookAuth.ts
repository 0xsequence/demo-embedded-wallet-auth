import { useEffect } from 'react'
import { generateCodeVerifier, generateCodeChallenge, generateNonce } from './pkce'

interface FacebookAuthConfig {
  appId: string
  onSuccess?: (idToken: string) => void
  onError?: (error: Error) => void
}

export function useFacebookAuth(config: FacebookAuthConfig) {
  useEffect(() => {
    // Check if this is a callback from Facebook
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const error = params.get('error')
    const errorDescription = params.get('error_description')

    // Only process if this appears to be a Facebook callback
    if (code || error) {
      const codeVerifier = sessionStorage.getItem('facebook_code_verifier')
      const storedState = sessionStorage.getItem('facebook_state')

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

      // Exchange code for tokens
      fetch(
        `https://graph.facebook.com/v11.0/oauth/access_token?${new URLSearchParams({
          client_id: config.appId,
          redirect_uri: `${window.location.origin}/login`,
          code_verifier: codeVerifier!,
          code
        })}`
      )
        .then(response => {
          if (!response.ok) throw new Error('Failed to exchange code for tokens')
          return response.json()
        })
        .then(data => {
          window.opener?.postMessage(
            {
              type: 'FACEBOOK_AUTH_CALLBACK',
              payload: { idToken: data.id_token }
            },
            '*'
          )
          window.close()
        })
        .catch(error => {
          window.opener?.postMessage(
            {
              type: 'FACEBOOK_AUTH_ERROR',
              error: error instanceof Error ? error.message : 'Failed to complete Facebook authentication'
            },
            '*'
          )
          window.close()
        })
    }
  }, [])

  const initiateFacebookLogin = async (): Promise<void> => {
    try {
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
        throw new Error('Popup was blocked. Please allow popups for this site.')
      }

      // Add message listener for popup callback
      const messageHandler = (event: MessageEvent) => {
        if (event.data?.type === 'FACEBOOK_AUTH_CALLBACK') {
          window.removeEventListener('message', messageHandler)
          clearInterval(checkPopupClosed)
          config.onSuccess?.(event.data.payload.idToken)
        } else if (event.data?.type === 'FACEBOOK_AUTH_ERROR') {
          window.removeEventListener('message', messageHandler)
          clearInterval(checkPopupClosed)
          config.onError?.(new Error(event.data.error))
        }
      }

      window.addEventListener('message', messageHandler)

      // Check if popup was closed before completing
      const checkPopupClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkPopupClosed)
          window.removeEventListener('message', messageHandler)
          config.onError?.(new Error('Authentication was cancelled'))
        }
      }, 1000)
    } catch (error) {
      config.onError?.(error instanceof Error ? error : new Error('Failed to initiate Facebook login'))
    }
  }

  return {
    initiateFacebookLogin
  }
}
