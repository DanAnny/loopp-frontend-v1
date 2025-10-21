import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { Provider } from 'react-redux'
import store from './store'
import { PersistGate } from 'redux-persist/integration/react'
import persistor from './store/persistor'
import { setAccessToken, setOnTokenRefreshed } from '@/services/http'
import { setAccess } from '@/features/auth/authSlice'

function onBeforeLift() {
  const token = store.getState()?.auth?.accessToken
  if (token) setAccessToken(token)
}
setOnTokenRefreshed((newToken) => store.dispatch(setAccess(newToken)))

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor} onBeforeLift={onBeforeLift}>
        <App />
      </PersistGate>
    </Provider>
  </React.StrictMode>
)
