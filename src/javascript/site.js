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
async function sha256hash(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return hash;
}

async function fetchContactRelay(form, endpoint) {
  console.log(form);
  let token = "";
  try {
    const fetchTokenResponse = await fetch(endpoint);
    const tokenResponse = await fetchTokenResponse.json();
    token = tokenResponse.token;
  } catch (error) {
    alert("Unable to send message");
  }
  try {
    const email = form.querySelector("#emailFormControlInput").value;
    const message = form.querySelector("#messageFormControlInput").value;
    const hash = sha256hash(`${email}${message}${token}`);
    const request = {
      email,
      message,
      token,
      hash,
    };
    const fetchMessage = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });
    const fetchMessageResponse = await fetchMessage.text();
    console.log(fetchMessageResponse);
  } catch (error) {
    console.log(error);
  }
}
