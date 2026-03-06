import { useState, useEffect } from "react";
import { Download, FilePlus, Trash2, ArrowUp, ArrowDown, Edit, Save, X, Star, Palette, LogIn, LogOut, Lock } from "lucide-react";
import { jsPDF } from "jspdf";

import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, setDoc, getDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAvTBQfaLRi-PumdUR_-YLcO8ws5knQWyw",
  authDomain: "publication-data-33a4a.firebaseapp.com",
  projectId: "publication-data-33a4a",
  storageBucket: "publication-data-33a4a.firebasestorage.app",
  messagingSenderId: "211832161346",
  appId: "1:211832161346:web:0e69405e7b316b07c399db"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const EMPTY_PUB = { authors: "", title: "", journal: "", volume: "", pageNumbers: "", month: "", year: "", doi: "" };

// ── PDF Background Color Options ──────────────────────────
const BG_COLOR_OPTIONS = [
  { label: "Parchment", value: "#FCF8E3", rgb: [252, 248, 227] },
  { label: "White", value: "#FFFFFF", rgb: [255, 255, 255] },
  { label: "Ivory", value: "#FFFFF0", rgb: [255, 255, 240] },
  { label: "Light Blue", value: "#EFF6FF", rgb: [239, 246, 255] },
  { label: "Mint", value: "#F0FDF4", rgb: [240, 253, 244] },
  { label: "Lavender", value: "#F5F3FF", rgb: [245, 243, 255] },
  { label: "Rose", value: "#FFF1F2", rgb: [255, 241, 242] },
  { label: "Warm Gray", value: "#F9FAFB", rgb: [249, 250, 251] },
];

// ── LaTeX → Unicode converter ──────────────────────────────
const SUPERSCRIPT_MAP = {
  '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹',
  'a':'ᵃ','b':'ᵇ','c':'ᶜ','d':'ᵈ','e':'ᵉ','f':'ᶠ','g':'ᵍ','h':'ʰ','i':'ⁱ','j':'ʲ',
  'k':'ᵏ','l':'ˡ','m':'ᵐ','o':'ᵒ','p':'ᵖ','r':'ʳ','s':'ˢ','t':'ᵗ','u':'ᵘ',
  'v':'ᵛ','w':'ʷ','x':'ˣ','y':'ʸ','z':'ᶻ',
  'A':'ᴬ','B':'ᴮ','D':'ᴰ','E':'ᴱ','G':'ᴳ','H':'ᴴ','I':'ᴵ','J':'ᴶ','K':'ᴷ','L':'ᴸ',
  'M':'ᴹ','N':'ᴺ','O':'ᴼ','P':'ᴾ','R':'ᴿ','T':'ᵀ','U':'ᵁ','V':'ⱽ','W':'ᵂ',
  '+':'⁺','-':'⁻','=':'⁼','(':'⁽',')':'⁾','*':'*','n':'ⁿ',
};
const SUBSCRIPT_MAP = {
  '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉',
  'a':'ₐ','e':'ₑ','i':'ᵢ','j':'ⱼ','o':'ₒ','r':'ᵣ','u':'ᵤ','v':'ᵥ','x':'ₓ',
  '+':'₊','-':'₋','=':'₌','(':'₍',')':'₎',
};
const GREEK_MAP = {
  'alpha':'α','beta':'β','gamma':'γ','delta':'δ','epsilon':'ε','zeta':'ζ','eta':'η',
  'theta':'θ','iota':'ι','kappa':'κ','lambda':'λ','mu':'μ','nu':'ν','xi':'ξ',
  'pi':'π','rho':'ρ','sigma':'σ','tau':'τ','upsilon':'υ','phi':'φ','chi':'χ',
  'psi':'ψ','omega':'ω',
  'Alpha':'Α','Beta':'Β','Gamma':'Γ','Delta':'Δ','Epsilon':'Ε','Theta':'Θ',
  'Lambda':'Λ','Mu':'Μ','Pi':'Π','Sigma':'Σ','Phi':'Φ','Psi':'Ψ','Omega':'Ω',
};
const SYMBOL_MAP = {
  'infty':'∞','infinity':'∞','leq':'≤','geq':'≥','neq':'≠','approx':'≈',
  'times':'×','cdot':'·','ldots':'…','cdots':'⋯','forall':'∀','exists':'∃',
  'in':'∈','notin':'∉','subset':'⊂','subseteq':'⊆','cup':'∪','cap':'∩',
  'rightarrow':'→','leftarrow':'←','leftrightarrow':'↔',
  'Rightarrow':'⇒','Leftarrow':'⇐','Leftrightarrow':'⇔',
  'partial':'∂','nabla':'∇','int':'∫','sum':'∑','prod':'∏','sqrt':'√',
  'pm':'±','mp':'∓','div':'÷','circ':'∘','emptyset':'∅','ell':'ℓ',
};

