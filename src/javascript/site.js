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

async function fetchContactRelay(form, endpoint) {
  let token = "";
  try {
    const fetchTokenResponse = await fetch(endpoint, {
      credentials: "include",
    });
    const tokenResponse = await fetchTokenResponse.json();
    token = tokenResponse.token;
  } catch (error) {
    alert("Unable to send message");
  }
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
    const fetchMessage = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      credentials: "include",
      method: "POST",
      body: JSON.stringify(request),
    });
    const fetchMessageResponse = await fetchMessage.text();
    console.log(fetchMessageResponse);
    alert("Thank you!");
  } catch (error) {
    console.log(error);
  }
}
