"""
YT-DLP Playlist Downloader - Backend Server (Enhanced & Fixed)
A Flask server that interfaces with yt-dlp to fetch playlist info and download videos.
Includes: folder browsing via PowerShell Forms, native Explorer opening, smart playlist sync,
robust subtitle handling, and MP3 bitrate control.
"""

import json
import os
import subprocess
import sys
import threading
import time
import re
import uuid
import shutil
from datetime import datetime
from flask import Flask, request, jsonify, Response
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Paths
download_sessions = {}
download_history = []
HISTORY_FILE = os.path.join(os.path.dirname(__file__), "download_history.json")
DEFAULT_DOWNLOAD_PATH = os.path.join(os.path.expanduser("~"), "Downloads", "YT-DLP Downloads")
active_processes = {}

# Locate yt-dlp dynamically for any computer
def get_ytdlp_path():
    which_yt = shutil.which("yt-dlp")
    if which_yt and os.path.isfile(which_yt):
        return which_yt
    local_bin = os.path.join(os.path.dirname(__file__), "bin", "yt-dlp.exe")
    if os.path.isfile(local_bin):
        return local_bin
    for path in [
        os.path.join(sys.prefix, "Scripts", "yt-dlp.exe"),
        os.path.join(sys.prefix, "yt-dlp.exe"),
        r"C:\Python38\yt-dlp.exe",
        r"C:\Python39\yt-dlp.exe",
        r"C:\Python310\yt-dlp.exe",
        r"C:\Python311\yt-dlp.exe",
        r"C:\Python312\yt-dlp.exe",
        "yt-dlp",
        "yt-dlp.exe"
    ]:
        if os.path.isfile(path):
            return path
    return "yt-dlp"

YTDLP = get_ytdlp_path()

# Locate ffmpeg dynamically across system, user, WinGet, or local bin
def get_ffmpeg_dir():
    which_ff = shutil.which("ffmpeg")
    if which_ff:
        return os.path.dirname(os.path.abspath(which_ff))
    local_bin = os.path.join(os.path.dirname(__file__), "bin")
    if os.path.isfile(os.path.join(local_bin, "ffmpeg.exe")):
        return local_bin
    candidates = [
        os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WinGet\Links"),
        os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WinGet\Packages"),
        os.path.expandvars(r"%ProgramFiles%\ffmpeg\bin"),
        os.path.expandvars(r"%ProgramFiles(x86)%\ffmpeg\bin"),
        r"C:\ffmpeg\bin",
        r"C:\ProgramData\chocolatey\bin",
    ]
    for d in candidates:
        if os.path.isfile(os.path.join(d, "ffmpeg.exe")):
            return d
    return None

FFMPEG_DIR = get_ffmpeg_dir()

def load_history():
    global download_history
    try:
        if os.path.exists(HISTORY_FILE):
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                download_history = json.load(f)
    except Exception:
        download_history = []

def save_history():
    try:
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(download_history[-100:], f, ensure_ascii=False, indent=2)
    except Exception:
        pass

load_history()

def clean_path(path_str):
    """Clean and normalize folder paths from user input or quotes."""
    if not path_str:
        return DEFAULT_DOWNLOAD_PATH
    p = str(path_str).strip()
    p = re.sub(r'^["\'“”‘’]+|["\'“”‘’]+$', '', p).strip()
    p = p.replace('"', '').replace("'", "")
    if p.startswith('\\') and len(p) >= 3 and p[2] == ':':
        p = p[1:]
    if not p:
        return DEFAULT_DOWNLOAD_PATH
    if len(p) == 2 and p[1] == ':':
        p = p + "\\"
    elif len(p) == 3 and p[1] == ':' and p[2] in ('/', '\\'):
        p = p[0:2] + "\\"
    return os.path.normpath(p)

def normalize_name(s):
    if not s:
        return ""
    # Strip tatweel and punctuation
    s = re.sub(r'[\u0640]', '', s)
    s = re.sub(r'[\\/*?:"<>|#()\[\]_\-\.]', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip().lower()
    return s

def format_duration(seconds):
    if not seconds:
        return "N/A"
    seconds = int(seconds)
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"

def format_views(count):
    if not count:
        return ""
    if count >= 1_000_000:
        return f"{count / 1_000_000:.1f}M views"
    if count >= 1_000:
        return f"{count / 1_000:.1f}K views"
    return f"{count} views"


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "ytdlp": YTDLP,
        "ffmpeg": FFMPEG_DIR,
        "default_path": DEFAULT_DOWNLOAD_PATH
    })


