/**
 * 메인 애플리케이션 진입점 및 뷰 오케스트레이터 (site_new/js/app.js)
 * - 게이트 초기화
 * - 지형도 데이터 로드 및 통계 지표 반영
 * - 제품 중심 지형도(view=products) 및 기업 디렉터리(view=companies) 렌더링
 * - 5개 공통 필터축 (기술, 산업·업무, 구동형태, 회원사, 조직유형) 바인딩
 * - 기술 도메인 표시명 UI 오버라이드 및 미분류 기업 분리 처리
 */

import { initGate } from "./gate.js";
import {
  loadLandscapeData,
  getChoseong,
  getOrgInitial,
  sortProducts,
  sortDisplayEntries,
  getTechnologyLabel
} from "./landscape.js";
import { FilterManager } from "./filter.js";
import { DetailPanel } from "./panel.js";
import { AdminManager } from "./admin.js";
import { CONTACT_CONFIG } from "./config.js";

class App {
  constructor() {
    this.data = null;
    this.filterManager = null;
    this.panel = null;

    // DOM 참조
    this.tabProducts = document.getElementById("tab-products");
    this.tabIndustry = document.getElementById("tab-industry");
    this.tabCompanies = document.getElementById("tab-companies");

    this.viewProducts = document.getElementById("view-products");
    this.viewIndustry = document.getElementById("view-industry");
    this.viewCompanies = document.getElementById("view-companies");
    this.viewEmpty = document.getElementById("view-empty");

    this.searchInput = document.getElementById("search-input");
    this.searchClearBtn = document.getElementById("search-clear-btn");
    this.filterToggleBtn = document.getElementById("filter-toggle-btn");
    this.filterResetBtn = document.getElementById("filter-reset-btn");
    this.emptyResetBtn = document.getElementById("empty-reset-btn");
    this.filterCountBadge = document.getElementById("filter-count-badge");
    this.resultsCountText = document.getElementById("results-count-text");
    this.selectedFiltersDisplay = document.getElementById("selected-filters-display");

    // 표시 방식 (간략히 'compact' / 자세히 'detailed'), 기본값: 'compact'
    let savedMode = "compact";
    try {
      savedMode = localStorage.getItem("itchosun_display_mode") || "compact";
    } catch (e) {
      savedMode = "compact";
    }
    this.displayMode = savedMode;
    this.btnModeCompact = document.getElementById("btn-mode-compact");
    this.btnModeDetailed = document.getElementById("btn-mode-detailed");

    // 좌측 필터 Drawer DOM 참조
    this.filterDrawer = document.getElementById("filter-drawer");
    this.filterDrawerBackdrop = document.getElementById("filter-drawer-backdrop");
    this.filterDrawerCloseBtn = document.getElementById("filter-drawer-close-btn");
    this.filterDrawerResetBtn = document.getElementById("filter-drawer-reset-btn");
    this.filterDrawerApplyBtn = document.getElementById("filter-drawer-apply-btn");
    this.filterDrawerCountBadge = document.getElementById("filter-drawer-count-badge");
    this.filterDrawerResultsCount = document.getElementById("filter-drawer-results-count");

    this.unclassifiedSearchSec = document.getElementById("unclassified-search-section");
    this.unclassifiedSearchGrid = document.getElementById("unclassified-search-grid");

    this.unclassifiedAccordionBtn = document.getElementById("unclassified-accordion-btn");
    this.unclassifiedAccordionBody = document.getElementById("unclassified-accordion-body");
    this.unclassifiedOrgsGrid = document.getElementById("unclassified-orgs-grid");
    this.unclassifiedCountBadge = document.getElementById("unclassified-count-badge");
    this.scrollTopBtn = document.getElementById("scroll-top-btn");
  }

  async start() {
    try {
      // 1. 시연용 비밀번호 게이트 통과 대기
      await initGate();

      // 2. 데이터 로드 및 초기화
      this.data = await loadLandscapeData();
      this.panel = new DetailPanel(this.data);
      this.filterManager = new FilterManager(this.data, () => this.render());
      this.adminManager = new AdminManager((isAdmin) => {
        this.handleAdminModeChange(isAdmin);
      });

      // 3. 헤더 통계 지표 및 푸터 문의 정보 바인딩
      this.renderHeroStats();
      this.renderFooterContact();

      // 4. 4개 필터축 체크박스 목록 생성 (회원사 필터 제외)
      this.buildFilterCheckboxes();

      // 5. 하단 미분류 기업 아코디언 채우기

      // 6. 이벤트 리스너 바인딩
      this.bindEvents();

      // 7. 초기 탭, 표시 모드 및 뷰 렌더링
      this.updateActiveTabUI();
      this.updateDisplayModeUI();
      this.render();

    } catch (err) {
      console.error("애플리케이션 초기화 오류:", err);
      const main = document.querySelector(".main-content");
      if (main) {
        main.innerHTML = `<div class="container" style="padding: 40px; text-align: center; color: #EF4444;">
          <h3>데이터를 불러오는 중 오류가 발생했습니다.</h3>
          <p>${err.message}</p>
        </div>`;
      }
    }
  }

  renderFooterContact() {
    const el = document.getElementById("footer-contact");
    if (!el || !CONTACT_CONFIG) return;

    el.textContent = "";
    if (CONTACT_CONFIG.prefixText) {
      el.appendChild(document.createTextNode(CONTACT_CONFIG.prefixText));
    }
    if (CONTACT_CONFIG.linkUrl && CONTACT_CONFIG.linkText) {
      const a = document.createElement("a");
      a.href = CONTACT_CONFIG.linkUrl;
      a.textContent = CONTACT_CONFIG.linkText;
      if (/^https?:\/\//i.test(CONTACT_CONFIG.linkUrl)) {
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      }
      el.appendChild(a);
    }
    if (CONTACT_CONFIG.suffixText) {
      el.appendChild(document.createTextNode(CONTACT_CONFIG.suffixText));
    }
  }

  renderHeroStats() {
    const s = this.data.stats;
    document.getElementById("stat-total-orgs").textContent = `${s.total_organizations}개사`;
    document.getElementById("stat-total-prds").textContent = `${s.total_products}개`;
    document.getElementById("stat-classified-orgs").textContent = `${s.classified_organizations}개사`;
    const unclassEl = document.getElementById("stat-unclassified-orgs");
    if (unclassEl) {
      unclassEl.textContent = `${s.unclassified_organizations}곳`;
    }
    if (this.unclassifiedCountBadge) {
      this.unclassifiedCountBadge.textContent = `${s.unclassified_organizations}곳`;
    }
  }

