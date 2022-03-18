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
    // const fetchTokenResponse = await fetch(endpoint);
    console.log(token);
  } catch (error) {
    console.log(error);
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
