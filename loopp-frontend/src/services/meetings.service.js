import { apiClient } from "./http";

const meetings = {

  createGoogleMeet(payload) {
    // payload: { projectId }
    return apiClient.post("/meetings/google-meet", payload);
  },
};

export default meetings;
