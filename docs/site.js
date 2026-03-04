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

async function fetchContactRelay(form) {
  const formElement = document.querySelector("#messageForm");
  const submitButton = formElement.querySelector("input[type=submit]");
  submitButton.disabled = true;
  try {
    // grecaptcha.ready(function () {
    //   const token = await grecaptcha.execute("reCAPTCHA_site_key", {
    //     action: "submit",
    //   });
    // });

    const email = form.querySelector("#emailFormControlInput").value;
    const message = form.querySelector("#messageFormControlInput").value;
    const request = {
      email,
      message,
    };
    const response = await fetchContactRelayCore(request);
    if (response.success) {
      formElement.hidden = true;
      alert("Thank you!");
    } else {
      submitButton.disabled = false;
      alert(response.errorMsg);
    }
  } catch (error) {
    console.log(error);
  }
}
