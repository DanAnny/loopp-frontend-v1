import { apiClient } from './http'
export const downloadMember = (fileId, download = false) =>
  apiClient.get(`/files/${fileId}${download ? '?download=1' : ''}`, { responseType: 'blob' })

export const downloadClient = (fileId, requestId, clientKey, download = false) =>
  apiClient.get(`/files/${fileId}/client?requestId=${requestId}&clientKey=${clientKey}${download ? '&download=1' : ''}`, { responseType: 'blob' })
