/* SwipeKill local autopsy.
   Canvas heuristics only. No model, no API, no fake GPT.
   Same pixels → same scores. */
(function (g) {
  "use strict";

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function round1(n) { return Math.round(n * 10) / 10; }

  function loadImage(dataUrl) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  function compressFile(file, maxEdge, quality) {
    maxEdge = maxEdge || 900;
    quality = quality || 0.72;
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * scale));
        var h = Math.max(1, Math.round(img.height * scale));
        var c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        var ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve({
          dataUrl: c.toDataURL("image/jpeg", quality),
          width: w,
          height: h,
          origW: img.width,
          origH: img.height
        });
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read that image"));
      };
      img.src = url;
    });
  }

  /* Downscale for metrics. Fast and stable. */
  function sample(img, targetW) {
    var w = targetW;
    var h = Math.max(1, Math.round(img.height / img.width * w));
    var c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    var ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    var pix = ctx.getImageData(0, 0, w, h).data;
    return { w: w, h: h, pix: pix };
  }

  function lumaAt(pix, i) {
    return (pix[i] * 299 + pix[i + 1] * 587 + pix[i + 2] * 114) / 1000;
  }

  function isSkin(r, g, b) {
    /* YCbCr skin window — rough, honest, not a face detector. */
    var y = 0.299 * r + 0.587 * g + 0.114 * b;
    var cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    var cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    /* Require a clear red-over-green so beige walls / taupe rooms are not "skin". */
    return y > 40 && y < 230 && cb > 77 && cb < 135 && cr > 133 && cr < 180 && r > g + 8 && r > 60;
  }

  function metricsFromSample(s) {
    var w = s.w, h = s.h, pix = s.pix;
    var n = w * h;
    var sum = 0, sum2 = 0;
    var dark = 0, bright = 0;
    var warm = 0, cool = 0;
    var satSum = 0;
    var skin = new Uint8Array(n);
    var skinCount = 0;

    var i, p, y, r, g, b, mx, mn, sat;
    for (p = 0, i = 0; p < n; p++, i += 4) {
      r = pix[i]; g = pix[i + 1]; b = pix[i + 2];
      y = lumaAt(pix, i);
      sum += y;
      sum2 += y * y;
      if (y < 28) dark++;
      if (y > 245) bright++;
      if (r > b + 12) warm++;
      if (b > r + 12) cool++;
      mx = Math.max(r, g, b);
      mn = Math.min(r, g, b);
      sat = mx === 0 ? 0 : (mx - mn) / mx;
      satSum += sat;
      if (isSkin(r, g, b)) { skin[p] = 1; skinCount++; }
    }

    var mean = sum / n;
    var variance = Math.max(0, sum2 / n - mean * mean);
    var contrast = Math.sqrt(variance);

    /* Simple gradient magnitude as sharpness. */
    /* Edge-aware sharpness: mean of real edges, not the flat interior.
       Flat studio graphics and real photos both keep hard edges above 7;
       a true blur spreads the edge and drops this mean under 7. */
    var sharpSum = 0, sharpN = 0;
    var edgeSum = 0, edgeN = 0;
    var x, row;
    for (var yy = 1; yy < h - 1; yy++) {
      row = yy * w;
      for (x = 1; x < w - 1; x++) {
        var c0 = lumaAt(pix, (row + x) * 4);
        var cx = lumaAt(pix, (row + x + 1) * 4);
        var cy = lumaAt(pix, ((yy + 1) * w + x) * 4);
        var gmag = Math.abs(c0 - cx) + Math.abs(c0 - cy);
        sharpSum += gmag;
        sharpN++;
        if (gmag > 1) { edgeSum += gmag; edgeN++; }
      }
    }
    var sharpness = (edgeN > sharpN * 0.01) ? (edgeSum / edgeN) : (sharpN ? sharpSum / sharpN : 0);

    /* Skin blobs via flood fill. Largest = likely face / body. */
    var seen = new Uint8Array(n);
    var blobs = [];
    var dirs = [1, -1, w, -w];
    for (p = 0; p < n; p++) {
      if (!skin[p] || seen[p]) continue;
      var stack = [p];
      seen[p] = 1;
      var size = 0, sx = 0, sy = 0, minx = w, maxx = 0, miny = h, maxy = 0;
      while (stack.length) {
        var q = stack.pop();
        size++;
        var qx = q % w, qy = (q - qx) / w;
        sx += qx; sy += qy;
        if (qx < minx) minx = qx;
        if (qx > maxx) maxx = qx;
        if (qy < miny) miny = qy;
        if (qy > maxy) maxy = qy;
        for (var d = 0; d < 4; d++) {
          var nq = q + dirs[d];
          if (nq < 0 || nq >= n) continue;
          var nx = nq % w;
          if (Math.abs(nx - qx) > 1) continue;
          if (skin[nq] && !seen[nq]) { seen[nq] = 1; stack.push(nq); }
        }
      }
      if (size >= n * 0.003) {
        blobs.push({
          size: size,
          cx: sx / size / w,
          cy: sy / size / h,
          bw: (maxx - minx + 1) / w,
          bh: (maxy - miny + 1) / h
        });
      }
    }
    blobs.sort(function (a, b) { return b.size - a.size; });

    var face = blobs[0] || null;
    var faceFrac = face ? face.size / n : 0;
    /* Group guess: 2+ substantial skin regions, none dominating. */
    var second = blobs[1];
    var group = blobs.length >= 3;
    if (!group && second && face && second.size > n * 0.012 && face.size / second.size < 5) group = true;
    if (blobs.length >= 3 && blobs[2].size > n * 0.008) group = true;
    /* Landscape + a lot of skin that is not one big portrait face = group / party shot. */
    if (!group && w > h * 1.12 && (skinCount / n) > 0.12 && faceFrac < 0.28) group = true;

    /* Dark band across upper-middle (sunglasses / shadowed eyes heuristic). */
    var eyeBandDark = 0, eyeBandN = 0;
    var y0 = Math.floor(h * 0.22), y1 = Math.floor(h * 0.42);
    var x0 = Math.floor(w * 0.28), x1 = Math.floor(w * 0.72);
    for (yy = y0; yy < y1; yy++) {
      for (x = x0; x < x1; x++) {
        eyeBandN++;
        if (lumaAt(pix, (yy * w + x) * 4) < 50) eyeBandDark++;
      }
    }
    var eyeDarkRatio = eyeBandN ? eyeBandDark / eyeBandN : 0;

    return {
      brightness: mean / 255,
      contrast: contrast / 255,
      sharpness: sharpness,
      darkFrac: dark / n,
      blowFrac: bright / n,
      warmth: (warm - cool) / n,
      sat: satSum / n,
      skinFrac: skinCount / n,
      faceFrac: faceFrac,
      faceCx: face ? face.cx : 0.5,
      faceCy: face ? face.cy : 0.45,
      faceBox: face ? { w: face.bw, h: face.bh } : null,
      blobCount: blobs.length,
      group: group,
      eyeDarkRatio: eyeDarkRatio,
      aspect: w / h
    };
  }

  function scoreFromMetrics(m) {
    var attractive = 5.2;
    var trust = 5.4;
    var approach = 5.3;

    /* Sharpness: dating-app thumbs are tiny. Soft photos die. */
    if (m.sharpness >= 18) { attractive += 1.8; trust += 0.6; }
    else if (m.sharpness >= 12) { attractive += 1.0; }
    else if (m.sharpness >= 7) { attractive += 0.2; }
    else { attractive -= 4.2; trust -= 2.2; approach -= 1.8; } /* bury-tier blur */

    /* Light. Cave selfies and flash-bombs both kill. */
    if (m.brightness >= 0.38 && m.brightness <= 0.68) {
      attractive += 1.4; trust += 1.1; approach += 1.0;
    } else if (m.brightness >= 0.28 && m.brightness < 0.38) {
      attractive -= 0.4; trust -= 0.2;
    } else if (m.brightness < 0.22 || m.darkFrac > 0.42) {
      attractive -= 2.4; trust -= 1.6; approach -= 1.8;
    } else if (m.brightness > 0.82 || m.blowFrac > 0.18) {
      attractive -= 1.6; trust -= 0.8; approach -= 0.6;
    }

    /* Contrast: muddy vs harsh. */
    if (m.contrast >= 0.14 && m.contrast <= 0.32) {
      attractive += 0.6; trust += 0.5;
    } else if (m.contrast < 0.09) {
      attractive -= 1.1; trust -= 0.6;
    } else if (m.contrast > 0.42) {
      trust -= 0.8; approach -= 0.7;
    }

    /* Face size / placement. Phone screens punish tiny heads. */
    if (m.faceFrac >= 0.10 && m.faceFrac <= 0.38) {
      attractive += 1.6; trust += 1.2; approach += 0.8;
    } else if (m.faceFrac >= 0.06 && m.faceFrac < 0.10) {
      attractive += 0.3;
    } else if (m.faceFrac > 0 && m.faceFrac < 0.05) {
      attractive -= 4.0; trust -= 2.4; approach -= 2.0; /* bury-tier tiny-face */
    } else if (m.faceFrac === 0) {
      attractive -= 4.0; trust -= 3.0; approach -= 2.4; /* bury-tier no-face */
    } else if (m.faceFrac > 0.48) {
      attractive -= 0.6; /* extreme close crop, pores and nostrils */
    }

    if (m.faceBox) {
      var cx = m.faceCx;
      var cy = m.faceCy;
      if (cx > 0.32 && cx < 0.68 && cy > 0.22 && cy < 0.55) {
        attractive += 0.7; trust += 0.4;
      } else if (cy > 0.62) {
        attractive -= 0.9; /* face in the dirt, sky eating the frame */
      }
    }

    if (m.group) {
      attractive -= 5.5; trust -= 4.0; approach -= 2.6; /* group never leads a mixed stack */
    }

    /* Warm light reads human. Ice-blue bathroom reads morgue. */
    if (m.warmth > 0.04 && m.warmth < 0.38) {
      approach += 1.1; attractive += 0.4;
    } else if (m.warmth < -0.12) {
      approach -= 1.0; attractive -= 0.4;
    }

    if (m.sat > 0.55) { trust -= 1.0; attractive -= 0.3; } /* fried filter */
    if (m.sat < 0.12) { attractive -= 0.6; approach -= 0.4; }

    if (m.eyeDarkRatio > 0.55 && m.brightness < 0.45) {
      approach -= 1.2; trust -= 0.5; /* eyes gone */
    }

    attractive = clamp(attractive, 1.2, 9.4);
    trust = clamp(trust, 1.2, 9.4);
    approach = clamp(approach, 1.2, 9.4);

    var composite = attractive * 0.5 + trust * 0.25 + approach * 0.25;
    return {
      attractive: round1(attractive),
      trustworthy: round1(trust),
      approachable: round1(approach),
      composite: round1(composite)
    };
  }

  function flagsFromMetrics(m, scores) {
    var flags = [];
    if (m.group) flags.push("group");
    if (m.sharpness < 7) flags.push("soft");
    if (m.brightness < 0.24 || m.darkFrac > 0.42) flags.push("dark");
    if (m.brightness > 0.82 || m.blowFrac > 0.18) flags.push("blown");
    if (m.faceFrac > 0 && m.faceFrac < 0.05) flags.push("tiny-face");
    if (m.faceFrac === 0) flags.push("no-face");
    if (m.faceCy > 0.62 && m.faceFrac > 0) flags.push("low-face");
    if (m.warmth < -0.12) flags.push("cold");
    if (m.sat > 0.55) flags.push("filter");
    if (m.contrast < 0.09) flags.push("muddy");
    if (m.eyeDarkRatio > 0.55 && m.brightness < 0.45) flags.push("eyes-hidden");
    if (scores.composite < 4.2) flags.push("weak");
    return flags;
  }

  var FAULT_PRIORITY = [
    ["group", "It's a group shot. She does not know which one you are"],
    ["dark", "It's underexposed, so your face reads as a shadow"],
    ["soft", "It's soft. Thumbs get a blur, not a person"],
    ["tiny-face", "your face is a stamp; the room got the frame"],
    ["no-face", "we can't lock a face — landscape, back-of-head, or a body shot"],
    ["low-face", "your face is a stamp; the room got the frame"],
    ["blown", "the highlights are cooked"],
    ["eyes-hidden", "the eyes disappear"],
    ["cold", "the light is ice-blue, bathroom-mirror energy"],
    ["filter", "the color is fried; it looks like a filter, not a person"],
    ["muddy", "the contrast is mud — nothing separates your face from the room"]
  ];

  function worstFaultLine(photo) {
    var f = photo.flags || [];
    var i;
    for (i = 0; i < FAULT_PRIORITY.length; i++) {
      if (f.indexOf(FAULT_PRIORITY[i][0]) !== -1) return FAULT_PRIORITY[i][1];
    }
    if (photo.scores && photo.scores.composite < 5) {
      return "nothing in the frame is doing work — light, crop, and face all mid";
    }
    return "relative to the rest of your stack, this one asks her to do the most work";
  }

  function killSentence(photo, rank) {
    var lead = rank.isCurrentFirst
      ? "This is the one in your first slot right now. That's the problem. "
      : "This is the kill shot. ";
    return lead + worstFaultLine(photo) + ".";
  }

  function firstSentence(photo) {
    var f = photo.flags || [];
    if (f.indexOf("group") !== -1) {
      return "Least-bad of a weak set — still a group. Use it only if you have no solo. Then replace it.";
    }
    var parts = [];
    if (photo.metrics.faceFrac >= 0.08) parts.push("your face is actually in the frame");
    if (photo.metrics.sharpness >= 10) parts.push("it's sharp enough for a phone thumb");
    if (photo.metrics.brightness >= 0.32 && photo.metrics.brightness <= 0.72) parts.push("the light is usable");
    if (!parts.length) parts.push("it's the strongest of what you gave us");
    var head = parts[0].charAt(0).toUpperCase() + parts[0].slice(1); return "Put this first. " + head + (parts[1] ? ", and " + parts[1] : "") + ".";
  }

  function hasFlag(p, name) {
    return p && p.flags && p.flags.indexOf(name) !== -1;
  }

  function threeFixes(photos, kill, first) {
    var light;
    if (hasFlag(kill, "dark") || kill.metrics.brightness < 0.32) {
      light = "Light — Photo " + kill.slot + " is a cave. Stand side-on to a window, not under a yellow ceiling bulb, not in a bathroom with the lights off behind you. If the room is dark, you are not 'moody.' You are invisible.";
    } else if (hasFlag(kill, "blown")) {
      light = "Light — Photo " + kill.slot + " is blasted. Turn your back to the sun or step into open shade. No flash. No ring light two inches from your nose.";
    } else if (hasFlag(kill, "cold") || (first && first.metrics.warmth < -0.12)) {
      light = "Light — Photo " + (hasFlag(kill, "cold") ? kill.slot : first.slot) + " is ice-blue bathroom light. Get out of the mirror. Window, late afternoon, face a few degrees off camera.";
    } else if (first && first.metrics.brightness < 0.36) {
      light = "Light — Photo " + first.slot + " is dragging the stack down. Same face, window light, late afternoon. If you only fix one thing this week, fix the light.";
    } else {
      light = "Light — Your stack is not a cave, but it's flat. Take the next first-photo by a window, face turned a few degrees off camera. Even light makes you look like someone she could talk to.";
    }

    var crop;
    if (hasFlag(kill, "tiny-face") || hasFlag(kill, "no-face")) {
      crop = "Crop — Photo " + kill.slot + " wastes the frame on the room. Crop to chest-up. Dating apps are a 2-inch thumb. If she has to pinch-zoom to find you, she will not.";
    } else if (hasFlag(kill, "low-face")) {
      crop = "Crop — In photo " + kill.slot + " your head is in the bottom third. The sky is not going to get you a match. Dead space goes. Eyes sit in the upper third.";
    } else if (hasFlag(kill, "group")) {
      crop = "Crop — A crop will not save a group shot. You need a solo. Until then, bury the group and do not lead with it.";
    } else if (hasFlag(first, "tiny-face") || (first && first.metrics.faceFrac < 0.08)) {
      crop = "Crop — Tighten photo " + first.slot + " one notch: top of hair to mid-chest. Leave a little air above the head. Do not go nostril-close.";
    } else {
      crop = "Crop — Tighten photo " + first.slot + " one notch: top of hair to mid-chest. Leave a little air above the head. Do not go nostril-close.";
    }

    var expression;
    if (hasFlag(kill, "group")) {
      expression = "Expression — Photo " + kill.slot + " is a group. She cannot tell which face is yours. Get a solo looking at the lens. One person. One frame.";
    } else if (hasFlag(kill, "soft")) {
      expression = "Expression — Photo " + kill.slot + " is a smear. Hold still, tap to focus on the eyes, then shoot. A blurry grin is not 'natural.' It is unreadable.";
    } else if (hasFlag(kill, "tiny-face") || hasFlag(kill, "no-face")) {
      expression = "Expression — We can barely find a face on photo " + kill.slot + ". Get closer. Eyes at the lens. If she cannot see you, she cannot read you.";
    } else if (hasFlag(kill, "dark")) {
      expression = "Expression — In the dark, your face goes blank. Same look, window light, eyes on the lens. Mood is not a substitute for a visible face.";
    } else if (hasFlag(kill, "eyes-hidden") || hasFlag(kill, "cold")) {
      expression = "Expression — Eyes are doing no work. Take the sunglasses off. Look at the lens, not the floor. Closed mouth is fine. Dead eyes are not.";
    } else if (first && first.metrics.warmth < 0 && first.scores.approachable < 6) {
      expression = "Expression — The lead photo reads closed. Soften the jaw. Think 'you just recognized someone,' not 'passport office.' One real photo beats six smirks.";
    } else {
      expression = "Expression — Don't add another look-away-into-the-void shot. One frame looking into the lens, mouth easy, like you can hold a conversation. That's the third photo most stacks are missing.";
    }

    return [
      { key: "light", title: "Light", body: light },
      { key: "crop", title: "Crop", body: crop },
      { key: "expression", title: "Expression", body: expression }
    ];
  }

  function buryPenalty(p) {
    var n = 0;
    if (hasFlag(p, "group")) n += 8;
    if (hasFlag(p, "soft")) n += 7;
    if (hasFlag(p, "no-face")) n += 7;
    if (hasFlag(p, "tiny-face")) n += 6.5;
    if (hasFlag(p, "dark")) n += 2;
    return n;
  }

  function sortScore(p) {
    return p.scores.composite - buryPenalty(p);
  }

  function isLeadCandidate(p) {
    return !hasFlag(p, "group")
      && !hasFlag(p, "soft")
      && !hasFlag(p, "tiny-face")
      && !hasFlag(p, "no-face")
      && p.metrics.faceFrac >= 0.05
      && p.metrics.sharpness >= 7;
  }

  function isWound(p) {
    return hasFlag(p, "group")
      || hasFlag(p, "dark")
      || hasFlag(p, "soft")
      || hasFlag(p, "tiny-face")
      || hasFlag(p, "no-face");
  }

  function rankPhotos(photos) {
    /* Keep the slot assigned at upload. Never re-number after sort. */
    var scored = photos.map(function (p, i) {
      var copy = Object.assign({}, p, { slot: p.slot != null ? p.slot : i + 1 });
      copy.flags = (p.flags || []).slice();
      if (copy.metrics) {
        var m = copy.metrics;
        var looksGroup = m.group || m.blobCount >= 3
          || (m.aspect > 1.12 && m.skinFrac > 0.12 && m.faceFrac < 0.28);
        if (looksGroup && copy.flags.indexOf("group") === -1) {
          copy.flags.push("group");
          copy.metrics = Object.assign({}, m, { group: true });
        }
      }
      return copy;
    });
    scored.sort(function (a, b) { return sortScore(b) - sortScore(a); });

    var hasNonGroup = scored.some(function (p) { return !hasFlag(p, "group"); });
    var first = scored.find(function (p) {
      return isLeadCandidate(p) && (!hasNonGroup || !hasFlag(p, "group"));
    }) || scored.find(function (p) {
      return !hasFlag(p, "group") && !hasFlag(p, "soft") && !hasFlag(p, "tiny-face") && !hasFlag(p, "no-face");
    }) || scored.find(function (p) {
      return !hasFlag(p, "group");
    }) || scored[0];

    var currentFirst = scored.find(function (p) { return p.isFirst; });
    var kill = null;
    /* User-marked first that is group/dark/soft/tiny-face is the wound. */
    if (currentFirst && currentFirst.id !== first.id && isWound(currentFirst)) {
      kill = currentFirst;
    }
    if (!kill) {
      var rest = scored.filter(function (p) { return p.id !== first.id; });
      rest.sort(function (a, b) { return sortScore(a) - sortScore(b); });
      kill = rest[0] || scored[scored.length - 1];
    }
    if (kill.id === first.id && scored.length > 1) {
      kill = scored[scored.length - 1];
      if (kill.id === first.id) kill = scored[scored.length - 2];
    }

    var bury = scored.filter(function (p) {
      return p.id !== first.id;
    }).sort(function (a, b) { return sortScore(a) - sortScore(b); }).slice(0, 2);

    var killIsCurrent = !!(currentFirst && currentFirst.id === kill.id);
    return {
      order: scored,
      first: first,
      kill: Object.assign({}, kill, { isCurrentFirst: killIsCurrent }),
      bury: bury,
      fixes: threeFixes(scored, kill, first),
      killWhy: killSentence(Object.assign({}, kill, { isCurrentFirst: killIsCurrent }), { isCurrentFirst: killIsCurrent }),
      firstWhy: firstSentence(first)
    };
  }

  function analyzeDataUrl(dataUrl) {
    return loadImage(dataUrl).then(function (img) {
      var s = sample(img, 140);
      var metrics = metricsFromSample(s);
      var scores = scoreFromMetrics(metrics);
      var flags = flagsFromMetrics(metrics, scores);
      return { metrics: metrics, scores: scores, flags: flags };
    });
  }

  g.SK = g.SK || {};
  g.SK.analyze = {
    compressFile: compressFile,
    analyzeDataUrl: analyzeDataUrl,
    rankPhotos: rankPhotos
  };
})(window);
