/**
 * YT-DLP Playlist Downloader - Enhanced Popup Controller
 */

let API = "http://127.0.0.1:5000/api";

// State
let rawPlaylistVideos = [];
let displayedVideos = [];
let currentSessionId = null;
let progressInterval = null;
let lastPlaylistTitle = "Playlist";

document.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  setupSettingsAndStorage();
  setupEventListeners();
  const isOnline = await checkServerStatus();
  if (isOnline) {
    await checkAndResumeActiveDownload();
  }
  autoFillCurrentTabUrl();
});

// ================= TABS =================
function setupTabs() {
  const tabDownloaderBtn = document.getElementById("tabDownloaderBtn");
  const tabHistoryBtn = document.getElementById("tabHistoryBtn");
  const tabDownloader = document.getElementById("tabDownloader");
  const tabHistory = document.getElementById("tabHistory");

  tabDownloaderBtn.addEventListener("click", () => {
    tabDownloaderBtn.classList.add("active");
    tabHistoryBtn.classList.remove("active");
    tabDownloader.style.display = "block";
    tabHistory.style.display = "none";
  });

  tabHistoryBtn.addEventListener("click", () => {
    tabHistoryBtn.classList.add("active");
    tabDownloaderBtn.classList.remove("active");
    tabDownloader.style.display = "none";
    tabHistory.style.display = "block";
    loadHistory();
  });
}

// Check and recover ongoing downloads when reopening popup
async function checkAndResumeActiveDownload() {
  try {
    const res = await fetch(`${API}/active-session`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.active && data.session && data.session_id) {
      currentSessionId = data.session_id;
      lastPlaylistTitle = data.session.playlist_title || "Playlist";

      // Show progress screen
      document.getElementById("playlistSection").style.display = "none";
      document.getElementById("progressSection").style.display = "block";
      document.getElementById("completionCard").style.display = "none";
      document.getElementById("currentVideoCard").style.display = "block";
      document.getElementById("cancelBtn").style.display = "block";

      document.getElementById("sessionPlaylistTitle").textContent = lastPlaylistTitle;

      const queue = document.getElementById("downloadQueueList");
      queue.innerHTML = "";
      if (data.session.videos) {
        Object.entries(data.session.videos).forEach(([id, v]) => {
          const item = document.createElement("div");
          item.className = `queue-item ${v.status || "waiting"}`;
          item.id = `queue-${id}`;
          item.innerHTML = `
            <span class="queue-icon">⏳</span>
            <span class="queue-title">${escapeHtml(v.title)}</span>
          `;
          queue.appendChild(item);
        });
      }

      updateProgressDisplay(data.session);
      startProgressPolling();
    }
  } catch {}
}

