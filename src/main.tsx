import '@0xsequence/design-system/styles.css'
import './main.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider, ToastProvider } from '@0xsequence/design-system'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { SequenceWaaS } from '@0xsequence/waas'
import { ethers } from 'ethers'

import App from './App.tsx'
import Login from './Login.tsx'
import { MaybeWithStytch } from './components/MaybeWithStytch.tsx'

export const node = new ethers.JsonRpcProvider('https://nodes.sequence.app/polygon')

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_ID_DEV = import.meta.env.VITE_GOOGLE_CLIENT_ID_DEV
const SEQUENCE_PROJECT_ACCESS_KEY = import.meta.env.VITE_SEQUENCE_PROJECT_ACCESS_KEY
const SEQUENCE_WAAS_CONFIG_KEY = import.meta.env.VITE_SEQUENCE_WAAS_CONFIG_KEY
const SEQUENCE_PROJECT_ACCESS_KEY_DEV = import.meta.env.VITE_SEQUENCE_PROJECT_ACCESS_KEY_DEV
const SEQUENCE_WAAS_CONFIG_KEY_DEV = import.meta.env.VITE_SEQUENCE_WAAS_CONFIG_KEY_DEV

const isDevEnv = localStorage.getItem('isDev') === 'true'
let projectAccessKey = SEQUENCE_PROJECT_ACCESS_KEY
let waasConfigKey = SEQUENCE_WAAS_CONFIG_KEY
let googleClientId = GOOGLE_CLIENT_ID

if (isDevEnv) {
  console.log('Using dev environment')
  console.log(`Project Access Key: ${SEQUENCE_PROJECT_ACCESS_KEY_DEV}`)
  console.log(`Waas Config Key: ${SEQUENCE_WAAS_CONFIG_KEY_DEV}`)
  console.log(`Google Client ID: ${GOOGLE_CLIENT_ID_DEV}`)
  projectAccessKey = SEQUENCE_PROJECT_ACCESS_KEY_DEV
  waasConfigKey = SEQUENCE_WAAS_CONFIG_KEY_DEV
  googleClientId = GOOGLE_CLIENT_ID_DEV
}

export const sequence = new SequenceWaaS({
  network: 'polygon',
  projectAccessKey: projectAccessKey,
  waasConfigKey: waasConfigKey
})

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />
  },
  {
    path: '/',
    element: <App />
  }
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <GoogleOAuthProvider clientId={googleClientId}>
          <MaybeWithStytch>
            <RouterProvider router={router} />
          </MaybeWithStytch>
        </GoogleOAuthProvider>
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>
)