@app.route("/api/fetch-playlist", methods=["POST"])
def fetch_playlist():
    data = request.json or {}
    url = data.get("url", "").strip()

    if not url:
        return jsonify({"error": "No URL provided"}), 400

    try:
        playlist_title = "Playlist"
        playlist_uploader = ""
        try:
            cmd_info = [
                YTDLP,
                "--flat-playlist",
                "--dump-single-json",
                "--no-warnings",
                "--no-check-certificates",
                url
            ]
            result_info = subprocess.run(
                cmd_info,
                capture_output=True,
                text=True,
                timeout=45,
                encoding="utf-8",
                errors="replace"
            )
            if result_info.returncode == 0:
                playlist_data = json.loads(result_info.stdout)
                playlist_title = playlist_data.get("title", "Playlist")
                playlist_uploader = playlist_data.get("uploader", "")
        except Exception:
            pass

        cmd = [
            YTDLP,
            "--flat-playlist",
            "--dump-json",
            "--no-warnings",
            "--no-check-certificates",
            url
        ]

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=180,
            encoding="utf-8",
            errors="replace"
        )

        if result.returncode != 0 and not result.stdout.strip():
            return jsonify({"error": f"yt-dlp error: {result.stderr[:500]}"}), 400

        videos = []
        for line in result.stdout.strip().split("\n"):
            if not line.strip():
                continue
            try:
                info = json.loads(line)
                vid_id = str(info.get("id") or len(videos) + 1)
                vid_url = info.get("webpage_url") or info.get("url")
                if not vid_url or not vid_url.startswith("http"):
                    vid_url = f"https://www.youtube.com/watch?v={vid_id}"

                thumb = info.get("thumbnail") or f"https://i.ytimg.com/vi/{vid_id}/mqdefault.jpg"

                video = {
                    "id": vid_id,
                    "title": info.get("title", "Unknown Title"),
                    "url": vid_url,
                    "duration": info.get("duration"),
                    "duration_string": format_duration(info.get("duration")),
                    "thumbnail": thumb,
                    "uploader": info.get("uploader", ""),
                    "view_count": info.get("view_count"),
                    "view_count_str": format_views(info.get("view_count")),
                }
                videos.append(video)
            except json.JSONDecodeError:
                continue

        return jsonify({
            "playlist_title": playlist_title,
            "playlist_uploader": playlist_uploader,
            "video_count": len(videos),
            "videos": videos,
            "total_duration": format_duration(sum(v.get("duration") or 0 for v in videos))
        })

    except subprocess.TimeoutExpired:
        return jsonify({"error": "Request timed out while fetching playlist."}), 408
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/download", methods=["POST"])
def start_download():
    data = request.json or {}
    videos = data.get("videos", [])
    quality = data.get("quality", "best")
    format_type = data.get("format", "mp4")
    audio_quality = data.get("audio_quality", "0")
    download_path = clean_path(data.get("download_path"))
    subtitles = data.get("subtitles", False)
    subtitle_lang = data.get("subtitle_lang", "en")
    speed_limit = data.get("speed_limit", "")
    playlist_title = data.get("playlist_title", "Unknown")

    if not videos:
        return jsonify({"error": "No videos selected"}), 400

    try:
        os.makedirs(download_path, exist_ok=True)
    except Exception as e:
        return jsonify({"error": f"Cannot create download folder: {str(e)}"}), 400

    session_id = str(uuid.uuid4())[:8]
    download_sessions[session_id] = {
        "status": "starting",
        "total": len(videos),
        "completed": 0,
        "failed": 0,
        "skipped": 0,
        "current_video": "",
        "current_index": 0,
        "current_progress": 0,
        "current_speed": "",
        "current_eta": "",
        "current_size": "",
        "videos": {},
        "errors": [],
        "download_path": download_path,
        "playlist_title": playlist_title,
        "started_at": datetime.now().isoformat(),
        "cancelled": False
    }

    thread = threading.Thread(
        target=download_worker,
        args=(session_id, videos, quality, format_type, audio_quality, download_path,
              subtitles, subtitle_lang, speed_limit),
        daemon=True
    )
    thread.start()

    return jsonify({"session_id": session_id})


