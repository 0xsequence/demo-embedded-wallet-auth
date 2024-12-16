import { Box, Text, Button, TextInput } from '@0xsequence/design-system'
import { Network } from '@0xsequence/waas'
import { SetStateAction, useState } from 'react'
import { sequence } from '../../main'

export function SignTypedDataView(props: { network?: Network }) {
  const [typedData, setTypedData] = useState<string>('')
  const [signature, setSignature] = useState<string>()

  const signTypedData = async () => {
    const signature = await sequence.signTypedData({
      typedData: JSON.parse(typedData),
      network: props.network?.id
    })

    setSignature(signature.data.signature)
  }

  return (
    <Box>
      <TextInput
        name="signTypedDataText"
        type="textarea"
        onChange={(ev: { target: { value: SetStateAction<string> } }) => {
          setTypedData(ev.target.value)
          if (signature != '') {
            setSignature('')
          }
        }}
        value={typedData}
        placeholder="Enter a typed data to sign"
        required
        data-id="signTypedDataInput"
      />
      <Button marginTop="5" label="Sign typed data" disabled={typedData === ''} onClick={() => signTypedData()} />
      {signature && signature !== '' && (
        <Box flexDirection="column" marginTop="5">
          <Text variant="normal" color="text100" fontWeight="bold">
            Signature for {typedData}:
          </Text>
          <Box>
            <Text as="p" wordBreak="break-word">
              {signature}
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  )
}
