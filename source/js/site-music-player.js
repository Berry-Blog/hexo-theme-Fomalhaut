/*!
 * site-music-player.js
 * 全站播放器外观与 APlayer 现有播放引擎分离：
 * 播放引擎在 PJAX 内容区之外，因此站内切页时不中断；控件根据页面放入首页横幅或导航栏。
 */
(function () {
  'use strict';

  if (window.__siteMusicDockReady) return;
  window.__siteMusicDockReady = true;

  var ENGINE_ID = 'site-music-engine';
  var dock = document.createElement('section');
  dock.id = 'site-music-player';
  dock.className = 'site-music-player';
  dock.setAttribute('aria-label', '网易云音乐播放器');
  dock.setAttribute('data-playing', 'false');
  dock.innerHTML =
    '<div class="site-music-cover"><img alt="歌曲封面" hidden><span aria-hidden="true">♪</span></div>' +
    '<a class="site-music-meta" href="/life/music/" title="打开八音盒歌单">' +
      '<span class="site-music-title">正在读取歌单…</span>' +
      '<span class="site-music-artist">网易云音乐</span>' +
    '</a>' +
    '<div class="site-music-controls">' +
      '<button type="button" data-smp-action="previous" aria-label="上一首" title="上一首">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h2v14H6zm13 0v14L9 12z"/></svg>' +
      '</button>' +
      '<button type="button" data-smp-action="toggle" aria-label="播放" title="播放">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>' +
      '</button>' +
      '<button type="button" data-smp-action="next" aria-label="下一首" title="下一首">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 5h2v14h-2zM5 5v14l10-7z"/></svg>' +
      '</button>' +
    '</div>' +
    '<div class="site-music-progress" aria-hidden="true"><span></span></div>';
  document.body.appendChild(dock);

  var activePlayer = null;
  var boundPlayers = typeof WeakSet === 'function' ? new WeakSet() : null;
  var retryTimer = null;

  function isHomePage() {
    return !!document.querySelector('#body-wrap.home');
  }

  function placeDock() {
    if (!document.body || !dock) return;

    dock.classList.remove('is-home-hero', 'is-mobile-float');
    if (isHomePage()) {
      var hero = document.getElementById('site-info');
      if (hero) {
        dock.classList.add('is-home-hero');
        hero.appendChild(dock);
        return;
      }
    }

    if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) {
      dock.classList.add('is-mobile-float');
      document.body.appendChild(dock);
      return;
    }

    var nav = document.getElementById('nav');
    var brand = nav && nav.querySelector('#blog_name');
    if (brand && brand.parentNode) {
      brand.parentNode.insertBefore(dock, brand.nextSibling);
    } else {
      document.body.appendChild(dock);
    }
  }

  function getPlayers() {
    return Array.isArray(window.aplayers) ? window.aplayers : [];
  }

  function findPlayer() {
    var players = getPlayers();
    for (var i = 0; i < players.length; i++) {
      var p = players[i];
      var container = p && (p.container || p.element);
      if (container && container.id === ENGINE_ID) return p;
    }
    for (var j = 0; j < players.length; j++) {
      if (players[j] && players[j].options && players[j].options.fixed) return players[j];
    }
    return null;
  }

  function currentAudio(player) {
    if (!player || !player.list) return null;
    if (player.list.current) return player.list.current;
    var audios = player.list.audios || [];
    return audios[player.list.index || 0] || null;
  }

  function formatTime(value) {
    var seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
    var minutes = Math.floor(seconds / 60);
    var rest = Math.floor(seconds % 60);
    return String(minutes).padStart(2, '0') + ':' + String(rest).padStart(2, '0');
  }

  function update(player) {
    if (!player) return;
    activePlayer = player;

    var audio = currentAudio(player);
    var title = dock.querySelector('.site-music-title');
    var artist = dock.querySelector('.site-music-artist');
    var cover = dock.querySelector('.site-music-cover img');
    var coverFallback = dock.querySelector('.site-music-cover span');
    var toggle = dock.querySelector('[data-smp-action="toggle"]');
    var progress = dock.querySelector('.site-music-progress span');

    if (audio) {
      title.textContent = audio.name || '网易云音乐';
      artist.textContent = audio.artist || audio.author || '打开八音盒';
      var image = audio.cover || audio.pic || '';
      if (image) {
        cover.src = image;
        cover.hidden = false;
        coverFallback.hidden = true;
      } else {
        cover.removeAttribute('src');
        cover.hidden = true;
        coverFallback.hidden = false;
      }
    }

    var playing = !!(player.audio && !player.audio.paused);
    dock.setAttribute('data-playing', playing ? 'true' : 'false');
    if (toggle) {
      toggle.setAttribute('aria-label', playing ? '暂停' : '播放');
      toggle.title = playing ? '暂停' : '播放';
      toggle.innerHTML = playing
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
    }

    if (player.audio && progress) {
      var duration = player.audio.duration;
      var current = player.audio.currentTime || 0;
      var percent = duration && Number.isFinite(duration)
        ? Math.max(0, Math.min(100, current / duration * 100))
        : 0;
      progress.style.width = percent + '%';
      dock.setAttribute('aria-valuetext', formatTime(current) + ' / ' + formatTime(duration));
    }
  }

  function bindPlayer(player) {
    if (!player) return false;
    activePlayer = player;

    if (!boundPlayers || !boundPlayers.has(player)) {
      if (boundPlayers) boundPlayers.add(player);
      ['play', 'pause', 'listswitch', 'loadeddata', 'canplay', 'timeupdate', 'ended'].forEach(function (name) {
        if (typeof player.on === 'function') player.on(name, function () { update(player); });
      });
      if (player.audio && typeof player.audio.addEventListener === 'function') {
        ['timeupdate', 'durationchange', 'play', 'pause', 'loadedmetadata'].forEach(function (name) {
          player.audio.addEventListener(name, function () { update(player); });
        });
      }
    }

    update(player);
    return true;
  }

  function bindWhenReady() {
    if (bindPlayer(findPlayer())) {
      if (retryTimer) window.clearInterval(retryTimer);
      retryTimer = null;
      return;
    }
    if (!retryTimer) {
      retryTimer = window.setInterval(function () {
        if (bindPlayer(findPlayer())) {
          window.clearInterval(retryTimer);
          retryTimer = null;
        }
      }, 300);
    }
  }

  dock.addEventListener('click', function (event) {
    var button = event.target.closest && event.target.closest('[data-smp-action]');
    if (!button) return;
    event.preventDefault();

    var player = activePlayer || findPlayer();
    if (!player) return;
    var action = button.getAttribute('data-smp-action');
    try {
      if (action === 'toggle') {
        if (player.audio && !player.audio.paused) player.pause();
        else player.play();
      } else if (action === 'previous') {
        if (typeof player.skipBack === 'function') player.skipBack();
        else if (player.list && typeof player.list.switch === 'function') {
          var list = player.list.audios || [];
          player.list.switch((player.list.index - 1 + list.length) % list.length);
        }
      } else if (action === 'next') {
        if (typeof player.skipForward === 'function') player.skipForward();
        else if (player.list && typeof player.list.switch === 'function') {
          var audios = player.list.audios || [];
          player.list.switch((player.list.index + 1) % audios.length);
        }
      }
    } catch (error) {
      console.warn('[site-music-player] 播放操作失败', error);
    }
    update(player);
  });

  // PJAX 替换 #body-wrap 前先把控件移出页面内容区，换页完成后再放入新导航或首页横幅。
  document.addEventListener('pjax:send', function () {
    if (document.body && dock.parentNode) document.body.appendChild(dock);
  });
  document.addEventListener('pjax:complete', function () {
    placeDock();
    bindWhenReady();
  });
  window.addEventListener('resize', placeDock);
  window.addEventListener('orientationchange', placeDock);

  placeDock();
  bindWhenReady();
})();
