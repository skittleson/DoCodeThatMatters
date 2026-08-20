async function fetchContactRelayCore(request) {
  // The relay lives on the API Gateway, not wherever this script is hosted
  // (it used to be loaded directly from the gateway, so origin-from-script
  // worked by coincidence; self-hosting this file broke that assumption).
  const endpoint = "https://t0aqplp9ri.execute-api.us-east-1.amazonaws.com/latest";
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  try {
    const fetchTokenResponse = await fetch(endpoint, {
      credentials: "include",
      headers: headers,
    });
    if (fetchTokenResponse.status !== 200) {
      throw new Error("Failed to fetch anticsrf token");
    }
    const tokenResponse = await fetchTokenResponse.json();
    request.token = tokenResponse.token;
  } catch (error) {
    return {
      success: false,
      errorMsg: "Unable to create session with anticsrf",
      error,
    };
  }
  try {
    const fetchMessage = await fetch(endpoint, {
      body: JSON.stringify(request),
      credentials: "include",
      headers: headers,
      method: "POST",
    });
    if (fetchMessage.status !== 200) {
      throw new Error("Failed to fetch anticsrf token");
    }
    const fetchMessageResponse = await fetchMessage.text();
    return {
      success: true,
      errorMsg: "",
      error: null,
      data: fetchMessageResponse,
    };
  } catch (error) {
    return { success: false, errorMsg: "Unable to send message", error };
  }
}
