import { useEffect } from 'react'

function FacebookCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')

    // Send auth result back to main window
    if (window.opener) {
      window.opener.postMessage(
        {
          type: 'FACEBOOK_AUTH_CALLBACK',
          payload: { code, state }
        },
        window.location.origin
      )
      window.close()
    }
  }, [])

  return null
}

export default FacebookCallback
