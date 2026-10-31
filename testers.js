// Tester list sign-up on the home page: <form class="tips testers">.
// Sent through Web3Forms like the game tips (see tips.js), so each sign-up is e-mailed to us.
var TESTERS_KEY = "32a91827-d722-49ac-9a82-1cbb62a11b25";

document.querySelectorAll("form.testers").forEach(function (form) {
  var status = form.querySelector(".status");
  var button = form.querySelector("button");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var data = new FormData(form);
    if (data.get("botcheck")) return;
    data.append("access_key", TESTERS_KEY);
    data.append("subject", "[Tester list] New sign-up");
    data.append("from_name", "EEK tester list");
    button.disabled = true;
    status.textContent = "Sending...";
    fetch("https://api.web3forms.com/submit", { method: "POST", body: data })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        if (!r.success) throw new Error(r.message);
        form.reset();
        status.textContent = "You're on the list! We'll e-mail you when there is something new to test.";
      })
      .catch(function () {
        status.textContent = "Could not send right now - please try again later.";
      })
      .finally(function () { button.disabled = false; });
  });
});
