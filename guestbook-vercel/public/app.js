/* =====================================================================
   CONFIG: defaults. Override in config.js, or with Vercel environment
   variables (see README). Do not edit the defaults here.
   ===================================================================== */
const CONFIG = Object.assign({
  contractAddress: "",
  chainId: 11155111,                         // Sepolia
  chainName: "Sepolia",
  rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",   // read-only access, no wallet needed
  explorer: "https://sepolia.etherscan.io",
  faucetNote: "Ask the booth host for test ETH, or use any Sepolia faucet.",
  maxName: 32,
  maxMessage: 200,
  pageSize: 50,
  pollMs: 10000
}, window.GUESTBOOK_CONFIG || {});
CONFIG.chainId = Number(CONFIG.chainId);

const ABI = [
  "function sign(string name, string message)",
  "function count() view returns (uint256)",
  "function getLatest(uint256 n) view returns (tuple(address signer, string name, string message, uint64 timestamp, uint64 blockNumber)[])"
];

/* ---------- helpers ---------- */
const $ = (id) => document.getElementById(id);
const enc = new TextEncoder();
const byteLen = (s) => enc.encode(s).length;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const short = (a) => a.slice(0, 6) + "…" + a.slice(-4);

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function ago(ts) {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " h ago";
  return Math.floor(s / 86400) + " d ago";
}
function resolveAddress() {
  const fromUrl = new URLSearchParams(location.search).get("contract");
  for (const c of [fromUrl, CONFIG.contractAddress]) {
    if (c && ethers.isAddress(c)) return ethers.getAddress(c);
  }
  return "";
}

/* ---------- state ---------- */
let address = "";
let reader = null;          // read-only contract, uses public RPC
let signer = null;          // set after the wallet connects
let account = null;
let lastTotal = 0;
let firstLoad = true;
const seen = new Set();

/* ---------- UI: messages ---------- */
function setStatus(text, bad, node) {
  const s = $("status");
  s.className = "status" + (bad ? " bad" : "");
  s.textContent = text || "";
  if (node) s.appendChild(node);
}
function setChainNote(text, bad) {
  const n = $("chainNote");
  n.hidden = !text;
  n.className = "chain-note" + (bad ? " bad" : "");
  n.textContent = text || "";
}

/* ---------- UI: form ---------- */
function updateCounter() {
  const n = byteLen($("msgEl").value.trim());
  const c = $("counter");
  c.textContent = n + " / " + CONFIG.maxMessage;
  c.classList.toggle("over", n > CONFIG.maxMessage);
}
function updateWallet() {
  $("goBtn").textContent = signer ? "Sign the guestbook" : "Connect wallet to sign";
  $("walletLine").textContent = signer && account
    ? "Connected as " + short(account) + " on " + CONFIG.chainName + "."
    : "No wallet connected. You can read the wall without one.";
}
function validate(name, msg) {
  if (!name) return "Add your name first.";
  if (byteLen(name) > CONFIG.maxName) return "Your name is too long. Keep it under " + CONFIG.maxName + " bytes.";
  if (!msg) return "Write a message first.";
  if (byteLen(msg) > CONFIG.maxMessage) return "Your message is too long. Keep it under " + CONFIG.maxMessage + " bytes.";
  return "";
}

/* ---------- UI: pending block ---------- */
function showPending(step, extra) {
  const p = $("pending");
  p.hidden = false;
  $("pendingIdx").textContent = String(lastTotal + 1);
  const items = $("pendingSteps").children;
  for (let i = 0; i < items.length; i++) {
    items[i].className = i + 1 < step ? "done" : i + 1 === step ? "now" : "";
  }
  const link = $("txLink");
  link.textContent = "";
  if (step === 2 && extra) {
    const a = el("a", null, "View transaction");
    a.href = CONFIG.explorer + "/tx/" + extra;
    a.target = "_blank"; a.rel = "noopener";
    link.appendChild(a);
  }
  if (step === 3) {
    items[2].textContent = "Sealed into block " + Number(extra).toLocaleString();
    items[2].className = "done";
  } else {
    items[2].textContent = "Sealed into a block";
  }
}
function hidePending() { $("pending").hidden = true; }

/* ---------- render the wall ---------- */
function render(total, list) {
  lastTotal = total;
  const shown = list.length;
  $("tally").textContent = total === 0
    ? "No signatures yet"
    : total.toLocaleString() + (total === 1 ? " signature" : " signatures") +
      (shown < total ? ", showing the latest " + shown : ", newest first");

  const chain = $("chain");
  chain.querySelectorAll("li.entry[data-id]").forEach((n) => n.remove());
  $("empty").hidden = total !== 0;

  list.forEach((e, i) => {
    const id = total - i;
    const row = el("li", "entry");
    row.dataset.id = String(id);
    if (!firstLoad && !seen.has(id)) row.classList.add("fresh");
    seen.add(id);

    row.appendChild(el("span", "idx", String(id)));
    row.appendChild(el("span", "knot"));

    const body = el("div", "body");
    body.appendChild(el("p", "msg", e.message));

    const meta = el("p", "meta");
    meta.appendChild(el("span", "who", e.name));
    const a = el("a", "addr", short(e.signer));
    a.href = CONFIG.explorer + "/address/" + e.signer;
    a.target = "_blank"; a.rel = "noopener";
    a.title = e.signer;
    meta.appendChild(a);
    meta.appendChild(el("span", null, "block " + e.block.toLocaleString()));
    const t = el("time", null, ago(e.timestamp));
    t.title = new Date(e.timestamp * 1000).toLocaleString();
    meta.appendChild(t);
    body.appendChild(meta);

    row.appendChild(body);
    chain.appendChild(row);
  });
  firstLoad = false;
}

