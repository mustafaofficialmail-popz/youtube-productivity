// enable_playback.js
// Adds a responsive YouTube player and owner-only jump controls for playlist navigation.
//
// Usage: include this script on chapter pages AFTER the iframe (or anywhere).
// It will look for an iframe with id="playlist" and a data-src (or src) containing the playlist URL.
// If found, it replaces the UI with a player + controls that can jump to any index using the IFrame API.

(function () {
    // --- Config ---
    const CONTROL_BUTTONS = [10, 20, 30, 40]; // quick-jump buttons (edit if you want)
    const PLAYER_ELEMENT_ID = 'yt-player-wrapper';
  
    // load youtube api if not present
    function loadYouTubeAPI(onLoaded) {
      if (window.YT && window.YT.Player) {
        return onLoaded();
      }
      // If the API script tag is already in DOM, wait for it
      if (!document.getElementById('youtube-iframe-api')) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
      // global callback used by YT API when ready
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        if (typeof prev === 'function') prev();
        onLoaded();
      };
    }
  
    // parse playlist id from a youtube embed url
    function extractPlaylistId(url) {
      try {
        const u = new URL(url);
        const q = new URLSearchParams(u.search);
        if (q.has('list')) return q.get('list');
        // sometimes list is encoded in hash
        if (u.hash) {
          const h = new URLSearchParams(u.hash.replace(/^#/, ''));
          if (h.has('list')) return h.get('list');
        }
      } catch (e) {
        // fallback: regex
        const m = url.match(/[?&]list=([a-zA-Z0-9_\-]+)/);
        if (m) return m[1];
      }
      return null;
    }
  
    // Create controls UI
    function createControls(container, onPrev, onNext, onJumpTo) {
      const ctrl = document.createElement('div');
      ctrl.className = 'playlist-controls';
      // Basic styles — you can move to CSS file
      ctrl.style.display = 'flex';
      ctrl.style.flexWrap = 'wrap';
      ctrl.style.gap = '8px';
      ctrl.style.alignItems = 'center';
      ctrl.style.marginTop = '10px';
  
      const btnPrev = document.createElement('button');
      btnPrev.type = 'button';
      btnPrev.textContent = 'Prev';
      btnPrev.className = 'btn-prev';
      btnPrev.onclick = onPrev;
  
      const btnNext = document.createElement('button');
      btnNext.type = 'button';
      btnNext.textContent = 'Next';
      btnNext.className = 'btn-next';
      btnNext.onclick = onNext;
  
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '1';
      input.placeholder = 'video #';
      input.style.width = '80px';
      input.className = 'jump-input';
  
      const btnGo = document.createElement('button');
      btnGo.type = 'button';
      btnGo.textContent = 'Go';
      btnGo.onclick = () => {
        const n = parseInt(input.value, 10);
        if (!isNaN(n) && n >= 1) onJumpTo(n - 1); // convert to 0-based index
      };
  
      // quick jump buttons
      const quickWrap = document.createElement('div');
      quickWrap.style.display = 'flex';
      quickWrap.style.gap = '6px';
      CONTROL_BUTTONS.forEach(v => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = String(v);
        b.onclick = () => onJumpTo(v - 1);
        quickWrap.appendChild(b);
      });
  
      // Append in order
      ctrl.appendChild(btnPrev);
      ctrl.appendChild(btnNext);
      ctrl.appendChild(input);
      ctrl.appendChild(btnGo);
      ctrl.appendChild(quickWrap);
  
      // small info text
      const info = document.createElement('div');
      info.className = 'playlist-info';
      info.style.marginLeft = '8px';
      info.style.color = 'rgba(255,255,255,0.8)';
      info.style.fontSize = '0.95rem';
      info.textContent = '';
  
      ctrl.appendChild(info);
  
      container.appendChild(ctrl);
  
      return {
        setInfo: txt => (info.textContent = txt),
        inputEl: input,
        ctrlEl: ctrl
      };
    }
  
    // Replace existing iframe with a player container + controls
    function initForIframe(iframe) {
      const src = iframe.getAttribute('data-src') || iframe.getAttribute('src') || '';
      const playlistId = extractPlaylistId(src || '');
      if (!playlistId) {
        console.warn('enable_playback: no playlist id found in iframe data-src/src:', src);
        return;
      }
  
      // Prepare DOM: create wrapper right next to iframe and remove/hide old iframe
      const wrapper = document.createElement('div');
      wrapper.id = PLAYER_ELEMENT_ID;
      // responsive container (keeps 16:9)
      wrapper.innerHTML = `
        <div class="player-holder" style="position:relative;width:100%;padding-bottom:56.25%;overflow:hidden;border-radius:8px;">
          <div id="yt-player" style="position:absolute;top:0;left:0;width:100%;height:100%;"></div>
        </div>
      `;
      // insert wrapper after iframe
      iframe.parentNode.insertBefore(wrapper, iframe.nextSibling);
      // keep the old iframe hidden but in DOM (owner only). We'll leave it hidden.
      // iframe.style.display = 'none'; // already hidden in your template
  
      // container for controls
      const controlsContainer = document.createElement('div');
      controlsContainer.className = 'owner-controls';
      iframe.parentNode.insertBefore(controlsContainer, wrapper.nextSibling);
  
      // state
      let player = null;
      let playlistLength = null;
      let currentIndex = 0;
  
      function onPlayerReady() {
        // load playlist at saved index (0)
        try {
          player.loadPlaylist({ list: playlistId, index: 0, suggestedQuality: 'large' });
        } catch (e) {
          console.error('enable_playback: loadPlaylist error', e);
        }
      }
  
      function onPlayerStateChange(event) {
        // update currentIndex
        if (!player || typeof player.getPlaylistIndex !== 'function') return;
        try {
          const idx = player.getPlaylistIndex();
          if (typeof idx === 'number' && idx >= 0) {
            currentIndex = idx;
            controlsAPI.setInfo(`Now: #${idx + 1}${playlistLength ? ' / ' + playlistLength : ''}`);
          }
        } catch (e) {}
      }
  
      // create controls with handlers
      const controlsAPI = createControls(controlsContainer,
        // prev
        () => {
          if (!player) return;
          try { player.previousVideo(); } catch (e) {}
        },
        // next
        () => {
          if (!player) return;
          try { player.nextVideo(); } catch (e) {}
        },
        // jumpTo(index)
        (index0) => {
          if (!player) return;
          if (index0 < 0) index0 = 0;
          // If playlist length known, clamp it
          if (playlistLength && index0 >= playlistLength) index0 = playlistLength - 1;
          try {
            // use loadPlaylist to jump reliably to an index
            player.loadPlaylist({ list: playlistId, index: index0, suggestedQuality: 'large' });
          } catch (e) {
            console.error('enable_playback: failed jump', e);
          }
        }
      );
  
      // add a small "show controls" toggle (owner-only). You can remove if not needed.
      const showToggle = document.createElement('label');
      showToggle.style.display = 'block';
      showToggle.style.marginTop = '8px';
      showToggle.style.fontSize = '0.9rem';
      showToggle.style.color = 'rgba(255,255,255,0.9)';
      showToggle.innerHTML = '<input type="checkbox" id="show-controls" checked style="margin-right:6px"> Controls visible';
      controlsContainer.insertBefore(showToggle, controlsContainer.firstChild);
      const cb = showToggle.querySelector('#show-controls');
      cb.addEventListener('change', () => {
        controlsAPI.ctrlEl.style.display = cb.checked ? 'flex' : 'none';
      });
  
      // Create player once API ready
      loadYouTubeAPI(() => {
        player = new YT.Player('yt-player', {
          height: '360',
          width: '640',
          playerVars: {
            controls: 1,
            rel: 0,
            modestbranding: 1,
            // playsinline helps mobile playback inline
            playsinline: 1,
          },
          events: {
            onReady: function (e) {
              onPlayerReady();
              // try to get playlist length after a short delay
              setTimeout(() => {
                try {
                  const list = player.getPlaylist();
                  if (Array.isArray(list)) playlistLength = list.length;
                  // set info
                  controlsAPI.setInfo(`Now: #1${playlistLength ? ' / ' + playlistLength : ''}`);
                } catch (err) {}
              }, 800);
            },
            onStateChange: onPlayerStateChange
          }
        });
      });
    }
  
    // Find iframe with id="playlist" in the page (our template uses that id).
    document.addEventListener('DOMContentLoaded', () => {
      const iframe = document.getElementById('playlist');
      if (!iframe) return;
      // if data-src empty, try src. If both empty, nothing to do.
      const src = iframe.getAttribute('data-src') || iframe.getAttribute('src') || '';
      if (!src) {
        // nothing to initialize yet (owner hasn't set playlist). Keep iframe hidden.
        console.log('enable_playback: iframe data-src/src empty — no playlist to initialize yet.');
        return;
      }
      initForIframe(iframe);
    });
  })();
  