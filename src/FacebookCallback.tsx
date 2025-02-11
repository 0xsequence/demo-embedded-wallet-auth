import { useEffect, useState } from 'react'
import { Box, Text, Spinner } from '@0xsequence/design-system'

function FacebookCallback() {
  const [error, setError] = useState<string>()

  useEffect(() => {
    try {
      // Remove Facebook's #_=_ hash if present
      if (window.location.hash === '#_=_') {
        window.location.hash = ''
      }

      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const state = params.get('state')
      const error = params.get('error')
      const errorDescription = params.get('error_description')

      if (error || !code || !state) {
        throw new Error(errorDescription || 'Authentication failed')
      }

      // Send auth result back to main window
      if (window.opener) {
        window.opener.postMessage(
          {
            type: 'FACEBOOK_AUTH_CALLBACK',
            payload: { code, state }
          },
          '*' // Allow any origin, we'll validate in the receiver
        )

        // Close after a short delay to ensure message is sent
        setTimeout(() => window.close(), 100)
      } else {
        throw new Error('Popup window lost reference to opener')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    }
  }, [])

  if (error) {
    return (
      <Box padding="6" gap="4" alignItems="center">
        <Text color="negative">{error}</Text>
      </Box>
    )
  }

  return (
    <Box padding="6" gap="4" alignItems="center">
      <Spinner size="large" />
      <Text>Completing authentication...</Text>
    </Box>
  )
}

export default FacebookCallback
