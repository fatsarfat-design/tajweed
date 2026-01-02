
(() => {
  const $ = (sel, el=document) => el.querySelector(sel);
  const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));

  const STORAGE = {
    settings: "tajweed_settings_v22",
    progress: "tajweed_progress_v21",
    notesPrefix: "tajweed_note_v21_"
  };

  const DEFAULT_SETTINGS = {
    theme: "night",          // night | sand
    fontSize: 16,
    arabicSize: 22,
    arabicFont: "Noto Naskh Arabic",
    background: "none",      // none | mosaic | stars | arabesque | photo
    bgPhoto: ""            // dataURL or https://... for photo background
  };

  const BG = {
    none: { img: "none", repeat:"repeat", size:"auto" },
    mosaic: { img: "radial-gradient(circle at 10px 10px, rgba(232,200,120,.30) 1px, transparent 1.5px), radial-gradient(circle at 30px 22px, rgba(125,211,252,.25) 1px, transparent 1.5px)", repeat:"repeat", size:"40px 40px" },
    stars: { img: "radial-gradient(circle at 5px 5px, rgba(255,255,255,.25) 1px, transparent 1.5px), radial-gradient(circle at 18px 14px, rgba(232,200,120,.22) 1px, transparent 1.5px), radial-gradient(circle at 28px 28px, rgba(125,211,252,.20) 1px, transparent 1.5px)", repeat:"repeat", size:"36px 36px" },
    arabesque: { img: "conic-gradient(from 45deg at 12px 12px, rgba(232,200,120,.20), transparent 25%, rgba(125,211,252,.14) 50%, transparent 75%, rgba(232,200,120,.18))", repeat:"repeat", size:"48px 48px" }
  };

  function loadSettings(){
    try { return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(STORAGE.settings))||{}) }; }
    catch { return { ...DEFAULT_SETTINGS }; }
  }
  function saveSettings(s){
    localStorage.setItem(STORAGE.settings, JSON.stringify(s));
  }
  function applySettings(s){
    const root = document.documentElement;
    root.style.setProperty("--fs", s.fontSize + "px");
    root.style.setProperty("--arfs", s.arabicSize + "px");
    root.style.setProperty("--arfont", `"${s.arabicFont}", "Amiri", "Scheherazade New", serif`);
    if(s.theme === "sand"){
      root.style.setProperty("--bg", "#0b0a07");
      root.style.setProperty("--panel", "#14110b");
      root.style.setProperty("--card", "#14110b");
      root.style.setProperty("--text", "#f3efe4");
      root.style.setProperty("--muted", "#c6bba5");
      root.style.setProperty("--accent", "#f2c97b");
      root.style.setProperty("--accent2", "#7dd3fc");
      root.style.setProperty("--border", "rgba(255,255,255,.10)");
    } else {
      // night defaults are in CSS; keep.
      root.style.setProperty("--bg", "#0c0f14");
      root.style.setProperty("--panel", "#111826");
      root.style.setProperty("--card", "#0f1724");
      root.style.setProperty("--text", "#e8eefc");
      root.style.setProperty("--muted", "#9bb0d0");
      root.style.setProperty("--accent", "#e8c878");
      root.style.setProperty("--accent2", "#7dd3fc");
      root.style.setProperty("--border", "rgba(255,255,255,.08)");
    }
    let b;
    if(s.background === "photo"){
      const src = (s.bgPhoto || "").trim();
      const safe = src.replace(/"/g, "%22");
      b = { img: src ? `url("${safe}")` : "none", repeat: "no-repeat", size: "cover", pos: "center" };
    } else {
      b = BG[s.background] || BG.none;
    }
    root.style.setProperty("--bg-img", b.img);
    root.style.setProperty("--bg-repeat", b.repeat);
    root.style.setProperty("--bg-size", b.size);
    root.style.setProperty("--bg-pos", b.pos || "center");
  }

  function loadProgress(){
    try { return JSON.parse(localStorage.getItem(STORAGE.progress)) || { completed: {} }; }
    catch { return { completed: {} }; }
  }
  function saveProgress(p){
    localStorage.setItem(STORAGE.progress, JSON.stringify(p));
  }

  function getNote(lessonId){
    return localStorage.getItem(STORAGE.notesPrefix + lessonId) || "";
  }
  function setNote(lessonId, txt){
    localStorage.setItem(STORAGE.notesPrefix + lessonId, txt);
  }

  // Data
  const blocks = (window.TAJWEED_BLOCKS || []);
  const tests = (window.TAJWEED_TESTS || {});
  const exams = (window.TAJWEED_EXAMS || {});

  // UI state
  let settings = loadSettings();
  let progress = loadProgress();
  let current = { blockId: null, lessonId: null, mode: "lesson" }; // lesson | quiz | trainer | settings | exam
  let filter = { q: "", activePill: "all" };

  const pills = [
    {id:"all", label:"Все"},
    {id:"lesson", label:"Теория"},
    {id:"quiz", label:"Мини‑тест"},
    {id:"trainer", label:"Тренажёр"},
    {id:"exam", label:"Экзамены"},
    {id:"settings", label:"Настройки"}
  ];

  // Helpers
  const findLesson = (lessonId) => {
    for(const b of blocks){
      for(const l of b.lessons){
        if(l.id === lessonId) return { block: b, lesson: l };
      }
    }
    return null;
  };

  const firstLesson = () => blocks?.[0]?.lessons?.[0]?.id || null;

  function setHash(parts){
    const h = "#" + parts.filter(Boolean).join("/");
    if(location.hash !== h) location.hash = h;
  }

  function parseHash(){
    const raw = (location.hash || "").replace(/^#/, "");
    const parts = raw.split("/").filter(Boolean);
    // formats:
    // #lesson/<lessonId>
    // #quiz/<blockId>
    // #trainer
    // #settings
    // #exam/<blockId|final>
    if(parts[0] === "quiz"){
      return { mode:"quiz", blockId: parts[1] || "b2", lessonId:null };
    }
    if(parts[0] === "trainer"){
      return { mode:"trainer", blockId:null, lessonId:null };
    }
    if(parts[0] === "settings"){
      return { mode:"settings", blockId:null, lessonId:null };
    }
    if(parts[0] === "exam"){
      return { mode:"exam", blockId: parts[1] || "final", lessonId:null };
    }
    if(parts[0] === "lesson"){
      const lessonId = parts[1] || firstLesson();
      const fl = findLesson(lessonId);
      return { mode:"lesson", blockId: fl?.block?.id || null, lessonId };
    }
    // default
    const lessonId = firstLesson();
    const fl = findLesson(lessonId);
    return { mode:"lesson", blockId: fl?.block?.id || null, lessonId };
  }

  // Rendering
  function renderSidebar(){
    $("#pillRow").innerHTML = pills.map(p => `
      <div class="pill ${filter.activePill===p.id?'active':''}" data-pill="${p.id}">${p.label}</div>
    `).join("");

    const q = filter.q.trim().toLowerCase();
    const wrap = $("#blocksWrap");
    wrap.innerHTML = "";

    blocks.forEach((b, bi) => {
      // filter by search
      const lessons = b.lessons.filter(l => {
        if(!q) return true;
        const hay = (b.title + " " + l.title + " " + (l.arabicTitle||"") + " " + (l.content||"")).toLowerCase();
        return hay.includes(q);
      });

      if(q && lessons.length === 0) return;

      const blockEl = document.createElement("div");
      blockEl.className = "block";
      blockEl.innerHTML = `
        <div class="blockTitle">
          <span>${b.title}</span>
          <span class="small">${lessons.length}/${b.lessons.length}</span>
        </div>
        <div class="lessonList">
          ${lessons.map((l, li) => {
            const isActive = current.mode==="lesson" && current.lessonId===l.id;
            const done = !!progress.completed[l.id];
            const hint = (l.arabicTitle ? l.arabicTitle : "—");
            return `
              <div class="lessonBtn ${isActive?'active':''}" data-lesson="${l.id}">
                <div class="idx">${done ? "✓" : (li+1)}</div>
                <div class="meta">
                  <div class="title">${l.title}</div>
                  <div class="hint">${hint}</div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `;
      wrap.appendChild(blockEl);
    });
  }

  function renderHero(){
    const hero = $("#hero");
    const title = (current.mode==="lesson") ? "Учебное приложение по таджвиду" :
                  (current.mode==="quiz") ? "Мини‑тесты" :
                  (current.mode==="trainer") ? "Тренажёр" :
                  (current.mode==="exam") ? "Экзамены" :
                  "Настройки";
    const desc = (current.mode==="lesson")
      ? "Открывай тему, делай заметки, проходи мини‑тест и экзамены. Всё сохраняется."
      : (current.mode==="quiz")
      ? "Короткие тесты по каждому блоку: быстрая проверка понимания."
      : (current.mode==="trainer")
      ? "Случайные задания: угадай правило/термин/категорию. Отлично для закрепления."
      : (current.mode==="exam")
      ? "Экзамены по блокам и итоговый экзамен по всему курсу."
      : "Шрифт, размер, фон, тема — подстрой приложение под себя.";
    hero.innerHTML = `
      <div class="hero card">
        <div class="topbar">
          <div>
            <h2>${title}</h2>
            <p>${desc}</p>
          </div>
          <div class="actions">
            <button class="btn" id="btnLesson">Теория</button>
            <button class="btn" id="btnQuiz">Мини‑тест</button>
            <button class="btn" id="btnTrainer">Тренажёр</button>
            <button class="btn" id="btnExam">Экзамены</button>
            <button class="btn primary" id="btnSettings">Настройки</button>
          </div>
        </div>
      </div>
    `;
    $("#btnLesson").onclick = () => { filter.activePill="lesson"; setHash(["lesson", current.lessonId || firstLesson()]); };
    $("#btnQuiz").onclick = () => { filter.activePill="quiz"; setHash(["quiz", current.blockId || "b2"]); };
    $("#btnTrainer").onclick = () => { filter.activePill="trainer"; setHash(["trainer"]); };
    $("#btnExam").onclick = () => { filter.activePill="exam"; setHash(["exam","final"]); };
    $("#btnSettings").onclick = () => { filter.activePill="settings"; setHash(["settings"]); };
  }

  function renderLesson(){
    const panel = $("#mainPanel");
    const found = findLesson(current.lessonId);
    if(!found){
      panel.innerHTML = `<div class="card content"><h3>Не найдено</h3><p class="muted">Тема не найдена.</p></div>`;
      return;
    }
    const {block, lesson} = found;
    const done = !!progress.completed[lesson.id];
    panel.innerHTML = `
      <div class="grid2">
        <div class="card content">
          <h3>${block.title} • ${lesson.title}</h3>
          ${lesson.arabicTitle ? `<div class="ar">${lesson.arabicTitle}</div>` : ``}
          <div class="ru">${lesson.content}</div>
          <div class="hr"></div>
          <div class="actions">
            <button class="btn primary" id="markDone">${done ? "Отмечено ✓" : "Отметить как пройдено"}</button>
            <button class="btn" id="goMiniQuiz">Мини‑тест по блоку</button>
            <button class="btn" id="goExam">Экзамен по блоку</button>
          </div>
          <div class="result" id="lessonStatus">${done ? "Тема отмечена как пройденная." : "Отметь тему, когда будешь уверена."}</div>
        </div>
        <div class="card noteBox">
          <h3 style="margin:0 0 10px; font-size:16px;">Мои заметки</h3>
          <textarea id="noteArea" placeholder="Пиши свои заметки по этой теме..."></textarea>
          <div class="noteRow">
            <div class="badge" id="noteSaved">Сохраняется автоматически</div>
            <div class="actions">
              <button class="btn" id="clearNote">Очистить</button>
            </div>
          </div>
          <div class="hr"></div>
          <div class="small">Подсказка: заметки сохраняются на этом устройстве (localStorage).</div>
        </div>
      </div>
    `;

    // note
    const ta = $("#noteArea");
    ta.value = getNote(lesson.id);
    let t;
    ta.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        setNote(lesson.id, ta.value);
        $("#noteSaved").textContent = "Сохранено ✓";
        setTimeout(()=> $("#noteSaved").textContent = "Сохраняется автоматически", 900);
      }, 250);
    });
    $("#clearNote").onclick = () => {
      ta.value = "";
      setNote(lesson.id, "");
      $("#noteSaved").textContent = "Очищено";
      setTimeout(()=> $("#noteSaved").textContent = "Сохраняется автоматически", 900);
    };

    $("#markDone").onclick = () => {
      progress.completed[lesson.id] = true;
      saveProgress(progress);
      renderSidebar();
      renderLesson();
    };

    $("#goMiniQuiz").onclick = () => setHash(["quiz", block.id]);
    $("#goExam").onclick = () => setHash(["exam", block.id]);
  }

  function renderQuiz(){
    const panel = $("#mainPanel");
    const blockId = current.blockId || "b2";
    const block = blocks.find(b=>b.id===blockId) || blocks[0];
    const qs = tests[blockId] || [];
    if(!qs.length){
      panel.innerHTML = `<div class="card content"><h3>Мини‑тест</h3><p class="muted">Пока нет вопросов для этого блока.</p></div>`;
      return;
    }

    panel.innerHTML = `
      <div class="card quiz">
        <h3 style="margin:0 0 6px;">Мини‑тест • ${block.title}</h3>
        <div class="small">Выбери ответы и нажми «Проверить».</div>
        <div id="quizWrap"></div>
        <div class="actions" style="margin-top:10px;">
          <button class="btn primary" id="checkQuiz">Проверить</button>
          <button class="btn" id="retryQuiz">Заново</button>
          <button class="btn" id="toLessonFromQuiz">Открыть теорию блока</button>
        </div>
        <div class="result" id="quizResult"></div>
      </div>
    `;

    const wrap = $("#quizWrap");
    wrap.innerHTML = qs.map((item, i) => `
      <div class="q" data-q="${i}">
        <h4>${i+1}. ${item.prompt}</h4>
        ${item.options.map((opt, j) => `
          <label class="opt">
            <input type="radio" name="q_${i}" value="${j}">
            <div>${opt}</div>
          </label>
        `).join("")}
        <div class="small" id="ex_${i}"></div>
      </div>
    `).join("");

    $("#checkQuiz").onclick = () => {
      let score = 0;
      qs.forEach((item,i)=>{
        const picked = $(`input[name="q_${i}"]:checked`);
        const ex = $(`#ex_${i}`);
        if(!picked){
          ex.textContent = "—";
          return;
        }
        const val = Number(picked.value);
        if(val === item.answer){
          score++;
          ex.textContent = "Верно ✓ " + (item.explain ? ("— " + item.explain) : "");
        } else {
          ex.textContent = `Неверно ✗ Правильный ответ: ${item.options[item.answer]}` + (item.explain ? (" — " + item.explain) : "");
        }
      });
      const pct = Math.round((score/qs.length)*100);
      $("#quizResult").textContent = `Результат: ${score}/${qs.length} (${pct}%).`;
    };

    $("#retryQuiz").onclick = () => setHash(["quiz", blockId]);
    $("#toLessonFromQuiz").onclick = () => {
      const lessonId = block.lessons[0]?.id || firstLesson();
      setHash(["lesson", lessonId]);
    };
  }

  function renderTrainer(){
    const panel = $("#mainPanel");
    panel.innerHTML = `
      <div class="card quiz">
        <h3 style="margin:0 0 6px;">Тренажёр</h3>
        <div class="small">Случайные вопросы из всех блоков. Выбирай сложность и тренируйся.</div>
        <div class="hr"></div>
        <div class="settings">
          <div class="row">
            <label>Сложность</label>
            <select id="trLevel">
              <option value="easy">Лёгкая (1 вариант очевидный)</option>
              <option value="normal" selected>Обычная</option>
              <option value="hard">Сложная (больше похожих ответов)</option>
            </select>
            <button class="btn primary" id="nextTask">Следующее задание</button>
          </div>
        </div>
        <div id="taskBox" class="q"></div>
        <div class="result" id="taskResult"></div>
      </div>
    `;

    const pool = [];
    Object.entries(tests).forEach(([bid, qs])=>{
      qs.forEach((it, idx)=> pool.push({ bid, idx, ...it }));
    });

    const pick = () => pool[Math.floor(Math.random()*pool.length)];

    function showOne(){
      const level = $("#trLevel").value;
      const item = pick();
      let opts = [...item.options];

      // Hard: shuffle always (default) + maybe add "похожий" distractor (we can't add safely) => keep shuffle.
      // Easy: keep correct close to top? We'll do mild bias.
      const correctText = opts[item.answer];

      // shuffle
      const shuffled = opts.map((t,i)=>({t,i})).sort(()=>Math.random()-0.5);
      let newAnswer = shuffled.findIndex(o=>o.i===item.answer);
      opts = shuffled.map(o=>o.t);

      if(level==="easy"){
        // put correct as option 0 sometimes
        if(Math.random()<0.6){
          const idx = newAnswer;
          const [ct] = opts.splice(idx,1);
          opts.unshift(ct);
          newAnswer = 0;
        }
      }

      $("#taskBox").innerHTML = `
        <h4 style="margin:0 0 8px;">${item.prompt}</h4>
        ${opts.map((o,j)=>`
          <label class="opt">
            <input type="radio" name="tr" value="${j}">
            <div>${o}</div>
          </label>
        `).join("")}
        <div class="small">Источник: ${item.bid.toUpperCase()}</div>
      `;
      $("#taskResult").textContent = "";
      $("#nextTask").onclick = showOne;

      // handle check on click: pick option -> evaluate instantly
      $$("#taskBox input[name='tr']").forEach(inp=>{
        inp.addEventListener("change", ()=>{
          const v = Number(inp.value);
          if(v === newAnswer){
            $("#taskResult").textContent = "Верно ✓ " + (item.explain ? ("— " + item.explain) : "");
          } else {
            $("#taskResult").textContent = `Неверно ✗ Правильный ответ: ${opts[newAnswer]}` + (item.explain ? (" — " + item.explain) : "");
          }
        });
      });
    }

    $("#nextTask").onclick = showOne;
    showOne();
  }

  function renderSettings(){
    const panel = $("#mainPanel");
    panel.innerHTML = `
      <div class="card settings">
        <h3 style="margin:0 0 6px;">Настройки</h3>
        <div class="small">Все настройки сохраняются и применяются сразу.</div>

        <div class="row" id="bgPhotoRow" style="display:none;">
          <label>Фото фона</label>
          <div class="col">
            <input id="bgPhotoFile" type="file" accept="image/*">
            <input id="bgPhotoUrl" type="url" placeholder="или вставь ссылку на картинку (https://...)">
            <div class="small" style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
              <button class="btn ghost" id="bgPhotoClear" type="button">Убрать фото</button>
              <span>Фото сохраняется на этом устройстве.</span>
            </div>
          </div>
        </div>

        <div class="hr"></div>

        <div class="row">
          <label>Тема</label>
          <select id="setTheme">
            <option value="night">Ночь</option>
            <option value="sand">Тёплая (песочная)</option>
          </select>
        </div>

        <div class="row">
          <label>Размер текста</label>
          <input id="setFs" type="range" min="14" max="22" step="1">
          <span class="small" id="fsVal"></span>
        </div>

        <div class="row">
          <label>Размер арабского</label>
          <input id="setArFs" type="range" min="18" max="34" step="1">
          <span class="small" id="arVal"></span>
        </div>

        <div class="row">
          <label>Шрифт арабского</label>
          <select id="setArFont">
            <option value="Noto Naskh Arabic">Noto Naskh Arabic</option>
            <option value="Amiri">Amiri</option>
            <option value="Scheherazade New">Scheherazade New</option>
          </select>
        </div>

        <div class="row">
          <label>Фон</label>
          <select id="setBg">
            <option value="none">Без фона</option>
            <option value="mosaic">Мозаика</option>
            <option value="stars">Звёзды</option>
            <option value="arabesque">Арабески</option>
            <option value="photo">Фото (своё)</option>
          </select>
        </div>

        <div class="hr"></div>

        <div class="row">
          <button class="btn danger" id="resetAll">Сбросить прогресс и заметки</button>
          <span class="small">Осторожно: удалит локальные данные на этом устройстве.</span>
        </div>
      </div>
    `;

    $("#setTheme").value = settings.theme;
    $("#setFs").value = settings.fontSize;
    $("#setArFs").value = settings.arabicSize;
    $("#setArFont").value = settings.arabicFont;
    $("#setBg").value = settings.background;

    $("#bgPhotoUrl").value = settings.bgPhoto || "";

    const syncBgPhotoUI = ()=>{
      const isPhoto = settings.background === "photo";
      $("#bgPhotoRow").style.display = isPhoto ? "" : "none";
    };
    syncBgPhotoUI();

    const updateLabels = () => {
      $("#fsVal").textContent = settings.fontSize + "px";
      $("#arVal").textContent = settings.arabicSize + "px";
    };
    updateLabels();

    $("#setTheme").onchange = (e)=>{ settings.theme = e.target.value; saveSettings(settings); applySettings(settings); };
    $("#setFs").oninput = (e)=>{ settings.fontSize = Number(e.target.value); saveSettings(settings); applySettings(settings); updateLabels(); };
    $("#setArFs").oninput = (e)=>{ settings.arabicSize = Number(e.target.value); saveSettings(settings); applySettings(settings); updateLabels(); };
    $("#setArFont").onchange = (e)=>{ settings.arabicFont = e.target.value; saveSettings(settings); applySettings(settings); };
    $("#setBg").onchange = (e)=>{ settings.background = e.target.value; saveSettings(settings); applySettings(settings); syncBgPhotoUI(); };

    // Фото фона
    $("#bgPhotoFile").onchange = (e)=>{
      const f = e.target.files && e.target.files[0];
      if(!f) return;
      const r = new FileReader();
      r.onload = () => {
        settings.bgPhoto = String(r.result || "");
        $("#bgPhotoUrl").value = "";
        settings.background = "photo";
        $("#setBg").value = "photo";
        saveSettings(settings);
        applySettings(settings);
        syncBgPhotoUI();
      };
      r.readAsDataURL(f);
    };

    $("#bgPhotoUrl").onchange = (e)=>{
      const v = (e.target.value || "").trim();
      if(!v) return;
      settings.bgPhoto = v;
      settings.background = "photo";
      $("#setBg").value = "photo";
      saveSettings(settings);
      applySettings(settings);
      syncBgPhotoUI();
    };

    $("#bgPhotoClear").onclick = ()=>{
      settings.bgPhoto = "";
      $("#bgPhotoUrl").value = "";
      $("#bgPhotoFile").value = "";
      saveSettings(settings);
      applySettings(settings);
    };


    $("#resetAll").onclick = () => {
      if(!confirm("Точно сбросить прогресс и удалить все заметки на этом устройстве?")) return;
      localStorage.removeItem(STORAGE.progress);
      Object.keys(localStorage).forEach(k=>{
        if(k.startsWith(STORAGE.notesPrefix)) localStorage.removeItem(k);
      });
      progress = loadProgress();
      renderSidebar();
      alert("Готово. Прогресс и заметки удалены.");
    };
  }

  function renderExam(){
    const panel = $("#mainPanel");
    const which = current.blockId || "final";

    const buildExamQuestions = () => {
      if(which === "final"){
        const qs = [];
        // pickPerBlock
        const per = exams?.final?.pickPerBlock || 3;
        Object.entries(tests).forEach(([bid, arr])=>{
          const picks = arr
            .map((it, idx)=>({bid, idx, ...it}))
            .sort(()=>Math.random()-0.5)
            .slice(0, Math.min(per, arr.length));
          qs.push(...picks);
        });
        return qs.sort(()=>Math.random()-0.5);
      } else {
        const arr = tests[which] || [];
        return arr.map((it, idx)=>({bid: which, idx, ...it}));
      }
    };

    const examQs = buildExamQuestions();
    if(!examQs.length){
      panel.innerHTML = `<div class="card content"><h3>Экзамен</h3><p class="muted">Нет вопросов.</p></div>`;
      return;
    }

    const title = (which === "final") ? "Итоговый экзамен" : `Экзамен • ${(blocks.find(b=>b.id===which)?.title||which)}`;
    panel.innerHTML = `
      <div class="card quiz">
        <h3 style="margin:0 0 6px;">${title}</h3>
        <div class="small">Ответь на вопросы, затем нажми «Завершить экзамен».</div>
        <div id="examWrap"></div>
        <div class="actions" style="margin-top:10px;">
          <button class="btn primary" id="finishExam">Завершить экзамен</button>
          <button class="btn" id="restartExam">Пересобрать экзамен</button>
        </div>
        <div class="result" id="examResult"></div>
      </div>
    `;

    $("#examWrap").innerHTML = examQs.map((item, i)=>`
      <div class="q" data-q="${i}">
        <h4>${i+1}. ${item.prompt} <span class="small">(${item.bid.toUpperCase()})</span></h4>
        ${item.options.map((opt,j)=>`
          <label class="opt">
            <input type="radio" name="e_${i}" value="${j}">
            <div>${opt}</div>
          </label>
        `).join("")}
        <div class="small" id="ee_${i}"></div>
      </div>
    `).join("");

    $("#finishExam").onclick = () => {
      let score = 0;
      examQs.forEach((item,i)=>{
        const picked = $(`input[name="e_${i}"]:checked`);
        const out = $(`#ee_${i}`);
        if(!picked){
          out.textContent = "—";
          return;
        }
        const v = Number(picked.value);
        if(v === item.answer){
          score++;
          out.textContent = "Верно ✓";
        } else {
          out.textContent = `Неверно ✗ Правильно: ${item.options[item.answer]}`;
        }
      });
      const pct = Math.round((score/examQs.length)*100);
      $("#examResult").textContent = `Итог: ${score}/${examQs.length} (${pct}%).`;
    };

    $("#restartExam").onclick = () => setHash(["exam", which]);
  }

  function renderMain(){
    renderHero();
    if(current.mode === "lesson") renderLesson();
    else if(current.mode === "quiz") renderQuiz();
    else if(current.mode === "trainer") renderTrainer();
    else if(current.mode === "settings") renderSettings();
    else if(current.mode === "exam") renderExam();
  }

  function attachSidebarHandlers(){
    $("#searchInput").addEventListener("input", (e)=>{
      filter.q = e.target.value;
      renderSidebar();
    });

    $("#pillRow").addEventListener("click", (e)=>{
      const pill = e.target.closest("[data-pill]");
      if(!pill) return;
      const id = pill.getAttribute("data-pill");
      filter.activePill = id;

      if(id === "lesson"){
        setHash(["lesson", current.lessonId || firstLesson()]);
      } else if(id === "quiz"){
        setHash(["quiz", current.blockId || "b2"]);
      } else if(id === "trainer"){
        setHash(["trainer"]);
      } else if(id === "settings"){
        setHash(["settings"]);
      } else if(id === "exam"){
        setHash(["exam","final"]);
      } else {
        // all -> show current
        if(current.mode==="lesson") setHash(["lesson", current.lessonId || firstLesson()]);
        else setHash([current.mode, current.blockId || "final"]);
      }
    });

    $("#blocksWrap").addEventListener("click", (e)=>{
      const btn = e.target.closest("[data-lesson]");
      if(!btn) return;
      const lessonId = btn.getAttribute("data-lesson");
      setHash(["lesson", lessonId]);
    });
  }

  function syncModeToPill(){
    const map = { lesson:"lesson", quiz:"quiz", trainer:"trainer", settings:"settings", exam:"exam" };
    filter.activePill = map[current.mode] || "all";
  }

  function onRoute(){
    current = parseHash();
    // set blockId for lesson
    if(current.mode === "lesson"){
      const fl = findLesson(current.lessonId);
      current.blockId = fl?.block?.id || current.blockId;
    }
    syncModeToPill();
    renderSidebar();
    renderMain();
  }

  function init(){
    applySettings(settings);

    // Build basic layout
    document.body.innerHTML = `
      <div class="app">
        <aside class="sidebar">
          <div class="brand">
            <div class="logo"></div>
            <div>
              <h1>Таджвид • Учебник</h1>
              <div class="sub">Блоки • Заметки • Тесты • Экзамены</div>
            </div>
          </div>
          <div class="searchRow">
            <input id="searchInput" placeholder="Поиск по темам и примерам..." />
          </div>
          <div class="pills" id="pillRow"></div>
          <div id="blocksWrap"></div>
          <div class="hr"></div>
          <div class="small">Версия: v21 • без кеш‑ошибок</div>
        </aside>

        <main class="main">
          <div id="hero"></div>
          <div id="mainPanel"></div>
        </main>
      </div>
    `;

    attachSidebarHandlers();
    window.addEventListener("hashchange", onRoute);
    if(!location.hash) setHash(["lesson", firstLesson()]);
    onRoute();

    // register SW (safe version)
    if("serviceWorker" in navigator){
      navigator.serviceWorker.register("./sw.js").catch(()=>{ /* ignore */ });
    }
  }

  init();
})();
