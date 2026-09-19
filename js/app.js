// Handles the converter interface

const FORMAT_GROUPS = [
  {
    label: "Documents",
    formats: ["docx", "odt", "pdf", "rtf", "icml", "epub", "epub2", "epub3", "fb2", "opendocument"],
  },
  {
    label: "Markdown",
    formats: ["markdown", "markdown_github", "markdown_mmd", "markdown_phpextra", "markdown_strict", "markua", "commonmark", "commonmark_x", "gfm", "djot"],
  },
  {
    label: "Web",
    formats: ["html", "html4", "html5", "chunkedhtml", "revealjs", "docbook", "docbook4", "docbook5", "jats", "jats_archiving", "jats_articleauthoring", "jats_publishing", "tei", "xml"],
  },
  {
    label: "Slides",
    formats: ["dzslides", "s5", "slideous", "slidy", "beamer", "pptx"],
  },
  {
    label: "Text",
    formats: ["plain", "ansi", "asciidoc", "asciidoc_legacy", "asciidoctor", "bbcode", "bbcode_fluxbb", "bbcode_hubzilla", "bbcode_phpbb", "bbcode_steam", "bbcode_xenforo", "dokuwiki", "jira", "man", "mediawiki", "ms", "muse", "opml", "org", "rst", "textile", "vimdoc", "xwiki", "zimwiki"],
  },
  {
    label: "Code & data",
    formats: ["json", "csljson", "native", "ipynb", "bibtex", "biblatex"],
  },
  {
    label: "Typesetting",
    formats: ["latex", "context", "typst", "haddock", "texinfo"],
  },
];

const DEFAULT_DIR = "/sdcard/Download";
const STORAGE_KEY = "dc-theme";

const SUPPORTED_EXTENSIONS = [
  ".md", ".markdown", ".txt", ".text",
  ".html", ".htm", ".xhtml",
  ".docx", ".odt", ".epub", ".fb2", ".rtf",
  ".org", ".rst",
  ".tex", ".latex", ".ltx",
  ".json", ".csv", ".tsv", ".xlsx", ".pptx",
  ".xml", ".dbk", ".tei",
  ".ipynb", ".opml", ".bib",
  ".typ", ".typst",
  ".wiki", ".mediawiki", ".muse", ".man", ".pod", ".ms", ".native",
];

const ICONS = {
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  spinner: '<svg class="ico-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="60 200"><circle cx="12" cy="12" r="9"/></svg>',
};

const els = {
  themeToggle: document.getElementById("theme-toggle"),
  dropzone: document.getElementById("dropzone"),
  fileInput: document.getElementById("file-input"),
  fileSection: document.getElementById("file-section"),
  fileCount: document.getElementById("file-count"),
  fileList: document.getElementById("file-list"),
  clearFiles: document.getElementById("clear-files"),
  formatSelect: document.getElementById("format-select"),
  dirInput: document.getElementById("output-dir"),
  dirReset: document.getElementById("dir-reset"),
  form: document.getElementById("convert-form"),
  convertButton: document.getElementById("convert-button"),
  spinner: document.querySelector("#convert-button .spinner"),
  resultsCard: document.getElementById("results-card"),
  summary: document.getElementById("summary"),
  statusList: document.getElementById("status-list"),
  unsupportedNote: document.getElementById("unsupported-note"),
};

let files = [];

function systemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

function initTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch (e) {}
  applyTheme(saved === "light" || saved === "dark" ? saved : systemTheme());
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch (e) {}
}

function humanSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + " MB";
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + " GB";
}

function isSupported(name) {
  const dot = name.lastIndexOf(".");
  const ext = dot > -1 ? name.slice(dot).toLowerCase() : "";
  return SUPPORTED_EXTENSIONS.indexOf(ext) > -1;
}

