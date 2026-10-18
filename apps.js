// ============================================================
//  CONFIGURAÇÃO SUPABASE
// ============================================================
const SUPABASE_URL = "https://ojnslmzbryfapmnwiefr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qbnNsbXpicnlmYXBtbndpZWZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMDUwNjQsImV4cCI6MjEwNzg4MTA2NH0.yilHEBICm3Z-FDTp5n75AY8kUfKVzSXke1z0mDjkuQo";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
//  ESTADO
// ============================================================
let currentMode = "login"; // login | register
let currentGame = "snake";
let currentUser = null; // { username, email }

// ============================================================
//  INICIALIZAÇÃO
// ============================================================
document.addEventListener("DOMContentLoaded", async () => {
  loadSession();
  setupLoginModal();
  setupTabs();
  await loadHiScores();
  await loadActivityFeed();

  // Escuta sessão do Supabase (login em outro device etc.)
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (session) loadSession();
    else {
      currentUser = null;
      renderUserArea();
    }
  });
});

// ============================================================
//  SESSÃO / LOGIN
// ============================================================
function loadSession() {
  const stored = localStorage.getItem("amand_user");
  if (stored) {
    try {
      currentUser = JSON.parse(stored);
    } catch { currentUser = null; }
  }
  renderUserArea();
}

function renderUserArea() {
  const loginBtn = document.getElementById("loginBtn");
  const userInfo = document.getElementById("userInfo");
  const nameDisp = document.getElementById("userNameDisplay");

  if (currentUser) {
    loginBtn.classList.add("hidden");
    userInfo.classList.remove("hidden");
    nameDisp.textContent = `👤 ${currentUser.username}`;
  } else {
    loginBtn.classList.remove("hidden");
    userInfo.classList.add("hidden");
  }
}

// ============================================================
//  MODAL DE LOGIN
// ============================================================
function setupLoginModal() {
  const modal = document.getElementById("loginModal");
  const loginBtn = document.getElementById("loginBtn");
  const closeBtn = document.getElementById("closeModal");
  const switchLink = document.getElementById("switchMode");
  const form = document.getElementById("loginForm");
  const logoutBtn = document.getElementById("logoutBtn");

  loginBtn.onclick = () => modal.classList.remove("hidden");
  closeBtn.onclick = () => modal.classList.add("hidden");
  modal.onclick = (e) => { if (e.target === modal) modal.classList.add("hidden"); };

  switchLink.onclick = (e) => {
    e.preventDefault();
    setLoginMode(currentMode === "login" ? "register" : "login");
  };

  form.onsubmit = handleSubmit;

  logoutBtn.onclick = async () => {
    await supabaseClient.auth.signOut();
    localStorage.removeItem("amand_user");
    currentUser = null;
    renderUserArea();
    await loadHiScores();
    await loadActivityFeed();
  };
}

function setLoginMode(mode) {
  currentMode = mode;
  const title = document.getElementById("modalTitle");
  const submitBtn = document.getElementById("submitBtn");
  const switchLink = document.getElementById("switchMode");
  const registerFields = document.getElementById("registerFields");
  const usernameInput = document.getElementById("usernameInput");

  document.getElementById("loginError").textContent = "";

  if (mode === "login") {
    title.textContent = "Entrar";
    submitBtn.textContent = "Entrar";
    switchLink.textContent = "Ainda não tem conta? Registrar";
    registerFields.classList.add("hidden");
    usernameInput.required = false;
  } else {
    title.textContent = "Criar conta";
    submitBtn.textContent = "Registrar";
    switchLink.textContent = "Já tem conta? Entrar";
    registerFields.classList.remove("hidden");
    usernameInput.required = true;
  }
}

