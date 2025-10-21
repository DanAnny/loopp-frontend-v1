import { apiClient } from "./http"

export const getAll = () => apiClient.get("/users")
export const getPms = (isBusy) =>
  apiClient.get(`/users/pms${isBusy !== undefined ? `?isBusy=${isBusy}` : ""}`)
export const getById = (id) => apiClient.get(`/users/${id}`)
export const update = (id, body) => apiClient.put(`/users/${id}`, body)
export const remove = (id) => apiClient.delete(`/users/${id}`)
export const getEngineers = () => apiClient.get("/users/engineers")

// export everything in the default
export default {
  getAll,
  getPms,
  getById,
  update,
  remove,
  getEngineers,
}