function addFiles(list) {
  let skipped = 0;
  for (const file of list) {
    if (!isSupported(file.name)) {
      skipped++;
      continue;
    }
    const exists = files.some((f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified);
    if (!exists) files.push(file);
  }
  els.unsupportedNote.hidden = skipped === 0;
  els.unsupportedNote.textContent = skipped + " unsupported file" + (skipped === 1 ? "" : "s") + " ignored";
  renderFiles();
}

function renderFiles() {
  els.fileSection.hidden = files.length === 0;
  els.fileCount.textContent = files.length + (files.length === 1 ? " file" : " files");
  els.convertButton.disabled = files.length === 0;
  els.fileList.innerHTML = "";
  files.forEach((file, index) => {
    const li = document.createElement("li");
    li.className = "file-item";
    li.innerHTML = ICONS.file +
      '<div class="file-meta"><span class="file-name"></span><span class="file-size"></span></div>' +
      '<button class="remove-btn" type="button" aria-label="Remove"></button>';
    li.querySelector(".file-name").textContent = file.name;
    li.querySelector(".file-size").textContent = humanSize(file.size);
    li.querySelector(".remove-btn").innerHTML = ICONS.x;
    li.querySelector(".remove-btn").addEventListener("click", () => removeFile(index));
    els.fileList.appendChild(li);
  });
}

function removeFile(index) {
  files.splice(index, 1);
  renderFiles();
}

function buildFormatSelect() {
  FORMAT_GROUPS.forEach((group) => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = group.label;
    group.formats.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      optgroup.appendChild(option);
    });
    els.formatSelect.appendChild(optgroup);
  });
}

async function convertFile(file, format, dir) {
  const response = await fetch("/api/convert", {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Filename": encodeURIComponent(file.name),
      "X-Format": format,
      "X-Output-Dir": dir,
    },
    body: file,
  });
  return response.json();
}

function addStatusRow(file, format) {
  const li = document.createElement("li");
  li.className = "status-item processing";
  li.innerHTML = '<span class="state">' + ICONS.spinner + "</span>" +
    '<div class="status-info"><span class="status-title"></span><span class="status-detail"></span></div>';
  li.querySelector(".status-title").textContent = file.name + " \u2192 " + format;
  li.querySelector(".status-detail").textContent = "Converting\u2026";
  els.statusList.appendChild(li);
  return li;
}

function setStatus(li, state, detail) {
  li.className = "status-item " + state;
  const icon = state === "done" ? ICONS.check : state === "failed" ? ICONS.x : ICONS.spinner;
  li.querySelector(".state").innerHTML = icon;
  if (detail) li.querySelector(".status-detail").textContent = detail;
}

function setBusy(busy) {
  els.spinner.hidden = !busy;
  els.convertButton.disabled = busy || files.length === 0;
}

async function runConversion() {
  const format = els.formatSelect.value;
  const dir = els.dirInput.value.trim() || DEFAULT_DIR;
  const targets = files.slice();
  let done = 0;
  let failed = 0;

  els.resultsCard.hidden = false;
  els.statusList.innerHTML = "";
  els.summary.textContent = "Converting " + targets.length + " file" + (targets.length === 1 ? "" : "s") + " to " + format;
  setBusy(true);

  for (const file of targets) {
    const row = addStatusRow(file, format);
    try {
      const result = await convertFile(file, format, dir);
      if (result.ok) {
        done++;
        setStatus(row, "done", "Saved to\n" + result.output);
      } else {
        failed++;
        setStatus(row, "failed", result.error || "Conversion failed");
      }
    } catch (err) {
      failed++;
      setStatus(row, "failed", "Connection error");
    }
    els.summary.textContent = done + " of " + targets.length + " converted" + (failed ? " \u00b7 " + failed + " failed" : " \u00b7 all done");
  }
  setBusy(false);
}

initTheme();
buildFormatSelect();
els.themeToggle.addEventListener("click", toggleTheme);
els.dirReset.addEventListener("click", () => {
  els.dirInput.value = DEFAULT_DIR;
});
els.dropzone.addEventListener("click", () => els.fileInput.click());
els.dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    els.fileInput.click();
  }
});
els.fileInput.addEventListener("change", () => {
  addFiles(els.fileInput.files);
  els.fileInput.value = "";
});
["dragenter", "dragover"].forEach((name) => {
  els.dropzone.addEventListener(name, (e) => {
    e.preventDefault();
    els.dropzone.classList.add("drag");
  });
});
["dragleave", "drop"].forEach((name) => {
  els.dropzone.addEventListener(name, (e) => {
    e.preventDefault();
    els.dropzone.classList.remove("drag");
  });
});
els.dropzone.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));
els.clearFiles.addEventListener("click", () => {
  files = [];
  els.unsupportedNote.hidden = true;
  renderFiles();
});
els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (files.length && !els.convertButton.disabled) runConversion();
});