import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFile, access, mkdtemp, rm } from "node:fs/promises";
import { once } from "node:events";
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";

test(
  "synthetic Chromium DOM: bounded text excludes offscreen/clipped/hidden/sensitive descendants; metadata stays separate; stale and duplicate input guarded",
  { timeout: 45000 },
  async (t) => {
    const chrome =
      process.env.SWU_TEST_CHROME ??
      "C:/Program Files/Google/Chrome/Application/chrome.exe";
    try {
      await access(chrome);
    } catch {
      t.skip("Installed Chromium executable unavailable; set SWU_TEST_CHROME");
      return;
    }
    const source = await readFile(
      new URL("../extension/page.js", import.meta.url),
      "utf8",
    );
    const readingSource = await readFile(
      new URL("../src/reading.js", import.meta.url),
      "utf8",
    );
    const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0}article{position:absolute;left:10px;top:10px;width:250px;height:2000px}#off{position:absolute;top:1500px}#hidden{display:none}#clip{position:absolute;left:280px;top:10px;width:150px;height:24px;overflow:hidden}#below{position:absolute;top:80px}#search{position:absolute;left:450px;top:100px}</style><article id="article" aria-label="ACCESSIBILITY_ONLY">VISIBLE_WORD<span id="off">OFFSCREEN_WORD</span><span id="hidden">HIDDEN_WORD</span><span id="secret">SENSITIVE_WORD</span></article><div id="clip">CLIPPED_VISIBLE<span id="below">CLIPPED_OUT</span></div><input id="search" aria-label="Search"><input type="password" value="PASSWORD_VALUE"><pre id="result"></pre><script type="module">
  import {pageCommand} from '/page.js';
  import {composeText} from '/reading.js';
  const assert=(v,m)=>{if(!v)throw Error(m);};
  try {
    const ctx={tabId:1,session:'test-session',deadline:Date.now()+30000};
    const card=document.createElement('a');card.id='card';card.href='https://example.com/one';card.style='position:absolute;left:450px;top:160px';const title=document.createElement('span');title.textContent='OBSERVED_TITLE';card.append(title);document.body.append(card);
    const o=pageCommand('observe',{selectors:['#article','#search']},ctx),text=o.nodes.map(n=>n.text).join(' ');
    const link=o.nodes.find(n=>n.locator?.selector==='#card');assert(link.text===''&&composeText(o,link).text==='OBSERVED_TITLE','bounded descendant link composition failed');
    assert(text.includes('VISIBLE_WORD'),'visible missing');
    for(const word of ['OFFSCREEN_WORD','HIDDEN_WORD','SENSITIVE_WORD','CLIPPED_OUT','PASSWORD_VALUE','ACCESSIBILITY_ONLY'])assert(!text.includes(word),'leaked '+word);
    assert(o.nodes.find(n=>n.locator?.selector==='#article').label==='ACCESSIBILITY_ONLY','metadata missing');
    assert(o.nodes.every(n=>n.textEvidence.pixels==='unverified'),'pixel claim');
    const n=o.nodes.find(n=>n.locator?.selector==='#search');
    const a={operationId:'fill-1',target:n.ref,kind:'fill',text:'SWU',expectedValue:'',intent:'edit-field'};
    const receipt=pageCommand('act',{action:a,before:o,target:n},ctx);assert(receipt.delivery==='synthetic-dispatched','fill withheld '+receipt.reason);
    assert(document.getElementById('search').value==='SWU','fill missing');
    assert(pageCommand('act',{action:a,before:o,target:n},ctx).delivery==='not-sent','duplicate delivered');
    const fresh=pageCommand('observe',{selectors:[]},ctx),target=fresh.nodes.find(n=>n.locator?.selector==='#search');
    assert(fresh.nodes.find(n=>n.locator?.selector==='#card').ref===link.ref,'same-document element ref not stable');
    document.getElementById('search').setAttribute('data-changed','yes');
    assert(pageCommand('act',{action:{...a,operationId:'stale',target:target.ref,expectedValue:'SWU'},before:fresh,target},ctx).delivery==='not-sent','mutation delivered');
    const field=document.getElementById('search');field.blur();field.addEventListener('focus',()=>{field.value='site-change';},{once:true});
    const next=pageCommand('observe',{selectors:[]},ctx),nextTarget=next.nodes.find(n=>n.locator?.selector==='#search');
    const changed=pageCommand('act',{action:{...a,operationId:'focus-change',target:nextTarget.ref,expectedValue:'SWU',text:'DO_NOT_OVERWRITE'},before:next,target:nextTarget},ctx);
    assert(changed.delivery==='unknown'&&field.value==='site-change','focus-handler value overwritten');
    document.getElementById('result').textContent='PASS_SYNTHETIC_DOM';
  } catch(e) {document.getElementById('result').textContent='FAIL: '+e.message;}
  </script>`;
    const server = http.createServer((req, res) => {
      res.setHeader(
        "content-type",
        ["/page.js", "/reading.js"].includes(req.url)
          ? "text/javascript"
          : "text/html",
      );
      res.end(
        req.url === "/page.js"
          ? source
          : req.url === "/reading.js"
            ? readingSource
            : html,
      );
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    t.after(() => new Promise((r) => server.close(r)));
    const profile = await mkdtemp(
      path.join(os.tmpdir(), "swu-chromium-selfcheck-"),
    );
    t.after(() =>
      rm(profile, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 100,
      }),
    );
    const child = spawn(
      chrome,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        `--user-data-dir=${profile}`,
        "--window-size=800,600",
        "--virtual-time-budget=5000",
        "--dump-dom",
        `http://127.0.0.1:${server.address().port}/`,
      ],
      { windowsHide: true },
    );
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.resume();
    const timer = setTimeout(() => child.kill(), 30000);
    const [code] = await once(child, "exit");
    clearTimeout(timer);
    assert.equal(code, 0);
    assert.match(output, /<pre id="result">PASS_SYNTHETIC_DOM<\/pre>/);
  },
);
