/**
 * 검색 및 다중 복합 필터 모듈 (site_new/js/filter.js)
 * - 보기 방식: 제품 중심 지형도('products') / 기업 디렉터리('companies')
 * - 동일 필터축 내 복수선택: OR 결합
 * - 서로 다른 필터축 간: AND 결합
 * - URL 쿼리 파라미터 실시간 동기화 (?view=products&q=...&industry=...) 및 하위 호환 매핑
 * - 미분류 기업 검색어 분리 집계
 */

import { getTechnologyLabel } from "./landscape.js";

export class FilterManager {
  constructor(landscapeData, onFilterChange) {
    this.data = landscapeData;
    this.onFilterChange = onFilterChange;

    this.currentView = "products"; // 'products' | 'industry' | 'companies'
    this.searchQuery = "";

    // 4개 필터축 (회원사 필터 제외)
    this.selectedTechs = new Set();
    this.selectedIndustries = new Set();
    this.selectedModels = new Set();
    this.selectedTypes = new Set();

    this.initFromUrl();
  }

  setView(view, push = false) {
    if (this.currentView === view) return;
    this.currentView = view;
    this.syncToUrl({ push });
    this.notify();
  }

  setSearchQuery(query) {
    this.searchQuery = (query || "").trim();
    this.syncToUrl();
    this.notify();
  }

  toggleFilter(axis, value) {
    const targetSet = this.getSetByAxis(axis);
    if (!targetSet) return;

    if (targetSet.has(value)) {
      targetSet.delete(value);
    } else {
      targetSet.add(value);
    }

    this.syncToUrl();
    this.notify();
  }

  getSetByAxis(axis) {
    const map = {
      tech: this.selectedTechs,
      industry: this.selectedIndustries,
      model: this.selectedModels,
      type: this.selectedTypes
    };
    return map[axis] || null;
  }

  resetAll() {
    this.searchQuery = "";
    this.selectedTechs.clear();
    this.selectedIndustries.clear();
    this.selectedModels.clear();
    this.selectedTypes.clear();

    // URL을 쿼리스트링 없는 깨끗한 기본 주소로 복원
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, "", cleanUrl);

