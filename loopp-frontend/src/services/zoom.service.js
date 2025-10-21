// frontend/src/services/zoom.service.js
import { apiClient } from './http';
const zoom = {
  createMeeting: (payload) => apiClient.post("/integrations/zoom/meetings", payload),
};

export default zoom;