async function refresh() {
  if (!reader) return;
  try {
    const [total, latest] = await Promise.all([reader.count(), reader.getLatest(CONFIG.pageSize)]);
    const list = Array.from(latest, (e) => ({
      signer: e[0], name: e[1], message: e[2],
      timestamp: Number(e[3]), block: Number(e[4])
    }));
    render(Number(total), list);
    setChainNote("");
  } catch (err) {
    console.error(err);
    setChainNote("Can't reach the network right now. Retrying automatically.", true);
  }
}

/* ---------- wallet ---------- */
async function ensureChain() {
  const hex = "0x" + CONFIG.chainId.toString(16);
  const current = await window.ethereum.request({ method: "eth_chainId" });
  if (String(current).toLowerCase() === hex) return;
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
  } catch (e) {
    if (e && e.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: hex, chainName: CONFIG.chainName, rpcUrls: [CONFIG.rpcUrl],
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          blockExplorerUrls: [CONFIG.explorer]
        }]
      });
    } else { throw e; }
  }
}
async function connect() {
  if (!window.ethereum) { const e = new Error("no wallet"); e.code = "NO_WALLET"; throw e; }
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  await ensureChain();
  const provider = new ethers.BrowserProvider(window.ethereum);
  signer = await provider.getSigner();
  account = accounts[0];
  updateWallet();
}
function walletMissing() {
  const s = $("status");
  s.className = "status bad";
  s.textContent = "No wallet found in this browser. ";
  if (location.protocol.startsWith("http")) {
    const a = el("a", null, "Open this page inside MetaMask");
    a.href = "https://metamask.app.link/dapp/" + location.host + location.pathname + location.search;
    s.appendChild(a);
    s.appendChild(document.createTextNode(", or ask the booth host to sign for you."));
  } else {
    s.appendChild(document.createTextNode("Install a wallet such as MetaMask, or ask the booth host to sign for you."));
  }
}
function explain(e) {
  const code = e && e.code;
  const text = String((e && (e.shortMessage || e.message)) || "").toLowerCase();
  if (code === "ACTION_REJECTED" || code === 4001) return "You cancelled in your wallet. Nothing was sent.";
  if (code === "INSUFFICIENT_FUNDS" || text.includes("insufficient funds"))
    return "This wallet has no test ETH to pay the network fee. " + CONFIG.faucetNote;
  return "Something went wrong: " + ((e && (e.shortMessage || e.message)) || "unknown error");
}

/* ---------- signing ---------- */
async function onGo() {
  const btn = $("goBtn");
  const name = $("nameEl").value.trim();
  const msg = $("msgEl").value.trim();
  setStatus("");
  btn.disabled = true;
  try {
    if (!signer) {
      await connect();
      if (!name && !msg) { setStatus("Wallet connected. Now write your message and sign."); return; }
    }
    const problem = validate(name, msg);
    if (problem) { setStatus(problem, true); return; }

    // The user may have switched networks since connecting.
    await ensureChain();

    const contract = new ethers.Contract(address, ABI, signer);
    const before = lastTotal;
    showPending(1);
    const tx = await contract.sign(name, msg);
    showPending(2, tx.hash);
    const receipt = await tx.wait();
    showPending(3, receipt.blockNumber);

    $("msgEl").value = "";
    updateCounter();
    setStatus("Done. Your line is on the chain permanently.");

    // The public RPC can lag a block or two behind the wallet's node.
    for (let i = 0; i < 8; i++) {
      await refresh();
      if (lastTotal > before) break;
      await sleep(2000);
    }
    await sleep(600);
    hidePending();
  } catch (e) {
    hidePending();
    if (e && e.code === "NO_WALLET") walletMissing();
    else setStatus(explain(e), true);
  } finally {
    btn.disabled = false;
    updateWallet();
  }
}

/* ---------- boot ---------- */
function boot() {
  if (typeof ethers === "undefined") {
    $("tally").textContent = "";
    setChainNote("Couldn't load the blockchain library. Check the internet connection and reload.", true);
    return;
  }

  address = resolveAddress();
  $("uhNetwork").textContent = CONFIG.chainName + " test network";

  if (!address) {
    $("setup").hidden = false;
    $("tally").textContent = "Waiting for a contract address";
    $("addrSave").addEventListener("click", () => {
      const v = $("addrInput").value.trim();
      if (!ethers.isAddress(v)) { $("addrErr").textContent = "That doesn't look like a contract address. It starts with 0x and has 42 characters."; return; }
      location.href = location.pathname + "?contract=" + ethers.getAddress(v);
    });
    return;
  }

  // Show the address in "Under the hood"
  const dd = $("uhAddress");
  dd.textContent = "";
  const a = el("a", "mono", address);
  a.href = CONFIG.explorer + "/address/" + address;
  a.target = "_blank"; a.rel = "noopener";
  dd.appendChild(a);

  $("note").hidden = false;
  $("msgEl").addEventListener("input", updateCounter);
  $("goBtn").addEventListener("click", onGo);
  updateCounter();
  updateWallet();

  const provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl, CONFIG.chainId, {
    staticNetwork: ethers.Network.from(CONFIG.chainId)
  });
  reader = new ethers.Contract(address, ABI, provider);

  if (window.ethereum && window.ethereum.on) {
    window.ethereum.on("chainChanged", () => { signer = null; account = null; updateWallet(); });
    window.ethereum.on("accountsChanged", (accs) => {
      if (!accs || !accs.length) { signer = null; account = null; }
      else if (signer) { account = accs[0]; connect().catch(() => { signer = null; account = null; updateWallet(); }); }
      updateWallet();
    });
  }

  refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, CONFIG.pollMs);
}
boot();