  buildFilterCheckboxes() {
    // 1. 기술 영역
    const techContainer = document.getElementById("filter-list-tech");
    if (techContainer) {
      techContainer.innerHTML = "";
      this.data.taxonomies.technology_domains.forEach(tech => {
        const label = getTechnologyLabel(tech.code, tech.label);
        techContainer.appendChild(this.createCheckboxItem("tech", tech.code, label));
      });
    }

    // 2. 산업·업무 영역
    const industryContainer = document.getElementById("filter-list-industry");
    if (industryContainer) {
      industryContainer.innerHTML = "";
      this.data.taxonomies.business_domains.forEach(biz => {
        industryContainer.appendChild(this.createCheckboxItem("industry", biz.code, biz.label));
      });
    }

    // 3. 에이전트 구동 형태
    const opContainer = document.getElementById("filter-list-operating");
    if (opContainer) {
      opContainer.innerHTML = "";
      this.data.taxonomies.operating_models.forEach(model => {
        opContainer.appendChild(this.createCheckboxItem("model", model.code, model.label));
      });
    }

    // 4. 조직 유형
    const typeContainer = document.getElementById("filter-list-type");
    if (typeContainer) {
      typeContainer.innerHTML = "";
      const orgTypes = Array.from(
        new Set(this.data.organizations.map(o => o.org_type).filter(Boolean))
      ).sort();
      orgTypes.forEach(t => {
        typeContainer.appendChild(this.createCheckboxItem("type", t, t));
      });
    }
  }

  createCheckboxItem(axis, value, label) {
    const labelEl = document.createElement("label");
    labelEl.className = "filter-checkbox-item";

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.dataset.axis = axis;
    chk.value = value;

    const targetSet = this.filterManager.getSetByAxis(axis);
    if (targetSet && targetSet.has(value)) {
      chk.checked = true;
    }

    chk.addEventListener("change", () => {
      this.filterManager.toggleFilter(axis, value);
    });

    const span = document.createElement("span");
    span.textContent = label;

    labelEl.appendChild(chk);
    labelEl.appendChild(span);
    return labelEl;
  }

