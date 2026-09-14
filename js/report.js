(function () {
  "use strict";

  var app = document.getElementById("app");

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function meter(n) {
    var cls = n >= 7 ? "good" : n < 4.5 ? "bad" : "";
    var w = Math.max(8, Math.min(100, (n / 10) * 100));
    return '<div class="meter ' + cls + '"><i style="width:' + w + '%"></i></div>';
  }

  function scoreBlock(p) {
    return (
      '<div class="scores">' +
        '<div class="score-row"><span>Attractive</span>' + meter(p.scores.attractive) + "<b>" + p.scores.attractive.toFixed(1) + "</b></div>" +
        '<div class="score-row"><span>Trustworthy</span>' + meter(p.scores.trustworthy) + "<b>" + p.scores.trustworthy.toFixed(1) + "</b></div>" +
        '<div class="score-row"><span>Approachable</span>' + meter(p.scores.approachable) + "<b>" + p.scores.approachable.toFixed(1) + "</b></div>" +
      "</div>"
    );
  }

  SK.store.loadSession().then(function (session) {
    if (!session || !session.photos || !session.ranking) {
      app.innerHTML = '<p class="lede">No autopsy on this device. <a href="upload.html">Upload the stack.</a></p>';
      return;
    }
    if (!SK.store.isUnlocked()) {
      location.replace("paywall.html");
      return;
    }

    var byId = {};
    session.photos.forEach(function (p, i) {
      if (p.slot == null) p.slot = i + 1;
      byId[p.id] = p;
    });
    var R = session.ranking;
    var order = (R.orderIds || []).map(function (id) { return byId[id]; }).filter(Boolean);
    if (!order.length) order = session.photos.slice().sort(function (a, b) { return b.scores.composite - a.scores.composite; });
    var kill = byId[R.killId] || order[order.length - 1];
    var first = byId[R.firstId] || order[0];
    var bury = (R.buryIds || []).map(function (id) { return byId[id]; }).filter(Boolean).slice(0, 2);

    var rankHtml = order.map(function (p, i) {
      var tags = [];
      if (p.id === kill.id) tags.push('<span class="badge badge-kill">KILL</span>');
      if (p.id === first.id) tags.push('<span class="badge badge-first">PUT THIS FIRST</span>');
      if (bury.some(function (b) { return b.id === p.id; }) && p.id !== first.id) tags.push('<span class="badge badge-bury">BURY</span>');
      return (
        '<article class="rank-card">' +
          '<img alt="Photo ' + p.slot + '" src="' + p.dataUrl + '" />' +
          '<div>' +
            '<div class="slot">Rank ' + (i + 1) + " · your photo " + p.slot + (p.isFirst ? " · was first" : "") + "</div>" +
            tags.join(" ") +
            scoreBlock(p) +
          "</div>" +
        "</article>"
      );
    }).join("");

    var buryHtml = bury.map(function (p) {
      var why = (p.flags || []).indexOf("group") !== -1
        ? "Group shot. She is playing Where's Waldo with your face."
        : (p.flags || []).indexOf("dark") !== -1
        ? "Too dark. Buried is kindness. Deleted is cleaner."
        : (p.flags || []).indexOf("soft") !== -1
        ? "Soft focus on a phone is just blur."
        : "Weakest leftover. It does not earn a slot.";
      return "<p><strong>Photo " + p.slot + ".</strong> " + esc(why) + "</p>";
    }).join("");

    var fixes = (R.fixes || []).map(function (f) {
      return '<div class="fix"><h3>' + esc(f.title) + "</h3><p>" + esc(f.body) + "</p></div>";
    }).join("");

    app.innerHTML =
      '<div class="kicker">Autopsy · this device</div>' +
      "<h1>The stack, ranked.</h1>" +
      '<div class="banner-kill">' +
        '<div class="badge badge-kill">KILL</div>' +
        "<h2>Photo " + kill.slot + (R.killIsCurrentFirst || kill.isFirst ? " — and it's your first photo" : "") + "</h2>" +
        "<p>" + esc(R.killWhy || "") + "</p>" +
      "</div>" +
      '<div class="banner-first">' +
        '<div class="badge badge-first">PUT THIS FIRST</div>' +
        "<h2>Photo " + first.slot + "</h2>" +
        "<p>" + esc(R.firstWhy || "") + "</p>" +
      "</div>" +
      "<h2>Ranks</h2>" +
      '<div class="rank">' + rankHtml + "</div>" +
      '<section class="band" style="border:0;padding:1.6rem 0 0">' +
        "<h2>Delete or bury</h2>" +
        "<p class=\"lede\">Max two. Do it tonight. Do not negotiate with a photo that already lost.</p>" +
        buryHtml +
      "</section>" +
      '<section class="band" style="border:0;padding:1.6rem 0 0">' +
        "<h2>Three fixes. That's the sport.</h2>" +
        '<div class="fixes">' + fixes + "</div>" +
      "</section>" +
      '<p class="btn-note" style="margin-top:2rem;text-align:left">Scores come from light, sharpness, crop, and group-vs-solo on your photos. Not a lab. Not your worth. <a href="upload.html">Run another stack</a></p>';
  });
})();
