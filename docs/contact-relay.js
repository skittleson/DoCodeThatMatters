const contactRelayLoadedScriptSource = document.currentScript.src;
async function fetchContactRelayCore(request) {
  const endpoint = new URL(contactRelayLoadedScriptSource).origin + "/latest";
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
