// Serves the app and converts documents with Pandoc

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const TMPDIR = os.tmpdir();
const DEFAULT_DIR = "/sdcard/Download";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

const OUTPUT_EXTS = {
  ansi: "txt", asciidoc: "adoc", asciidoc_legacy: "adoc", asciidoctor: "adoc",
  bbcode: "txt", bbcode_fluxbb: "txt", bbcode_hubzilla: "txt",
  bbcode_phpbb: "txt", bbcode_steam: "txt", bbcode_xenforo: "txt",
  beamer: "tex", biblatex: "bib", bibtex: "bib", chunkedhtml: "html",
  commonmark: "md", commonmark_x: "md", context: "tex", csljson: "json",
  djot: "djot", docbook: "xml", docbook4: "xml", docbook5: "xml",
  docx: "docx", dokuwiki: "txt", dzslides: "html", epub: "epub",
  epub2: "epub", epub3: "epub", fb2: "fb2", gfm: "md",
  haddock: "hs", html: "html", html4: "html", html5: "html",
  icml: "icml", ipynb: "ipynb", jats: "xml", jats_archiving: "xml",
  jats_articleauthoring: "xml", jats_publishing: "xml", jira: "txt",
  json: "json", latex: "tex", man: "man", markdown: "md",
  markdown_github: "md", markdown_mmd: "md", markdown_phpextra: "md",
  markdown_strict: "md", markua: "md", mediawiki: "txt", ms: "ms",
  muse: "muse", native: "native", odt: "odt", opendocument: "fodt",
  opml: "opml", org: "org", pdf: "pdf", plain: "txt", pptx: "pptx",
  revealjs: "html", rst: "rst", rtf: "rtf", s5: "html", slideous: "html",
  slidy: "html", tei: "xml", texinfo: "texi", textile: "textile",
  typst: "typ", vimdoc: "txt", xml: "xml", xwiki: "txt", zimwiki: "txt",
};

const INPUT_EXTS = {
  ".md": "markdown", ".markdown": "markdown", ".txt": "markdown",
  ".html": "html", ".htm": "html", ".docx": "docx", ".odt": "odt",
  ".epub": "epub", ".fb2": "fb2", ".rtf": "rtf", ".org": "org",
  ".rst": "rst", ".tex": "latex", ".latex": "latex",
  ".json": "json", ".csv": "csv", ".tsv": "tsv", ".xlsx": "xlsx",
  ".pptx": "pptx", ".xml": "docbook", ".typ": "typst", ".typst": "typst",
  ".ipynb": "ipynb", ".opml": "opml", ".bib": "bibtex",
};

const STATIC_FILES = {
  "/": "index.html",
  "/index.html": "index.html",
  "/css/style.css": "css/style.css",
  "/js/app.js": "js/app.js",
};

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function sendFile(res, file) {
  fs.readFile(path.join(ROOT, file), (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}

function inputFormatFor(filename) {
  return INPUT_EXTS[path.extname(filename).toLowerCase()] || null;
}

function safeDir(raw) {
  const fixed = String(raw || "").trim().replace(/^~(?=\/)/, os.homedir());
  if (!fixed) return DEFAULT_DIR;
  const cleaned = fixed.length > 1 && fixed.endsWith("/") ? fixed.replace(/\/+$/, "") : fixed;
  return path.resolve(cleaned);
}

function runPandoc(input, from, to, output, cb) {
  const args = [];
  if (from) args.push("-f", from);
  args.push("-t", to, "-s", input, "-o", output);
  execFile("pandoc", args, { timeout: 300000 }, (err, stdout, stderr) => {
    cb(err, stderr || (err ? String(err.message) : ""));
  });
}

function handleConvert(req, res) {
  let rawName = "input";
  try {
    rawName = decodeURIComponent(String(req.headers["x-filename"] || "input"));
  } catch (e) {
    rawName = "input";
  }
  const filename = path.basename(rawName) || "input";
  const format = String(req.headers["x-format"] || "").trim();
  const outDir = safeDir(req.headers["x-output-dir"]);
  if (!OUTPUT_EXTS[format]) {
    sendJson(res, 400, { ok: false, error: "Unsupported output format." });
    return;
  }

  const chunks = [];
  let received = 0;
  const limit = 300 * 1024 * 1024;
  req.on("data", (chunk) => {
    received += chunk.length;
    if (received > limit) {
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on("error", () => sendJson(res, 500, { ok: false, error: "Upload failed." }));
  req.on("end", () => {
    const token = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    const outExt = OUTPUT_EXTS[format];
    const tmpIn = path.join(TMPDIR, token + ext);
    const tmpOut = path.join(TMPDIR, token + "." + outExt);
    const outFile = path.join(outDir, base + "." + outExt);

    fs.writeFile(tmpIn, Buffer.concat(chunks), (err) => {
      if (err) {
        sendJson(res, 500, { ok: false, error: "Could not save the upload." });
        return;
      }
      runPandoc(tmpIn, inputFormatFor(filename), format, tmpOut, (pErr, pMsg) => {
        fs.unlink(tmpIn, () => {});
        if (pErr) {
          fs.unlink(tmpOut, () => {});
          sendJson(res, 422, { ok: false, error: pMsg || "Conversion failed." });
          return;
        }
        fs.mkdir(outDir, { recursive: true }, (mkErr) => {
          if (mkErr) {
            fs.unlink(tmpOut, () => {});
            sendJson(res, 422, { ok: false, error: "Could not create the output directory." });
            return;
          }
          fs.copyFile(tmpOut, outFile, (cpErr) => {
            fs.unlink(tmpOut, () => {});
            if (cpErr) {
              sendJson(res, 422, { ok: false, error: "Could not write the output file." });
              return;
            }
            sendJson(res, 200, { ok: true, output: outFile });
          });
        });
      });
    });
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/convert") {
    handleConvert(req, res);
    return;
  }
  if (req.method !== "GET") {
    res.writeHead(405);
    res.end();
    return;
  }
  const urlPath = new URL(req.url, "http://localhost").pathname;
  if (urlPath === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }
  const file = STATIC_FILES[urlPath];
  if (!file) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  sendFile(res, file);
});

server.listen(PORT, () => {
  console.log("Documents Converter running at http://localhost:" + PORT);
});

execFile("pandoc", ["--version"], (err) => {
  if (err) {
    console.warn("Warning: Pandoc not found. Install Pandoc to enable conversions.");
  } else {
    console.log("Pandoc detected");
  }
});