function toScript(str, map) {
  return str.split('').map(c => map[c] || c).join('');
}

function latexToUnicode(text) {
  if (!text) return text;
  let result = text.replace(/\$([^$]+)\$/g, (_, inner) => convertLatexInner(inner));
  result = result.replace(/\\([a-zA-Z]+)/g, (_, cmd) =>
    GREEK_MAP[cmd] || SYMBOL_MAP[cmd] || `\\${cmd}`
  );
  return result;
}

function convertLatexInner(inner) {
  let s = inner;
  s = s.replace(/\\([a-zA-Z]+)/g, (_, cmd) => GREEK_MAP[cmd] || SYMBOL_MAP[cmd] || cmd);
  s = s.replace(/\^\{([^}]*)\}/g, (_, arg) => toScript(arg, SUPERSCRIPT_MAP));
  s = s.replace(/_\{([^}]*)\}/g, (_, arg) => toScript(arg, SUBSCRIPT_MAP));
  s = s.replace(/\^(.)/g, (_, c) => SUPERSCRIPT_MAP[c] || c);
  s = s.replace(/_(.)/g, (_, c) => SUBSCRIPT_MAP[c] || c);
  s = s.replace(/[{}]/g, '');
  return s;
}

// ── Order persistence helpers ──────────────────────────────
const ORDER_DOC_ID = "publication_order";

async function saveOrderToFirestore(orderedIds) {
  try {
    await setDoc(doc(db, "meta", ORDER_DOC_ID), { order: orderedIds });
  } catch (e) {
    localStorage.setItem("pub_order", JSON.stringify(orderedIds));
  }
}

async function loadOrderFromFirestore() {
  try {
    const snap = await getDoc(doc(db, "meta", ORDER_DOC_ID));
    if (snap.exists()) return snap.data().order || [];
  } catch (e) {}
  try {
    return JSON.parse(localStorage.getItem("pub_order")) || [];
  } catch (e) { return []; }
}

function applyOrder(pubs, order) {
  if (!order.length) return pubs;
  const map = Object.fromEntries(pubs.map(p => [p.id, p]));
  const ordered = order.filter(id => map[id]).map(id => map[id]);
  const unordered = pubs.filter(p => !order.includes(p.id));
  return [...ordered, ...unordered];
}

