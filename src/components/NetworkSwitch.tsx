import { Box, Text, Select, TokenImage, Spinner } from '@0xsequence/design-system'
import { useEffect, useState } from 'react'
import { sequence } from '../main.tsx'
import { NetworkList, Network } from '@0xsequence/waas'
import { networkImages } from '../assets/networks/index.ts'

export function NetworkSwitch({ onNetworkChange }: { onNetworkChange: (network: Network) => void }) {
  const [network, setNetwork] = useState<undefined | Network>()
  const [networkList, setNetworkList] = useState<NetworkList>([])

  useEffect(() => {
    sequence.networkList().then((networks: NetworkList) => {
      const sortedNetworks = [...networks].sort((a, b) => a.name.localeCompare(b.name))
      setNetworkList(sortedNetworks)
      setNetwork(sortedNetworks[0])
      onNetworkChange(sortedNetworks[0])
    })
  }, [])

  if (networkList.length === 0) {
    return (
      <Box marginY="5">
        <Spinner />
      </Box>
    )
  }

  return (
    <Box marginBottom="4">
      <Box marginBottom="4">
        <Text variant="normal" color="text100" fontWeight="bold">
          Network to use with requests:
        </Text>
      </Box>
      <Box>
        <Select
          name="chainId"
          labelLocation="top"
          onValueChange={val => {
            const selected = networkList?.find(chain => chain.name === val)
            if (selected) {
              setNetwork(selected)
              onNetworkChange(selected)
            }
          }}
          value={network?.name}
          options={[
            ...networkList.map(chain => ({
              label: (
                <Box alignItems="center" gap="2">
                  <TokenImage src={networkImages[chain.id]} size="sm" />
                  <Text>{chain.name}</Text>
                </Box>
              ),
              value: String(chain.name)
            }))
          ]}
        />
      </Box>
    </Box>
  )
}
