import { configureStore, combineReducers } from '@reduxjs/toolkit'
import auth from '@/features/auth/authSlice'
import { persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist'
import storage from 'redux-persist/lib/storage'

const rootReducer = combineReducers({ auth })
const persistConfig = { key: 'loopp', version: 1, storage, whitelist: ['auth'] }
const reducer = persistReducer(persistConfig, rootReducer)

export const store = configureStore({
  reducer,
  middleware: (gDM) => gDM({
    serializableCheck: { ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER] },
  }),
})

export default store
