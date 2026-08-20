async function fetchContactRelay(form) {
  const formElement = document.querySelector("#messageForm");
  const submitButton = formElement.querySelector("input[type=submit]");
  const thankYouElement = document.querySelector("#contactThankYou");
  const errorElement = document.querySelector("#contactError");
  const errorDetailElement = document.querySelector("#contactErrorDetail");
  submitButton.disabled = true;
  errorElement?.classList.add("hidden");
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
      thankYouElement?.classList.remove("hidden");
    } else {
      submitButton.disabled = false;
      if (errorDetailElement) errorDetailElement.textContent = response.errorMsg;
      errorElement?.classList.remove("hidden");
    }
  } catch (error) {
    submitButton.disabled = false;
    if (errorDetailElement) errorDetailElement.textContent = "Unable to send message.";
    errorElement?.classList.remove("hidden");
    console.log(error);
  }
}