def download_worker(session_id, videos, quality, format_type, audio_quality, download_path,
                    subtitles, subtitle_lang, speed_limit):
    session = download_sessions[session_id]
    session["status"] = "downloading"

    if format_type == "mp3":
        format_args = ["-x", "--audio-format", "mp3", "--audio-quality", str(audio_quality)]
    elif format_type == "webm":
        format_args = ["-f", "bv*[ext=webm]+ba[ext=webm]/b[ext=webm]/bv*+ba/b"]
    elif quality == "best":
        format_args = ["-f", "bv*+ba/b"]
    elif quality == "1080":
        format_args = ["-f", "bv*[height<=?1080]+ba/b[height<=?1080]/b"]
    elif quality == "720":
        format_args = ["-f", "bv*[height<=?720]+ba/b[height<=?720]/b"]
    elif quality == "480":
        format_args = ["-f", "bv*[height<=?480]+ba/b[height<=?480]/b"]
    elif quality == "360":
        format_args = ["-f", "bv*[height<=?360]+ba/b[height<=?360]/b"]
    else:
        format_args = ["-f", "bv*+ba/b"]

    for i, video in enumerate(videos):
        if session.get("cancelled"):
            session["status"] = "cancelled"
            break

        video_url = video.get("url") or f"https://www.youtube.com/watch?v={video.get('id', '')}"
        video_title = video.get("title", f"Video {i+1}")
        video_id = str(video.get("id", i))

        session["current_video"] = video_title
        session["current_index"] = i + 1
        session["current_progress"] = 0
        session["current_speed"] = ""
        session["current_eta"] = ""
        session["current_size"] = ""
        session["videos"][video_id] = {
            "title": video_title,
            "url": video_url,
            "status": "downloading",
            "progress": 0
        }

        recent_output_lines = []

        try:
            cmd = [
                YTDLP,
                "--newline",
                "--progress",
                "--no-warnings",
                "--no-check-certificates",
                "--windows-filenames",
                "--ignore-errors",
                "--no-abort-on-error",
                "-o", os.path.join(download_path, "%(title)s.%(ext)s"),
                "--encoding", "utf-8",
                "--progress-template", "download:[PROGRESS] %(progress._percent_str)s %(progress._speed_str)s ETA:%(progress._eta_str)s SIZE:%(progress._total_bytes_str)s",
            ] + format_args

            if FFMPEG_DIR:
                cmd.extend(["--ffmpeg-location", FFMPEG_DIR])

            # Subtitles (only if not mp3)
            if subtitles and format_type != "mp3":
                cmd.extend([
                    "--write-subs",
                    "--write-auto-subs",
                    "--sub-lang", subtitle_lang,
                    "--sub-format", "srt/best",
                    "--embed-subs"
                ])

            if speed_limit:
                cmd.extend(["-r", speed_limit])

            cmd.append(video_url)

            # Combine stderr into stdout to capture all progress & avoid pipe deadlock
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
            )
            active_processes[session_id] = process

            while True:
                line = process.stdout.readline()
                if not line:
                    if process.poll() is not None:
                        break
                    time.sleep(0.02)
                    continue

                if session.get("cancelled"):
                    try:
                        process.terminate()
                    except Exception:
                        pass
                    break

                line = line.strip()
                recent_output_lines.append(line)
                if len(recent_output_lines) > 25:
                    recent_output_lines.pop(0)

                # Regex 1: Matches custom template: [PROGRESS]   0.0%  501.47KiB/s ETA:07:48 SIZE: 229.20MiB
                progress_match = re.search(
                    r'\[PROGRESS\]\s+([\d.]+)%\s+(\S+)\s+ETA:\s*([^\s]+)\s+SIZE:\s*([^\s]+)',
                    line
                )
                if progress_match:
                    p = float(progress_match.group(1))
                    session["current_progress"] = p
                    session["current_speed"] = progress_match.group(2)
                    session["current_eta"] = progress_match.group(3)
                    session["current_size"] = progress_match.group(4)
                    session["videos"][video_id]["progress"] = p
                    continue

                # Regex 2: Matches standard yt-dlp: [download]  45.2% of  120.00MiB at  3.50MiB/s ETA 00:20
                std_match = re.search(
                    r'\[download\]\s+([\d.]+)%\s+of\s+~?\s*([^\s]+)\s+at\s+([^\s]+)\s+ETA\s+([^\s]+)',
                    line
                )
                if std_match:
                    p = float(std_match.group(1))
                    session["current_progress"] = p
                    session["current_size"] = std_match.group(2)
                    session["current_speed"] = std_match.group(3)
                    session["current_eta"] = std_match.group(4)
                    session["videos"][video_id]["progress"] = p
                    continue

                # Regex 3: Catch any line with percentage
                pct_match = re.search(r'([\d.]+)%', line)
                if pct_match:
                    try:
                        p = float(pct_match.group(1))
                        session["current_progress"] = p
                        session["videos"][video_id]["progress"] = p
                    except Exception:
                        pass

                speed_match = re.search(r'([\d.]+\s*[KMGT]?i?B/s)', line)
                if speed_match:
                    session["current_speed"] = speed_match.group(1)

                eta_match = re.search(r'ETA\s*[:\s]*([0-9:]+)', line)
                if eta_match:
                    session["current_eta"] = eta_match.group(1)

                size_match = re.search(r'(?:of|SIZE:)\s*~?\s*([\d.]+\s*[KMGT]?i?B)', line)
                if size_match:
                    session["current_size"] = size_match.group(1)

                if "[download] 100%" in line:
                    session["current_progress"] = 100
                    session["videos"][video_id]["progress"] = 100

                if "has already been downloaded" in line:
                    session["videos"][video_id]["status"] = "skipped"
                    session["skipped"] += 1
                    session["current_progress"] = 100
                    session["videos"][video_id]["progress"] = 100

                if "[Merger]" in line or "[ExtractAudio]" in line or "[EmbedSubtitle]" in line:
                    session["videos"][video_id]["status"] = "processing"

            process.wait()

            if session.get("cancelled"):
                session["videos"][video_id]["status"] = "cancelled"
                continue

            # Mark as completed if process succeeded OR if download reached 100%
            is_successful = (process.returncode == 0) or (session["videos"][video_id]["progress"] >= 99.0)

            if is_successful:
                if session["videos"][video_id]["status"] != "skipped":
                    session["completed"] += 1
                    session["videos"][video_id]["status"] = "completed"
                session["videos"][video_id]["progress"] = 100
            else:
                session["failed"] += 1
                session["videos"][video_id]["status"] = "failed"
                err_text = "\n".join(recent_output_lines[-5:]) if recent_output_lines else "Download error"
                session["videos"][video_id]["error"] = err_text[:300]
                session["errors"].append(f"{video_title}: {err_text[:200]}")

        except Exception as e:
            session["failed"] += 1
            session["videos"][video_id]["status"] = "failed"
            session["videos"][video_id]["error"] = str(e)
            session["errors"].append(f"{video_title}: {str(e)}")

    active_processes.pop(session_id, None)

    if not session.get("cancelled"):
        session["status"] = "completed"

    session["current_video"] = ""
    session["finished_at"] = datetime.now().isoformat()

    history_entry = {
        "session_id": session_id,
        "playlist_title": session.get("playlist_title", "Unknown"),
        "total": session["total"],
        "completed": session["completed"],
        "failed": session["failed"],
        "skipped": session["skipped"],
        "download_path": download_path,
        "started_at": session.get("started_at"),
        "finished_at": session.get("finished_at"),
        "status": session["status"]
    }
    download_history.append(history_entry)
    save_history()