async function handleSubmit(e) {
  e.preventDefault();
  const email = document.getElementById("emailInput").value.trim();
  const password = document.getElementById("passwordInput").value;
  const username = document.getElementById("usernameInput").value.trim();
  const errorEl = document.getElementById("loginError");
  errorEl.textContent = "";

  if (currentMode === "login") {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) { errorEl.textContent = "Erro: " + error.message; return; }

    // Busca username no perfil
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("username")
      .eq("id", data.user.id)
      .single();

    currentUser = { username: profile?.username || email.split("@")[0], email };
    localStorage.setItem("amand_user", JSON.stringify(currentUser));
    renderUserArea();
    document.getElementById("loginModal").classList.add("hidden");
    document.getElementById("loginForm").reset();
    await loadHiScores();
    await loadActivityFeed();
  } else {
    // REGISTRO — checar username único
    if (!username) { errorEl.textContent = "Nome de usuário é obrigatório."; return; }

    const { data: existing } = await supabaseClient
      .from("profiles")
      .select("username")
      .eq("username", username)
      .maybeSingle();

    if (existing) {
      errorEl.textContent = `O nome "${username}" já está em uso. Tente outro.`;
      return;
    }

    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) { errorEl.textContent = "Erro: " + error.message; return; }

    // Cria perfil
    if (data.user) {
      const { error: profErr } = await supabaseClient.from("profiles").insert({
        id: data.user.id,
        username,
      });
      if (profErr) { errorEl.textContent = "Erro ao criar perfil: " + profErr.message; return; }

      currentUser = { username, email };
      localStorage.setItem("amand_user", JSON.stringify(currentUser));
      renderUserArea();
      document.getElementById("loginModal").classList.add("hidden");
      document.getElementById("loginForm").reset();
      await loadHiScores();
      await loadActivityFeed();
    }
  }
}

// ============================================================
//  HISCORE
// ============================================================
function setupTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.onclick = () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentGame = tab.dataset.game;
      loadHiScores();
    };
  });
}

async function loadHiScores() {
  const list = document.getElementById("hiscoreList");
  list.innerHTML = `<li class="muted">Carregando...</li>`;

  const { data, error } = await supabaseClient
    .from("scores")
    .select("score, username, created_at")
    .eq("game", currentGame)
    .order("score", { ascending: false })
    .limit(10);

  if (error || !data) {
    list.innerHTML = `<li class="muted">Nenhuma pontuação ainda. Seja o primeiro!</li>`;
    return;
  }

  if (data.length === 0) {
    list.innerHTML = `<li class="muted">Nenhuma pontuação ainda. Seja o primeiro!</li>`;
    return;
  }

  list.innerHTML = data
    .map((row) => {
      const name = row.username
        ? `<span class="user">${escapeHtml(row.username)}</span>`
        : `<span class="anon">um Amanfã</span>`;
      return `<li>${name} fez <span class="score">${row.score}</span> pontos</li>`;
    })
    .join("");
}

// ============================================================
//  FEED DE ATIVIDADE
// ============================================================
async function loadActivityFeed() {
  const feed = document.getElementById("activityFeed");
  feed.innerHTML = `<li class="muted">Carregando...</li>`;

  const { data, error } = await supabaseClient
    .from("scores")
    .select("score, username, game, created_at")
    .order("created_at", { ascending: false })
    .limit(15);

  if (error || !data || data.length === 0) {
    feed.innerHTML = `<li class="muted">Nenhuma atividade recente. Que tal jogar?</li>`;
    return;
  }

  feed.innerHTML = data
    .map((row) => {
      const gameName = { snake: "Snake", memory: "Memory", clicker: "Clicker" }[row.game] || row.game;
      if (row.username) {
        return `<li>${escapeHtml(row.username)} jogou <strong>${gameName}</strong> e fez <span class="score">${row.score}</span> pontos!</li>`;
      }
      return `<li><em>um Amanfã</em> fez <span class="score">${row.score}</span> pontos em <strong>${gameName}</strong></li>`;
    })
    .join("");
}

// ============================================================
//  UTILITÁRIO — chamado pelos jogos via window.opener
// ============================================================
async function submitScore(game, score) {
  const username = currentUser ? currentUser.username : null;

  const { error } = await supabaseClient.from("scores").insert({
    game,
    score,
    username,
  });

  if (error) {
    console.error("Erro ao salvar pontuação:", error);
    return false;
  }
  await loadHiScores();
  await loadActivityFeed();
  return true;
}

// Expor para os jogos (que abrem na mesma aba — usam localStorage)
window.AmandApps = {
  submitScore,
  getCurrentUser: () => currentUser,
};

// ============================================================
//  UTILS
// ============================================================
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}