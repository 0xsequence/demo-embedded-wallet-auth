
import { Box, Text, Button, TextInput, Spinner } from "@0xsequence/design-system"
import { SetStateAction, useState } from "react"
import { signer } from '../../main'
import { ContractTransaction, ethers } from 'ethers'

export function CallContractsView() {
  const [contractAddress, setContractAddress] = useState<string>('')
  const [contractAbi, setContractAbi] = useState<string>('')
  const [contractMethod, setContractMethod] = useState<string>('')
  const [contractMethodArgs, setContractMethodArgs] = useState<string>('')
  const [transactionHash, setTransactionHash] = useState<string>()
  const [inProgress, setInProgress] = useState<boolean>(false)
  const [sendTransactionError, setSendTransactionError] = useState<string>()

  const callContract = async () => {
    try {
      setSendTransactionError(undefined)
      setInProgress(true)

      const contract = new ethers.Contract(contractAddress, JSON.parse(contractAbi), signer)
      const tx: ContractTransaction = await contract[contractMethod](...JSON.parse(contractMethodArgs))
      setTransactionHash(tx.hash)
      await tx.wait()

      setInProgress(false)
    } catch (e) {
      console.error(e)
      setInProgress(false)
    }
  }

  return (
    <Box>
      <Box marginBottom="5">
        <Text variant="normal" color="text100" fontWeight="bold">
          Call any contract
        </Text>
      </Box>
      <Box marginTop="5">
        <TextInput
          name="callContractAddress"
          type="text"
          onChange={(ev: { target: { value: SetStateAction<string> } }) => {
            setContractAddress(ev.target.value)
          }}
          value={contractAddress}
          placeholder="Contract address 0x..."
          required
          data-id="nativeTokenSendAddress"
        />
      </Box>
      <Box marginTop="5">
        <TextInput
          name="callContractAbi"
          type="text"
          onChange={(ev: { target: { value: SetStateAction<string> } }) => {
            setContractAbi(ev.target.value)
          }}
          value={contractAbi}
          placeholder="Contract ABI or function ABI, e.g. [{...}] or [{...}, {...}] or transfer(address,uint256)"
          required
          data-id="nativeTokenSendAmount"
        />
      </Box>
      <Box marginTop="5">
        <TextInput
          name="callContractMethod"
          type="text"
          onChange={(ev: { target: { value: SetStateAction<string> } }) => {
            setContractMethod(ev.target.value)
          }}
          value={contractMethod}
          placeholder="Method name, e.g. transfer"
          required
          data-id="nativeTokenSendAmount"
        />
      </Box>
      <Box marginTop="5">
        <TextInput
          name="callContractArgs"
          type="text"
          onChange={(ev: { target: { value: SetStateAction<string> } }) => {
            setContractMethodArgs(ev.target.value)
          }}
          value={contractMethodArgs}
          placeholder={`Method args, e.g. [0x..., 1000] or named { "to": "0x...", "amount": "1000" }`}
          required
          data-id="nativeTokenSendAmount"
        />
      </Box>
      {sendTransactionError && (
        <Box marginTop="3">
          Transaction failed: {sendTransactionError}
        </Box>
      )}
      {!inProgress ? (
        <Button
          marginTop="5"
          label="Call contract"
          disabled={
            contractAddress === '' &&
            contractAbi === '' &&
            contractMethod === '' &&
            contractMethodArgs === ''
          }
          onClick={() => callContract() }
        />
      ) : (
        <Box gap="2" marginY="4" alignItems="center" justifyContent="center">
          <Spinner />
        </Box>
      )}
      {transactionHash && (
        <Box marginTop="3">
          <Text variant="normal" color="text100" fontWeight="bold">
            Send native token transaction hash:
          </Text>
          <br />
          <a href={`https://polygonscan.com/tx/${transactionHash}`} target="_blank" rel="noopener noreferrer">
            {transactionHash}
          </a>
        </Box>
      )}
    </Box>
  )
}
