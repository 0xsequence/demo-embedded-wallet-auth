import { Button } from "@0xsequence/design-system"
import { useContext } from "react"
import { TwitterClientIdContext } from './MaybeWithTwitter.tsx'

export function TwitterLogin() {
  const twitterClientId = useContext(TwitterClientIdContext)

  if (!twitterClientId) {
    return null
  }

  const handleClick = () => {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: twitterClientId,
      redirect_uri: `${window.location.origin}/login`,
      scope: 'users.read users.email tweet.read', // tweet.read is required for reading current user (for some reason)
      state: `twitter-${Math.random().toString(36).substring(2, 15)}`,
      code_challenge: 'challenge',
      code_challenge_method: 'plain',
    })
    window.location.assign(`https://x.com/i/oauth2/authorize?${params.toString()}`)
  }

  return (
    <Button onClick={handleClick}  label="Login with Twitter" />
  )
}