// ================= SETTINGS & PERSISTENCE =================
function setupSettingsAndStorage() {
  const toggleBtn = document.getElementById("toggleAdvancedBtn");
  const advSection = document.getElementById("advancedSection");
  const subCheck = document.getElementById("subtitlesCheck");
  const subLang = document.getElementById("subtitleLangSelect");
  const formatSelect = document.getElementById("formatSelect");
  const videoQualityField = document.getElementById("videoQualityField");
  const audioQualityField = document.getElementById("audioQualityField");
  const browseFolderBtn = document.getElementById("browseFolderBtn");
  const openFolderDirectBtn = document.getElementById("openFolderDirectBtn");
  const quickBrowseFolderBtn = document.getElementById("quickBrowseFolderBtn");
  const quickOpenFolderBtn = document.getElementById("quickOpenFolderBtn");
  const downloadPathInput = document.getElementById("downloadPathInput");

  // Format Switch (MP3 vs Video)
  function updateFormatView() {
    const isMp3 = formatSelect.value === "mp3";
    if (isMp3) {
      if (videoQualityField) videoQualityField.style.display = "none";
      if (audioQualityField) audioQualityField.style.display = "flex";
      subCheck.checked = false;
      subCheck.disabled = true;
      subLang.disabled = true;
    } else {
      if (videoQualityField) videoQualityField.style.display = "flex";
      if (audioQualityField) audioQualityField.style.display = "none";
      subCheck.disabled = false;
      subLang.disabled = !subCheck.checked;
    }
  }

  formatSelect.addEventListener("change", () => {
    updateFormatView();
    savePreferences();
  });

  // Toggle Advanced Settings
  toggleBtn.addEventListener("click", () => {
    const isHidden = advSection.style.display === "none";
    advSection.style.display = isHidden ? "block" : "none";
    toggleBtn.textContent = isHidden ? "▲ Hide Options" : "⚙️ Options & Folders";
  });

  // Subtitles checkbox
  subCheck.addEventListener("change", () => {
    subLang.disabled = !subCheck.checked;
    savePreferences();
  });

  // Folder helper functions
  function setFolder(path) {
    downloadPathInput.value = path;
    const q = document.getElementById("quickFolderDisplay");
    if (q) q.textContent = path || "~/Downloads/YT-DLP Downloads";
  }

  async function triggerFolderBrowser(btn) {
    const cur = downloadPathInput.value.trim();
    try {
      if (btn) {
        btn.disabled = true;
        btn.textContent = "⏳...";
      }
      const res = await fetch(`${API}/browse-folder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: cur })
      });
      const data = await res.json();
      if (data.path) {
        setFolder(data.path);
        savePreferences();
        showInfo(`Download folder set to: ${data.path}`);
        return;
      }
    } catch {
      // fallback to prompt
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "📂 Browse";
      }
    }

    // Direct fallback prompt if GUI dialog is not available
    const manual = prompt("Enter destination folder path (e.g. D:\\ or C:\\Users\\...):", cur || "D:\\");
    if (manual) {
      setFolder(manual);
      savePreferences();
      showInfo(`Location set to: ${downloadPathInput.value}`);
    }
  }

  // Browse buttons
  browseFolderBtn.addEventListener("click", () => triggerFolderBrowser(browseFolderBtn));
  if (quickBrowseFolderBtn) {
    quickBrowseFolderBtn.addEventListener("click", () => triggerFolderBrowser(quickBrowseFolderBtn));
  }

  // Open folder directly
  function openCurrentFolder() {
    const p = downloadPathInput.value.trim();
    openDirectory(p);
  }
  openFolderDirectBtn.addEventListener("click", openCurrentFolder);
  if (quickOpenFolderBtn) quickOpenFolderBtn.addEventListener("click", openCurrentFolder);

  downloadPathInput.addEventListener("input", () => {
    let raw = downloadPathInput.value;
    const cleaned = raw.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").replace(/["']/g, "").trim();
    if (cleaned !== raw) {
      downloadPathInput.value = cleaned;
    }
    const q = document.getElementById("quickFolderDisplay");
    if (q) q.textContent = downloadPathInput.value.trim() || "~/Downloads/YT-DLP Downloads";
    savePreferences();
  });

  // Preset location chips
  document.querySelectorAll(".preset-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      const p = btn.dataset.path;
      if (p === "default") {
        setFolder("C:\\Users\\Essoo\\Downloads\\YT-DLP Downloads");
      } else if (p === "music") {
        setFolder("C:\\Users\\Essoo\\Music");
      } else if (p === "desktop") {
        setFolder("C:\\Users\\Essoo\\OneDrive\\Desktop");
      } else if (p === "D:\\") {
        setFolder("D:\\");
      } else {
        setFolder(p);
      }
      savePreferences();
      showInfo(`Location set to: ${downloadPathInput.value}`);
    });
  });

  // Save changes automatically
  ["qualitySelect", "audioQualitySelect", "formatSelect", "speedLimitSelect", "subtitleLangSelect", "downloadPathInput"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", savePreferences);
  });

  // Restore saved preferences
  if (chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["quality", "audioQuality", "format", "speedLimit", "subtitles", "subLang", "downloadPath"], (items) => {
      if (items.format) {
        formatSelect.value = items.format;
      }
      if (items.quality && document.getElementById("qualitySelect")) {
        document.getElementById("qualitySelect").value = items.quality;
      }
      if (items.audioQuality && document.getElementById("audioQualitySelect")) {
        document.getElementById("audioQualitySelect").value = items.audioQuality;
      }
      if (items.speedLimit) document.getElementById("speedLimitSelect").value = items.speedLimit;
      if (items.subtitles !== undefined) {
        subCheck.checked = items.subtitles;
      }
      if (items.subLang) subLang.value = items.subLang;
      if (items.downloadPath) {
        setFolder(items.downloadPath);
      }
      updateFormatView();
    });
  } else {
    updateFormatView();
  }
}

function savePreferences() {
  if (chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({
      quality: document.getElementById("qualitySelect") ? document.getElementById("qualitySelect").value : "best",
      audioQuality: document.getElementById("audioQualitySelect") ? document.getElementById("audioQualitySelect").value : "0",
      format: document.getElementById("formatSelect").value,
      speedLimit: document.getElementById("speedLimitSelect").value,
      subtitles: document.getElementById("subtitlesCheck").checked,
      subLang: document.getElementById("subtitleLangSelect").value,
      downloadPath: document.getElementById("downloadPathInput").value.trim()
    });
  }
}

// ================= EVENT LISTENERS =================
function setupEventListeners() {
  document.getElementById("fetchBtn").addEventListener("click", fetchPlaylist);
  document.getElementById("pasteCurrentBtn").addEventListener("click", pasteCurrentTabUrl);

  // Search & Filter
  const searchInput = document.getElementById("searchVideoInput");
  const clearSearchBtn = document.getElementById("clearSearchBtn");
  searchInput.addEventListener("input", filterVideos);
  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    clearSearchBtn.style.display = "none";
    filterVideos();
  });

  // Sorting
  document.getElementById("sortSelect").addEventListener("change", sortVideos);

  // Quick Select
  document.getElementById("selectAllBtn").addEventListener("click", selectAllVisible);
  document.getElementById("deselectAllBtn").addEventListener("click", deselectAllVisible);
  document.getElementById("invertSelectionBtn").addEventListener("click", invertSelection);
  document.getElementById("applyRangeBtn").addEventListener("click", applyRangeSelection);
  document.getElementById("scanFolderBtn").addEventListener("click", scanFolderAndSelectMissing);

  // Downloads
  document.getElementById("downloadBtn").addEventListener("click", () => startDownload(false));
  document.getElementById("downloadAllBtn").addEventListener("click", () => startDownload(true));
  document.getElementById("cancelBtn").addEventListener("click", cancelDownload);

  // Completion
  document.getElementById("openFolderBtn").addEventListener("click", () => {
    openDirectory(document.getElementById("downloadPathInput").value.trim());
  });
  document.getElementById("retryFailedBtn").addEventListener("click", retryFailedDownloads);
  document.getElementById("newDownloadBtn").addEventListener("click", resetUI);

  // History
  document.getElementById("clearHistoryBtn").addEventListener("click", clearHistory);

  // Enter in URL input
  document.getElementById("urlInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") fetchPlaylist();
  });
}

// ================= SERVER CHECK =================
async function checkServerStatus() {
  const endpoints = ["http://127.0.0.1:5000/api", "http://localhost:5000/api"];
  for (const ep of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`${ep}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        API = ep;
        const data = await res.json();
        const dot = document.getElementById("serverStatus");
        dot.className = "status-dot online";
        dot.title = `Server online (${ep})`;
        if (!document.getElementById("downloadPathInput").value && data.default_path) {
          document.getElementById("downloadPathInput").value = data.default_path;
        }
        return true;
      }
    } catch (e) {
      console.warn(`Health check failed on ${ep}:`, e);
    }
  }

  const dot = document.getElementById("serverStatus");
  dot.className = "status-dot offline";
  dot.title = "Server offline - Start server using Start_YTDLP_Server.bat on your Desktop";
  return false;
}

