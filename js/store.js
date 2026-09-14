/* SwipeKill store: unlock flag + photo/analysis persistence */
(function (g) {
  "use strict";

  var DB_NAME = "swipekill";
  var DB_VER = 1;
  var STORE = "session";
  var SESSION_ID = "current";
  var UNLOCK_KEY = "sk_unlocked";
  var UNLOCK_SRC = "sk_unlock_source";

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function consumeUnlockQuery() {
    /* Query string never unlocks. Only success.html after Stripe. */
    try {
      var params = new URLSearchParams(location.search);
      if (params.has("unlocked")) {
        params.delete("unlocked");
        var q = params.toString();
        history.replaceState({}, "", location.pathname + (q ? "?" + q : "") + location.hash);
      }
    } catch (e) {}
    return false;
  }

  function isUnlocked() {
    return localStorage.getItem(UNLOCK_KEY) === "1"
      && localStorage.getItem(UNLOCK_SRC) === "stripe-success";
  }

  function unlock(source) {
    localStorage.setItem(UNLOCK_KEY, "1");
    localStorage.setItem(UNLOCK_SRC, source || "unknown");
    if (!localStorage.getItem("sk_unlock_day")) {
      localStorage.setItem("sk_unlock_day", todayISO());
    }
  }

  function hasPaymentLink() {
    var u = (g.SK_CONFIG && g.SK_CONFIG.STRIPE_PAYMENT_LINK) || "";
    return !!String(u).trim();
  }

  function paymentUrl() {
    return String((g.SK_CONFIG && g.SK_CONFIG.STRIPE_PAYMENT_LINK) || "").trim();
  }

  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!g.indexedDB) {
        reject(new Error("no-idb"));
        return;
      }
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function idbGet() {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readonly");
        var r = tx.objectStore(STORE).get(SESSION_ID);
        r.onsuccess = function () { resolve(r.result || null); };
        r.onerror = function () { reject(r.error); };
      });
    });
  }

  function idbSet(data) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(data, SESSION_ID);
        tx.oncomplete = function () { resolve(data); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  var mem = null;

  function saveSession(data) {
    mem = data;
    return idbSet(data).catch(function () {
      try {
        var slim = {
          photos: (data.photos || []).map(function (p) {
            return {
              id: p.id,
              name: p.name,
              dataUrl: p.dataUrl,
              isFirst: p.isFirst,
              slot: p.slot,
              metrics: p.metrics,
              scores: p.scores,
              flags: p.flags
            };
          }),
          ranking: data.ranking,
          createdAt: data.createdAt
        };
        sessionStorage.setItem("sk_session", JSON.stringify(slim));
        return slim;
      } catch (e) {
        return data;
      }
    });
  }

  function loadSession() {
    if (mem) return Promise.resolve(mem);
    return idbGet().then(function (row) {
      if (row) { mem = row; return row; }
      try {
        var raw = sessionStorage.getItem("sk_session");
        if (raw) {
          mem = JSON.parse(raw);
          return mem;
        }
      } catch (e) {}
      return null;
    }).catch(function () {
      try {
        var raw = sessionStorage.getItem("sk_session");
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    });
  }

  function clearSession() {
    mem = null;
    try { sessionStorage.removeItem("sk_session"); } catch (e) {}
    return openDb().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(SESSION_ID);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { resolve(); };
      });
    }).catch(function () {});
  }

  consumeUnlockQuery();

  g.SK = g.SK || {};
  g.SK.store = {
    isUnlocked: isUnlocked,
    unlock: unlock,
    hasPaymentLink: hasPaymentLink,
    paymentUrl: paymentUrl,
    saveSession: saveSession,
    loadSession: loadSession,
    clearSession: clearSession,
    consumeUnlockQuery: consumeUnlockQuery
  };
})(window);
