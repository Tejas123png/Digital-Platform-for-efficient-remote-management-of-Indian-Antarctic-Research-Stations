/**
 * Antarctic Station Telemetry API Client
 * Connects to the Python Flask backend at http://localhost:5000
 */

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export { API_URL };

/**
 * Fetch the latest telemetry snapshot from Flask API
 * @param {string} [station="MAITRI"] - Station identifier (MAITRI or BHARATI)
 * @returns {Promise<Object>} Telemetry record
 */
export async function fetchStationData(station = "MAITRI") {
  const response = await fetch(`${API_URL}/api/data?station=${station}`, {
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
 * Fetch the latest telemetry snapshot specifically for Bharati station
 * @returns {Promise<Object>} Telemetry record for Bharati
 */
export async function fetchBharatiData() {
  return fetchStationData("BHARATI");
}

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

/**
 * Request AI analysis for a specific alert
 * @param {string} alertId - e.g. 'low_battery'
 * @param {string} alertMessage - e.g. 'LOW BATTERY RESERVE'
 * @param {string} severity - 'critical' or 'warning'
 * @returns {Promise<Object>} Structured AI analysis
 */
export async function analyzeAlert(alertId, alertMessage, severity) {
  const response = await fetch(`${API_URL}/api/alerts/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({
      alert_id: alertId,
      alert_message: alertMessage,
      severity: severity
    })
  });

  return await response.json();
}
