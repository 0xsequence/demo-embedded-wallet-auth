import { useEffect, useState } from 'react'
import { Box, Text, Divider, Button, Spinner, Modal, Collapsible, ExternalLinkIcon } from '@0xsequence/design-system'

import { router, sequence } from './main'

import { Logo } from './components/Logo'
import { SendTransactionsView } from './components/views/SendTransactionsView'
import { ListSessionsView } from './components/views/ListSessionsView'
import { googleLogout } from '@react-oauth/google'
import { SignMessageView } from './components/views/SignMessageView'
import { CallContractsView } from './components/views/CallContractsView'
import { AnimatePresence } from 'framer-motion'
import { PINCodeInput } from './components/PINCodeInput'
import { SendERC20View } from './components/views/SendERC20View'
import { SendERC1155View } from './components/views/SendERC1155View'
import { NetworkSwitch } from './components/NetworkSwitch.tsx'
import { ListAccountsView } from './components/views/ListAccountsView.tsx'
import { AccountName } from './components/views/AccountName.tsx'
import { Account, IdentityType, Network } from '@0xsequence/waas'
import { getMessageFromUnknownError } from './utils/getMessageFromUnknownError.ts'
import { PlayFabClient } from 'playfab-sdk'
import { SignTypedDataView } from './components/views/SignTypedDataView.tsx'

PlayFabClient.settings.titleId = import.meta.env.VITE_PLAYFAB_TITLE_ID

function App() {
  const [walletAddress, setWalletAddress] = useState<string>()
  const [fetchWalletAddressError, setFetchWalletAddressError] = useState<string>()

  const [sessionValidationCode, setSessionValidationCode] = useState<string[]>([])
  const [isValidateSessionPending, setIsValidateSessionPending] = useState(false)
  const [isFinishValidateSessionPending, setIsFinishValidateSessionPending] = useState(false)

  const [network, setNetwork] = useState<undefined | Network>()

  const [currentAccount, setCurrentAccount] = useState<Account>()

  useEffect(() => {
    sequence
      .getAddress()
      .then((address: string) => {
        setWalletAddress(address)
      })
      .catch((e: unknown) => {
        setFetchWalletAddressError(getMessageFromUnknownError(e))
      })

    sequence.listAccounts().then(response => {
      if (response.currentAccountId) {
        setCurrentAccount(response.accounts.find(account => account.id === response.currentAccountId))
      }
    })
  }, [])

  useEffect(() => {
    sequence.isSignedIn().then((signedIn: boolean) => {
      if (!signedIn) {
        router.navigate('/login')
      }
    })
  }, [])

  useEffect(() => {
    const code = sessionValidationCode.join('')
    if (code.length === 6) {
      setIsFinishValidateSessionPending(true)
      sequence.finishValidateSession(code)
    }
  }, [sessionValidationCode])

  useEffect(() => {
    const removeCallback = sequence.onValidationRequired(() => {
      setIsValidateSessionPending(true)

      sequence.waitForSessionValid(600 * 1000, 4000).then((isValid: boolean) => {
        console.log('isValid', isValid)
        setSessionValidationCode([])
        setIsValidateSessionPending(false)
        setIsFinishValidateSessionPending(false)
      })
    })
    return () => {
      removeCallback.then((cb: () => void) => cb())
    }
  }, [])

  return (
    <>
      <AnimatePresence>
        {isValidateSessionPending && (
          <Modal>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'Helvetica, Arial, sans-serif',
                fontSize: '1.2em',
                height: '50vh'
              }}
            >
              <Box flexDirection="column" alignItems="center">
                <Text marginBottom="7">Please enter the session verification code that was sent to your email</Text>
                <PINCodeInput value={sessionValidationCode} digits={6} onChange={setSessionValidationCode} />
                <Box marginTop="5">{isFinishValidateSessionPending && <Spinner />}</Box>
              </Box>
            </div>
          </Modal>
        )}
      </AnimatePresence>
      <Box marginY="0" marginX="auto" paddingX="6" style={{ maxWidth: '720px', marginTop: '80px', marginBottom: '80px' }}>
        <Box marginBottom="10">
          <Logo />
        </Box>

        <Box marginBottom="5" flexDirection="row">
          {currentAccount && (
            <Box flexDirection="column" gap="2">
              <Text marginTop="1" variant="normal" color="text100">
                {currentAccount.type === IdentityType.Guest
                  ? 'Guest account'
                  : `Logged in with account type ${currentAccount.type}`}{' '}
              </Text>
              {currentAccount.type !== IdentityType.Guest && <AccountName acc={currentAccount} />}
            </Box>
          )}

          <Button
            marginLeft="auto"
            label="Log out"
            size="xs"
            onClick={async () => {
              try {
                await sequence.dropSession({ strict: false })
              } catch (e: unknown) {
                console.warn(`Could not drop session: ${getMessageFromUnknownError(e)}`)
              }

              googleLogout()
              router.navigate('/login')
            }}
          />
        </Box>

        <Divider background="buttonGlass" />

        <Box marginBottom="5">
          <Text variant="normal" color="text100" fontWeight="bold">
            Your wallet address:
          </Text>
        </Box>

        <Box marginBottom="5">
          <Text variant="normal" color="text100" fontWeight="normal">
            {walletAddress ? (
              <Box>
                <Text>{walletAddress}</Text>
              </Box>
            ) : (
              <Spinner />
            )}
          </Text>
        </Box>

        <Box>{fetchWalletAddressError && <Text>Error fetching wallet address: {fetchWalletAddressError}</Text>}</Box>
        <Divider background="buttonGlass" />
        <ListSessionsView />

        <Divider background="buttonGlass" />

        <Box marginBottom="5">
          <NetworkSwitch onNetworkChange={setNetwork}></NetworkSwitch>
        </Box>

        <Divider background="buttonGlass" />

        <Collapsible marginY={'3'} label="Send native token transaction">
          <Divider background="buttonGlass" />
          <SendTransactionsView network={network} />
        </Collapsible>
        <Collapsible marginY={'3'} label="Send ERC20 transaction">
          <Divider background="buttonGlass" />
          <SendERC20View network={network} />
        </Collapsible>
        <Collapsible marginY={'3'} label="Send ERC1155 transaction">
          <Divider background="buttonGlass" />
          <SendERC1155View network={network} />
        </Collapsible>
        <Collapsible marginY={'3'} label="Sign a message">
          <Divider background="buttonGlass" />
          <SignMessageView network={network} />
        </Collapsible>
        <Collapsible marginY={'3'} label="Sign typed data">
          <Divider background="buttonGlass" />
          <SignTypedDataView network={network} />
        </Collapsible>
        <Collapsible marginY={'3'} label="Call contracts">
          <Divider background="buttonGlass" />
          <CallContractsView network={network} />
        </Collapsible>
        <Collapsible marginY={'3'} label="External Wallet Linking Demo">
          <Text
            as="a"
            variant="medium"
            color="text100"
            href="https://demo-waas-wallet-link.pages.dev/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Go to demo
            <ExternalLinkIcon position="relative" top="1" marginLeft="1" />
          </Text>
        </Collapsible>
        <ListAccountsView />
      </Box>
    </>
  )
}

export default App
