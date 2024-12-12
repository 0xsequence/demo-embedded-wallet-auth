import { useEffect, useState } from 'react'
import { Box, Button, Text, TextInput } from '@0xsequence/design-system'
import { Network } from '@0xsequence/waas'
import { sequence } from '../../main.tsx'
import { PINCodeInput } from '../PINCodeInput.tsx'

export function ChildAdoptionView({ network }: { network: Network }) {
  const [code, setCode] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [adopter, setAdopter] = useState("")
  const [respondWithCode, setRespondWithCode] = useState<((answer: string) => Promise<void>) | null>(null)

  useEffect(() => {
    sequence.getAdopter().then(adopter => setAdopter(adopter))
  }, [setAdopter, respondWithCode])

  useEffect(() => {
    return sequence.onConfirmationRequired(async (respondWithCode: (answer: string) => Promise<void>) => {
      setRespondWithCode(() => respondWithCode)
    })
  }, [])

  const sendAnswer = async () => {
    if (!respondWithCode) return
    try {
      await respondWithCode(code.join(''))
      setError(null)
      setRespondWithCode(null)
    } catch (e) {
      setError(e.message)
      setCode([])
    }
  }

  const adoptChildWallet = async () => {
    const adoptionSignal = `sequence-internal-adoption-signal-1`
    const adopter = '0x7B7D7BA79542584f9AeF539F6696c070a4e1Ced6'
    const signature = '0x01000100000000020189e6eb0408ae08542bcc99696fba0c001f6aa3ac0000fe010003000000000601000100007400010df7a741b9736a3254e621a4e7c89db7379b4b4fb2007dd294dfd387bd2c8fe666901a27954f2b3f7c61843edeea8481af7de89eb800c56593561cccc99717871b010400002c01019cec96321d5a54df2277fe3dbb2405016a3bbf9601013f5602872eff7ef96e69ef2409e0dd3c62923bd706020001000074000137e7912712dcc2bff97b67840b4ecca45386d945159fee26641e09371b8b4d6d6e501d433ac2f10efbd5f906a7d99e2eee237f039322d8f95dd6120b898301341c010400002c0101951448847a03ad1005a0e463dff0da093690ff240101e0f61b36d02be47455ce5332e9d7bb43bf8f344b03010043347c7c7806511212df32410da167afe44641cb'
    try {
      await sequence.adoptChildWallet({
        network: '11155111',
        adopterProof: {
          message: adoptionSignal,
          signature,
        },
        adopter: adopter,
      })
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <Box>
      <Box>
        <Text variant="normal" color="text100" fontWeight="normal">
          {adopter ? `Adopter: ${adopter}` : 'This wallet has no adopter'}
        </Text>
      </Box>
      {respondWithCode ? (
        <Box>
          <Text variant="normal" color="text100" fontWeight="normal">
            Enter code received in email.
          </Text>
          <PINCodeInput value={code} digits={6} onChange={setCode} />
          <Button label="Send" onClick={sendAnswer} />
        </Box>
      ) : (
      <Button label="Adopt child wallet" onClick={adoptChildWallet} />
      )}
      {!!error && <Text variant="normal" color="text100" fontWeight="normal">Error: {error}</Text>}
    </Box>
  )
}