// ================= AUTO-FILL TAB URL =================
async function autoFillCurrentTabUrl() {
  try {
    if (chrome && chrome.tabs) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url && (
        tab.url.includes("youtube.com/playlist") ||
        tab.url.includes("youtube.com/watch") ||
        tab.url.includes("youtu.be") ||
        tab.url.includes("youtube.com/shorts")
      )) {
        document.getElementById("urlInput").value = tab.url;

        // Show smart 1-click download banner for single videos / shorts
        if (tab.url.includes("/watch") || tab.url.includes("youtu.be") || tab.url.includes("/shorts")) {
          const banner = document.getElementById("quickWatchBanner");
          const title = document.getElementById("quickWatchTitle");
          const cleanTitle = (tab.title || "Current Video").replace(/\s*-\s*YouTube$/i, "");
          if (title) {
            title.textContent = cleanTitle;
            title.title = cleanTitle;
          }
          if (banner) banner.style.display = "flex";

          const btnVid = document.getElementById("quickDlVideoBtn");
          const btnAud = document.getElementById("quickDlAudioBtn");
          if (btnVid) btnVid.onclick = () => quickDownloadSingle(tab.url, cleanTitle, "mp4");
          if (btnAud) btnAud.onclick = () => quickDownloadSingle(tab.url, cleanTitle, "mp3");
        }
      }
    }
  } catch {}
}

