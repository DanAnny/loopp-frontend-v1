import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import * as Auth from '@/services/auth.service'
import { setAccessToken } from '@/services/http'

export const signInThunk = createAsyncThunk('auth/signIn', async (payload, { rejectWithValue }) => {
  try {
    const { data } = await Auth.signIn(payload) // { accessToken, user }
    return data
  } catch (e) {
    return rejectWithValue(e?.response?.data || { message: 'Sign in failed' })
  }
})

export const logoutThunk = createAsyncThunk('auth/logout', async () => {
  try { await Auth.logout() } catch {}
  return true
})

// features/auth/authSlice.js (add this near your other thunks)
export const bootstrapAuthThunk = createAsyncThunk(
  'auth/bootstrap',
  async (_, { dispatch, getState }) => {
    const hasToken = !!getState()?.auth?.accessToken
    if (hasToken) return { from: 'persist' }
    try {
      // uses apiClient.post('/auth/refresh') with withCredentials: true
      const { data } = await Auth.refresh()
      if (data?.accessToken) {
        dispatch(setAccess(data.accessToken))     // Redux + setAccessToken()
        return { from: 'refresh' }
      }
    } catch {}
    return { from: 'none' }
  }
)

const slice = createSlice({
  name: 'auth',
  initialState: { user: null, accessToken: null, status: 'idle', error: null },
  reducers: {
    setAccess(state, { payload }) { // called when interceptor refreshes
      state.accessToken = payload
      setAccessToken(payload)
    },
  },
  extraReducers: (b) => {
    b.addCase(signInThunk.pending, (s) => { s.status = 'loading'; s.error = null })
     .addCase(signInThunk.fulfilled, (s, { payload }) => {
       s.status = 'succeeded'
       s.user = payload.user
       s.accessToken = payload.accessToken
       setAccessToken(payload.accessToken)
     })
     .addCase(signInThunk.rejected, (s, { payload }) => {
       s.status = 'failed'
       s.error = payload?.message || 'Sign in failed'
     })
     .addCase(logoutThunk.fulfilled, (s) => {
       s.user = null
       s.accessToken = null
       setAccessToken(null)
     })
  }
})

export const { setAccess } = slice.actions
export default slice.reducer
