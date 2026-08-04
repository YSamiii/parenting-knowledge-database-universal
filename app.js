(() => {
  "use strict";

  const OVERRIDES_KEY = "parentingKnowledgeGeneralOverridesV1";
  const SETTINGS_KEY = "parentingKnowledgeGeneralSettingsV1";
  const DEFAULT_SETTINGS = {
    childName: "宝宝",
    childAgeMonths: 0,
    remoteUrl: "",
    autoSync: false,
    lastSyncAt: ""
  };

  const pageInfo = {
    home: ["首页", "查看已整理的育儿知识与近期重点"],
    library: ["知识库", "按主题浏览全部知识条目"],
    search: ["全文搜索", "搜索标题、标签、原则、方法和注意事项"],
    ask: ["问知识库", "自动调取相关条目并生成可核对的回答"],
    updates: ["更新与备份", "新增知识无需重装应用"],
    checklists: ["发育清单", "按年龄观察、勾选并保存宝宝的发展记录"],
    settings: ["设置", "调整孩子资料与同步方式"]
  };

  let settings = loadJson(SETTINGS_KEY, DEFAULT_SETTINGS);
  let overrides = loadJson(OVERRIDES_KEY, { knowledgeVersion: "", generatedAt: "", categories: [], entries: [] });
  let activeCategories = buildActiveCategories();
  let activeEntries = buildActiveEntries();
  let currentView = "home";

  const els = {
    pageTitle: document.getElementById("pageTitle"),
    pageSubtitle: document.getElementById("pageSubtitle"),
    versionBadge: document.getElementById("versionBadge"),
    articleDialog: document.getElementById("articleDialog"),
    articleDialogContent: document.getElementById("articleDialogContent"),
    dialogClose: document.getElementById("dialogClose"),
    toastDialog: document.getElementById("toastDialog"),
    toastText: document.getElementById("toastText"),
    importFileInput: document.getElementById("importFileInput"),
    sidebar: document.querySelector(".sidebar"),
    mobileMenuButton: document.getElementById("mobileMenuButton"),
    drawerBackdrop: document.getElementById("drawerBackdrop")
  };

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return structuredClone(fallback);
      return { ...structuredClone(fallback), ...JSON.parse(raw) };
    } catch {
      return structuredClone(fallback);
    }
  }

  function saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function buildActiveCategories() {
    const source = Array.isArray(overrides.categories) && overrides.categories.length
      ? overrides.categories
      : window.BUILTIN_KNOWLEDGE_PACKAGE.categories;
    return source.map(category => structuredClone(category));
  }

  function buildActiveEntries() {
    const map = new Map(window.BUILTIN_KNOWLEDGE_PACKAGE.entries.map(entry => [entry.id, structuredClone(entry)]));
    for (const entry of overrides.entries || []) {
      if (entry && entry.id) map.set(entry.id, structuredClone(entry));
    }
    return [...map.values()].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt), "zh-CN"));
  }

  function currentVersion() {
    return overrides.knowledgeVersion || window.BUILTIN_KNOWLEDGE_PACKAGE.knowledgeVersion;
  }

  function getCategory(id) {
    return activeCategories.find(category => category.id === id) || {
      id: "other", name: "其他", icon: "•", description: ""
    };
  }

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toast(message) {
    els.toastText.textContent = message;
    if (els.toastDialog.open) els.toastDialog.close();
    els.toastDialog.show();
    window.setTimeout(() => {
      if (els.toastDialog.open) els.toastDialog.close();
    }, 2400);
  }

  function navigate(view, options = {}) {
    currentView = view;
    document.querySelectorAll(".view").forEach(node => node.classList.toggle("active", node.id === `view-${view}`));
    document.querySelectorAll("[data-view]").forEach(node => node.classList.toggle("active", node.dataset.view === view));
    const [title, subtitle] = pageInfo[view] || pageInfo.home;
    els.pageTitle.textContent = title;
    els.pageSubtitle.textContent = subtitle;
    renderView(view, options);
    closeDrawer();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderView(view, options = {}) {
    if (view === "home") renderHome();
    if (view === "library") renderLibrary(options.category || "all");
    if (view === "checklists") renderChecklists(options.age || "");
    if (view === "search") renderSearch(options.query || "");
    if (view === "ask") renderAsk(options.question || "");
    if (view === "updates") renderUpdates();
    if (view === "settings") renderSettings();
    els.versionBadge.textContent = `知识库 v${currentVersion()}`;
  }

  function renderHome() {
    const root = document.getElementById("view-home");
    const categoryCounts = activeCategories.map(category => ({
      ...category,
      count: activeEntries.filter(entry => entry.category === category.id).length
    }));
    const scenarioCount = activeEntries.filter(entry => scenarioTips(entry).length).length;
    const recent = activeEntries.slice(0, 4);

    root.innerHTML = `
      <div class="hero">
        <div class="hero-content">
          <span class="eyebrow">通用育儿知识体系 · 本地优先</span>
          <h2>把零散育儿知识，变成随时可用的答案。</h2>
          <p>现有内容已经按主题、适用年龄、可执行方法和风险提示整理。搜索可以直接定位知识点；提问功能会调用相关条目，并显示回答依据。</p>
          <div class="hero-actions">
            <button class="button primary" data-action="hero-ask">开始提问</button>
            <button class="button secondary" data-action="hero-search">搜索知识</button>
          </div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card"><div class="stat-number">${activeEntries.length}</div><div class="stat-label">已整理知识条目</div></div>
        <div class="stat-card"><div class="stat-number">${categoryCounts.filter(item => item.count > 0).length}</div><div class="stat-label">知识分类</div></div>
        <div class="stat-card"><div class="stat-number">${scenarioCount}</div><div class="stat-label">含分情况建议的条目</div></div>
        <div class="stat-card"><div class="stat-number">${currentVersion()}</div><div class="stat-label">当前知识库版本</div></div>
      </div>

      <div class="section-head">
        <div><h2>按主题浏览</h2><p>每条知识均保留实践方法与需要避免的绝对化说法</p></div>
      </div>
      <div class="category-grid">
        ${categoryCounts.map(category => `
          <button class="category-card" data-category="${escapeHtml(category.id)}">
            <div class="category-icon">${category.icon}</div>
            <h3>${escapeHtml(category.name)}</h3>
            <p>${escapeHtml(category.description)}</p>
            <div class="category-count">${category.count} 条知识 →</div>
          </button>
        `).join("")}
      </div>

      <div class="section-head">
        <div><h2>最近整理</h2><p>按更新时间显示</p></div>
        <button class="link-button" data-action="view-all">查看全部</button>
      </div>
      <div class="card-grid">${recent.map(renderKnowledgeCard).join("")}</div>
    `;

    root.querySelector("[data-action='hero-ask']").addEventListener("click", () => navigate("ask"));
    root.querySelector("[data-action='hero-search']").addEventListener("click", () => navigate("search"));
    root.querySelector("[data-action='view-all']").addEventListener("click", () => navigate("library"));
    root.querySelectorAll("[data-category]").forEach(button => button.addEventListener("click", () => navigate("library", { category: button.dataset.category })));
    bindArticleButtons(root);
  }

  function renderLibrary(initialCategory = "all") {
    const root = document.getElementById("view-library");
    root.innerHTML = `
      <div class="toolbar">
        <div class="search-box"><input id="librarySearch" type="search" placeholder="在知识库中筛选……" autocomplete="off" /></div>
        <select id="libraryCategory" aria-label="选择分类">
          <option value="all">全部分类</option>
          ${activeCategories.map(category => `<option value="${category.id}" ${initialCategory === category.id ? "selected" : ""}>${escapeHtml(category.name)}</option>`).join("")}
        </select>
      </div>
      <div class="result-summary" id="librarySummary"></div>
      <div class="card-grid" id="libraryGrid"></div>
    `;
    const input = root.querySelector("#librarySearch");
    const select = root.querySelector("#libraryCategory");
    const grid = root.querySelector("#libraryGrid");
    const summary = root.querySelector("#librarySummary");

    const update = () => {
      const query = input.value.trim();
      const category = select.value;
      const results = activeEntries.filter(entry => (category === "all" || entry.category === category) && (!query || simpleMatch(entry, query)));
      summary.textContent = `显示 ${results.length} 条知识${query ? ` · 搜索“${query}”` : ""}`;
      grid.innerHTML = results.length ? results.map(renderKnowledgeCard).join("") : renderEmpty("没有找到匹配条目", "可以更换关键词或选择其他分类。", "");
      bindArticleButtons(grid);
    };
    input.addEventListener("input", update);
    select.addEventListener("change", update);
    update();
  }

  function renderChecklists(initialAge = "") {
    const root = document.getElementById("view-checklists");
    const all = window.LOOKSEE_CHECKLISTS || [];
    const suggested = initialAge || (settings.childAgeMonths ? [...all].reverse().find(x => settings.childAgeMonths >= x.months)?.id : "") || all[0].id;
    root.innerHTML = '<div class="checklist-layout"><div class="age-tabs">'+all.map(a=>'<button class="age-tab '+(a.id===suggested?'active':'')+'" data-age="'+a.id+'">'+a.label+'</button>').join('')+'</div><div id="checklistPanel"></div></div>';
    const panel=root.querySelector('#checklistPanel');
    const draw=(id)=>{ const a=all.find(x=>x.id===id)||all[0]; const key='lookseeChecklistV1:'+a.id; const saved=loadJson(key,{states:{},notes:'',updatedAt:''}); const done=Object.values(saved.states).filter(Boolean).length; panel.innerHTML='<div class="panel checklist-head"><div><span class="eyebrow">Looksee 发育观察</span><h2>'+escapeHtml(a.label)+'清单</h2><p class="muted">已观察到 '+done+' / '+a.items.length+' 项。清单用于日常观察和与专业人员沟通，不替代标准化筛查或诊断。</p></div><button class="button secondary" id="clearChecklist">清空本页</button></div><div class="checklist-items">'+a.items.map((item,i)=>'<label class="check-item '+(saved.states[i]?'checked':'')+'"><input type="checkbox" data-item="'+i+'" '+(saved.states[i]?'checked':'')+'><span class="checkmark">✓</span><span><b>'+(i+1)+'.</b> '+escapeHtml(item)+'</span></label>').join('')+'</div><div class="panel"><label><b>观察备注</b><textarea id="checkNotes" class="ask-textarea" placeholder="记录日期、场景或想和医生讨论的问题……">'+escapeHtml(saved.notes||'')+'</textarea></label><p class="muted small">如出现已掌握能力倒退、明显左右不对称，或你持续担忧，请及时咨询医生或发育专业人员。</p></div>'; panel.querySelectorAll('[data-item]').forEach(cb=>cb.addEventListener('change',()=>{saved.states[cb.dataset.item]=cb.checked;saved.updatedAt=new Date().toISOString();saveJson(key,saved);draw(a.id);})); panel.querySelector('#checkNotes').addEventListener('input',e=>{saved.notes=e.target.value;saved.updatedAt=new Date().toISOString();saveJson(key,saved);}); panel.querySelector('#clearChecklist').addEventListener('click',()=>{localStorage.removeItem(key);draw(a.id);}); root.querySelectorAll('.age-tab').forEach(b=>b.classList.toggle('active',b.dataset.age===a.id)); };
    root.querySelectorAll('[data-age]').forEach(b=>b.addEventListener('click',()=>draw(b.dataset.age))); draw(suggested);
  }

  function renderSearch(initialQuery = "") {
    const root = document.getElementById("view-search");
    root.innerHTML = `
      <div class="panel">
        <div class="search-box"><input id="globalSearch" type="search" value="${escapeHtml(initialQuery)}" placeholder="例如：分离焦虑、打人、绘本、户外近视……" autocomplete="off" /></div>
        <div class="example-chips">
          ${["情绪崩溃", "入园告别", "轮流等待", "绘本提问", "数学分类", "户外近视"].map(item => `<button class="chip" data-query="${item}">${item}</button>`).join("")}
        </div>
      </div>
      <div class="section-head"><div><h2>搜索结果</h2><p id="searchSummary">输入关键词后开始搜索</p></div></div>
      <div class="card-grid" id="searchGrid"></div>
    `;

    const input = root.querySelector("#globalSearch");
    const grid = root.querySelector("#searchGrid");
    const summary = root.querySelector("#searchSummary");

    const update = () => {
      const query = input.value.trim();
      if (!query) {
        summary.textContent = "输入关键词后开始搜索";
        grid.innerHTML = renderEmpty("支持全文搜索", "会同时搜索标题、分类、标签、原则、方法和注意事项。", "⌕");
        return;
      }
      const results = rankEntries(query).filter(item => item.score > 0).slice(0, 20);
      summary.textContent = `找到 ${results.length} 条相关知识，按相关度排序`;
      grid.innerHTML = results.length ? results.map(item => renderKnowledgeCard(item.entry, item.score)).join("") : renderEmpty("暂未找到相关知识", "当前知识库可能尚未覆盖这个主题。", "");
      bindArticleButtons(grid);
    };
    input.addEventListener("input", update);
    root.querySelectorAll("[data-query]").forEach(button => button.addEventListener("click", () => {
      input.value = button.dataset.query;
      input.dispatchEvent(new Event("input"));
    }));
    update();
    window.setTimeout(() => input.focus(), 50);
  }

  function renderAsk(initialQuestion = "") {
    const root = document.getElementById("view-ask");
    root.innerHTML = `
      <div class="ask-layout">
        <div class="panel">
          <span class="eyebrow">仅调用已收录知识</span>
          <h2 style="margin-top:16px">描述你遇到的具体情况</h2>
          <p class="muted">问题越具体，调取的条目越准确。回答会列出来源知识点，不会把知识库没有的内容伪装成结论。</p>
          <textarea id="questionInput" class="ask-textarea" placeholder="例如：宝宝想拿别人手里的玩具，被制止后一直哭，我应该怎么回应？">${escapeHtml(initialQuestion)}</textarea>
          <div class="example-chips">
            ${[
              "孩子被制止后一直哭怎么办？",
              "入园时告别应该怎么说？",
              "孩子主动帮忙却把水洒了怎么办？",
              "一岁半怎么做数学启蒙？"
            ].map(item => `<button class="chip" data-question="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join("")}
          </div>
          <button class="button primary" id="askButton">调取知识并回答</button>
        </div>
        <div class="panel answer-box" id="answerBox">
          <div class="answer-placeholder"><div><div style="font-size:34px;margin-bottom:12px">?</div><strong>回答会显示在这里</strong><p>系统会检索最相关的知识条目，再组合核心判断、具体做法和注意事项。</p></div></div>
        </div>
      </div>
    `;

    const input = root.querySelector("#questionInput");
    const answerBox = root.querySelector("#answerBox");
    const ask = () => {
      const question = input.value.trim();
      if (!question) {
        toast("请先输入问题");
        input.focus();
        return;
      }
      answerBox.innerHTML = generateAnswerHtml(question);
      bindArticleButtons(answerBox);
    };
    root.querySelector("#askButton").addEventListener("click", ask);
    input.addEventListener("keydown", event => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") ask();
    });
    root.querySelectorAll("[data-question]").forEach(button => button.addEventListener("click", () => {
      input.value = button.dataset.question;
      ask();
    }));
    if (initialQuestion) ask();
  }

  function renderUpdates() {
    const root = document.getElementById("view-updates");
    root.innerHTML = `
      <div class="update-grid">
        <div class="update-card">
          <span class="eyebrow">推荐更新方式</span>
          <h3 style="margin-top:16px">导入知识更新包</h3>
          <p>以后你把新知识发给我，我可以继续整理为同一数据结构。应用导入新的 JSON 更新包后会自动合并，不需要重新安装。</p>
          <div class="sync-status">当前版本：<strong>${currentVersion()}</strong><br>条目数量：<strong>${activeEntries.length}</strong><br>最后同步：<strong>${settings.lastSyncAt ? formatDateTime(settings.lastSyncAt) : "尚未进行远程同步"}</strong></div>
          <div style="display:flex;gap:9px;flex-wrap:wrap">
            <button class="button primary" id="importButton">导入更新包</button>
            <button class="button secondary" id="exportButton">导出完整知识库</button>
          </div>
        </div>

        <div class="update-card">
          <span class="eyebrow">可选</span>
          <h3 style="margin-top:16px">远程自动同步</h3>
          <p>设置一个公开的 JSON 地址后，应用可在打开时检查新版本。这个地址可以放在 GitHub Pages、静态网站或你自己的云端存储中。</p>
          <div class="field">
            <label for="remoteUrlInput">远程知识库地址</label>
            <input id="remoteUrlInput" type="url" value="${escapeHtml(settings.remoteUrl)}" placeholder="https://example.com/knowledge.json" />
          </div>
          <label style="display:flex;align-items:center;gap:8px;margin:13px 0"><input id="autoSyncInput" type="checkbox" ${settings.autoSync ? "checked" : ""}> 打开应用时自动检查更新</label>
          <div style="display:flex;gap:9px;flex-wrap:wrap">
            <button class="button primary" id="syncNowButton">立即同步</button>
            <button class="button secondary" id="saveSyncButton">保存设置</button>
          </div>
        </div>

        <div class="update-card">
          <h3>更新流程</h3>
          <div class="steps">
            <div class="step">把新的育儿文章、截图或笔记发给我。</div>
            <div class="step">新内容会被分类、去重、修正绝对化说法，并生成更新包。</div>
            <div class="step">在这里导入更新包，知识搜索和问答立即使用新内容。</div>
          </div>
        </div>

        <div class="update-card">
          <h3>本地数据管理</h3>
          <p>导出的文件包含内置知识和后来导入的全部更新，可用于备份或迁移到另一台设备。</p>
          <div style="display:flex;gap:9px;flex-wrap:wrap">
            <button class="button ghost" id="backupButton">导出备份</button>
            <button class="button danger" id="resetButton">移除后续更新</button>
          </div>
        </div>
      </div>
    `;

    root.querySelector("#importButton").addEventListener("click", () => els.importFileInput.click());
    root.querySelector("#exportButton").addEventListener("click", exportKnowledgePackage);
    root.querySelector("#backupButton").addEventListener("click", exportKnowledgePackage);
    root.querySelector("#saveSyncButton").addEventListener("click", () => {
      settings.remoteUrl = root.querySelector("#remoteUrlInput").value.trim();
      settings.autoSync = root.querySelector("#autoSyncInput").checked;
      saveJson(SETTINGS_KEY, settings);
      toast("同步设置已保存");
    });
    root.querySelector("#syncNowButton").addEventListener("click", async () => {
      settings.remoteUrl = root.querySelector("#remoteUrlInput").value.trim();
      settings.autoSync = root.querySelector("#autoSyncInput").checked;
      saveJson(SETTINGS_KEY, settings);
      await syncFromRemote(true);
    });
    root.querySelector("#resetButton").addEventListener("click", () => {
      const confirmed = window.confirm("确定移除所有后续导入的更新，恢复到应用内置知识库吗？");
      if (!confirmed) return;
      overrides = { knowledgeVersion: "", generatedAt: "", categories: [], entries: [] };
      saveJson(OVERRIDES_KEY, overrides);
      activeCategories = buildActiveCategories();
      activeEntries = buildActiveEntries();
      toast("已恢复内置知识库");
      renderUpdates();
    });
  }

  function renderSettings() {
    const root = document.getElementById("view-settings");
    root.innerHTML = `
      <div class="panel">
        <h2>孩子资料</h2>
        <p class="muted">问答会根据月龄优先选择合适的分龄建议。资料只保存在当前设备。</p>
        <div class="form-grid">
          <div class="field">
            <label for="childName">称呼</label>
            <input id="childName" value="${escapeHtml(settings.childName)}" />
          </div>
          <div class="field">
            <label for="childAge">当前月龄</label>
            <input id="childAge" type="number" min="0" max="216" value="${Number(settings.childAgeMonths) || 0}" />
          </div>
        </div>
        <div style="margin-top:18px"><button class="button primary" id="saveSettings">保存设置</button></div>
      </div>

      <div class="panel" style="margin-top:16px">
        <h3>应用说明</h3>
        <p class="muted">当前问答是本地检索式问答：它只使用已收录知识，不依赖外部人工智能服务，因此可离线运行，也不会把问题上传到服务器。它适合检索和整合通用育儿知识，但不替代医生、心理师或其他专业人员的评估。</p>
      </div>
    `;
    root.querySelector("#saveSettings").addEventListener("click", () => {
      settings.childName = root.querySelector("#childName").value.trim() || "孩子";
      settings.childAgeMonths = Math.max(0, Number(root.querySelector("#childAge").value) || 0);
      saveJson(SETTINGS_KEY, settings);
      toast("设置已保存");
    });
  }

  function renderKnowledgeCard(entry, score = null) {
    const category = getCategory(entry.category);
    return `
      <article class="knowledge-card">
        <div class="card-meta">
          <span class="pill accent">${category.icon} ${escapeHtml(category.name)}</span>
          <span class="pill">${escapeHtml(entry.ageRange || "不限年龄")}</span>
          ${score !== null ? `<span class="pill">相关度 ${Math.min(99, Math.round(score))}</span>` : ""}
        </div>
        <h3>${escapeHtml(entry.title)}</h3>
        <p>${escapeHtml(entry.summary)}</p>
        <div class="tags">${(entry.tags || []).slice(0, 5).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
        <div class="card-footer">
          <span class="muted small">更新 ${escapeHtml(entry.updatedAt || "")}</span>
          <button class="link-button" data-article-id="${escapeHtml(entry.id)}">查看详情 →</button>
        </div>
      </article>
    `;
  }

  function renderEmpty(title, description, icon) {
    return `<div class="empty-state" style="grid-column:1/-1">${icon ? `<div style="font-size:30px;margin-bottom:10px">${icon}</div>` : ""}<strong>${escapeHtml(title)}</strong>${escapeHtml(description)}</div>`;
  }

  function openArticle(id) {
    const entry = activeEntries.find(item => item.id === id);
    if (!entry) return;
    const category = getCategory(entry.category);
    els.articleDialogContent.innerHTML = `
      <article class="article-body">
        <div class="card-meta"><span class="pill accent">${category.icon} ${escapeHtml(category.name)}</span><span class="pill">${escapeHtml(entry.ageRange || "不限年龄")}</span></div>
        <h2>${escapeHtml(entry.title)}</h2>
        <p class="article-summary">${escapeHtml(entry.summary)}</p>
        ${renderDetailSection("核心原则", entry.principles)}
        ${(entry.ageTips || []).length ? `<h3>分龄参考</h3><div class="age-tip-grid">${entry.ageTips.map(group => `<div class="age-tip"><strong>${escapeHtml(group.label)}</strong><ul>${(group.items || []).map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>`).join("")}</div>` : ""}
        ${renderDetailSection("可执行做法", entry.practices)}
        ${(entry.cautions || []).length ? `<h3>需要注意</h3><div class="caution-box"><ul>${entry.cautions.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : ""}
        ${scenarioTips(entry).length ? `<h3>不同情况怎么用</h3><div class="baby-tips-box"><ul>${scenarioTips(entry).map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : ""}
        <p class="muted small" style="margin-top:24px">条目 ID：${escapeHtml(entry.id)} · 更新日期：${escapeHtml(entry.updatedAt || "")}</p>
      </article>
    `;
    els.articleDialog.showModal();
  }

  function renderDetailSection(title, items = []) {
    if (!items.length) return "";
    return `<h3>${escapeHtml(title)}</h3><ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }

  function bindArticleButtons(root) {
    root.querySelectorAll("[data-article-id]").forEach(button => button.addEventListener("click", () => openArticle(button.dataset.articleId)));
  }

  function entryText(entry) {
    return [
      entry.title,
      getCategory(entry.category).name,
      entry.ageRange,
      ...(entry.tags || []),
      entry.summary,
      ...(entry.principles || []),
      ...(entry.practices || []),
      ...(entry.cautions || []),
      ...scenarioTips(entry),
      ...((entry.ageTips || []).flatMap(group => [group.label, ...(group.items || [])]))
    ].join(" ");
  }

  function scenarioTips(entry) {
    if (Array.isArray(entry.scenarioTips)) return entry.scenarioTips;
    if (Array.isArray(entry.babyTips)) return entry.babyTips;
    return [];
  }

  function normalizeText(text) {
    return String(text || "")
      .toLowerCase()
      .replaceAll("粘液质", "黏液质")
      .replaceAll("粘液型", "黏液型")
      .replace(/[\s\p{P}\p{S}]+/gu, "");
  }

  function queryTerms(query) {
    const clean = normalizeText(query);
    const terms = new Set();
    const latin = String(query).toLowerCase().match(/[a-z0-9]+/g) || [];
    latin.forEach(term => terms.add(term));
    const chinese = clean.replace(/[a-z0-9]/g, "");
    for (let size = 2; size <= 4; size += 1) {
      for (let i = 0; i <= chinese.length - size; i += 1) terms.add(chinese.slice(i, i + size));
    }
    const aliases = {
      "幼儿园": ["入园", "分离焦虑", "daycare"],
      "托儿所": ["入园", "分离焦虑", "daycare"],
      "哭": ["哭闹", "情绪调节", "共同调节"],
      "发脾气": ["生气", "情绪调节", "边界"],
      "打人": ["情绪调节", "伤害行为", "边界"],
      "抢玩具": ["轮流", "等待", "规则", "情绪调节"],
      "不听话": ["规则", "执行功能", "情绪调节"],
      "看书": ["绘本", "亲子阅读"],
      "英语": ["英语启蒙", "语感"],
      "数数": ["数学启蒙", "计数", "一一对应"],
      "分类": ["数学启蒙", "数据素养"],
      "散步": ["户外", "自然教育"],
      "近视": ["户外", "视力"],
      "气质类型": ["九大气质维度", "容易型", "困难型", "慢热型", "四气质", "胆汁质", "多血质", "黏液质", "抑郁质"],
      "胆汁质": ["四气质", "反应强度", "坚持性"],
      "多血质": ["四气质", "活动水平", "接近新事物"],
      "黏液质": ["四气质", "适应速度", "启动时间"],
      "粘液质": ["四气质", "黏液质", "适应速度", "启动时间"],
      "抑郁质": ["四气质", "敏感度", "谨慎"],
      "难养型": ["困难型", "九大气质维度", "良好适配"],
      "易养型": ["容易型", "九大气质维度", "良好适配"],
      "帮忙": ["家务", "自主性", "修复"],
      "洒水": ["家务", "出错", "修复"]
    };
    for (const [key, values] of Object.entries(aliases)) {
      if (String(query).includes(key)) values.forEach(value => terms.add(normalizeText(value)));
    }
    return [...terms].filter(term => term.length >= 2);
  }

  function scoreEntry(entry, query) {
    const terms = queryTerms(query);
    if (!terms.length) return 0;
    const title = normalizeText(entry.title);
    const tags = normalizeText((entry.tags || []).join(" "));
    const category = normalizeText(getCategory(entry.category).name);
    const summary = normalizeText(entry.summary);
    const body = normalizeText(entryText(entry));
    let score = 0;
    for (const term of terms) {
      if (title.includes(term)) score += 10 + term.length;
      if (tags.includes(term)) score += 9 + term.length;
      if (category.includes(term)) score += 7;
      if (summary.includes(term)) score += 4;
      if (body.includes(term)) score += 1.4;
    }
    const full = normalizeText(query);
    if (full.length >= 2 && body.includes(full)) score += 30;
    return score;
  }

  function rankEntries(query) {
    return activeEntries
      .map(entry => ({ entry, score: scoreEntry(entry, query) }))
      .sort((a, b) => b.score - a.score || String(b.entry.updatedAt).localeCompare(String(a.entry.updatedAt)));
  }

  function simpleMatch(entry, query) {
    const body = normalizeText(entryText(entry));
    const full = normalizeText(query);
    if (body.includes(full)) return true;
    return queryTerms(query).some(term => body.includes(term));
  }

  function ageAppropriateItems(entry) {
    const groups = entry.ageTips || [];
    if (!groups.length) return [];
    const age = Number(settings.childAgeMonths) || 0;
    const targetIndex = age < 12 ? 0 : age < 24 ? 1 : age < 36 ? 2 : age < 48 ? 3 : groups.length - 1;
    return (groups[Math.min(targetIndex, groups.length - 1)]?.items || []).slice(0, 3);
  }

  function unique(items) {
    return [...new Set(items.filter(Boolean))];
  }

  function generateAnswerHtml(question) {
    const ranked = rankEntries(question);
    const topScore = ranked[0]?.score || 0;
    const selected = ranked.filter(item => item.score > Math.max(3, topScore * 0.26)).slice(0, 3);
    if (!selected.length || topScore < 4) {
      return `
        <div class="answer-placeholder">
          <div><strong>现有知识库没有足够匹配内容</strong><p>可以换一个更具体的关键词，或先把这个主题的新资料加入知识库。</p></div>
        </div>
      `;
    }

    const entries = selected.map(item => item.entry);
    const core = entries.map(entry => entry.summary).slice(0, 3);
    const ageItems = entries.flatMap(ageAppropriateItems);
    const applicable = entries.flatMap(entry => scenarioTips(entry));
    const actions = unique([
      ...ageItems,
      ...applicable,
      ...entries.flatMap(entry => (entry.practices || []).slice(0, 2))
    ]).slice(0, 7);
    const cautions = unique(entries.flatMap(entry => (entry.cautions || []).slice(0, 2))).slice(0, 5);
    const confidence = topScore > 70 ? "匹配度较高" : topScore > 30 ? "匹配度中等" : "初步匹配";

    return `
      <div class="card-meta"><span class="confidence">${confidence}</span><span class="pill">调用 ${entries.length} 条知识</span></div>
      <h2>基于现有知识库的回答</h2>
      <div class="answer-section">
        <h4>核心判断</h4>
        ${core.map(item => `<p>${escapeHtml(item)}</p>`).join("")}
      </div>
      <div class="answer-section">
        <h4>可以这样处理</h4>
        <ul>${actions.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
      ${cautions.length ? `<div class="answer-section"><h4>需要注意</h4><ul>${cautions.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : ""}
      <div class="answer-section">
        <h4>本次调用的知识点</h4>
        <div class="source-list">${selected.map(item => `<button class="source-item" data-article-id="${escapeHtml(item.entry.id)}"><strong>${escapeHtml(item.entry.title)}</strong><br><span class="muted small">相关度得分 ${Math.round(item.score)}</span></button>`).join("")}</div>
      </div>
      <div class="disclaimer">此回答只整合当前个人知识库，不会补充库外事实。涉及持续严重的健康、发育、安全或心理问题时，需要专业评估。</div>
    `;
  }

  function validatePackage(data) {
    if (!data || typeof data !== "object") throw new Error("文件内容不是有效对象");
    if (!Array.isArray(data.entries)) throw new Error("更新包缺少 entries 数组");
    for (const entry of data.entries) {
      if (!entry.id || !entry.title || !entry.category || !entry.summary) {
        throw new Error("至少有一条知识缺少 id、title、category 或 summary");
      }
    }
  }

  function importPackage(data, source = "文件") {
    validatePackage(data);
    const map = new Map((overrides.entries || []).map(entry => [entry.id, entry]));
    for (const entry of data.entries) map.set(entry.id, entry);
    overrides = {
      knowledgeVersion: data.knowledgeVersion || overrides.knowledgeVersion || currentVersion(),
      generatedAt: data.generatedAt || new Date().toISOString(),
      categories: Array.isArray(data.categories) && data.categories.length ? data.categories : (overrides.categories || activeCategories),
      entries: [...map.values()]
    };
    saveJson(OVERRIDES_KEY, overrides);
    activeCategories = buildActiveCategories();
    activeEntries = buildActiveEntries();
    settings.lastSyncAt = new Date().toISOString();
    saveJson(SETTINGS_KEY, settings);
    toast(`${source}更新成功：已合并 ${data.entries.length} 条知识`);
    renderView(currentView);
  }

  function exportKnowledgePackage() {
    const data = {
      schemaVersion: 1,
      knowledgeVersion: currentVersion(),
      generatedAt: new Date().toISOString(),
      categories: activeCategories,
      entries: activeEntries
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `育儿知识库-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast("知识库已导出");
  }

  async function syncFromRemote(showFeedback = false) {
    const url = settings.remoteUrl?.trim();
    if (!url) {
      if (showFeedback) toast("请先填写远程知识库地址");
      return;
    }
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      validatePackage(data);
      importPackage(data, "远程");
    } catch (error) {
      if (showFeedback) toast(`同步失败：${error.message}`);
      console.error("Remote sync failed", error);
    }
  }

  function formatDateTime(value) {
    try {
      return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
    } catch {
      return value;
    }
  }

  function openDrawer() {
    els.sidebar.classList.add("open");
    els.drawerBackdrop.classList.add("active");
  }

  function closeDrawer() {
    els.sidebar.classList.remove("open");
    els.drawerBackdrop.classList.remove("active");
  }

  document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.view)));
  els.dialogClose.addEventListener("click", () => els.articleDialog.close());
  els.articleDialog.addEventListener("click", event => {
    if (event.target === els.articleDialog) els.articleDialog.close();
  });
  els.mobileMenuButton.addEventListener("click", openDrawer);
  els.drawerBackdrop.addEventListener("click", closeDrawer);
  els.importFileInput.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      importPackage(data);
    } catch (error) {
      toast(`导入失败：${error.message}`);
    } finally {
      event.target.value = "";
    }
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(console.error));
  }

  navigate("home");
  if (settings.autoSync && settings.remoteUrl) syncFromRemote(false);
})();
