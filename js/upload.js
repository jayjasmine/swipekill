(function () {
  "use strict";

  var photos = [];
  var MAX = 6;
  var MIN = 4;

  var filesEl = document.getElementById("files");
  var drop = document.getElementById("drop");
  var thumbs = document.getElementById("thumbs");
  var count = document.getElementById("count");
  var go = document.getElementById("go");
  var status = document.getElementById("status");
  var age = document.getElementById("age");
  var nudes = document.getElementById("nudes");

  function uid() {
    return "p" + Math.random().toString(36).slice(2, 9);
  }

  function render() {
    thumbs.innerHTML = "";
    photos.forEach(function (p, i) {
      var el = document.createElement("div");
      el.className = "thumb" + (p.isFirst ? " is-first" : "");
      el.innerHTML =
        '<img alt="Photo ' + p.slot + '" src="' + p.dataUrl + '" />' +
        '<button class="x" type="button" data-id="' + p.id + '" aria-label="Remove">×</button>' +
        '<label class="first-flag"><input type="radio" name="first" value="' + p.id + '"' +
        (p.isFirst ? " checked" : "") + ' /> First photo</label>';
      thumbs.appendChild(el);
    });
    count.textContent = photos.length + " / " + MAX;
    var firstSet = photos.some(function (p) { return p.isFirst; });
    var ready = photos.length >= MIN && firstSet && age.checked && nudes.checked && !go.dataset.busy;
    go.disabled = !ready;
    if (photos.length < MIN) status.textContent = "Add " + (MIN - photos.length) + " more. Mark which is currently first.";
    else if (!firstSet) status.textContent = "Mark the photo that is first on your profile right now.";
    else if (!age.checked || !nudes.checked) status.textContent = "Check both boxes. 21+. Dating photos only.";
    else status.textContent = "We will lock the scores until you pay.";
  }

  function nextSlot() {
    var max = 0;
    photos.forEach(function (p) {
      if ((p.slot || 0) > max) max = p.slot;
    });
    return max + 1;
  }

  /* FileList order is the user's order. Compress one-by-one so
     photos[] / slot stay in index order even if later files are smaller. */
  function addFiles(list) {
    var incoming = Array.prototype.slice.call(list || []);
    incoming.sort(function (a, b) {
      return String(a.name || "").localeCompare(String(b.name || ""), undefined, { numeric: true, sensitivity: "base" });
    });
    var chain = Promise.resolve();
    incoming.forEach(function (file) {
      chain = chain.then(function () {
        if (photos.length >= MAX) return;
        if (!file.type || file.type.indexOf("image/") !== 0) return;
        return SK.analyze.compressFile(file, 880, 0.7).then(function (c) {
          if (photos.length >= MAX) return;
          var hasFirst = photos.some(function (p) { return p.isFirst; });
          photos.push({
            id: uid(),
            name: file.name,
            dataUrl: c.dataUrl,
            isFirst: !hasFirst,
            slot: nextSlot()
          });
          render();
        }).catch(function () {
          status.textContent = "Could not read one of those files. Try a JPG.";
        });
      });
    });
    return chain;
  }

  drop.addEventListener("click", function () { filesEl.click(); });
  filesEl.addEventListener("change", function () { addFiles(filesEl.files); filesEl.value = ""; });
  ["dragenter", "dragover"].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); });
  });
  drop.addEventListener("drop", function (e) {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  });

  thumbs.addEventListener("click", function (e) {
    var btn = e.target.closest(".x");
    if (btn) {
      var wasFirst = false;
      photos = photos.filter(function (p) {
        if (p.id === btn.getAttribute("data-id")) { wasFirst = p.isFirst; return false; }
        return true;
      });
      if (wasFirst && photos[0]) photos[0].isFirst = true;
      render();
    }
  });
  thumbs.addEventListener("change", function (e) {
    if (e.target.name === "first") {
      photos.forEach(function (p) { p.isFirst = p.id === e.target.value; });
      render();
    }
  });
  age.addEventListener("change", render);
  nudes.addEventListener("change", render);

  go.addEventListener("click", function () {
    if (go.disabled) return;
    go.disabled = true;
    go.dataset.busy = "1";
    status.textContent = "Running the autopsy on this phone…";

    var jobs = photos.map(function (p) {
      return SK.analyze.analyzeDataUrl(p.dataUrl).then(function (a) {
        return {
          id: p.id,
          name: p.name,
          dataUrl: p.dataUrl,
          isFirst: p.isFirst,
          slot: p.slot,
          metrics: a.metrics,
          scores: a.scores,
          flags: a.flags
        };
      });
    });

    Promise.all(jobs).then(function (done) {
      var ranking = SK.analyze.rankPhotos(done);
      return SK.store.saveSession({
        photos: done,
        ranking: {
          orderIds: ranking.order.map(function (p) { return p.id; }),
          firstId: ranking.first.id,
          killId: ranking.kill.id,
          buryIds: ranking.bury.map(function (p) { return p.id; }),
          killWhy: ranking.killWhy,
          firstWhy: ranking.firstWhy,
          killIsCurrentFirst: ranking.kill.isCurrentFirst,
          fixes: ranking.fixes
        },
        createdAt: new Date().toISOString()
      });
    }).then(function () {
      location.href = "paywall.html";
    }).catch(function () {
      delete go.dataset.busy;
      go.disabled = false;
      status.textContent = "Something broke while reading the photos. Try again with smaller JPGs.";
    });
  });

  render();
})();
