if ("serviceWorker" in navigator) {
  if (navigator.serviceWorker.controller) {
    console.log(
      "[PWA Builder] active service worker found, no need to register"
    );
  } else {
    // Register the service worker
    navigator.serviceWorker
      .register("/sw.js", {
        scope: "./",
      })
      .then(function (reg) {
        console.log(
          "[PWA Builder] Service worker has been registered for scope: " +
            reg.scope
        );
      });
  }
}

//https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest#basic_example
async function digestMessage(message) {
  const msgUint8 = new TextEncoder().encode(message); // encode as (utf-8) Uint8Array
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8); // hash the message
  const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(""); // convert bytes to hex string
  return hashHex;
}

async function fetchContactRelayCore(request, endpoint) {
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

async function fetchContactRelay(form, endpoint) {
  try {
    const email = form.querySelector("#emailFormControlInput").value;
    const message = form.querySelector("#messageFormControlInput").value;
    const hash = await digestMessage(`${email}${message}${token}`);
    const request = {
      email,
      message,
      token,
      hash,
    };
    const response = await fetchContactRelayCore(request, endpoint);
    if (response.success) {
      alert("Thank you!");
    } else {
      alert(response.errorMsg);
    }
  } catch (error) {
    console.log(error);
  }
}