@app.route("/api/progress-poll/<session_id>", methods=["GET"])
def get_progress_poll(session_id):
    if session_id not in download_sessions:
        return jsonify({"error": "Session not found"}), 404
    return jsonify(download_sessions[session_id])


@app.route("/api/active-session", methods=["GET"])
def get_active_session():
    """Return the currently downloading session if any exists."""
    for s_id, s_data in download_sessions.items():
        if s_data.get("status") in ("downloading", "starting"):
            return jsonify({"active": True, "session_id": s_id, "session": s_data})
    return jsonify({"active": False})


@app.route("/api/cancel/<session_id>", methods=["POST"])
def cancel_download(session_id):
    if session_id in download_sessions:
        download_sessions[session_id]["cancelled"] = True
        download_sessions[session_id]["status"] = "cancelled"
        proc = active_processes.get(session_id)
        if proc:
            try:
                # Force kill process tree on Windows
                if sys.platform == "win32":
                    subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                                   capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW)
                else:
                    proc.terminate()
            except Exception:
                pass
        return jsonify({"status": "cancelled"})
    return jsonify({"error": "Session not found"}), 404


@app.route("/api/retry/<session_id>", methods=["POST"])
def retry_failed(session_id):
    if session_id not in download_sessions:
        return jsonify({"error": "Session not found"}), 404

    session = download_sessions[session_id]
    failed_videos = []
    for vid_id, info in session["videos"].items():
        if info["status"] == "failed":
            failed_videos.append({
                "id": vid_id,
                "title": info["title"],
                "url": info.get("url") or f"https://www.youtube.com/watch?v={vid_id}"
            })

    if not failed_videos:
        return jsonify({"error": "No failed videos to retry"}), 400

    return jsonify({"failed_videos": failed_videos})