  bindEvents() {
    // 탭 클릭
    if (this.tabProducts) {
      this.tabProducts.addEventListener("click", () => {
        this.filterManager.setView("products", true);
        this.updateActiveTabUI();
      });
    }

    if (this.tabIndustry) {
      this.tabIndustry.addEventListener("click", () => {
        this.filterManager.setView("industry", true);
        this.updateActiveTabUI();
      });
    }

    if (this.tabCompanies) {
      this.tabCompanies.addEventListener("click", () => {
        this.filterManager.setView("companies", true);
        this.updateActiveTabUI();
      });
    }

    // 탭 키보드 네비게이션 (WAI-ARIA tabs)
    const tabs = [this.tabProducts, this.tabIndustry, this.tabCompanies].filter(Boolean);
    tabs.forEach((tab, index) => {
      tab.addEventListener("keydown", (e) => {
        let targetIndex = -1;
        if (e.key === "ArrowRight") {
          targetIndex = (index + 1) % tabs.length;
        } else if (e.key === "ArrowLeft") {
          targetIndex = (index - 1 + tabs.length) % tabs.length;
        } else if (e.key === "Home") {
          targetIndex = 0;
        } else if (e.key === "End") {
          targetIndex = tabs.length - 1;
        }
        if (targetIndex >= 0) {
          e.preventDefault();
          tabs[targetIndex].focus();
          tabs[targetIndex].click();
        }
      });
    });

    // 브라우저 뒤로가기 / 앞으로가기 지원 (popstate)
    window.addEventListener("popstate", () => {
      this.filterManager.initFromUrl();
      this.searchInput.value = this.filterManager.searchQuery;
      this.updateSearchClearVisibility();
      this.updateActiveTabUI();
      this.render();
    });

    // 검색창 입력
    this.searchInput.value = this.filterManager.searchQuery;
    this.updateSearchClearVisibility();

    this.searchInput.addEventListener("input", (e) => {
      const q = e.target.value;
      this.updateSearchClearVisibility();
      this.filterManager.setSearchQuery(q);
    });

    this.searchClearBtn.addEventListener("click", () => {
      this.searchInput.value = "";
      this.updateSearchClearVisibility();
      this.filterManager.setSearchQuery("");
      this.searchInput.focus();
    });

    // 필터 토글 버튼: 좌측 Drawer 열기
    if (this.filterToggleBtn) {
      this.filterToggleBtn.addEventListener("click", () => {
        this.openFilterDrawer();
      });
    }

    // 좌측 필터 Drawer 내부 닫기 버튼 및 백드롭
    if (this.filterDrawerCloseBtn) {
      this.filterDrawerCloseBtn.addEventListener("click", () => this.closeFilterDrawer());
    }
    if (this.filterDrawerBackdrop) {
      this.filterDrawerBackdrop.addEventListener("click", () => this.closeFilterDrawer());
    }
    if (this.filterDrawerApplyBtn) {
      this.filterDrawerApplyBtn.addEventListener("click", () => this.closeFilterDrawer());
    }

    // ESC 키로 필터 Drawer 닫기
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.filterDrawer && this.filterDrawer.classList.contains("active")) {
        e.preventDefault();
        this.closeFilterDrawer();
      }
    });

    // 필터 초기화 버튼들
    const resetHandler = () => {
      this.filterManager.resetAll();
      this.searchInput.value = "";
      this.updateSearchClearVisibility();
      this.syncCheckboxesUI();
    };
    this.filterResetBtn.addEventListener("click", resetHandler);
    if (this.filterDrawerResetBtn) {
      this.filterDrawerResetBtn.addEventListener("click", resetHandler);
    }
    if (this.emptyResetBtn) {
      this.emptyResetBtn.addEventListener("click", resetHandler);
    }

    // 표시 방식 (간략히 / 자세히) 전환 버튼
    if (this.btnModeCompact) {
      this.btnModeCompact.addEventListener("click", () => {
        this.setDisplayMode("compact");
      });
    }
    if (this.btnModeDetailed) {
      this.btnModeDetailed.addEventListener("click", () => {
        this.setDisplayMode("detailed");
      });
    }

    // 미분류 기업 아코디언 토글
    if (this.unclassifiedAccordionBtn) {
      this.unclassifiedAccordionBtn.addEventListener("click", () => {
        const isExpanded = this.unclassifiedAccordionBtn.getAttribute("aria-expanded") === "true";
        const willExpand = !isExpanded;
        this.unclassifiedAccordionBtn.setAttribute("aria-expanded", String(willExpand));
        this.unclassifiedAccordionBody.style.display = willExpand ? "block" : "none";
        this.unclassifiedAccordionBody.setAttribute("aria-hidden", String(!willExpand));
      });
    }

    // 최상단 이동 플로팅 버튼
    if (this.scrollTopBtn) {
      const updateScrollTopVisibility = () => {
        const isScrolled = (window.scrollY || window.pageYOffset || 0) >= 300;
        this.scrollTopBtn.classList.toggle("visible", isScrolled);
      };

      window.addEventListener("scroll", updateScrollTopVisibility, { passive: true });
      updateScrollTopVisibility();

      this.scrollTopBtn.addEventListener("click", () => {
        const prefersReducedMotion =
          typeof window.matchMedia === "function" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({
          top: 0,
          behavior: prefersReducedMotion ? "auto" : "smooth"
        });
      });
    }
  }

  setDisplayMode(mode) {
    if (this.displayMode === mode) return;
    this.displayMode = mode;
    try {
      localStorage.setItem("itchosun_display_mode", mode);
    } catch (e) {
      // 로컬 스토리지 예외 대비
    }
    this.updateDisplayModeUI();
    this.render();
  }

  updateDisplayModeUI() {
    const isCompact = this.displayMode === "compact";
    if (this.btnModeCompact) {
      this.btnModeCompact.classList.toggle("active", isCompact);
      this.btnModeCompact.setAttribute("aria-pressed", String(isCompact));
    }
    if (this.btnModeDetailed) {
      this.btnModeDetailed.classList.toggle("active", !isCompact);
      this.btnModeDetailed.setAttribute("aria-pressed", String(!isCompact));
    }
  }

  /**
   * 설문(1차·2차·통합) 응답 여부 판별 (제품 등록 여부 제외)
   */
  hasSurveyResponse(org) {
    return Boolean(org && (org.has_survey1 || org.has_survey2 || org.has_integrated_survey));
  }

  /**
   * 간략히 보기 전용 조직명 칩(버튼) 요소 생성
   * - 설명·제품명·제품 설명·태그·이니셜 배지 없이 조직 이름만 표시
   * - 1차·2차·통합 설문 응답 기업에는 왼쪽 컬러 테두리 클래스 적용
   * - 클릭 및 키보드 선택 시 상세 drawer 열기
   */
  createCompactOrgChip(org) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = this.hasSurveyResponse(org)
      ? "compact-org-chip has-survey"
      : "compact-org-chip";
    chip.textContent = org.compact_display_name || org.display_name || "";
    chip.setAttribute("aria-label", `${org.display_name} 상세 정보 보기`);

    const openHandler = () => {
      this.panel.openOrg(org, chip);
    };

    chip.addEventListener("click", openHandler);
    chip.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openHandler();
      }
    });

    return chip;
  }

  openFilterDrawer() {
    if (!this.filterDrawer) return;
    document.body.classList.add("drawer-open");
    this.filterDrawerBackdrop.style.display = "block";
    this.filterDrawer.style.display = "flex";
    this.filterDrawer.setAttribute("aria-hidden", "false");
    this.filterDrawerBackdrop.setAttribute("aria-hidden", "false");
    this.filterToggleBtn.setAttribute("aria-expanded", "true");

    void this.filterDrawer.offsetWidth;
    this.filterDrawerBackdrop.classList.add("active");
    this.filterDrawer.classList.add("active");
    if (this.filterDrawerCloseBtn) {
      this.filterDrawerCloseBtn.focus();
    }
  }

  closeFilterDrawer() {
    if (!this.filterDrawer || !this.filterDrawer.classList.contains("active")) return;
    this.filterDrawerBackdrop.classList.remove("active");
    this.filterDrawer.classList.remove("active");
    this.filterDrawer.setAttribute("aria-hidden", "true");
    this.filterDrawerBackdrop.setAttribute("aria-hidden", "true");
    this.filterToggleBtn.setAttribute("aria-expanded", "false");

    setTimeout(() => {
      if (!this.filterDrawer.classList.contains("active")) {
        this.filterDrawerBackdrop.style.display = "none";
        this.filterDrawer.style.display = "none";
        if (!this.panel || !this.panel.isOpen) {
          document.body.classList.remove("drawer-open");
        }
      }
    }, 250);

    if (this.filterToggleBtn && typeof this.filterToggleBtn.focus === "function") {
      this.filterToggleBtn.focus();
    }
  }

  updateActiveTabUI() {
    const view = this.filterManager.currentView;
    const isProducts = view === "products";
    const isIndustry = view === "industry";
    const isCompanies = view === "companies";

    if (this.tabProducts) {
      this.tabProducts.classList.toggle("active", isProducts);
      this.tabProducts.setAttribute("aria-selected", String(isProducts));
      this.tabProducts.tabIndex = isProducts ? 0 : -1;
    }

    if (this.tabIndustry) {
      this.tabIndustry.classList.toggle("active", isIndustry);
      this.tabIndustry.setAttribute("aria-selected", String(isIndustry));
      this.tabIndustry.tabIndex = isIndustry ? 0 : -1;
    }

    if (this.tabCompanies) {
      this.tabCompanies.classList.toggle("active", isCompanies);
      this.tabCompanies.setAttribute("aria-selected", String(isCompanies));
      this.tabCompanies.tabIndex = isCompanies ? 0 : -1;
    }

    // 모바일 등 좁은 화면에서 선택된 탭이 잘리지 않고 화면 내로 들어오도록 자동 스크롤
    const activeTab = isProducts ? this.tabProducts : (isIndustry ? this.tabIndustry : this.tabCompanies);
    if (activeTab && typeof activeTab.scrollIntoView === "function") {
      activeTab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }

    if (this.viewProducts) {
      this.viewProducts.style.display = isProducts ? "block" : "none";
    }
    if (this.viewIndustry) {
      this.viewIndustry.style.display = isIndustry ? "block" : "none";
    }
    if (this.viewCompanies) {
      this.viewCompanies.style.display = isCompanies ? "block" : "none";
    }
  }

  updateSearchClearVisibility() {
    if (this.searchInput.value.trim()) {
      this.searchClearBtn.style.display = "block";
    } else {
      this.searchClearBtn.style.display = "none";
    }
  }

  syncCheckboxesUI() {
    if (!this.filterDrawer) return;
    const checkboxes = this.filterDrawer.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(chk => {
      const axis = chk.dataset.axis;
      const val = chk.value;
      const targetSet = this.filterManager.getSetByAxis(axis);
      chk.checked = Boolean(targetSet && targetSet.has(val));
    });
  }

  render() {
    this.syncCheckboxesUI();

    // 1. 필터 뱃지 및 선택된 필터 상세 표시
    const activeCount = this.filterManager.getActiveFilterCount();
    if (activeCount > 0) {
      this.filterCountBadge.textContent = String(activeCount);
      this.filterCountBadge.style.display = "inline-block";
    } else {
      this.filterCountBadge.style.display = "none";
    }

    if (this.filterDrawerCountBadge) {
      this.filterDrawerCountBadge.textContent = String(activeCount);
      this.filterDrawerCountBadge.style.display = activeCount > 0 ? "inline-block" : "none";
    }

    // 선택된 필터 옵션값 자체를 한줄한줄 표시
    this.renderSelectedFiltersDetailed();

    // 2. 현재 뷰 렌더링
    const view = this.filterManager.currentView;
    let totalMatchingPrds = 0;
    let totalMatchingEditorials = 0;
    let totalMatchingOrgs = 0;

    if (view === "products") {
      const stats = this.renderProductsLandscape();
      totalMatchingPrds = stats.prdCount;
      totalMatchingEditorials = stats.editorialCount;
      totalMatchingOrgs = stats.orgCount;
    } else if (view === "industry") {
      const stats = this.renderIndustryLandscape();
      totalMatchingPrds = stats.prdCount;
      totalMatchingEditorials = stats.editorialCount;
      totalMatchingOrgs = stats.orgCount;
    } else if (view === "companies") {
      const stats = this.renderCompaniesDirectory();
      totalMatchingPrds = stats.prdCount;
      totalMatchingEditorials = stats.editorialCount;
      totalMatchingOrgs = stats.orgCount;
    }

    // 결과 수 표기:
    // - 간략 보기: 중복 제거된 조직 수와 일치 (일반: "전체 기업 N곳", 관리자: "전체 기업 N곳 (제품 등록 N개 · 조사 기업 N곳)")
    // - 자세히 보기: 기존 상세 표기 유지
    const isAdmin = this.adminManager?.isAdmin || false;
    const isCompact = this.displayMode === "compact";

    if (isCompact) {
      if (isAdmin) {
        this.resultsCountText.textContent = `전체 기업 ${totalMatchingOrgs}곳 (제품 등록 ${totalMatchingPrds}개 · 조사 기업 ${totalMatchingEditorials}곳)`;
      } else {
        this.resultsCountText.textContent = `전체 기업 ${totalMatchingOrgs}곳`;
      }
      if (this.filterDrawerResultsCount) {
        this.filterDrawerResultsCount.textContent = `기업 ${totalMatchingOrgs}곳`;
      }
    } else {
      if (isAdmin) {
        if (view === "products" || view === "industry") {
          this.resultsCountText.textContent = `전체 기업 ${totalMatchingOrgs}곳 · 제품 ${totalMatchingPrds}개 · 조사 기업 ${totalMatchingEditorials}곳`;
        } else {
          this.resultsCountText.textContent = `전체 기업 ${totalMatchingOrgs}곳 (제품 등록 ${totalMatchingPrds}개 · 조사 기업 ${totalMatchingEditorials}곳)`;
        }
        if (this.filterDrawerResultsCount) {
          this.filterDrawerResultsCount.textContent = (view === "companies")
            ? `기업 ${totalMatchingOrgs}곳`
            : `기업 ${totalMatchingOrgs}곳 (항목 ${totalMatchingPrds + totalMatchingEditorials}개)`;
        }
      } else {
        if (view === "products" || view === "industry") {
          this.resultsCountText.textContent = `기업 ${totalMatchingOrgs}곳 · 제품 ${totalMatchingPrds}개`;
        } else {
          this.resultsCountText.textContent = `전체 기업 ${totalMatchingOrgs}곳 (제품 등록 ${totalMatchingPrds}개)`;
        }
        if (this.filterDrawerResultsCount) {
          this.filterDrawerResultsCount.textContent = (view === "companies")
            ? `기업 ${totalMatchingOrgs}곳`
            : `기업 ${totalMatchingOrgs}곳 · 제품 ${totalMatchingPrds}개`;
        }
      }
    }

    // 3. 빈 화면 (Empty State) 처리
    const hasAnyResult = totalMatchingOrgs > 0;
    if (!hasAnyResult) {
      this.viewEmpty.style.display = "block";
    } else {
      this.viewEmpty.style.display = "none";
    }

    // 4. 미분류 기업 검색어 일치 결과 별도 섹션
    this.renderUnclassifiedSearchMatches();
    this.renderUnclassifiedAccordion();
  }

  /**
   * 선택된 필터 옵션값을 "축 이름: 선택값" 형태로 한줄한줄 렌더링
   */
  renderSelectedFiltersDetailed() {
    if (!this.selectedFiltersDisplay) return;

    const detailedFilters = this.filterManager.getSelectedFiltersDetailed();
    if (detailedFilters.length > 0) {
      this.selectedFiltersDisplay.style.display = "flex";
      this.selectedFiltersDisplay.innerHTML = "";

      detailedFilters.forEach(item => {
        const row = document.createElement("div");
        row.className = "selected-filter-row";

        const titleSpan = document.createElement("span");
        titleSpan.className = "selected-filter-label";
        titleSpan.textContent = `${item.axisTitle}:`;

        const valuesWrap = document.createElement("div");
        valuesWrap.className = "selected-filter-values";

        item.values.forEach((val, idx) => {
          const chip = document.createElement("span");
          chip.className = "selected-filter-chip";
          chip.textContent = val;

          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "chip-remove-btn";
          removeBtn.innerHTML = "&times;";
          removeBtn.title = `${val} 필터 해제`;
          removeBtn.setAttribute("aria-label", `${val} 필터 해제`);
          removeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.filterManager.toggleFilter(item.axis, item.codes[idx]);
          });

          chip.appendChild(removeBtn);
          valuesWrap.appendChild(chip);
        });

        row.appendChild(titleSpan);
        row.appendChild(valuesWrap);
        this.selectedFiltersDisplay.appendChild(row);
      });
    } else {
      this.selectedFiltersDisplay.style.display = "none";
      this.selectedFiltersDisplay.innerHTML = "";
    }
  }

  /**
   * 구역별 집계 문자열 생성 (기업 수 우선 표기)
   */
  formatDomainCounts(orgCount, prdCount, editorialCount, isCompact, isAdmin) {
    if (isCompact) {
      return `기업 ${orgCount}곳`;
    }
    if (isAdmin) {
      if (prdCount > 0 && editorialCount > 0) {
        return `기업 ${orgCount}곳 · 제품 ${prdCount}개 · 조사 기업 ${editorialCount}곳`;
      }
      if (prdCount > 0) {
        return `기업 ${orgCount}곳 · 제품 ${prdCount}개`;
      }
      return `기업 ${orgCount}곳 · 조사 기업 ${editorialCount}곳`;
    }
    if (prdCount > 0) {
      return `기업 ${orgCount}곳 · 제품 ${prdCount}개`;
    }
    return `기업 ${orgCount}곳`;
  }

  /**
   * 제품 및 기업 소개 지형도 렌더링
   * - 기본 단위: display_entries (제품 129개 + 조사 기업 소개 170곳)
   * - 기술 구역별 항목 렌더링
   * - 구역별 '제품 X개 · 조사 기업 Y곳 (기업 Z곳)' 표기
   * - 결과 0개 구역 숨김 (필터/검색 활성화 시)
   * - 4단계 정렬
   */
  renderProductsLandscape() {
    this.viewProducts.innerHTML = "";

    const hasActiveFilters = this.filterManager.hasActiveFilters();
    const allFilteredEntries = this.filterManager.filterDisplayEntries(this.data.allDisplayEntries || this.data.allProducts);

    // 전체 고유 기업 수 계산
    const uniqueOrgIds = new Set(allFilteredEntries.map(e => e.org?.org_id).filter(Boolean));
    const prdEntries = allFilteredEntries.filter(e => e.entry_type === "product");
    const editorialEntries = allFilteredEntries.filter(e => e.entry_type === "organization_profile");

    const totalStats = {
      prdCount: prdEntries.length,
      editorialCount: editorialEntries.length,
      orgCount: uniqueOrgIds.size
    };

    const techDomains = this.data.taxonomies.technology_domains || [];

    techDomains.forEach(tech => {
      // 해당 기술 영역에 속한 엔트리 필터링
      const domainEntries = allFilteredEntries.filter(e => {
        const tList = e.technology_domains || [];
        return tList.includes(tech.code);
      });

      // 동일 구역 내 중복 entry_id 제거
      const seenIds = new Set();
      const uniqueDomainEntries = [];
      domainEntries.forEach(e => {
        const id = e.entry_id || (e.entry_type === "product" ? e.product_id : e.org?.org_id);
        if (!seenIds.has(id)) {
          seenIds.add(id);
          uniqueDomainEntries.push(e);
        }
      });

      // 4단계 정렬
      const sortedEntries = sortDisplayEntries(uniqueDomainEntries);

      // 구역별 통계
      const domainOrgIds = new Set(sortedEntries.map(e => e.org?.org_id).filter(Boolean));
      const domainPrds = sortedEntries.filter(e => e.entry_type === "product").length;
      const domainEditorials = sortedEntries.filter(e => e.entry_type === "organization_profile").length;

      // [명세 10절] 검색/필터 적용 상태에서 결과가 0개인 기술 구역은 숨김
      if (hasActiveFilters && sortedEntries.length === 0) {
        return;
      }

      // 구역 섹션 생성
      const sec = document.createElement("section");
      sec.className = "domain-section";
      const displayLabel = getTechnologyLabel(tech.code, tech.label);
      sec.setAttribute("aria-label", displayLabel);

      // 헤더: 구역명 + 집계
      const header = document.createElement("div");
      header.className = "domain-header";

      const titleWrap = document.createElement("div");
      titleWrap.className = "domain-title-wrapper";

      const title = document.createElement("h3");
      title.className = "domain-title";
      title.textContent = displayLabel;

      const counts = document.createElement("span");
      counts.className = "domain-counts";
      const isAdmin = this.adminManager?.isAdmin || false;
      const isCompact = this.displayMode === "compact";
      counts.textContent = this.formatDomainCounts(
        domainOrgIds.size,
        domainPrds,
        domainEditorials,
        isCompact,
        isAdmin
      );

      titleWrap.appendChild(title);
      titleWrap.appendChild(counts);
      header.appendChild(titleWrap);
      sec.appendChild(header);

      if (sortedEntries.length === 0) {
        const emptyMsg = document.createElement("div");
        emptyMsg.className = "domain-empty-msg";
        emptyMsg.textContent = "등록된 제품 및 기업 소개 정보가 없습니다.";
        sec.appendChild(emptyMsg);
      } else if (isCompact) {
        // [간략히 보기]
        // - 같은 분류에 여러 제품을 가진 조직도 이름은 한 번만 표시 (분류 내 중복 제거)
        // - 제품 정보가 없는 조사 기업도 기존 분류에 함께 표시
        // - 조직명은 작은 버튼 형태로 촘촘하게 배치하고, 각 분류 안에서 가나다순 정렬
        // - 설명·제품명·제품 설명·태그·이니셜 배지 없이 조직 이름만 표시
        const seenOrgInDomain = new Set();
        const domainUniqueOrgs = [];
        sortedEntries.forEach(entry => {
          const org = entry.org;
          if (org && org.org_id && !seenOrgInDomain.has(org.org_id)) {
            seenOrgInDomain.add(org.org_id);
            domainUniqueOrgs.push(org);
          }
        });

        domainUniqueOrgs.sort((a, b) =>
          (a.display_name || "").localeCompare(b.display_name || "", "ko")
        );

        const compactGrid = document.createElement("div");
        compactGrid.className = "compact-grid";

        domainUniqueOrgs.forEach(org => {
          compactGrid.appendChild(this.createCompactOrgChip(org));
        });

        sec.appendChild(compactGrid);
      } else {
        // [자세히 보기] 기존 카드 그리드
        const grid = document.createElement("div");
        grid.className = "domain-grid";

        sortedEntries.forEach(entry => {
          if (entry.entry_type === "product") {
            grid.appendChild(this.createProductCard(entry));
          } else {
            grid.appendChild(this.createEditorialCard(entry));
          }
        });

        sec.appendChild(grid);
      }

      this.viewProducts.appendChild(sec);
    });

    return totalStats;
  }

  /**
   * 산업·업무 지형도 렌더링
   * - 표시 대상: 제품 보유 기업 + 조직 조사·공개자료 기반 프로필 기업 (allDisplayEntries)
   * - taxonomies.business_domains order 순으로 구역 배치
   * - 동일 구역 내 entry_id (보조: product_id/org_id) 기준 중복 제거
   * - 복수 산업 영역 연결 엔트리는 해당되는 모든 구역에 표시
   * - 4단계 정렬: 1) 조직명 가나다순, 2) 제품명 가나다순, 3) org_id, 4) entry_id
   * - 구역별 집계:
   *   - 간략히 보기: '기업 N곳'
   *   - 자세히 보기 (일반): '제품 X개 · 기업 Y곳' (제품 없는 경우 '기업 Y곳')
   *   - 자세히 보기 (관리자): '제품 X개 · 조사 기업 Y곳 (기업 Z곳)' 등 구분 표시
   * - 간략히 보기: 고유 기업(org_id) 칩 버튼 배치 (클릭 시 조직 상세 Drawer)
   * - 자세히 보기: 제품 엔트리는 createProductCard, 조직 소개 엔트리는 createEditorialCard 재사용
   * - 검색/필터 적용 시 결과 0개 구역 숨김
   */
  renderIndustryLandscape() {
    this.viewIndustry.innerHTML = "";

    const hasActiveFilters = this.filterManager.hasActiveFilters();
    // 표시 엔트리(제품 + 조직 프로필) 단위 필터링 수행
    const allFilteredEntries = this.filterManager.filterDisplayEntries(this.data.allDisplayEntries || this.data.allProducts);

    // 전체 고유 기업 수 및 제품/조사기업 개수 계산
    const uniqueOrgIds = new Set(allFilteredEntries.map(e => e.org?.org_id).filter(Boolean));
    const prdEntries = allFilteredEntries.filter(e => e.entry_type === "product");
    const editorialEntries = allFilteredEntries.filter(e => e.entry_type === "organization_profile");

    const totalStats = {
      prdCount: prdEntries.length,
      editorialCount: editorialEntries.length,
      orgCount: uniqueOrgIds.size
    };

    const bizDomains = this.data.taxonomies.business_domains || [];

    bizDomains.forEach(biz => {
      // 1. 해당 산업·업무 영역에 속한 엔트리 필터링
      const domainEntries = allFilteredEntries.filter(e => {
        const bList = e.business_domains || [];
        return bList.includes(biz.code);
      });

      // 2. 동일 구역 내 중복 entry_id 제거
      const seenIds = new Set();
      const uniqueDomainEntries = [];
      domainEntries.forEach(e => {
        const id = e.entry_id || (e.entry_type === "product" ? e.product_id : e.org?.org_id);
        if (!seenIds.has(id)) {
          seenIds.add(id);
          uniqueDomainEntries.push(e);
        }
      });

      // 3. 4단계 정렬 적용
      const sortedEntries = sortDisplayEntries(uniqueDomainEntries);

      // 4. 구역별 통계 (고유 기업 수, 제품 수, 조사 기업 수)
      const domainOrgIds = new Set(sortedEntries.map(e => e.org?.org_id).filter(Boolean));
      const domainPrds = sortedEntries.filter(e => e.entry_type === "product").length;
      const domainEditorials = sortedEntries.filter(e => e.entry_type === "organization_profile").length;

      // 5. [명세 7절] 검색/필터 적용 상태에서 결과가 0개인 구역은 숨김
      if (hasActiveFilters && sortedEntries.length === 0) {
        return;
      }

      // 6. 구역 섹션 DOM 생성
      const sec = document.createElement("section");
      sec.className = "domain-section";
      sec.setAttribute("aria-label", biz.label);

      // 헤더: 구역명 + 집계
      const header = document.createElement("div");
      header.className = "domain-header";

      const titleWrap = document.createElement("div");
      titleWrap.className = "domain-title-wrapper";

      const title = document.createElement("h3");
      title.className = "domain-title";
      title.textContent = biz.label;

      const counts = document.createElement("span");
      counts.className = "domain-counts";
      const isAdmin = this.adminManager?.isAdmin || false;
      const isCompact = this.displayMode === "compact";
      counts.textContent = this.formatDomainCounts(
        domainOrgIds.size,
        domainPrds,
        domainEditorials,
        isCompact,
        isAdmin
      );

      titleWrap.appendChild(title);
      titleWrap.appendChild(counts);
      header.appendChild(titleWrap);
      sec.appendChild(header);

      // 컨텐츠 렌더링
      if (sortedEntries.length === 0) {
        const emptyMsg = document.createElement("div");
        emptyMsg.className = "domain-empty-msg";
        emptyMsg.textContent = "등록된 제품 및 기업 소개 정보가 없습니다.";
        sec.appendChild(emptyMsg);
      } else if (isCompact) {
        // [간략히 보기] 분류 내 고유 조직(org_id) 중복 제거 버튼 칩
        const seenOrgInDomain = new Set();
        const domainUniqueOrgs = [];
        sortedEntries.forEach(entry => {
          const org = entry.org;
          if (org && org.org_id && !seenOrgInDomain.has(org.org_id)) {
            seenOrgInDomain.add(org.org_id);
            domainUniqueOrgs.push(org);
          }
        });

        domainUniqueOrgs.sort((a, b) =>
          (a.display_name || "").localeCompare(b.display_name || "", "ko-KR")
        );

        const compactGrid = document.createElement("div");
        compactGrid.className = "compact-grid";

        domainUniqueOrgs.forEach(org => {
          compactGrid.appendChild(this.createCompactOrgChip(org));
        });

        sec.appendChild(compactGrid);
      } else {
        // [자세히 보기] 제품 엔트리는 제품 카드, 조직 소개 엔트리는 조직 소개 카드로 표시
        const grid = document.createElement("div");
        grid.className = "domain-grid";

        sortedEntries.forEach(entry => {
          if (entry.entry_type === "product") {
            grid.appendChild(this.createProductCard(entry));
          } else {
            grid.appendChild(this.createEditorialCard(entry));
          }
        });

        sec.appendChild(grid);
      }

      this.viewIndustry.appendChild(sec);
    });

    return totalStats;
  }

  /**
   * 제품 카드 DOM 생성 (명세 준수)
   * 1. 회사 이름 (로고 + 조직명)
   * 2. 공통 기업 설명 (company_profile.summary, 없으면 영역 생략)
   * 3. 제품 정보 박스 (시각적으로 구분된 별도 영역: 제품명 -> 제품 설명)
   * 4. 태그: 출처 구분(설문 등록 제품) + 산업·업무 영역 + 구동 형태
   */
  createProductCard(product) {
    const org = product.org || {};
    const companySummary = org.company_profile?.summary || product.company_summary || null;

    const card = document.createElement("div");
    card.className = "product-card has-product";
    card.tabIndex = 0;
    card.role = "button";
    card.setAttribute("aria-label", `${org.display_name}의 ${product.name} 상세 정보 보기`);

    // 1. 상단 고정 1줄 레이아웃 (이니셜 + 조직명)
    const orgRow = document.createElement("div");
    orgRow.className = "card-org-row";

    const badge = document.createElement("span");
    badge.className = "org-initial-badge";
    badge.textContent = getOrgInitial(org.display_name);

    const orgName = document.createElement("span");
    orgName.className = "org-name-text";
    orgName.textContent = org.display_name || "";

    orgRow.appendChild(badge);
    orgRow.appendChild(orgName);
    card.appendChild(orgRow);

    // 2. 공통 기업 설명 (있을 때만 표시, 없으면 생략)
    if (companySummary) {
      const compDesc = document.createElement("p");
      compDesc.className = "card-company-desc";
      compDesc.textContent = companySummary;
      card.appendChild(compDesc);
    }

    // 3. 제품 정보 박스 (시각적으로 구분된 별도 영역)
    const productBox = document.createElement("div");
    productBox.className = "card-product-box";

    const prdLabel = document.createElement("span");
    prdLabel.className = "card-product-label";
    prdLabel.textContent = "제품 정보";
    productBox.appendChild(prdLabel);

    const prdName = document.createElement("h4");
    prdName.className = "card-product-name";
    prdName.textContent = product.name || "제품명 정보 없음";
    productBox.appendChild(prdName);

    if (product.description) {
      const prdDesc = document.createElement("p");
      prdDesc.className = "card-product-desc";
      prdDesc.textContent = product.description;
      productBox.appendChild(prdDesc);
    }

    card.appendChild(productBox);

    // 4. 태그 행: 출처 태그 + 산업·업무 영역 (최대 2개 + 초과분 '+N') 및 구동 형태
    const badgesRow = document.createElement("div");
    badgesRow.className = "card-badges-row";

    // 출처 태그 (설문 등록 제품 - 관리자 모드 전용)
    const srcTag = document.createElement("span");
    srcTag.className = "badge-tag source-survey admin-only";
    srcTag.textContent = "설문 등록 제품";
    badgesRow.appendChild(srcTag);

    // 산업·업무 태그
    const bizList = product.business_domains || [];
    const MAX_BIZ_TAGS = 2;
    const visibleBiz = bizList.slice(0, MAX_BIZ_TAGS);
    const extraBizCount = bizList.length - MAX_BIZ_TAGS;

    visibleBiz.forEach(bCode => {
      const tag = document.createElement("span");
      tag.className = "badge-tag industry";
      const bTax = this.data.taxonomies.business_domains.find(b => b.code === bCode);
      tag.textContent = bTax ? bTax.label : bCode;
      badgesRow.appendChild(tag);
    });

    if (extraBizCount > 0) {
      const moreTag = document.createElement("span");
      moreTag.className = "badge-tag more";
      moreTag.textContent = `+${extraBizCount}`;
      moreTag.title = `추가 산업·업무 영역 ${extraBizCount}개`;
      badgesRow.appendChild(moreTag);
    }

    // 에이전트 구동 형태 태그
    const models = product.operating_models || [];
    models.forEach(mCode => {
      const tag = document.createElement("span");
      tag.className = "badge-tag model";
      const opTax = this.data.taxonomies.operating_models.find(m => m.code === mCode);
      tag.textContent = opTax ? opTax.label : mCode;
      badgesRow.appendChild(tag);
    });

    if (badgesRow.childNodes.length > 0) {
      card.appendChild(badgesRow);
    }

    // 클릭 / 엔터 시 상세 Drawer 열기
    const openHandler = () => {
      this.panel.openProduct(product, card);
    };

    card.addEventListener("click", openHandler);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openHandler();
      }
    });

    return card;
  }

  /**
   * 조사 보강 기업 소개 카드 DOM 생성
   * 1. 회사 이름 (로고 + 조직명)
   * 2. 공통 기업 설명 (회사 이름 바로 아래, 별도 '기업 소개' 제목 제거)
   * 3. 태그: 출처 구분(조사 보강 기업) + 산업·업무 영역
   */
  createEditorialCard(entry) {
    const org = entry.org || {};
    const companySummary = org.company_profile?.summary || entry.company_summary || entry.description || null;

    const card = document.createElement("div");
    card.className = "product-card editorial-card";
    card.tabIndex = 0;
    card.role = "button";
    card.setAttribute("aria-label", `${org.display_name} 기업 상세 보기`);

    // 1. 상단 고정 1줄 레이아웃 (이니셜 + 조직명)
    const orgRow = document.createElement("div");
    orgRow.className = "card-org-row";

    const badge = document.createElement("span");
    badge.className = "org-initial-badge";
    badge.textContent = getOrgInitial(org.display_name);

    const orgName = document.createElement("span");
    orgName.className = "org-name-text";
    orgName.textContent = org.display_name || "";

    orgRow.appendChild(badge);
    orgRow.appendChild(orgName);
    card.appendChild(orgRow);

    // 2. 공통 기업 설명 ('기업 소개' 제목 제거, 바로 기업 설명 표시)
    if (companySummary) {
      const desc = document.createElement("p");
      desc.className = "card-company-desc";
      desc.textContent = companySummary;
      card.appendChild(desc);
    }

    // 3. 태그 행: 출처 태그 + 산업·업무 영역 (최대 2개 + 초과분 '+N')
    const badgesRow = document.createElement("div");
    badgesRow.className = "card-badges-row";

    // 출처 태그 (조사 보강 기업 - 관리자 모드 전용)
    const srcTag = document.createElement("span");
    srcTag.className = "badge-tag source-editorial admin-only";
    srcTag.textContent = "조사 보강 기업";
    badgesRow.appendChild(srcTag);

    // 산업·업무 태그
    const bizList = entry.business_domains || [];
    const MAX_BIZ_TAGS = 2;
    const visibleBiz = bizList.slice(0, MAX_BIZ_TAGS);
    const extraBizCount = bizList.length - MAX_BIZ_TAGS;

    visibleBiz.forEach(bCode => {
      const tag = document.createElement("span");
      tag.className = "badge-tag industry";
      const bTax = this.data.taxonomies.business_domains.find(b => b.code === bCode);
      tag.textContent = bTax ? bTax.label : bCode;
      badgesRow.appendChild(tag);
    });

    if (extraBizCount > 0) {
      const moreTag = document.createElement("span");
      moreTag.className = "badge-tag more";
      moreTag.textContent = `+${extraBizCount}`;
      moreTag.title = `추가 산업·업무 영역 ${extraBizCount}개`;
      badgesRow.appendChild(moreTag);
    }

    card.appendChild(badgesRow);

    // 클릭 / 엔터 시 상세 Drawer(조직 모드) 열기
    const openHandler = () => {
      this.panel.openOrg(org, card);
    };

    card.addEventListener("click", openHandler);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openHandler();
      }
    });

    return card;
  }

  /**
   * 기업 디렉터리 뷰 렌더링 (명세 6절)
   * - 기본 단위: org_id (각 기업 1회만 표시)
   * - 제품 없는 조직, 조사 보강 조직, 미분류 조직 모두 가나다순에 포함
   * - 공통 기업 소개(company_profile.summary) 표시
   * - 초성별 퀵점프
   */
  renderCompaniesDirectory() {
    const container = document.getElementById("all-orgs-container");
    const choseongNav = document.getElementById("choseong-nav");
    container.innerHTML = "";
    choseongNav.innerHTML = "";

    const filteredOrgs = this.filterManager.filterOrganizations(this.data.organizations);

    // 가나다순 정렬
    const sortedOrgs = [...filteredOrgs].sort((a, b) =>
      (a.display_name || "").localeCompare(b.display_name || "", "ko")
    );

    // 초성별 그룹핑
    const groupMap = new Map();
    sortedOrgs.forEach(org => {
      const ch = getChoseong(org.display_name);
      if (!groupMap.has(ch)) {
        groupMap.set(ch, []);
      }
      groupMap.get(ch).push(org);
    });

    // 정렬된 초성 키 목록 (한글 ㄱ-ㅎ -> 영문 A-Z -> 기타)
    const sortedKeys = Array.from(groupMap.keys()).sort((a, b) => {
      if (a === "기타") return 1;
      if (b === "기타") return -1;
      return a.localeCompare(b, "ko");
    });

    let totalPrds = 0;
    let totalEditorials = 0;

    sortedKeys.forEach(ch => {
      const orgList = groupMap.get(ch);

      // 1. 초성 퀵점프 버튼
      const jumpBtn = document.createElement("button");
      jumpBtn.type = "button";
      jumpBtn.className = "choseong-btn";
      jumpBtn.textContent = `${ch} (${orgList.length})`;
      jumpBtn.addEventListener("click", () => {
        const targetGroup = document.getElementById(`org-group-${ch}`);
        if (targetGroup) {
          targetGroup.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
      choseongNav.appendChild(jumpBtn);

      // 2. 초성 그룹 섹션
      const groupSec = document.createElement("div");
      groupSec.className = "org-choseong-group";
      groupSec.id = `org-group-${ch}`;

      const heading = document.createElement("h3");
      heading.className = "org-choseong-heading";
      heading.textContent = ch;
      groupSec.appendChild(heading);

      const isCompact = this.displayMode === "compact";
      if (isCompact) {
        const compactGrid = document.createElement("div");
        compactGrid.className = "compact-grid";

        orgList.forEach(org => {
          const prdCount = Array.isArray(org.products) ? org.products.length : 0;
          totalPrds += prdCount;
          if (org.editorial_profile && prdCount === 0) {
            totalEditorials++;
          }
          compactGrid.appendChild(this.createCompactOrgChip(org));
        });

        groupSec.appendChild(compactGrid);
      } else {
        const grid = document.createElement("div");
        grid.className = "org-grid";

        orgList.forEach(org => {
          const prdCount = Array.isArray(org.products) ? org.products.length : 0;
          totalPrds += prdCount;
          if (org.editorial_profile && prdCount === 0) {
            totalEditorials++;
          }

          const card = document.createElement("div");
          card.className = this.hasSurveyResponse(org)
            ? "org-card has-survey"
            : "org-card";
          card.tabIndex = 0;
          card.role = "button";
          card.setAttribute("aria-label", `${org.display_name} 기업 상세 보기`);

          const badge = document.createElement("span");
          badge.className = "org-initial-badge";
          badge.textContent = getOrgInitial(org.display_name);

          const info = document.createElement("div");
          info.className = "org-card-info";

          const name = document.createElement("div");
          name.className = "org-card-name";
          name.textContent = org.display_name || "";
          info.appendChild(name);

          // 공통 기업 소개가 있는 경우 디렉터리 카드에 요약 표시
          const compSummary = org.company_profile?.summary || null;
          if (compSummary) {
            const desc = document.createElement("p");
            desc.className = "org-card-desc";
            desc.textContent = compSummary;
            info.appendChild(desc);
          }

          const meta = document.createElement("div");
          meta.className = "org-card-meta";

          if (prdCount > 0) {
            const prdBadge = document.createElement("span");
            prdBadge.className = "org-product-badge";
            prdBadge.textContent = `제품 ${prdCount}개`;
            meta.appendChild(prdBadge);

            const srcBadge = document.createElement("span");
            srcBadge.className = "badge-tag source-survey admin-only";
            srcBadge.textContent = "설문 등록 제품";
            meta.appendChild(srcBadge);
          } else if (org.editorial_profile) {
            const epBadge = document.createElement("span");
            epBadge.className = "badge-tag source-editorial admin-only";
            epBadge.textContent = "조사 보강 기업";
            meta.appendChild(epBadge);
          } else if (org.classification_applicability === "organization_role_only") {
            const roleBadge = document.createElement("span");
            roleBadge.className = "badge-tag alliance";
            roleBadge.textContent = "생태계 지원 기관";
            meta.appendChild(roleBadge);
          } else {
            const unBadge = document.createElement("span");
            unBadge.className = "org-unclassified-badge";
            unBadge.textContent = "분류 정보 준비 중";
            meta.appendChild(unBadge);
          }

          info.appendChild(meta);

          card.appendChild(badge);
          card.appendChild(info);

          const openHandler = () => {
            this.panel.openOrg(org, card);
          };
          card.addEventListener("click", openHandler);
          card.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openHandler();
            }
          });

          grid.appendChild(card);
        });

        groupSec.appendChild(grid);
      }
      container.appendChild(groupSec);
    });

    return {
      prdCount: totalPrds,
      editorialCount: totalEditorials,
      orgCount: sortedOrgs.length
    };
  }

  /**
   * 검색어와 일치하는 미분류 기업 결과 표시 (지형도/디렉터리 카운트와 분리)
   */
  renderUnclassifiedSearchMatches() {
    const matches = this.filterManager.getUnclassifiedSearchMatches();
    if (matches.length > 0) {
      this.unclassifiedSearchSec.style.display = "block";
      this.unclassifiedSearchGrid.innerHTML = "";

      const isCompact = this.displayMode === "compact";
      if (isCompact) {
        this.unclassifiedSearchGrid.className = "compact-grid";
        matches.forEach(org => {
          this.unclassifiedSearchGrid.appendChild(this.createCompactOrgChip(org));
        });
      } else {
        this.unclassifiedSearchGrid.className = "unclassified-search-grid";
        matches.forEach(org => {
          const item = document.createElement("div");
          item.className = "unclassified-item";
          item.tabIndex = 0;
          item.role = "button";
          const roleLabel = org.classification_applicability === "organization_role_only"
            ? "생태계 지원 기관·협회"
            : "분류 정보 준비 중";
          item.textContent = `${org.display_name} — ${roleLabel}`;

          const openHandler = () => {
            this.panel.openOrg(org, item);
          };
          item.addEventListener("click", openHandler);
          item.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openHandler();
            }
          });

          this.unclassifiedSearchGrid.appendChild(item);
        });
      }
    } else {
      this.unclassifiedSearchSec.style.display = "none";
    }
  }

  /**
   * 하단 접이식 생태계 지원 기관 및 협회 아코디언 채우기
   */
  renderUnclassifiedAccordion() {
    if (!this.unclassifiedOrgsGrid) return;
    this.unclassifiedOrgsGrid.innerHTML = "";

    const roleOrgs = this.data.organizations
      .filter(o => o.classification_applicability === "organization_role_only" || o.classification_status === "unclassified")
      .sort((a, b) => (a.display_name || "").localeCompare(b.display_name || "", "ko"));

    const isCompact = this.displayMode === "compact";
    if (isCompact) {
      this.unclassifiedOrgsGrid.className = "compact-grid";
      roleOrgs.forEach(org => {
        this.unclassifiedOrgsGrid.appendChild(this.createCompactOrgChip(org));
      });
    } else {
      this.unclassifiedOrgsGrid.className = "unclassified-orgs-grid";
      roleOrgs.forEach(org => {
        const item = document.createElement("div");
        item.className = "unclassified-item";
        item.tabIndex = 0;
        item.role = "button";
        item.textContent = `${org.display_name} (${org.org_type || "기관"})`;
        item.title = org.official_name || org.display_name;

        const openHandler = () => {
          this.panel.openOrg(org, item);
        };
        item.addEventListener("click", openHandler);
        item.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openHandler();
          }
        });

        this.unclassifiedOrgsGrid.appendChild(item);
      });
    }
  }

  /**
   * 관리자 모드 On/Off 전환 시 실시간 UI 갱신 핸들러
   * - 검색어, 필터, 보기 방식 유지
   * - 상세 Drawer가 열려 있는 경우 실시간 re-render
   */
  handleAdminModeChange(isAdmin) {
    // 1. 현재 검색어 및 필터 유지한 상태로 뷰(집계 텍스트, 도메인 섹션 카운트) 갱신
    this.render();

    // 2. 열려 있는 Drawer가 있을 경우 Drawer 내용 즉시 갱신
    if (this.panel) {
      this.panel.refresh();
    }
  }
}

// 애플리케이션 기동
document.addEventListener("DOMContentLoaded", () => {
  const app = new App();
  app.start();
});