async function quickDownloadSingle(url, title, format) {
  const downloadPath = document.getElementById("downloadPathInput").value.trim();
  const video = { id: "single", title: title, url: url };
  try {
    const res = await fetch(`${API}/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videos: [video],
        quality: "720",
        format: format,
        download_path: downloadPath,
        playlist_title: title
      })
    });
    const data = await res.json();
    if (res.ok) {
      currentSessionId = data.session_id;
      lastPlaylistTitle = title;
      setupProgressView([video]);
      startProgressPolling();
    }
  } catch (e) {
    showError("Could not start download: " + e.message);
  }
}

async function pasteCurrentTabUrl() {
  try {
    if (chrome && chrome.tabs) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        document.getElementById("urlInput").value = tab.url;
        showInfo("Pasted current URL. Click Fetch!");
      }
    }
  } catch {
    showError("Could not access active tab URL");
  }
}

// ================= FETCH PLAYLIST =================
async function fetchPlaylist() {
  const url = document.getElementById("urlInput").value.trim();
  if (!url) {
    showError("Please enter or paste a URL first.");
    return;
  }

  const isServerUp = await checkServerStatus();
  if (!isServerUp) {
    showError("Cannot connect to local server! Please start 'server\\start_server.bat' first.");
    return;
  }

  const fetchBtn = document.getElementById("fetchBtn");
  fetchBtn.disabled = true;
  fetchBtn.querySelector(".btn-text").style.display = "none";
  fetchBtn.querySelector(".btn-loading").style.display = "inline-block";
  hideAlerts();

  try {
    const res = await fetch(`${API}/fetch-playlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to fetch playlist");
    }

    if (!data.videos || data.videos.length === 0) {
      throw new Error("No videos found in this URL.");
    }

    lastPlaylistTitle = data.playlist_title || "Playlist";
    rawPlaylistVideos = data.videos.map((v, idx) => ({
      ...v,
      originalIndex: idx + 1,
      selected: true
    }));

    // Update Meta Display
    document.getElementById("playlistTitle").textContent = data.playlist_title;
    document.getElementById("playlistTitle").title = data.playlist_title;
    document.getElementById("videoCount").textContent = `${data.videos.length} videos`;
    document.getElementById("playlistDuration").textContent = data.total_duration || "00:00";
    document.getElementById("playlistUploader").textContent = data.playlist_uploader ? `• ${data.playlist_uploader}` : "";

    // Reset Filter/Sort
    document.getElementById("searchVideoInput").value = "";
    document.getElementById("clearSearchBtn").style.display = "none";
    document.getElementById("sortSelect").value = "default";
    document.getElementById("rangeStart").value = "1";
    document.getElementById("rangeEnd").value = Math.min(10, data.videos.length);

    displayedVideos = [...rawPlaylistVideos];
    renderVideoList();
    document.getElementById("playlistSection").style.display = "block";

  } catch (err) {
    showError(err.message);
  } finally {
    fetchBtn.disabled = false;
    fetchBtn.querySelector(".btn-text").style.display = "inline";
    fetchBtn.querySelector(".btn-loading").style.display = "none";
  }
}

