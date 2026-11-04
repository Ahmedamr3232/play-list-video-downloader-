/**
 * YT-DLP Playlist Downloader - Background Service Worker
 * Keeps badge updated with live download % and sends desktop notifications
 * even when the popup is closed!
 */

const API = "http://127.0.0.1:5000/api";
let lastActiveSessionId = null;

// Poll active session every 2 seconds
setInterval(checkBackgroundDownload, 2000);

async function checkBackgroundDownload() {
  try {
    const res = await fetch(`${API}/active-session`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return;

    const data = await res.json();

    if (data.active && data.session) {
      const s = data.session;
      lastActiveSessionId = data.session_id;

      const total = s.total || 1;
      const done = (s.completed || 0) + (s.skipped || 0) + (s.failed || 0);
      const pct = Math.min(100, Math.round((done / total) * 100));

      // Update extension toolbar badge
      chrome.action.setBadgeText({ text: `${pct}%` });
      chrome.action.setBadgeBackgroundColor({ color: "#ff334b" });

    } else if (lastActiveSessionId) {
      // Session just finished!
      try {
        const checkRes = await fetch(`${API}/progress-poll/${lastActiveSessionId}`);
        if (checkRes.ok) {
          const finalData = await checkRes.json();
          if (finalData.status === "completed") {
            // Badge green checkmark
            chrome.action.setBadgeText({ text: "DONE" });
            chrome.action.setBadgeBackgroundColor({ color: "#10b981" });

            // Desktop notification
            chrome.notifications.create({
              type: "basic",
              iconUrl: "icons/icon128.png",
              title: "🎉 Download Complete!",
              message: `${finalData.completed} of ${finalData.total} videos downloaded from "${finalData.playlist_title}".`,
              priority: 2
            });

            // Clear badge after 8 seconds
            setTimeout(() => {
              chrome.action.setBadgeText({ text: "" });
            }, 8000);
          } else {
            chrome.action.setBadgeText({ text: "" });
          }
        }
      } catch {}
      lastActiveSessionId = null;
    } else {
      chrome.action.setBadgeText({ text: "" });
    }
  } catch {
    // Server offline or network blip
    chrome.action.setBadgeText({ text: "" });
  }
}
