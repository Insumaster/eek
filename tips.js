// Tips form for every game page: <form class="tips" data-game="Game name">.
// Sent through Web3Forms (https://web3forms.com), which e-mails each tip to us.
// The access key is public by design: it can only send mail to our own inbox.
var TIPS_KEY = "32a91827-d722-49ac-9a82-1cbb62a11b25";

document.querySelectorAll("form.tips").forEach(function (form) {
  var status = form.querySelector(".status");
  var button = form.querySelector("button");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var data = new FormData(form);
    if (data.get("botcheck")) return;
    if (!TIPS_KEY) {
      status.textContent = "The tips box is not open yet - please try again soon.";
      return;
    }
    var game = form.dataset.game;
    var kind = data.get("kind");
    data.append("access_key", TIPS_KEY);
    data.append("subject", "[Game tips] " + game + ": " + kind);
    data.append("from_name", game + " tips");
    data.append("game", game);
    button.disabled = true;
    status.textContent = "Sending...";
    fetch("https://api.web3forms.com/submit", { method: "POST", body: data })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        if (!r.success) throw new Error(r.message);
        form.reset();
        status.textContent = "Thank you! We read every tip.";
      })
      .catch(function () {
        status.textContent = "Could not send right now - please try again later.";
      })
      .finally(function () { button.disabled = false; });
  });
});