@app.route("/api/history", methods=["GET"])
def get_history():
    return jsonify({"history": download_history[-20:]})


@app.route("/api/clear-history", methods=["POST"])
def clear_history():
    global download_history
    download_history = []
    save_history()
    return jsonify({"status": "cleared"})


@app.route("/api/open-folder", methods=["POST"])
def open_folder():
    """Open download folder in Windows File Explorer reliably."""
    data = request.json or {}
    path = clean_path(data.get("path"))
    try:
        os.makedirs(path, exist_ok=True)
        try:
            os.startfile(path)
        except Exception:
            subprocess.Popen(f'explorer.exe "{path}"', shell=True)
        return jsonify({"status": "opened", "path": path})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/browse-folder", methods=["POST"])
def browse_folder():
    """Open native Windows folder picker dialog via PowerShell."""
    try:
        data = request.json or {}
        initial_dir = clean_path(data.get("path"))
        ps_script = os.path.join(os.path.dirname(__file__), "browse_folder.ps1")

        proc = subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps_script, initial_dir],
            capture_output=True,
            text=True,
            timeout=180
        )
        folder = clean_path(proc.stdout.strip())
        if folder and os.path.isdir(folder):
            return jsonify({"path": folder})
        return jsonify({"path": ""})
    except Exception as e:
        return jsonify({"error": str(e), "path": ""}), 200


@app.route("/api/scan-folder", methods=["POST"])
def scan_folder():
    data = request.json or {}
    folder = clean_path(data.get("folder_path"))
    videos = data.get("videos", [])

    try:
        os.makedirs(folder, exist_ok=True)
    except Exception:
        pass

    if not os.path.isdir(folder):
        return jsonify({
            "folder": folder,
            "total_checked": len(videos),
            "found_count": 0,
            "missing_count": len(videos),
            "found_ids": [],
            "missing_ids": [str(v.get("id", "")) for v in videos]
        })

    existing_files = []
    try:
        for entry in os.scandir(folder):
            if entry.is_file():
                try:
                    if entry.stat().st_size > 50 * 1024:
                        base, _ = os.path.splitext(entry.name)
                        existing_files.append({
                            "filename": entry.name,
                            "normalized": normalize_name(base)
                        })
                except Exception:
                    pass
    except Exception as e:
        return jsonify({"error": f"Failed to read folder: {str(e)}"}), 500

    found_ids = []
    missing_ids = []

    for v in videos:
        v_title = v.get("title", "")
        v_id = str(v.get("id", ""))
        norm_title = normalize_name(v_title)

        matched = False
        for f in existing_files:
            if v_id and len(v_id) > 4 and v_id in f["filename"]:
                matched = True
                break
            if norm_title and (norm_title == f["normalized"] or
                               (len(norm_title) >= 6 and (norm_title in f["normalized"] or f["normalized"] in norm_title))):
                matched = True
                break

        if matched:
            found_ids.append(v_id)
        else:
            missing_ids.append(v_id)

    return jsonify({
        "folder": folder,
        "total_checked": len(videos),
        "found_count": len(found_ids),
        "missing_count": len(missing_ids),
        "found_ids": found_ids,
        "missing_ids": missing_ids
    })


if __name__ == "__main__":
    os.makedirs(DEFAULT_DOWNLOAD_PATH, exist_ok=True)
    print("=" * 55)
    print("  [YT-DLP Playlist Downloader Server]")
    print(f"  yt-dlp:     {YTDLP}")
    print(f"  ffmpeg:     {FFMPEG_DIR or 'System PATH'}")
    print(f"  Downloads:  {DEFAULT_DOWNLOAD_PATH}")
    print(f"  Server:     http://127.0.0.1:5000")
    print("=" * 55)
    app.run(host="127.0.0.1", port=5000, debug=False, threaded=True)
