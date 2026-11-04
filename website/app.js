// ==========================================================================
// YT-DLP Downloader - Modern Interactive Landing Page Script
// ==========================================================================

let simRunning = false;
let simInterval = null;
let simProgress = 0;
let currentSimItem = 1;
const totalSimItems = 5;

const simVideoList = [
  { id: 1, title: "الشيخ عبد الباسط عبد الصمد - سورة فصلت (مرتل)", size: "45.2 MiB" },
  { id: 2, title: "الشيخ عبد الباسط عبد الصمد - سورة الشورى (مرتل)", size: "52.8 MiB" },
  { id: 3, title: "الشيخ عبد الباسط عبد الصمد - سورة الزخرف (مرتل)", size: "38.4 MiB" },
  { id: 4, title: "الشيخ عبد الباسط عبد الصمد - سورة الدخان (مرتل)", size: "29.1 MiB" },
  { id: 5, title: "الشيخ عبد الباسط عبد الصمد - سورة الجاثية (مرتل)", size: "33.7 MiB" }
];

document.addEventListener("DOMContentLoaded", () => {
  setupFaqAccordion();
});

// Copy command to clipboard with toast notification
function copyText(elementId, btnElement) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const textToCopy = el.textContent || el.innerText;
  navigator.clipboard.writeText(textToCopy).then(() => {
    showToast("Copied to clipboard!");

    const originalSpan = btnElement.querySelector("span");
    if (originalSpan) {
      const oldText = originalSpan.textContent;
      originalSpan.textContent = "Copied!";
      setTimeout(() => {
        originalSpan.textContent = oldText;
      }, 2000);
    }
  }).catch(err => {
    console.error("Copy failed", err);
  });
}

// Toast notification helper
function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

// Language Switcher for Instructions
function switchInstructionsLang(lang) {
  const guideEn = document.getElementById("guideEn");
  const guideAr = document.getElementById("guideAr");
  const btnEn = document.getElementById("btnLangEn");
  const btnAr = document.getElementById("btnLangAr");

  if (lang === "ar") {
    guideEn.classList.add("hidden");
    guideAr.classList.remove("hidden");
    btnAr.classList.add("active");
    btnEn.classList.remove("active");
  } else {
    guideAr.classList.add("hidden");
    guideEn.classList.remove("hidden");
    btnEn.classList.add("active");
    btnAr.classList.remove("active");
  }
}

// Format Switcher in Simulator
function setSimFormat(mode) {
  const tabVideo = document.getElementById("simTabVideo");
  const tabAudio = document.getElementById("simTabAudio");
  const formatChip = document.getElementById("simFormatChip");

  if (mode === "audio") {
    tabVideo.classList.remove("active");
    tabAudio.classList.add("active");
    formatChip.textContent = "🎵 MP3 320kbps (Click to change)";
    showToast("Switched to MP3 Audio Mode (320kbps)");
  } else {
    tabAudio.classList.remove("active");
    tabVideo.classList.add("active");
    formatChip.textContent = "🎬 1080p FHD (Click to change)";
    showToast("Switched to Video Mode (1080p MP4)");
  }
}

// Cycle Quality Chip
const qualityPresets = [
  "🎬 1080p FHD (Click to change)",
  "🎬 4K Ultra HD (Click to change)",
  "🎬 720p HD (Click to change)",
  "🎵 MP3 320k Pristine (Click to change)",
  "🎵 MP3 192k Fast (Click to change)"
];
let qualityIndex = 0;
function cycleQuality() {
  qualityIndex = (qualityIndex + 1) % qualityPresets.length;
  document.getElementById("simFormatChip").textContent = qualityPresets[qualityIndex];
}

// Change Simulator Folder
const folderPresets = [
  "D:\\YT-DLP Downloads",
  "C:\\Users\\Downloads\\YouTube",
  "D:\\Audio & Quran",
  "Desktop\\My Videos"
];
let folderIndex = 0;
function changeSimFolder() {
  folderIndex = (folderIndex + 1) % folderPresets.length;
  document.getElementById("demoFolderText").textContent = folderPresets[folderIndex];
  showToast(`Folder changed to: ${folderPresets[folderIndex]}`);
}

