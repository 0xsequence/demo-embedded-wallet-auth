import { useEffect, useState } from 'react'
import { generateNonce } from './pkce'

interface TwitchAuthConfig {
  clientId: string
  redirectUri: string
  scope?: string
  onSuccess?: (accessToken: string, idToken: string) => void
  onError?: (error: Error) => void
}

export function useTwitchAuth(config: TwitchAuthConfig) {
  const [inProgress, setInProgress] = useState(false)

  useEffect(() => {
    // Check if this is a callback from Twitch (tokens are in hash)
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const idToken = params.get('id_token')
    const state = params.get('state')
    const error = params.get('error')
    const errorDescription = params.get('error_description')

    // Only process if this appears to be a Twitch callback
    if (accessToken || error) {
      const storedState = sessionStorage.getItem('twitch_state')
      const storedNonce = sessionStorage.getItem('twitch_nonce')

      // Clean up session storage
      sessionStorage.removeItem('twitch_state')
      sessionStorage.removeItem('twitch_nonce')

      // Handle errors or invalid params
      if (error || !state) {
        window.opener?.postMessage(
          {
            type: 'TWITCH_AUTH_ERROR',
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
            type: 'TWITCH_AUTH_ERROR',
            error: 'Invalid state parameter'
          },
          '*'
        )
        window.close()
        return
      }

      // Send tokens back to parent window and close popup
      window.opener?.postMessage(
        {
          type: 'TWITCH_AUTH_SUCCESS',
          payload: {
            accessToken,
            idToken,
            nonce: storedNonce
          }
        },
        '*'
      )
      window.close()
    }
  }, []) // Only run on first render

  const initiateTwitchLogin = async (): Promise<void> => {
    try {
      setInProgress(true)

      const state = generateNonce()
      const nonce = generateNonce()

      // Store values in session storage to use after redirect
      sessionStorage.setItem('twitch_state', state)
      sessionStorage.setItem('twitch_nonce', nonce)

      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'token id_token',
        scope: config.scope || 'openid',
        state,
        nonce
      })

      const authUrl = `https://id.twitch.tv/oauth2/authorize?${params.toString()}`

      // Open popup
      const popup = window.open(authUrl, 'twitch-login', 'width=600,height=700,left=400,top=100')

      if (!popup) {
        setInProgress(false)
        throw new Error('Popup was blocked. Please allow popups for this site.')
      }

      // Add message listener for popup callback
      const messageHandler = async (event: MessageEvent) => {
        if (event.data?.type === 'TWITCH_AUTH_SUCCESS') {
          const { accessToken, idToken, nonce } = event.data.payload

          window.removeEventListener('message', messageHandler)
          clearInterval(checkPopupClosed)

          try {
            // Decode and verify the ID token's nonce
            const [, payload] = idToken.split('.')
            const decodedPayload = JSON.parse(atob(payload))

            if (decodedPayload.nonce !== nonce) {
              throw new Error('Invalid nonce in ID token')
            }

            config.onSuccess?.(accessToken, idToken)
          } catch (error) {
            config.onError?.(error instanceof Error ? error : new Error('Failed to complete Twitch authentication'))
          } finally {
            setInProgress(false)
          }
        } else if (event.data?.type === 'TWITCH_AUTH_ERROR') {
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
      config.onError?.(error instanceof Error ? error : new Error('Failed to initiate Twitch login'))
    }
  }

  return {
    initiateTwitchLogin,
    inProgress
  }
}
