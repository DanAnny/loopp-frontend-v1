import { apiClient } from "./http";

const meetings = {
  // Creates an instant meeting. You can extend payload with startTime, duration, etc.
  createZoomMeeting: async ({ projectId, topic, durationMinutes }) => {
    const { data } = await apiClient.post("/meetings/zoom", {
      projectId,
      topic,
      durationMinutes,
    });
    // Expected shape from backend: { join_url, start_url, meeting_id, password }
    return data;
  },
};

export default meetings;
