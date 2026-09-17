(function () {
  "use strict";

  var locked = document.getElementById("locked");
  var pay = document.getElementById("pay");
  var fail = document.getElementById("fail");

  if (fail) fail.classList.remove("is-on");
  if (SK.store.hasPaymentLink()) {
    if (pay) pay.textContent = "Pay $19 on Stripe — unlock the report";
    if (fail) fail.classList.remove("is-on");
  }

  SK.store.loadSession().then(function (session) {
    if (!session || !session.photos || session.photos.length < 4) {
      location.replace("upload.html");
      return;
    }
    if (SK.store.isUnlocked()) {
      location.replace("report.html");
      return;
    }
    session.photos.forEach(function (p, i) {
      var row = document.createElement("div");
      row.className = "locked-row";
      row.innerHTML =
        '<img class="ph" alt="" src="' + p.dataUrl + '" />' +
        '<div class="bars" aria-hidden="true">' +
          '<div class="slot">Photo ' + (p.slot || (i + 1)) + (p.isFirst ? " · current first" : "") + "</div>" +
          '<div class="bar"><i style="width:' + (40 + (i * 9) % 37) + '%"></i></div>' +
          '<div class="bar"><i style="width:' + (30 + (i * 13) % 41) + '%"></i></div>' +
          '<div class="bar"><i style="width:' + (35 + (i * 7) % 33) + '%"></i></div>' +
        "</div>";
      locked.appendChild(row);
    });
  });

  pay.addEventListener("click", function () {
    fail.classList.remove("is-on");
    if (SK.store.hasPaymentLink()) {
      location.href = SK.store.paymentUrl();
      return;
    }
    /* Do not unlock. Do not fake a charge. */
    fail.classList.add("is-on");
  });
})();
