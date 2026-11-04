// ==========================================================================
// YT-DLP Downloader - Landing Page Interactive Scripts
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  setupFaqAccordion();
  detectGitHubRepo();
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

// Interactive Simulation Preview: Switch between Video and Audio
function switchSimMode(mode) {
  const tabVideo = document.getElementById("simTabVideo");
  const tabAudio = document.getElementById("simTabAudio");
  const formatChip = document.getElementById("simFormatChip");
  const activeTitle = document.getElementById("simActiveTitle");
  const progressFill = document.getElementById("simProgressFill");

  if (mode === "audio") {
    tabVideo.classList.remove("active");
    tabAudio.classList.add("active");
    formatChip.textContent = "🎵 MP3 (320k Pristine)";
    activeTitle.textContent = "Converting Audio: Sheikh Abdulbasit - Juz' 25...";
    progressFill.style.width = "92%";
  } else {
    tabAudio.classList.remove("active");
    tabVideo.classList.add("active");
    formatChip.textContent = "🎬 1080p FHD";
    activeTitle.textContent = "Downloading: The 5 Most Important Minutes If You're Behind...";
    progressFill.style.width = "76%";
  }
}

// FAQ Accordion
function setupFaqAccordion() {
  const items = document.querySelectorAll(".faq-item");
  items.forEach(item => {
    const questionBtn = item.querySelector(".faq-question");
    questionBtn.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");
      // Close other items
      items.forEach(other => other.classList.remove("open"));
      if (!isOpen) {
        item.classList.add("open");
      }
    });
  });
}

// Detect GitHub URL when hosted on GitHub Pages
function detectGitHubRepo() {
  const host = window.location.hostname;
  const path = window.location.pathname;

  // If hosted on username.github.io/repo/
  if (host.endsWith("github.io")) {
    const parts = path.split("/").filter(Boolean);
    if (parts.length > 0) {
      const repoName = parts[0];
      const username = host.replace(".github.io", "");
      const repoUrl = `https://github.com/${username}/${repoName}`;
      const zipUrl = `https://github.com/${username}/${repoName}/archive/refs/heads/main.zip`;

      const downloadZipBtn = document.getElementById("downloadZipBtn");
      if (downloadZipBtn) downloadZipBtn.href = zipUrl;

      const stepDownloadBtn = document.getElementById("stepDownloadBtn");
      if (stepDownloadBtn) stepDownloadBtn.href = zipUrl;

      const githubRepoLink = document.getElementById("githubRepoLink");
      if (githubRepoLink) githubRepoLink.href = repoUrl;

      const footerGithubLink = document.getElementById("footerGithubLink");
      if (footerGithubLink) footerGithubLink.href = repoUrl;

      const cloneCmd = document.getElementById("cloneCmd");
      if (cloneCmd) cloneCmd.textContent = `git clone ${repoUrl}.git`;
    }
  }
}
