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

async function fetchContactRelay(request, endpoint) {
  try {
    const fetchTokenResponse = await fetch(endpoint);
    const tokenResponse = await fetchTokenResponse.json();
    const token = tokenResponse.token;
    console.log(token);
  } catch (error) {
    alert("Unable to send message");
  }

  // const response = await fetch(endpoint, {
  //   method: "POST",
  //   // mode: "no-cors",
  //   headers: {
  //     Accept: "application/json",
  //     "Content-Type": "application/json",
  //   },
  //   body: JSON.stringify(request),
  // });
}