// ================= RENDER VIDEO LIST =================
function renderVideoList() {
  const container = document.getElementById("videoList");
  container.innerHTML = "";

  displayedVideos.forEach((video) => {
    const item = document.createElement("div");
    const isDownloadedClass = video.isDownloaded ? "already-in-folder" : "";
    item.className = `video-item ${video.selected ? "selected" : ""} ${isDownloadedClass}`;
    item.dataset.id = video.id;

    const thumbSrc = video.thumbnail || "icons/icon48.png";
    const downloadedBadge = video.isDownloaded
      ? `<span class="already-downloaded-tag" title="Already downloaded in destination folder">✓ In Folder</span>`
      : "";

    item.innerHTML = `
      <span class="video-index">#${video.originalIndex}</span>
      <input type="checkbox" class="video-checkbox" ${video.selected ? "checked" : ""}>
      <div class="thumb-container">
        <img class="video-thumb" src="${escapeHtml(thumbSrc)}" alt="" loading="lazy" onerror="this.src='icons/icon48.png'">
        ${video.duration_string && video.duration_string !== "N/A" ? `<span class="duration-tag">${video.duration_string}</span>` : ""}
      </div>
      <div class="video-info">
        <div class="video-title" title="${escapeHtml(video.title)}">${escapeHtml(video.title)}</div>
        <div class="video-meta-row">
          ${downloadedBadge}
          ${video.uploader ? `<span>${escapeHtml(video.uploader)}</span>` : ""}
          ${video.view_count_str ? `<span>• ${video.view_count_str}</span>` : ""}
        </div>
      </div>
    `;

    // Row click toggles selection
    item.addEventListener("click", (e) => {
      if (e.target.tagName !== "INPUT") {
        const cb = item.querySelector(".video-checkbox");
        cb.checked = !cb.checked;
      }
      const isChecked = item.querySelector(".video-checkbox").checked;
      video.selected = isChecked;
      item.classList.toggle("selected", isChecked);
      updateSelectionSummary();
    });

    container.appendChild(item);
  });

  updateSelectionSummary();
}

function updateSelectionSummary() {
  const selectedCount = rawPlaylistVideos.filter(v => v.selected).length;
  document.getElementById("selectedCount").textContent = selectedCount;
  document.getElementById("totalVisibleCount").textContent = displayedVideos.length;
  document.getElementById("downloadBtn").disabled = selectedCount === 0;
}

// ================= FILTER & SEARCH =================
function filterVideos() {
  const query = document.getElementById("searchVideoInput").value.toLowerCase().trim();
  const clearBtn = document.getElementById("clearSearchBtn");
  clearBtn.style.display = query ? "block" : "none";

  if (!query) {
    displayedVideos = [...rawPlaylistVideos];
  } else {
    displayedVideos = rawPlaylistVideos.filter(v =>
      v.title.toLowerCase().includes(query) ||
      (v.uploader && v.uploader.toLowerCase().includes(query))
    );
  }
  applyCurrentSort();
  renderVideoList();
}

// ================= SORTING =================
function sortVideos() {
  applyCurrentSort();
  renderVideoList();
}

function applyCurrentSort() {
  const mode = document.getElementById("sortSelect").value;
  if (mode === "default") {
    displayedVideos.sort((a, b) => a.originalIndex - b.originalIndex);
  } else if (mode === "title") {
    displayedVideos.sort((a, b) => a.title.localeCompare(b.title));
  } else if (mode === "duration_desc") {
    displayedVideos.sort((a, b) => (b.duration || 0) - (a.duration || 0));
  } else if (mode === "duration_asc") {
    displayedVideos.sort((a, b) => (a.duration || 0) - (b.duration || 0));
  }
}

// ================= SELECTION TOOLS =================
function selectAllVisible() {
  displayedVideos.forEach(v => v.selected = true);
  renderVideoList();
}

function deselectAllVisible() {
  displayedVideos.forEach(v => v.selected = false);
  renderVideoList();
}

function invertSelection() {
  displayedVideos.forEach(v => v.selected = !v.selected);
  renderVideoList();
}