// Interactive Download Simulator
function startOrStopSimDownload() {
  const actionBtn = document.getElementById("simActionBtn");

  if (simRunning) {
    // Stop simulation
    clearInterval(simInterval);
    simRunning = false;
    actionBtn.textContent = "▶️ Resume Simulation";
    actionBtn.className = "btn btn-primary btn-sm";
    return;
  }

  // Start simulation
  simRunning = true;
  actionBtn.textContent = "⏸️ Pause Simulation";
  actionBtn.className = "btn btn-secondary btn-sm";

  simInterval = setInterval(() => {
    simProgress += Math.floor(Math.random() * 4) + 3;

    if (simProgress > 100) {
      // Mark current item as done
      const currentQueueEl = document.getElementById(`queue-item-${currentSimItem}`);
      if (currentQueueEl) {
        currentQueueEl.className = "sim-queue-item done";
        document.getElementById(`q-icon-${currentSimItem}`).textContent = "✅ Done";
      }

      currentSimItem++;
      simProgress = 0;

      if (currentSimItem > totalSimItems) {
        // Complete whole playlist
        clearInterval(simInterval);
        simRunning = false;
        actionBtn.textContent = "🎉 Download Completed! (Click to Restart)";
        actionBtn.className = "btn btn-glass btn-sm";
        document.getElementById("simActiveTitle").textContent = "All 5 Videos Downloaded Successfully!";
        document.getElementById("simActiveBadge").textContent = "5 / 5 (100%)";
        document.getElementById("simProgressFill").style.width = "100%";
        document.getElementById("simSpeed").textContent = "0.0 MiB/s";
        document.getElementById("simEta").textContent = "00:00";
        document.getElementById("simOverallStats").textContent = "5 done, 0 failed (5/5)";
        showToast("Simulation Complete: All files saved!");
        return;
      }
    }

    // Active item updates
    const activeVideo = simVideoList[currentSimItem - 1];
    document.getElementById("simActiveTitle").textContent = `Downloading (${currentSimItem}/5): ${activeVideo.title}`;
    document.getElementById("simActiveBadge").textContent = `Item ${currentSimItem} / 5 (${simProgress}%)`;
    document.getElementById("simProgressFill").style.width = `${simProgress}%`;

    // Random realistic speed between 14.5 and 22.8 MiB/s
    const speed = (14 + Math.random() * 8).toFixed(1);
    const etaSecs = Math.max(1, Math.round((100 - simProgress) / 5));
    const etaStr = `00:${etaSecs < 10 ? '0' : ''}${etaSecs}`;
    const sizeDone = ((simProgress / 100) * parseFloat(activeVideo.size)).toFixed(1);

    document.getElementById("simSpeed").textContent = `${speed} MiB/s`;
    document.getElementById("simEta").textContent = etaStr;
    document.getElementById("simSize").textContent = `${sizeDone} / ${activeVideo.size}`;
    document.getElementById("simOverallStats").textContent = `${currentSimItem - 1} done, 0 failed (${currentSimItem}/5)`;

    // Update active queue item UI
    for (let i = 1; i <= totalSimItems; i++) {
      const qEl = document.getElementById(`queue-item-${i}`);
      const qIcon = document.getElementById(`q-icon-${i}`);
      if (i < currentSimItem) {
        qEl.className = "sim-queue-item done";
        qIcon.textContent = "✅ Done";
      } else if (i === currentSimItem) {
        qEl.className = "sim-queue-item active";
        qIcon.textContent = `⬇️ ${simProgress}%`;
      } else {
        qEl.className = "sim-queue-item";
        qIcon.textContent = "⏳ Waiting";
      }
    }

  }, 120);
}

// Reset Demo Simulator
function resetSimDemo() {
  clearInterval(simInterval);
  simRunning = false;
  simProgress = 0;
  currentSimItem = 1;

  const actionBtn = document.getElementById("simActionBtn");
  actionBtn.textContent = "▶️ Start Live Download Simulation";
  actionBtn.className = "btn btn-primary btn-sm";

  document.getElementById("simActiveTitle").textContent = "Ready to download: Sheikh Abdulbasit - Juz' 25 (Murattal)";
  document.getElementById("simActiveBadge").textContent = "Item 1 / 5 (0%)";
  document.getElementById("simProgressFill").style.width = "0%";
  document.getElementById("simSpeed").textContent = "0.0 MiB/s";
  document.getElementById("simEta").textContent = "--:--";
  document.getElementById("simSize").textContent = "0.0 MiB";
  document.getElementById("simOverallStats").textContent = "0 done, 0 failed (0/5)";

  for (let i = 1; i <= totalSimItems; i++) {
    const qEl = document.getElementById(`queue-item-${i}`);
    const qIcon = document.getElementById(`q-icon-${i}`);
    qEl.className = i === 1 ? "sim-queue-item active" : "sim-queue-item";
    qIcon.textContent = "⏳ Waiting";
  }

  showToast("Simulator has been reset!");
}

function triggerSimFetch() {
  showToast("Fetched 5 videos from playlist!");
  resetSimDemo();
}

// FAQ Accordion
function setupFaqAccordion() {
  const items = document.querySelectorAll(".faq-item");
  items.forEach(item => {
    const questionBtn = item.querySelector(".faq-question");
    questionBtn.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");
      items.forEach(other => other.classList.remove("open"));
      if (!isOpen) {
        item.classList.add("open");
      }
    });
  });
}