// ── Login Modal ────────────────────────────────────────────
function LoginModal({ onClose }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onClose();
    } catch (e) {
      setError("Invalid email or password. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lock size={20} className="text-purple-800" />
            <h2 className="text-xl font-bold text-purple-900">Admin Login</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">Sign in to add, edit, or delete publications.</p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-400"
              placeholder="your@email.com"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-400"
              placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            onClick={handleLogin} disabled={loading}
            className="w-full py-2 bg-purple-800 text-white rounded hover:bg-purple-900 font-medium disabled:opacity-60 transition-colors"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────
function PublicationPDFGenerator() {
  const [publications, setPublications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [currentPublication, setCurrentPublication] = useState({ ...EMPTY_PUB });

  // Auth state
  const [user, setUser] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Best publications selection
  const [bestMode, setBestMode] = useState(false);
  const [selectedBest, setSelectedBest] = useState([]);
  const [bestLimit, setBestLimit] = useState(5);

  // PDF background color
  const [pdfBgColor, setPdfBgColor] = useState(BG_COLOR_OPTIONS[0]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customColor, setCustomColor] = useState("#FCF8E3");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => { fetchPublications(); }, []);

  const fetchPublications = async () => {
    setLoading(true);
    try {
      const [querySnapshot, savedOrder] = await Promise.all([
        getDocs(collection(db, "publications")),
        loadOrderFromFirestore(),
      ]);
      const fetched = [];
      querySnapshot.forEach((d) => fetched.push({ id: d.id, ...d.data() }));
      setPublications(applyOrder(fetched, savedOrder));
    } catch (error) {
      try {
        const saved = JSON.parse(localStorage.getItem('publications')) || [];
        setPublications(saved);
      } catch (e) { console.error(e); }
    }
    setLoading(false);
  };

  const saveCurrentOrder = async (pubs) => {
    await saveOrderToFirestore(pubs.map(p => p.id));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (editingId) {
      setPublications(publications.map(pub =>
        pub.id === editingId ? { ...pub, [name]: value } : pub
      ));
    } else {
      setCurrentPublication(prev => ({ ...prev, [name]: value }));
    }
  };

  const addPublication = async () => {
    if (!user) { setShowLoginModal(true); return; }
    if (!currentPublication.authors || !currentPublication.title || !currentPublication.journal) {
      alert("Authors, Title, and Journal are required fields");
      return;
    }
    try {
      const docRef = await addDoc(collection(db, "publications"), currentPublication);
      const newPubs = [...publications, { ...currentPublication, id: docRef.id }];
      setPublications(newPubs);
      await saveCurrentOrder(newPubs);
      setCurrentPublication({ ...EMPTY_PUB });
    } catch (error) {
      console.error("Error adding document:", error);
    }
  };

  const updatePublication = async () => {
    if (!user) { setShowLoginModal(true); return; }
    if (!editingId) return;
    const updatedPub = publications.find(pub => pub.id === editingId);
    try {
      await updateDoc(doc(db, "publications", editingId), updatedPub);
      setEditingId(null);
    } catch (error) {
      console.error("Error updating document:", error);
    }
  };

  const removePublication = async (id) => {
    if (!user) { setShowLoginModal(true); return; }
    if (!window.confirm("Are you sure you want to delete this publication?")) return;
    try {
      await deleteDoc(doc(db, "publications", id));
      const updated = publications.filter(pub => pub.id !== id);
      setPublications(updated);
      await saveCurrentOrder(updated);
      setSelectedBest(prev => prev.filter(sid => sid !== id));
    } catch (error) {
      console.error("Error deleting document:", error);
    }
  };

  const movePublication = async (id, direction) => {
    if (!user) { setShowLoginModal(true); return; }
    const index = publications.findIndex(pub => pub.id === id);
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === publications.length - 1)) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...publications];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIndex, 0, moved);
    setPublications(updated);
    await saveCurrentOrder(updated);
  };

  const cancelEdit = () => { fetchPublications(); setEditingId(null); };

  const toggleBestSelection = (id) => {
    setSelectedBest(prev => {
      if (prev.includes(id)) return prev.filter(sid => sid !== id);
      if (prev.length >= bestLimit) {
        alert(`You can only select up to ${bestLimit} publications. Deselect one first.`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const renderAuthorDisplay = (authors) => {
    if (!authors.includes("Sachchidanand Prasad")) return authors;
    return (
      <>
        {authors.split("Sachchidanand Prasad")[0]}
        <span className="font-bold">Sachchidanand Prasad</span>
        {authors.split("Sachchidanand Prasad")[1]}
      </>
    );
  };

  const getActiveBgRgb = () => {
    if (pdfBgColor.value === "__custom__") {
      const hex = customColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return [r, g, b];
    }
    return pdfBgColor.rgb;
  };

  const buildPDF = (pubList, headerTitle) => {
    const pdfdoc = new jsPDF();
    const pageW = pdfdoc.internal.pageSize.width;
    const pageH = pdfdoc.internal.pageSize.height;
    const margin = 20;
    const bgRgb = getActiveBgRgb();

    const addBg = () => {
      pdfdoc.setFillColor(...bgRgb);
      pdfdoc.rect(0, 0, pageW, pageH, 'F');
    };

    addBg();
    pdfdoc.setFont("times", "bold");
    pdfdoc.setFontSize(22);
    pdfdoc.setTextColor(70, 10, 100);
    pdfdoc.text(headerTitle, pageW / 2, 25, { align: 'center' });
    pdfdoc.setFont("times", "italic");
    pdfdoc.setFontSize(11);
    pdfdoc.setTextColor(80, 80, 80);
    pdfdoc.text("Sachchidanand Prasad", pageW / 2, 35, { align: 'center' });
    pdfdoc.setDrawColor(70, 10, 100);
    pdfdoc.setLineWidth(0.5);
    pdfdoc.line(margin, 40, pageW - margin, 40);

    let y = 50;

    pubList.forEach((pub, index) => {
      const estHeight = 40 + (pub.doi ? 7 : 0);
      if (y + estHeight > pageH - margin) {
        pdfdoc.addPage();
        addBg();
        y = 30;
      }

      pdfdoc.setFont("times", "bold");
      pdfdoc.setFontSize(12);
      pdfdoc.setTextColor(70, 10, 100);
      pdfdoc.text(`${index + 1}.`, margin, y);

      pdfdoc.setFont("times", "bold");
      pdfdoc.setFontSize(13);
      pdfdoc.setTextColor(3, 68, 236);
      pdfdoc.text(latexToUnicode(pub.title), margin + 10, y);
      y += 8;

      const formatted = pub.authors.trim().split(',').map(a => a.trim())
        .map(a => a.includes("Sachchidanand Prasad") ? `[B]${a}[/B]` : a).join(", ");
      const parts = formatted.split(/\[B\]|\[\/B\]/);
      let xOff = margin + 10;
      parts.forEach((part, i) => {
        if (!part) return;
        pdfdoc.setFont("times", i % 2 === 1 ? "bold" : "normal");
        pdfdoc.setFontSize(12);
        pdfdoc.setTextColor(0, 0, 0);
        pdfdoc.text(part, xOff, y);
        xOff += pdfdoc.getTextWidth(part);
      });
      y += 8;

      pdfdoc.setFont("times", "italic");
      pdfdoc.setTextColor(0, 0, 0);
      pdfdoc.text(latexToUnicode(pub.journal), margin + 10, y);
      y += 6;

      pdfdoc.setFont("times", "normal");
      let info = "";
      if (pub.volume) info += `Volume ${pub.volume}`;
      if (pub.pageNumbers) { if (info) info += ", "; info += `pp. ${pub.pageNumbers}`; }
      if (pub.month || pub.year) { if (info) info += ", "; info += [pub.month, pub.year].filter(Boolean).join(' '); }
      if (info) { pdfdoc.text(info, margin + 10, y); y += 6; }

      if (pub.doi) {
        pdfdoc.setFont("times", "normal");
        pdfdoc.setFontSize(11);
        pdfdoc.setTextColor(0, 80, 180);
        pdfdoc.text(`DOI: ${pub.doi}`, margin + 10, y);
        y += 6;
      }

      y += 9;
    });

    const pageCount = pdfdoc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdfdoc.setPage(i);
      pdfdoc.setDrawColor(70, 10, 100);
      pdfdoc.setLineWidth(0.5);
      pdfdoc.line(margin, pageH - 20, pageW - margin, pageH - 20);
      pdfdoc.setFont("times", "italic");
      pdfdoc.setFontSize(10);
      pdfdoc.setTextColor(80, 80, 80);
      pdfdoc.text(`Page ${i} of ${pageCount}`, pageW / 2, pageH - 10, { align: 'center' });
    }

    return pdfdoc;
  };

  const generateAllPDF = () => {
    if (!publications.length) return;
    buildPDF(publications, "Research Publications").save('research-publications.pdf');
  };

  const generateBestPDF = () => {
    if (!selectedBest.length) { alert("Please select at least one publication."); return; }
    const bestPubs = publications.filter(pub => selectedBest.includes(pub.id));
    buildPDF(bestPubs, `Best ${bestPubs.length} Research Publications`).save('best-publications.pdf');
  };

  const ColorPickerPanel = () => (
    <div className="absolute z-50 right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl p-4 w-72">
      <p className="text-sm font-semibold text-gray-700 mb-3">PDF Background Color</p>
      <div className="grid grid-cols-4 gap-2 mb-3">
        {BG_COLOR_OPTIONS.map(opt => (
          <button key={opt.value} title={opt.label}
            onClick={() => { setPdfBgColor(opt); setShowColorPicker(false); }}
            className={`w-full aspect-square rounded-lg border-2 transition-all ${
              pdfBgColor.value === opt.value ? 'border-purple-600 scale-110 shadow-md' : 'border-gray-200 hover:border-purple-300'
            }`}
            style={{ backgroundColor: opt.value }}
          />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2 mb-1">
        {BG_COLOR_OPTIONS.map(opt => (
          <p key={opt.value} className="text-center text-xs text-gray-500 leading-tight">{opt.label}</p>
        ))}
      </div>
      <div className="mt-3 border-t pt-3">
        <p className="text-xs font-medium text-gray-600 mb-2">Custom color</p>
        <div className="flex items-center gap-2">
          <input type="color" value={customColor} onChange={e => setCustomColor(e.target.value)}
            className="w-10 h-10 rounded cursor-pointer border border-gray-300" />
          <input type="text" value={customColor} onChange={e => setCustomColor(e.target.value)}
            className="flex-1 p-1.5 text-sm border border-gray-300 rounded font-mono" placeholder="#RRGGBB" />
          <button onClick={() => { setPdfBgColor({ label: "Custom", value: "__custom__", rgb: [] }); setShowColorPicker(false); }}
            className="px-2 py-1.5 bg-purple-700 text-white text-xs rounded hover:bg-purple-800">
            Use
          </button>
        </div>
      </div>
    </div>
  );

  const activeBgPreview = pdfBgColor.value === "__custom__" ? customColor : pdfBgColor.value;
  const activeBgLabel = pdfBgColor.value === "__custom__" ? `Custom (${customColor})` : pdfBgColor.label;

  return (
    <div className="max-w-4xl mx-auto p-6 bg-yellow-50 rounded-lg shadow-lg">

      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-purple-900">Research Publication PDF Generator</h1>
        <div>
          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 hidden sm:block">{user.email}</span>
              <button onClick={() => signOut(auth)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium transition-colors">
                <LogOut size={14} /> Logout
              </button>
            </div>
          ) : (
            <button onClick={() => setShowLoginModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 text-purple-800 rounded-lg hover:bg-purple-200 text-sm font-medium transition-colors">
              <LogIn size={14} /> Admin Login
            </button>
          )}
        </div>
      </div>

      {/* ── PDF Background Color Selector ── */}
      <div className="relative flex justify-end mb-4">
        <button onClick={() => setShowColorPicker(v => !v)}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors">
          <Palette size={16} className="text-purple-700" />
          PDF Background:
          <span className="inline-block w-5 h-5 rounded border border-gray-300" style={{ backgroundColor: activeBgPreview }} />
          <span className="text-gray-600">{activeBgLabel}</span>
        </button>
        {showColorPicker && <ColorPickerPanel />}
      </div>

      {/* ── Add Publication Form (only when logged in) ── */}
      {user && !editingId && (
        <div className="bg-white p-6 rounded-lg shadow mb-8 border-l-4 border-purple-800">
          <h2 className="text-xl font-semibold mb-4 text-purple-800">Add Publication Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Authors*</label>
              <input type="text" name="authors" value={currentPublication.authors} onChange={handleChange}
                placeholder="e.g., Sachchidanand Prasad, Johnson, M."
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-400 focus:border-transparent" />
              <p className="text-xs text-gray-500 mt-1">Separate authors with commas (,)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title*</label>
              <input type="text" name="title" value={currentPublication.title} onChange={handleChange}
                placeholder="Publication Title"
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-400 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Journal Name*</label>
              <input type="text" name="journal" value={currentPublication.journal} onChange={handleChange}
                placeholder="Journal of..."
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-400 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Volume</label>
              <input type="text" name="volume" value={currentPublication.volume} onChange={handleChange}
                placeholder="e.g., 42"
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-400 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Page Numbers</label>
              <input type="text" name="pageNumbers" value={currentPublication.pageNumbers} onChange={handleChange}
                placeholder="e.g., 123-145"
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-400 focus:border-transparent" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                <select name="month" value={currentPublication.month} onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-400 focus:border-transparent">
                  <option value="">Select Month</option>
                  {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                <input type="text" name="year" value={currentPublication.year} onChange={handleChange}
                  placeholder="e.g., 2025"
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-400 focus:border-transparent" />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">DOI</label>
              <input type="text" name="doi" value={currentPublication.doi} onChange={handleChange}
                placeholder="e.g., 10.1000/xyz123"
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-400 focus:border-transparent" />
              <p className="text-xs text-gray-500 mt-1">Digital Object Identifier (optional)</p>
            </div>
          </div>
          <button onClick={addPublication}
            className="mt-4 flex items-center justify-center px-4 py-2 bg-purple-800 text-white rounded hover:bg-purple-900 transition-colors">
            <FilePlus size={18} className="mr-2" /> Add Publication
          </button>
        </div>
      )}

      {/* ── Not logged in banner ── */}
      {!user && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-purple-800">
            <Lock size={16} />
            <span className="text-sm">You are viewing in read-only mode. Login to add or edit publications.</span>
          </div>
          <button onClick={() => setShowLoginModal(true)}
            className="text-sm px-3 py-1 bg-purple-800 text-white rounded hover:bg-purple-900 transition-colors">
            Login
          </button>
        </div>
      )}

      {/* ── Publications List ── */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-purple-800">Publications List</h2>
          {!loading && publications.length > 0 && (
            <button onClick={() => setBestMode(v => !v)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                bestMode
                  ? 'bg-amber-400 text-white border-amber-400 hover:bg-amber-500'
                  : 'bg-white text-amber-600 border-amber-400 hover:bg-amber-50'
              }`}>
              <Star size={14} className={bestMode ? 'fill-white' : 'fill-amber-400 text-amber-400'} />
              {bestMode ? 'Done Selecting' : 'Select Best Publications'}
            </button>
          )}
        </div>

        {bestMode && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex flex-wrap items-center gap-3 text-sm">
            <span className="text-amber-800 font-medium">Select best</span>
            <input type="number" min={1} max={publications.length || 20} value={bestLimit}
              onChange={e => {
                const val = Math.max(1, parseInt(e.target.value) || 1);
                setBestLimit(val);
                if (selectedBest.length > val) setSelectedBest(prev => prev.slice(0, val));
              }}
              className="w-14 p-1 border border-amber-300 rounded text-center focus:ring-2 focus:ring-amber-400" />
            <span className="text-amber-800 font-medium">publications</span>
            <div className="flex items-center gap-2 ml-auto">
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div className="bg-amber-400 h-2 rounded-full transition-all"
                  style={{ width: `${bestLimit > 0 ? Math.min((selectedBest.length / bestLimit) * 100, 100) : 0}%` }} />
              </div>
              <span className="text-amber-700 font-semibold">{selectedBest.length}/{bestLimit}</span>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-gray-500 italic">Loading publications...</p>
        ) : publications.length === 0 ? (
          <p className="text-gray-500 italic">No publications added yet.</p>
        ) : (
          <div className="space-y-4">
            {publications.map((pub, index) => (
              <div key={pub.id}
                className={`border rounded-lg p-4 transition-all ${
                  editingId === pub.id ? 'bg-yellow-100 border-yellow-400' :
                  selectedBest.includes(pub.id) ? 'bg-amber-50 border-amber-400 shadow-sm ring-1 ring-amber-300' :
                  'bg-yellow-50'
                }`}>
                {editingId === pub.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Authors</label>
                      <input type="text" name="authors" value={pub.authors} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                      <input type="text" name="title" value={pub.title} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Journal</label>
                      <input type="text" name="journal" value={pub.journal} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Volume</label>
                        <input type="text" name="volume" value={pub.volume} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Pages</label>
                        <input type="text" name="pageNumbers" value={pub.pageNumbers} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                        <select name="month" value={pub.month} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded">
                          <option value="">Select Month</option>
                          {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                        <input type="text" name="year" value={pub.year} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">DOI</label>
                      <input type="text" name="doi" value={pub.doi || ""} onChange={handleChange}
                        placeholder="e.g., 10.1000/xyz123" className="w-full p-2 border border-gray-300 rounded" />
                    </div>
                    <div className="flex justify-end space-x-2 mt-2">
                      <button onClick={cancelEdit} className="flex items-center px-3 py-1 bg-gray-300 text-gray-800 rounded hover:bg-gray-400">
                        <X size={16} className="mr-1" /> Cancel
                      </button>
                      <button onClick={updatePublication} className="flex items-center px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">
                        <Save size={16} className="mr-1" /> Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    {bestMode && (
                      <div className="pt-1 flex-shrink-0">
                        <input type="checkbox" checked={selectedBest.includes(pub.id)}
                          onChange={() => toggleBestSelection(pub.id)}
                          className="w-5 h-5 accent-amber-500 cursor-pointer rounded" />
                      </div>
                    )}
                    <div className="flex-grow min-w-0">
                      {selectedBest.includes(pub.id) && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full mb-1">
                          <Star size={10} className="fill-amber-500 text-amber-500" />
                          Best Publication #{selectedBest.indexOf(pub.id) + 1}
                        </span>
                      )}
                      <h3 className="font-bold text-lg text-purple-900 leading-tight">{latexToUnicode(pub.title)}</h3>
                      <p className="text-purple-800">{renderAuthorDisplay(pub.authors)}</p>
                      <p className="text-gray-700 italic">{pub.journal}</p>
                      <div className="flex flex-wrap gap-4 mt-1 text-gray-600 text-sm">
                        {pub.volume && <p><span className="font-medium">Volume:</span> {pub.volume}</p>}
                        {pub.pageNumbers && <p><span className="font-medium">Pages:</span> {pub.pageNumbers}</p>}
                        {(pub.month || pub.year) && (
                          <p><span className="font-medium">Published:</span> {[pub.month, pub.year].filter(Boolean).join(' ')}</p>
                        )}
                      </div>
                      {pub.doi && (
                        <p className="mt-1 text-sm">
                          <span className="font-medium text-gray-600">DOI:</span>{" "}
                          <a href={`https://doi.org/${pub.doi}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {pub.doi}
                          </a>
                        </p>
                      )}
                    </div>
                    {user && (
                      <div className="flex flex-col space-y-1 flex-shrink-0">
                        <button onClick={() => movePublication(pub.id, 'up')} disabled={index === 0}
                          className={`text-purple-700 hover:text-purple-900 ${index === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}>
                          <ArrowUp size={18} />
                        </button>
                        <button onClick={() => movePublication(pub.id, 'down')} disabled={index === publications.length - 1}
                          className={`text-purple-700 hover:text-purple-900 ${index === publications.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}`}>
                          <ArrowDown size={18} />
                        </button>
                        <button onClick={() => setEditingId(pub.id)} className="text-blue-600 hover:text-blue-800">
                          <Edit size={18} />
                        </button>
                        <button onClick={() => removePublication(pub.id)} className="text-red-500 hover:text-red-700">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Best PDF Download ── */}
      {selectedBest.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-5 mb-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Star size={18} className="fill-amber-400 text-amber-400" />
            <h3 className="font-semibold text-amber-800">{selectedBest.length} Publication{selectedBest.length > 1 ? 's' : ''} Selected as Best</h3>
          </div>
          <ol className="mb-4 space-y-1">
            {publications.filter(pub => selectedBest.includes(pub.id)).map((pub, i) => (
              <li key={pub.id} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="font-bold text-amber-600 flex-shrink-0 w-5">{i + 1}.</span>
                <span className="flex-grow line-clamp-1">{pub.title}</span>
                <button onClick={() => toggleBestSelection(pub.id)} className="flex-shrink-0 text-gray-400 hover:text-red-500">
                  <X size={14} />
                </button>
              </li>
            ))}
          </ol>
          <div className="flex gap-3 flex-wrap">
            <button onClick={generateBestPDF}
              className="flex items-center px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium shadow transition-colors">
              <Download size={18} className="mr-2" />
              Download Best {selectedBest.length} PDF
            </button>
            <button onClick={() => setSelectedBest([])}
              className="flex items-center px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
              <X size={16} className="mr-1" /> Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* ── Generate All PDF ── */}
      <div className="flex justify-center">
        <button onClick={generateAllPDF} disabled={publications.length === 0}
          className={`flex items-center justify-center px-6 py-3 rounded-lg text-white font-medium text-lg ${
            publications.length === 0 ? "bg-gray-400 cursor-not-allowed" : "bg-purple-800 hover:bg-purple-900 shadow-lg"
          }`}>
          <Download size={20} className="mr-2" />
          Generate All Publications PDF
        </button>
      </div>

      <div className="mt-6 text-center text-sm text-gray-600 space-y-1">
        <p>Use the <strong>PDF Background</strong> button to choose your PDF paper color.</p>
        <p>Publications by Sachchidanand Prasad will be highlighted with bold text.</p>
      </div>
    </div>
  );
}

export default PublicationPDFGenerator;