function applyRangeSelection() {
  const start = parseInt(document.getElementById("rangeStart").value, 10);
  const end = parseInt(document.getElementById("rangeEnd").value, 10);

  if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
    showError("Please enter a valid range (e.g. 1 to 10)");
    return;
  }

  rawPlaylistVideos.forEach(v => {
    v.selected = (v.originalIndex >= start && v.originalIndex <= end);
  });
  renderVideoList();
  showInfo(`Selected videos #${start} through #${end}`);
}

// ================= SCAN FOLDER & SELECT MISSING =================
async function scanFolderAndSelectMissing() {
  if (!rawPlaylistVideos || rawPlaylistVideos.length === 0) {
    showError("Please fetch a playlist first.");
    return;
  }

  const scanBtn = document.getElementById("scanFolderBtn");
  const origText = scanBtn.textContent;
  scanBtn.disabled = true;
  scanBtn.textContent = "⏳ Scanning...";

  const folderPath = document.getElementById("downloadPathInput").value.trim();

  try {
    const res = await fetch(`${API}/scan-folder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folder_path: folderPath,
        videos: rawPlaylistVideos
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to scan folder");
    }

    const foundSet = new Set((data.found_ids || []).map(String));

    rawPlaylistVideos.forEach(v => {
      const isFound = foundSet.has(String(v.id));
      v.isDownloaded = isFound;
      // Auto-select only the missing ones
      v.selected = !isFound;
    });

    renderVideoList();

    if (data.found_count === 0) {
      showInfo(`Folder checked: None of these videos are in the folder yet. All ${data.missing_count} selected!`);
    } else if (data.missing_count === 0) {
      showInfo(`Great news! All ${data.found_count} videos are already downloaded in your folder.`);
    } else {
      showInfo(`Found ${data.found_count} downloaded in folder. Auto-selected ${data.missing_count} missing videos to download!`);
    }

  } catch (err) {
    showError(err.message || "Failed to scan folder");
  } finally {
    scanBtn.disabled = false;
    scanBtn.textContent = origText;
  }
}

// ================= DOWNLOAD =================
async function startDownload(downloadAll) {
  let targetVideos;
  if (downloadAll) {
    targetVideos = [...rawPlaylistVideos];
  } else {
    targetVideos = rawPlaylistVideos.filter(v => v.selected);
  }

  if (targetVideos.length === 0) {
    showError("No videos selected for download.");
    return;
  }

  hideAlerts();
  const format = document.getElementById("formatSelect").value;
  const quality = document.getElementById("qualitySelect") ? document.getElementById("qualitySelect").value : "best";
  const audioQuality = document.getElementById("audioQualitySelect") ? document.getElementById("audioQualitySelect").value : "0";
  const speedLimit = document.getElementById("speedLimitSelect").value;
  const subtitles = format === "mp3" ? false : document.getElementById("subtitlesCheck").checked;
  const subtitleLang = document.getElementById("subtitleLangSelect").value;
  const downloadPath = document.getElementById("downloadPathInput").value.trim();

  try {
    const res = await fetch(`${API}/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videos: targetVideos,
        quality,
        format,
        audio_quality: audioQuality,
        download_path: downloadPath,
        speed_limit: speedLimit,
        subtitles,
        subtitle_lang: subtitleLang,
        playlist_title: lastPlaylistTitle
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to start download");
    }

    currentSessionId = data.session_id;
    setupProgressView(targetVideos);
    startProgressPolling();

  } catch (err) {
    showError(err.message);
  }
}

// ================= PROGRESS VIEW & POLLING =================
function setupProgressView(videos) {
  document.getElementById("playlistSection").style.display = "none";
  document.getElementById("progressSection").style.display = "block";
  document.getElementById("completionCard").style.display = "none";
  document.getElementById("currentVideoCard").style.display = "block";
  document.getElementById("cancelBtn").style.display = "block";

  document.getElementById("sessionPlaylistTitle").textContent = lastPlaylistTitle;
  document.getElementById("overallStats").textContent = `0 / ${videos.length} completed`;
  document.getElementById("overallPercent").textContent = "0%";
  document.getElementById("overallProgressBar").style.width = "0%";
  document.getElementById("totalVideosCount").textContent = videos.length;

  const queue = document.getElementById("downloadQueueList");
  queue.innerHTML = "";

  videos.forEach((v) => {
    const item = document.createElement("div");
    item.className = "queue-item waiting";
    item.id = `queue-${v.id}`;
    item.innerHTML = `
      <span class="queue-icon">⏳</span>
      <span class="queue-title">${escapeHtml(v.title)}</span>
    `;
    queue.appendChild(item);
  });
}