    this.notify();
  }

  hasActiveFilters() {
    return (
      this.searchQuery.length > 0 ||
      this.selectedTechs.size > 0 ||
      this.selectedIndustries.size > 0 ||
      this.selectedModels.size > 0 ||
      this.selectedTypes.size > 0
    );
  }

  getActiveFilterCount() {
    return (
      (this.searchQuery ? 1 : 0) +
      this.selectedTechs.size +
      this.selectedIndustries.size +
      this.selectedModels.size +
      this.selectedTypes.size
    );
  }

  /**
   * 사용자가 선택한 필터 항목들의 상세 정보(축 이름 및 선택 라벨 목록)를 반환합니다.
   */
  getSelectedFiltersDetailed() {
    const list = [];

    if (this.selectedTechs.size > 0) {
      const labels = Array.from(this.selectedTechs).map(code => {
        const item = (this.data.taxonomies.technology_domains || []).find(t => t.code === code);
        return getTechnologyLabel(code, item ? item.label : code);
      });
      list.push({ axis: "tech", axisTitle: "기술 영역", values: labels, codes: Array.from(this.selectedTechs) });
    }

    if (this.selectedIndustries.size > 0) {
      const labels = Array.from(this.selectedIndustries).map(code => {
        const item = (this.data.taxonomies.business_domains || []).find(b => b.code === code);
        return item ? item.label : code;
      });
      list.push({ axis: "industry", axisTitle: "산업·업무 영역", values: labels, codes: Array.from(this.selectedIndustries) });
    }

    if (this.selectedModels.size > 0) {
      const labels = Array.from(this.selectedModels).map(code => {
        const item = (this.data.taxonomies.operating_models || []).find(m => m.code === code);
        return item ? item.label : code;
      });
      list.push({ axis: "model", axisTitle: "에이전트 구동 형태", values: labels, codes: Array.from(this.selectedModels) });
    }

    if (this.selectedTypes.size > 0) {
      list.push({ axis: "type", axisTitle: "조직 유형", values: Array.from(this.selectedTypes), codes: Array.from(this.selectedTypes) });
    }

    return list;
  }

  /**
   * 표시 항목(제품 + 조사 기업 소개) 단위 필터링 수행
   * - 검색어: 조직명, 공식명, 별칭, 제품명, 제품 설명, 기업 소개 요약, 등록 요약, 커스텀 도메인, 핵심 기술, 활용 사례 등
   * - 각 축 내부 OR, 서로 다른 축 간 AND
   */
  filterDisplayEntries(entriesList) {
    const query = this.searchQuery.toLowerCase();

    return entriesList.filter(entry => {
      const org = entry.org || {};
      const ep = org.editorial_profile || {};

      // 1. 검색어 검사
      if (query) {
        const matchOrgDisplay = (org.display_name || "").toLowerCase().includes(query);
        const matchOrgOfficial = (org.official_name || "").toLowerCase().includes(query);
        const matchAliases = Array.isArray(org.aliases) && org.aliases.some(a => (a || "").toLowerCase().includes(query));

        const matchCompanySummary = Boolean(org.company_profile?.summary && org.company_profile.summary.toLowerCase().includes(query));
        let isMatch = matchOrgDisplay || matchOrgOfficial || matchAliases || matchCompanySummary;

        if (entry.entry_type === "product") {
          const matchName = (entry.name || "").toLowerCase().includes(query);
          const matchDesc = (entry.description || "").toLowerCase().includes(query);
          const matchCustomDomains = Array.isArray(entry.business_domain_customs) &&
            entry.business_domain_customs.some(c => (c || "").toLowerCase().includes(query));
          const matchCoreTech = (entry.core_technology || "").toLowerCase().includes(query);
          const matchUseCases = (entry.use_cases || "").toLowerCase().includes(query);
          isMatch = isMatch || matchName || matchDesc || matchCustomDomains || matchCoreTech || matchUseCases;
        } else if (entry.entry_type === "organization_profile") {
          const matchSummary = (ep.summary || entry.description || "").toLowerCase().includes(query);
          const matchRegSummary = (ep.registration_summary || "").toLowerCase().includes(query);
          isMatch = isMatch || matchSummary || matchRegSummary;
        }

        if (!isMatch) return false;
      }

      // 2. 기술 영역 (동일축 내 OR)
      if (this.selectedTechs.size > 0) {
        const techs = entry.technology_domains || [];
        const hasTech = techs.some(t => this.selectedTechs.has(t));
        if (!hasTech) return false;
      }

      // 3. 산업·업무 영역 (동일축 내 OR)
      if (this.selectedIndustries.size > 0) {
        const bizs = entry.business_domains || [];
        const hasBiz = bizs.some(b => this.selectedIndustries.has(b));
        if (!hasBiz) return false;
      }

      // 4. 에이전트 구동 형태 (동일축 내 OR)
      if (this.selectedModels.size > 0) {
        const models = entry.operating_models || [];
        const hasModel = models.some(m => this.selectedModels.has(m));
        if (!hasModel) return false;
      }

      // 5. 조직 유형 (동일축 내 OR)
      if (this.selectedTypes.size > 0) {
        const orgType = org.org_type || "기타";
        if (!this.selectedTypes.has(orgType)) return false;
      }

      return true;
    });
  }

  /**
   * 제품 단위 필터링 수행 (하위 호환)
   */
  filterProducts(productList) {
    return this.filterDisplayEntries(productList);
  }

  /**
   * 기업 디렉터리용 조직 필터링
   * - 검색어: 기업명, 공식명, 별칭, 보유 제품, 공통 기업 소개, 조사 요약문 등
   * - 제품/분류 관련 필터: 보유 제품 또는 조사 프로필이 조건을 만족해야 통과
   */
  filterOrganizations(orgList) {
    const query = this.searchQuery.toLowerCase();
    const hasProductFilters = this.selectedTechs.size > 0 ||
                              this.selectedIndustries.size > 0 ||
                              this.selectedModels.size > 0;

    return orgList.filter(org => {
      const ep = org.editorial_profile || null;
      const cp = org.company_profile || null;

      // 1. 검색어 검사
      if (query) {
        const matchDisplay = (org.display_name || "").toLowerCase().includes(query);
        const matchOfficial = (org.official_name || "").toLowerCase().includes(query);
        const matchAliases = Array.isArray(org.aliases) && org.aliases.some(a => (a || "").toLowerCase().includes(query));
        const matchCompany = Boolean(cp && cp.summary && cp.summary.toLowerCase().includes(query));
        const matchProduct = Array.isArray(org.products) && org.products.some(p => {
          const mName = (p.name || "").toLowerCase().includes(query);
          const mDesc = (p.description || "").toLowerCase().includes(query);
          const mCustom = Array.isArray(p.business_domain_customs) &&
            p.business_domain_customs.some(c => (c || "").toLowerCase().includes(query));
          const mTech = (p.core_technology || "").toLowerCase().includes(query);
          const mCases = (p.use_cases || "").toLowerCase().includes(query);
          return mName || mDesc || mCustom || mTech || mCases;
        });
        const matchEditorial = Boolean(ep && (
          (ep.summary || "").toLowerCase().includes(query) ||
          (ep.registration_summary || "").toLowerCase().includes(query)
        ));

        if (!matchDisplay && !matchOfficial && !matchAliases && !matchCompany && !matchProduct && !matchEditorial) {
          return false;
        }
      }

      // 2. 조직 유형
      if (this.selectedTypes.size > 0) {
        const type = org.org_type || "기타";
        if (!this.selectedTypes.has(type)) return false;
      }

      // 3. 분류 관련 필터가 켜진 경우
      if (hasProductFilters) {
        // A. 제품 기반 검사
        let hasMatchingProduct = false;
        if (Array.isArray(org.products) && org.products.length > 0) {
          hasMatchingProduct = org.products.some(p => {
            if (this.selectedTechs.size > 0) {
              const prodTechs = p.technology_domains || [];
              if (!prodTechs.some(t => this.selectedTechs.has(t))) return false;
            }
            if (this.selectedIndustries.size > 0) {
              const prodBiz = p.business_domains || [];
              if (!prodBiz.some(b => this.selectedIndustries.has(b))) return false;
            }
            if (this.selectedModels.size > 0) {
              const prodModels = p.operating_models || [];
              if (!prodModels.some(m => this.selectedModels.has(m))) return false;
            }
            return true;
          });
        }

        // B. 조사 프로필 기반 검사
        let hasMatchingEditorial = false;
        if (ep) {
          let techOk = true;
          if (this.selectedTechs.size > 0) {
            const epTechs = ep.technology_domains || [];
            techOk = epTechs.some(t => this.selectedTechs.has(t));
          }

          let bizOk = true;
          if (this.selectedIndustries.size > 0) {
            const epBiz = ep.business_domains || [];
            bizOk = epBiz.some(b => this.selectedIndustries.has(b));
          }

          let modelOk = true;
          if (this.selectedModels.size > 0) {
            const epModels = ep.operating_models || [];
            modelOk = epModels.some(m => this.selectedModels.has(m));
          }

          hasMatchingEditorial = techOk && bizOk && modelOk;
        }

        if (!hasMatchingProduct && !hasMatchingEditorial) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * 검색어와 일치하는 미분류 기업 목록 (지형도/디렉터리 카운트에서 분리)
   */
  getUnclassifiedSearchMatches() {
    if (!this.searchQuery) return [];
    const query = this.searchQuery.toLowerCase();

    return this.data.organizations.filter(org => {
      if (org.classification_status !== "unclassified") return false;

      const ep = org.editorial_profile || null;
      const matchDisplay = (org.display_name || "").toLowerCase().includes(query);
      const matchOfficial = (org.official_name || "").toLowerCase().includes(query);
      const matchAliases = Array.isArray(org.aliases) && org.aliases.some(a => (a || "").toLowerCase().includes(query));
      const matchSummary = ep ? (ep.summary || "").toLowerCase().includes(query) : false;

      return matchDisplay || matchOfficial || matchAliases || matchSummary;
    });
  }

  syncToUrl({ push = false } = {}) {
    const params = new URLSearchParams();
    if (this.currentView) params.set("view", this.currentView);
    if (this.searchQuery) params.set("q", this.searchQuery);
    if (this.selectedTechs.size > 0) params.set("tech", Array.from(this.selectedTechs).join(","));
    if (this.selectedIndustries.size > 0) params.set("industry", Array.from(this.selectedIndustries).join(","));
    if (this.selectedModels.size > 0) params.set("model", Array.from(this.selectedModels).join(","));
    if (this.selectedTypes.size > 0) params.set("type", Array.from(this.selectedTypes).join(","));

    const queryString = params.toString();
    const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
    if (push) {
      window.history.pushState({ view: this.currentView }, "", newUrl);
    } else {
      window.history.replaceState({ view: this.currentView }, "", newUrl);
    }
  }

  initFromUrl() {
    const params = new URLSearchParams(window.location.search);

    // 1. 보기 방식 (view 또는 이전 tab 파라미터 하위 호환)
    const viewParam = params.get("view") || params.get("tab");
    if (viewParam === "companies" || viewParam === "all-orgs") {
      this.currentView = "companies";
    } else if (viewParam === "industry") {
      this.currentView = "industry";
    } else {
      // 'products', 'tech' 또는 기타 미지정 시 기본 'products'
      this.currentView = "products";
    }

    // 2. 검색어
    const qParam = params.get("q");
    this.searchQuery = qParam ? qParam.trim() : "";

    // 3. 필터값 로드 (이전 값 초기화 후 재로드)
    this.selectedTechs.clear();
    this.selectedIndustries.clear();
    this.selectedModels.clear();
    this.selectedTypes.clear();

    const loadSet = (paramKeys, set) => {
      for (const key of paramKeys) {
        const val = params.get(key);
        if (val) {
          val.split(",").forEach(item => {
            const clean = item.trim();
            if (clean) set.add(clean);
          });
        }
      }
    };

    loadSet(["tech"], this.selectedTechs);
    loadSet(["industry"], this.selectedIndustries);
    loadSet(["model", "models"], this.selectedModels);
    loadSet(["type", "types"], this.selectedTypes);

    // 이전 domains 파라미터 호환: taxonomies에 매칭하여 tech 또는 industry로 복원
    const legacyDomains = params.get("domains");
    if (legacyDomains) {
      const techCodes = new Set((this.data.taxonomies.technology_domains || []).map(t => t.code));
      const bizCodes = new Set((this.data.taxonomies.business_domains || []).map(b => b.code));
      legacyDomains.split(",").forEach(item => {
        const clean = item.trim();
        if (techCodes.has(clean)) this.selectedTechs.add(clean);
        else if (bizCodes.has(clean)) this.selectedIndustries.add(clean);
      });
    }
  }

  notify() {
    if (typeof this.onFilterChange === "function") {
      this.onFilterChange();
    }
  }
}

