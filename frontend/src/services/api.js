/**
 * Antarctic Station Telemetry API Client
 * Connects to the Python Flask backend at http://localhost:5000
 */

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export { API_URL };

/**
 * Fetch the latest telemetry snapshot from Flask API
 * @returns {Promise<Object>} Telemetry record
 */
export async function fetchStationData() {
  const response = await fetch(`${API_URL}/api/data`, {
    method: "GET",
    headers: {
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

export const getStationData = fetchStationData;

/**
 * Check if the Flask API server is alive
 * @returns {Promise<boolean>}
 */
export async function checkHealth() {
  try {
    const response = await fetch(`${API_URL}/api/health`, {
      method: "GET"
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}