function startProgressPolling() {
  if (progressInterval) clearInterval(progressInterval);

  progressInterval = setInterval(async () => {
    if (!currentSessionId) return;

    try {
      const res = await fetch(`${API}/progress-poll/${currentSessionId}`);
      if (!res.ok) return;

      const data = await res.json();
      updateProgressDisplay(data);

      if (data.status === "completed" || data.status === "cancelled") {
        clearInterval(progressInterval);
        progressInterval = null;
        onDownloadFinished(data);
      }
    } catch (err) {
      console.warn("Polling error:", err);
    }
  }, 500);
}

function updateProgressDisplay(data) {
  const total = data.total || 1;
  const completed = (data.completed || 0) + (data.skipped || 0);
  const failed = data.failed || 0;
  const doneSoFar = completed + failed;
  const pct = Math.min(100, Math.round((doneSoFar / total) * 100));

  document.getElementById("overallStats").textContent = `${completed} done, ${failed} failed (${doneSoFar}/${total})`;
  document.getElementById("overallPercent").textContent = `${pct}%`;
  document.getElementById("overallProgressBar").style.width = `${pct}%`;

  if (data.current_video) {
    document.getElementById("currentVideoTitle").textContent = data.current_video;
    const curIdx = data.current_index || 1;
    const curProgress = (data.current_progress !== undefined && data.current_progress !== null)
      ? Math.round(data.current_progress)
      : 0;
    document.getElementById("currentVideoIndex").textContent = `${curIdx} (${curProgress}%)`;

    document.getElementById("currentSpeed").textContent = data.current_speed ? `⚡ ${data.current_speed}` : "⚡ Connecting...";
    document.getElementById("currentETA").textContent = data.current_eta ? `⏱️ ETA: ${data.current_eta}` : "⏱️ ETA: --:--";
    document.getElementById("currentSize").textContent = data.current_size ? `📦 ${data.current_size}` : "📦 Estimating...";
    document.getElementById("currentProgressBar").style.width = `${curProgress}%`;
  }

  // Update item queue badges
  if (data.videos) {
    Object.entries(data.videos).forEach(([id, info]) => {
      const el = document.getElementById(`queue-${id}`);
      if (!el) return;

      el.className = `queue-item ${info.status}`;
      const icon = el.querySelector(".queue-icon");

      if (info.status === "completed") {
        icon.textContent = "✅";
      } else if (info.status === "downloading") {
        const itemProg = (info.progress !== undefined && info.progress !== null) ? `${Math.round(info.progress)}%` : "";
        icon.textContent = `⬇️ ${itemProg}`;
      } else if (info.status === "processing") {
        icon.textContent = "⚙️";
      } else if (info.status === "failed") {
        icon.textContent = "❌";
      } else if (info.status === "skipped") {
        icon.textContent = "⏭️";
      }
    });
  }
}

function onDownloadFinished(data) {
  document.getElementById("currentVideoCard").style.display = "none";
  document.getElementById("cancelBtn").style.display = "none";
  const compCard = document.getElementById("completionCard");
  compCard.style.display = "block";

  const isCancelled = data.status === "cancelled";
  document.getElementById("completionIcon").textContent = isCancelled ? "⚠️" : (data.failed > 0 ? "⚠️" : "🎉");
  document.getElementById("completionTitle").textContent = isCancelled ? "Download Cancelled" : "Download Complete!";

  const msg = `${data.completed} downloaded, ${data.skipped || 0} skipped, ${data.failed} failed.`;
  document.getElementById("completionDetails").textContent = msg;

  const retryBtn = document.getElementById("retryFailedBtn");
  retryBtn.style.display = (data.failed > 0) ? "inline-block" : "none";

  // Trigger browser notification
  notifyUser("Download Complete", msg);
}

async function cancelDownload() {
  if (!currentSessionId) return;
  try {
    await fetch(`${API}/cancel/${currentSessionId}`, { method: "POST" });
    showInfo("Cancelling current download...");
  } catch {}
}

async function retryFailedDownloads() {
  if (!currentSessionId) return;
  try {
    const res = await fetch(`${API}/retry/${currentSessionId}`, { method: "POST" });
    const data = await res.json();
    if (data.failed_videos && data.failed_videos.length > 0) {
      startDownloadWithVideos(data.failed_videos);
    }
  } catch {
    showError("Could not retry failed downloads");
  }
}

async function startDownloadWithVideos(videos) {
  const quality = document.getElementById("qualitySelect").value;
  const format = document.getElementById("formatSelect").value;
  const downloadPath = document.getElementById("downloadPathInput").value.trim();

  try {
    const res = await fetch(`${API}/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videos,
        quality,
        format,
        download_path: downloadPath,
        playlist_title: `${lastPlaylistTitle} (Retry)`
      })
    });
    const data = await res.json();
    if (res.ok) {
      currentSessionId = data.session_id;
      setupProgressView(videos);
      startProgressPolling();
    }
  } catch {}
}

function resetUI() {
  currentSessionId = null;
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
  document.getElementById("progressSection").style.display = "none";
  document.getElementById("playlistSection").style.display = "block";
  hideAlerts();
}

// ================= HISTORY TAB =================
async function loadHistory() {
  const container = document.getElementById("historyList");
  container.innerHTML = `<div class="empty-state">Loading history...</div>`;

  try {
    const res = await fetch(`${API}/history`);
    const data = await res.json();

    if (!data.history || data.history.length === 0) {
      container.innerHTML = `<div class="empty-state">No downloads recorded yet.</div>`;
      return;
    }

    container.innerHTML = "";
    data.history.reverse().forEach((item) => {
      const el = document.createElement("div");
      el.className = "history-item";

      const dateStr = item.finished_at ? new Date(item.finished_at).toLocaleString() : "Recently";
      const statusIcon = item.status === "completed" ? "✅" : "⚠️";

      el.innerHTML = `
        <div class="history-details">
          <div class="history-title" title="${escapeHtml(item.playlist_title)}">${statusIcon} ${escapeHtml(item.playlist_title)}</div>
          <div class="history-sub">${item.completed}/${item.total} downloaded • ${dateStr}</div>
        </div>
        <button class="btn-icon open-hist-folder" title="Open Folder">📁</button>
      `;

      el.querySelector(".open-hist-folder").addEventListener("click", () => {
        openDirectory(item.download_path);
      });

      container.appendChild(el);
    });

  } catch {
    container.innerHTML = `<div class="empty-state">Could not load history from server.</div>`;
  }
}

async function clearHistory() {
  try {
    await fetch(`${API}/clear-history`, { method: "POST" });
    loadHistory();
  } catch {}
}

// ================= HELPERS =================
async function openDirectory(path) {
  try {
    const res = await fetch(`${API}/open-folder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: path || "" })
    });
    const d = await res.json();
    if (d.status === "opened") {
      showInfo(`Opened in File Explorer: ${d.path}`);
    } else {
      showError(d.error || "Could not open folder in File Explorer");
    }
  } catch (e) {
    showError("Could not connect to server to open folder.");
  }
}

function notifyUser(title, message) {
  try {
    if (chrome && chrome.notifications) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: title,
        message: message,
        priority: 2
      });
    }
  } catch {}
}

function showError(msg) {
  const el = document.getElementById("errorMsg");
  el.textContent = msg;
  el.style.display = "block";
  document.getElementById("infoMsg").style.display = "none";
}

function showInfo(msg) {
  const el = document.getElementById("infoMsg");
  el.textContent = msg;
  el.style.display = "block";
  document.getElementById("errorMsg").style.display = "none";
}

function hideAlerts() {
  document.getElementById("errorMsg").style.display = "none";
  document.getElementById("infoMsg").style.display = "none";
}

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
