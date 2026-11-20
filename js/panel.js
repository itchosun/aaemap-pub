/**
 * 상세 정보 Drawer 패널 모듈 (site_new/js/panel.js)
 * - 제품 상세 모드 ↔ 조직 상세 모드 양방향 전환
 * - 포커스 트랩, ESC 키 닫기, 배경 스크롤 방지
 * - 안전한 textContent 기반 렌더링 및 웹사이트 검증
 */

import { getOrgInitial, getTechnologyLabel } from "./landscape.js";
import { ORG_LOGOS } from "./logo-manifest.js";

export class DetailPanel {
  constructor(landscapeData) {
    this.data = landscapeData;

    this.backdrop = document.getElementById("drawer-backdrop");
    this.drawer = document.getElementById("detail-drawer");
    this.closeBtn = document.getElementById("drawer-close-btn");
    this.backBtn = document.getElementById("drawer-back-btn");
    this.drawerBody = document.getElementById("drawer-body");

    this.productModeContainer = document.getElementById("drawer-product-mode");
    this.orgModeContainer = document.getElementById("drawer-org-mode");

    this.isOpen = false;
    this.currentMode = null; // 'product' | 'org'
    this.previousOrg = null; // 제품 모드 진입 전의 조직 객체 (돌아가기 지원용)
    this.lastTriggerElement = null; // 포커스 복원용

    this.initEvents();
  }

  initEvents() {
    if (this.closeBtn) {
      this.closeBtn.addEventListener("click", () => this.close());
    }

    if (this.backdrop) {
      this.backdrop.addEventListener("click", () => this.close());
    }

    if (this.backBtn) {
      this.backBtn.addEventListener("click", () => {
        if (this.previousOrg) {
          this.openOrg(this.previousOrg, false);
        }
      });
    }

    // 키보드 이벤트 (ESC 닫기 및 Focus Trap)
    document.addEventListener("keydown", (e) => {
      if (!this.isOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        this.close();
        return;
      }

      if (e.key === "Tab") {
        this.handleFocusTrap(e);
      }
    });
  }

  handleFocusTrap(e) {
    const focusable = this.drawer.querySelectorAll(
      'button:not([disabled]):not([style*="display: none"]), [href]:not([style*="display: none"]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first || document.activeElement === this.drawerBody) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  openProduct(product, triggerEl = null, fromOrg = null) {
    if (triggerEl) this.lastTriggerElement = triggerEl;

    // 만약 조사 기업 소개 엔트리인 경우 조직 상세 화면으로 라우팅
    if (product && product.entry_type === "organization_profile") {
      this.openOrg(product.org, triggerEl);
      return;
    }

    if (fromOrg) {
      this.previousOrg = fromOrg;
    } else {
      this.previousOrg = null;
    }

    this.currentMode = "product";
    this.currentProduct = product;
    this.renderProductMode(product);
    this.showDrawer();
  }

  openOrg(org, triggerEl = null) {
    if (triggerEl) this.lastTriggerElement = triggerEl;
    this.previousOrg = null;

    this.currentMode = "org";
    this.currentOrg = org;
    this.renderOrgMode(org);
    this.showDrawer();
  }

  refresh() {
    if (!this.isOpen) return;
    if (this.currentMode === "product" && this.currentProduct) {
      this.renderProductMode(this.currentProduct);
    } else if (this.currentMode === "org" && this.currentOrg) {
      this.renderOrgMode(this.currentOrg);
    }
  }

  renderProductMode(product) {
    const org = product.org || {};

    // 1. 모드 전환
    this.productModeContainer.style.display = "block";
    this.orgModeContainer.style.display = "none";

    // 2. 돌아가기 버튼
    if (this.previousOrg) {
      this.backBtn.style.display = "inline-flex";
    } else {
      this.backBtn.style.display = "none";
    }

    // 3. 조직 헤더 정보
    const initialEl = document.getElementById("dp-org-initial");
    const displayEl = document.getElementById("dp-org-display");
    const officialEl = document.getElementById("dp-org-official");

    initialEl.textContent = getOrgInitial(org.display_name);
    displayEl.textContent = org.display_name || "";
    officialEl.textContent = (org.official_name && org.official_name !== org.display_name)
      ? `(공식: ${org.official_name})`
      : "";

    // 3-0. 기업 로고 표시 (로고 없거나 실패 시 숨김)
    this.bindOrgLogo("dp-org-logo-container", "dp-org-logo-img", org.org_id, org.display_name);

    // 3-1. 공통 기업 소개 (company_profile)
    const compSec = document.getElementById("dp-sec-company");
    const compDesc = document.getElementById("dp-company-desc");
    const compSources = document.getElementById("dp-company-sources");
    const cp = org.company_profile || null;

    if (compSec && compDesc) {
      if (cp && cp.summary) {
        compDesc.textContent = cp.summary;
        compSec.style.display = "block";
        if (compSources) {
          this.renderCompanySources(compSources, cp.sources, cp.source_label);
        }
      } else {
        compSec.style.display = "none";
        if (compSources) compSources.textContent = "";
      }
    }

    // 4. 제품명
    document.getElementById("dp-product-name").textContent = product.name || "제품명 정보 없음";

    // 5. 4대 분류 메타 그리드 (기술 영역, 산업·업무 영역, 에이전트 구동 형태, 조직 유형, 출처 유형)
    const metaGrid = document.getElementById("dp-meta-grid");
    if (metaGrid) {
      metaGrid.textContent = "";

      // 0) 출처 유형 뱃지 (제품 설문 출처 + 기업 소개 출처 분리)
      const sourceChips = [];
      const srcTag = document.createElement("span");
      srcTag.className = "badge-tag source-survey";
      srcTag.textContent = "설문 제출 제품 (실제 응답)";
      sourceChips.push(srcTag);

      if (cp && cp.source_label) {
        const cpTag = document.createElement("span");
        cpTag.className = "badge-tag source-editorial";
        cpTag.textContent = `기업 소개: ${cp.source_label}`;
        sourceChips.push(cpTag);
      }
      this.appendMetaRow(metaGrid, "출처 구분", sourceChips, "drawer-meta-row admin-only-flex");

      // 1) 기술 영역
      const techChips = (product.technology_domains || []).map(techCode => {
        const tag = document.createElement("span");
        tag.className = "badge-tag tech";
        const techTax = this.data.taxonomies.technology_domains.find(t => t.code === techCode);
        tag.textContent = getTechnologyLabel(techCode, techTax ? techTax.label : techCode);
        return tag;
      });
      this.appendMetaRow(metaGrid, "기술 영역", techChips);

      // 2) 산업·업무 영역
      const industryChips = (product.business_domains || []).map(bizCode => {
        const tag = document.createElement("span");
        tag.className = "badge-tag industry";
        const bizTax = this.data.taxonomies.business_domains.find(b => b.code === bizCode);
        tag.textContent = bizTax ? bizTax.label : bizCode;
        return tag;
      });
      this.appendMetaRow(metaGrid, "산업·업무 영역", industryChips);

      // 3) 에이전트 구동 형태
      const modelChips = (product.operating_models || []).map(opCode => {
        const tag = document.createElement("span");
        tag.className = "badge-tag model";
        const opTax = this.data.taxonomies.operating_models.find(m => m.code === opCode);
        tag.textContent = opTax ? opTax.label : opCode;
        return tag;
      });
      if (modelChips.length > 0) {
        this.appendMetaRow(metaGrid, "에이전트 구동 형태", modelChips);
      }

      // 4) 조직 유형
      const orgTypeChips = [];
      if (org.org_type) {
        const tag = document.createElement("span");
        tag.className = "badge-tag org-type";
        tag.textContent = org.org_type;
        orgTypeChips.push(tag);
      }
      if (org.alliance_member_status) {
        const tag = document.createElement("span");
        tag.className = "badge-tag alliance";
        tag.textContent = org.alliance_member_status;
        orgTypeChips.push(tag);
      }
      this.appendMetaRow(metaGrid, "조직 유형", orgTypeChips);

      // 5) 상위 조직 (존재 시)
      if (org.parent_organization && org.parent_organization.display_name) {
        const parentTag = document.createElement("span");
        parentTag.className = "badge-tag alliance";
        parentTag.textContent = org.parent_organization.display_name;
        this.appendMetaRow(metaGrid, "상위 조직", [parentTag]);
      }
    }

    // 6. 각 텍스트 필드 바인딩 (값이 없으면 섹션 숨김)
    this.bindTextSection("dp-sec-desc", "dp-desc", product.description);
    this.bindTextSection("dp-sec-tech", "dp-core-tech", product.core_technology);
    this.bindTextSection("dp-sec-market", "dp-target-market", product.target_market);
    this.bindTextSection("dp-sec-competitors", "dp-competitors", product.competitors);
    this.bindTextSection("dp-sec-competitiveness", "dp-core-competitiveness", product.core_competitiveness);
    this.bindTextSection("dp-sec-diff", "dp-diff", product.differentiation);
    this.bindTextSection("dp-sec-cases", "dp-use-cases", product.use_cases);

    // 기타 산업 설명
    let customDomainText = "";
    if (Array.isArray(product.business_domain_customs) && product.business_domain_customs.length > 0) {
      customDomainText = product.business_domain_customs.filter(Boolean).join("\n");
    }
    this.bindTextSection("dp-sec-custom-domain", "dp-custom-domain", customDomainText);

    // 7. 웹사이트 링크 버튼
    this.bindWebsiteButton("dp-website-btn", org.website);
  }

  renderOrgMode(org) {
    // 1. 모드 전환
    this.productModeContainer.style.display = "none";
    this.orgModeContainer.style.display = "block";
    this.backBtn.style.display = "none";

    const cp = org.company_profile || null;
    const ep = org.editorial_profile || null;
    const products = Array.isArray(org.products) ? org.products : [];

    // 2. 조직 기본 정보
    document.getElementById("do-org-initial").textContent = getOrgInitial(org.display_name);
    document.getElementById("do-org-display").textContent = org.display_name || "";
    document.getElementById("do-org-official").textContent = (org.official_name && org.official_name !== org.display_name)
      ? `(공식: ${org.official_name})`
      : "";

    // 2-0. 기업 로고 표시 (로고 없거나 실패 시 숨김)
    this.bindOrgLogo("do-org-logo-container", "do-org-logo-img", org.org_id, org.display_name);

    // 3. 메타 그리드 (조직 유형 및 보유 영역 집계)
    const metaGrid = document.getElementById("do-meta-grid");
    if (metaGrid) {
      metaGrid.textContent = "";

      // 0) 출처 구분 태그 (설문 제출 여부 및 기업 소개 출처 분리)
      const sourceChips = [];
      if (org.has_survey1 || org.has_survey2 || products.length > 0) {
        const tag = document.createElement("span");
        tag.className = "badge-tag source-survey";
        tag.textContent = "설문 제출 기업 (실제 응답)";
        sourceChips.push(tag);
      }
      if (cp && cp.source_label) {
        const tag = document.createElement("span");
        tag.className = "badge-tag source-editorial";
        tag.textContent = `기업 소개: ${cp.source_label}`;
        sourceChips.push(tag);
      }
      if (org.classification_applicability === "organization_role_only") {
        const tag = document.createElement("span");
        tag.className = "badge-tag alliance";
        tag.textContent = "생태계 지원 기관·협회";
        sourceChips.push(tag);
      }
      if (sourceChips.length > 0) {
        this.appendMetaRow(metaGrid, "출처 구분", sourceChips, "drawer-meta-row admin-only-flex");
      }

      // 1) 조직 유형 & 상태
      const orgTypeChips = [];
      if (org.org_type) {
        const badge = document.createElement("span");
        badge.className = "badge-tag org-type";
        badge.textContent = org.org_type;
        orgTypeChips.push(badge);
      }

      if (org.alliance_member_status) {
        const badge = document.createElement("span");
        badge.className = "badge-tag alliance";
        badge.textContent = org.alliance_member_status;
        orgTypeChips.push(badge);
      }

      if (org.classification_status === "unclassified" && org.classification_applicability !== "organization_role_only") {
        const badge = document.createElement("span");
        badge.className = "badge-tag unclassified";
        badge.textContent = "분류 정보 준비 중";
        orgTypeChips.push(badge);
      }
      this.appendMetaRow(metaGrid, "조직 유형", orgTypeChips);

      // 1-1) 상위 조직 (존재 시)
      if (org.parent_organization && org.parent_organization.display_name) {
        const parentBadge = document.createElement("span");
        parentBadge.className = "badge-tag alliance";
        parentBadge.textContent = org.parent_organization.display_name;
        this.appendMetaRow(metaGrid, "상위 조직", [parentBadge]);
      }

      // 2) 기술 영역 (제품 또는 조사 프로필에서 추출)
      let techCodes = [];
      if (products.length > 0) {
        techCodes = [...new Set(products.flatMap(p => p.technology_domains || []))];
      } else if (ep && Array.isArray(ep.technology_domains)) {
        techCodes = ep.technology_domains;
      }
      if (techCodes.length > 0) {
        const techChips = techCodes.map(techCode => {
          const tag = document.createElement("span");
          tag.className = "badge-tag tech";
          const techTax = this.data.taxonomies.technology_domains.find(t => t.code === techCode);
          tag.textContent = getTechnologyLabel(techCode, techTax ? techTax.label : techCode);
          return tag;
        });
        this.appendMetaRow(metaGrid, "기술 영역", techChips);
      }

      // 3) 산업·업무 영역 (제품 또는 조사 프로필에서 추출)
      let bizCodes = [];
      if (products.length > 0) {
        bizCodes = [...new Set(products.flatMap(p => p.business_domains || []))];
      } else if (ep && Array.isArray(ep.business_domains)) {
        bizCodes = ep.business_domains;
      }
      if (bizCodes.length > 0) {
        const industryChips = bizCodes.map(bizCode => {
          const tag = document.createElement("span");
          tag.className = "badge-tag industry";
          const bizTax = this.data.taxonomies.business_domains.find(b => b.code === bizCode);
          tag.textContent = bizTax ? bizTax.label : bizCode;
          return tag;
        });
        this.appendMetaRow(metaGrid, "산업·업무 영역", industryChips);
      }

      // 4) 에이전트 구동 형태 (제품 또는 조사 프로필에서 추출)
      let opCodes = [];
      if (products.length > 0) {
        opCodes = [...new Set(products.flatMap(p => p.operating_models || []))];
      } else if (ep && Array.isArray(ep.operating_models)) {
        opCodes = ep.operating_models;
      }
      if (opCodes.length > 0) {
        const modelChips = opCodes.map(opCode => {
          const tag = document.createElement("span");
          tag.className = "badge-tag model";
          const opTax = this.data.taxonomies.operating_models.find(m => m.code === opCode);
          tag.textContent = opTax ? opTax.label : opCode;
          return tag;
        });
        this.appendMetaRow(metaGrid, "에이전트 구동 형태", modelChips);
      }
    }

    // 3-1. 공통 기업 소개 (company_profile)
    const orgCompSec = document.getElementById("do-sec-company");
    const orgCompDesc = document.getElementById("do-company-desc");
    const orgCompSources = document.getElementById("do-company-sources");

    if (orgCompSec && orgCompDesc) {
      if (cp && cp.summary) {
        orgCompDesc.textContent = cp.summary;
        orgCompSec.style.display = "block";
        if (orgCompSources) {
          this.renderCompanySources(orgCompSources, cp.sources, cp.source_label);
        }
      } else {
        orgCompSec.style.display = "none";
        if (orgCompSources) orgCompSources.textContent = "";
      }
    }

    // 4. 제품 목록 또는 조사 프로필 렌더링
    const productsListEl = document.getElementById("do-products-list");
    let countEl = document.getElementById("do-product-count");
    const noProductsMsg = document.getElementById("do-no-products-msg");
    const secHeading = document.querySelector("#do-sec-products .drawer-sec-heading");
    if (productsListEl) productsListEl.textContent = "";

    // 이전 동적 생성 섹션 정리
    const existingEditorialSec = document.getElementById("do-editorial-dynamic-sec");
    if (existingEditorialSec) {
      existingEditorialSec.remove();
    }

    // 만약 이전 오류 등으로 countEl이 DOM에서 소실되었다면 헤딩 내부 구조 자가 복원
    if (!countEl && secHeading) {
      secHeading.innerHTML = '등록 제품 및 서비스 (<span id="do-product-count">0</span>)';
      countEl = document.getElementById("do-product-count");
    }

    if (products.length > 0) {
      if (secHeading) secHeading.style.display = "";
      if (countEl) countEl.textContent = String(products.length);
      if (noProductsMsg) noProductsMsg.style.display = "none";
      if (productsListEl) {
        products.forEach((prod, idx) => {
          const block = this.createExpandedProductCard(prod, idx, products.length, org);
          productsListEl.appendChild(block);
        });
      }
    } else {
      // 실제 등록된 제품이 없는 경우 (조사 기업 또는 지원 기관)
      if (secHeading) secHeading.style.display = "none";
      if (countEl) countEl.textContent = "0";
      if (noProductsMsg) noProductsMsg.style.display = "none";

      const editorialSec = document.createElement("div");
      editorialSec.id = "do-editorial-dynamic-sec";
      editorialSec.className = "drawer-editorial-section";

      if (org.classification_applicability === "organization_role_only") {
        const notice = document.createElement("div");
        notice.className = "drawer-notice-box";
        notice.textContent = "AI 생태계 지원 및 정책·표준화·육성 역할을 수행하는 기관/협회입니다.";
        editorialSec.appendChild(notice);
      } else {
        // 등록 자료 요약이 있고 summary와 다른 경우 추가 표시 (관리자 모드 전용)
        if (cp && cp.registration_summary && cp.registration_summary !== cp.summary) {
          const regBlock = document.createElement("div");
          regBlock.className = "drawer-section admin-only-block";
          const h4 = document.createElement("h4");
          h4.className = "drawer-sec-heading";
          h4.textContent = "등록 자료 요약";
          const p = document.createElement("p");
          p.className = "drawer-sec-text";
          p.textContent = cp.registration_summary;
          regBlock.appendChild(h4);
          regBlock.appendChild(p);
          editorialSec.appendChild(regBlock);
        }

        const notice = document.createElement("div");
        notice.className = "drawer-notice-box admin-only-block";
        notice.textContent = "※ 본 기업은 IT조선 조사팀의 공개 자료 조사 및 회원사 등록자료 검증을 바탕으로 소개와 분류가 수록되었습니다. (실제 설문 제출 제품 129개와 구분됩니다)";
        editorialSec.appendChild(notice);
      }

      productsListEl.appendChild(editorialSec);
    }

    // 5. 웹사이트 링크 버튼
    this.bindWebsiteButton("do-website-btn", org.website);
  }

  createExpandedProductCard(prod, idx, total, org = null) {
    const card = document.createElement("div");
    card.className = "drawer-expanded-product-card";

    // 1. 헤더 (제품 번호, 제품명, 상세 보기 버튼)
    const header = document.createElement("div");
    header.className = "drawer-expanded-header";

    if (total > 1) {
      const idxBadge = document.createElement("span");
      idxBadge.className = "drawer-product-seq-badge";
      idxBadge.textContent = `제품 ${idx + 1} / ${total}`;
      header.appendChild(idxBadge);
    }

    const title = document.createElement("h3");
    title.className = "drawer-expanded-product-name";
    title.textContent = prod.name || "제품명 정보 없음";
    header.appendChild(title);

    const srcTag = document.createElement("span");
    srcTag.className = "badge-tag source-survey admin-only";
    srcTag.textContent = "설문 제출 제품";
    header.appendChild(srcTag);

    card.appendChild(header);

    // 2. 도메인 및 구동 형태 뱃지들 (라벨과 함께 분류별로 정돈)
    const cardMeta = document.createElement("div");
    cardMeta.className = "drawer-card-meta-grid";

    const techChips = (prod.technology_domains || []).map(techCode => {
      const tag = document.createElement("span");
      tag.className = "badge-tag tech";
      const techTax = this.data.taxonomies.technology_domains.find(t => t.code === techCode);
      tag.textContent = getTechnologyLabel(techCode, techTax ? techTax.label : techCode);
      return tag;
    });
    this.appendMetaRow(cardMeta, "기술 영역", techChips, "drawer-card-meta-row");

    const industryChips = (prod.business_domains || []).map(bizCode => {
      const tag = document.createElement("span");
      tag.className = "badge-tag industry";
      const bizTax = this.data.taxonomies.business_domains.find(b => b.code === bizCode);
      tag.textContent = bizTax ? bizTax.label : bizCode;
      return tag;
    });
    this.appendMetaRow(cardMeta, "산업·업무 영역", industryChips, "drawer-card-meta-row");

    const modelChips = (prod.operating_models || []).map(opCode => {
      const tag = document.createElement("span");
      tag.className = "badge-tag model";
      const opTax = this.data.taxonomies.operating_models.find(m => m.code === opCode);
      tag.textContent = opTax ? opTax.label : opCode;
      return tag;
    });
    this.appendMetaRow(cardMeta, "에이전트 구동 형태", modelChips, "drawer-card-meta-row");

    if (cardMeta.childNodes.length > 0) {
      card.appendChild(cardMeta);
    }

    // 3. 각 텍스트 섹션 빌더
    const addSection = (headingText, contentText) => {
      if (!contentText || String(contentText).trim().length === 0) return;
      const sec = document.createElement("div");
      sec.className = "drawer-section";

      const h4 = document.createElement("h4");
      h4.className = "drawer-sec-heading";
      h4.textContent = headingText;

      const p = document.createElement("p");
      p.className = "drawer-sec-text";
      p.textContent = String(contentText).trim();

      sec.appendChild(h4);
      sec.appendChild(p);
      card.appendChild(sec);
    };

    addSection("제품 개요", prod.description);
    addSection("핵심 기술", prod.core_technology);
    addSection("타깃 시장", prod.target_market);
    addSection("주요 경쟁사 및 유사 서비스", prod.competitors);
    addSection("핵심 경쟁력", prod.core_competitiveness);
    addSection("차별점", prod.differentiation);
    addSection("주요 활용 사례", prod.use_cases);

    // 기타 산업 설명
    let customDomainText = "";
    if (Array.isArray(prod.business_domain_customs) && prod.business_domain_customs.length > 0) {
      customDomainText = prod.business_domain_customs.filter(Boolean).join("\n");
    }
    addSection("기타 산업 설명", customDomainText);

    return card;
  }

  bindTextSection(sectionId, textId, value) {
    const secEl = document.getElementById(sectionId);
    const textEl = document.getElementById(textId);
    if (!secEl || !textEl) return;

    if (value && String(value).trim().length > 0) {
      textEl.textContent = String(value).trim();
      secEl.style.display = "block";
    } else {
      secEl.style.display = "none";
    }
  }

  bindWebsiteButton(btnId, url) {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
      btn.href = url;
      btn.style.display = "inline-flex";
    } else {
      btn.style.display = "none";
      btn.removeAttribute("href");
    }
  }

  appendMetaRow(parent, labelText, chips, rowClass = "drawer-meta-row") {
    if (!chips || chips.length === 0) return;

    const row = document.createElement("div");
    row.className = rowClass;

    const label = document.createElement("span");
    label.className = "drawer-meta-label";
    label.textContent = labelText;
    row.appendChild(label);

    const container = document.createElement("div");
    container.className = "drawer-meta-chips";
    chips.forEach(chip => container.appendChild(chip));
    row.appendChild(container);

    parent.appendChild(row);
  }

  renderCompanySources(container, sources, sourceLabel = null) {
    container.textContent = "";
    if ((!sources || sources.length === 0) && !sourceLabel) return;

    if (sourceLabel) {
      const labelBadge = document.createElement("div");
      labelBadge.className = "drawer-source-label-badge";
      labelBadge.textContent = `출처 구분: ${sourceLabel}`;
      container.appendChild(labelBadge);
    }

    if (Array.isArray(sources) && sources.length > 0) {
      const list = document.createElement("ul");
      list.className = "drawer-sources-list";

      sources.forEach(src => {
        const li = document.createElement("li");
        li.className = "drawer-source-item";

        if (src.url) {
          const link = document.createElement("a");
          link.href = src.url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.className = "drawer-source-link";
          link.textContent = src.label || src.url;
          li.appendChild(link);
        } else {
          const span = document.createElement("span");
          span.className = "drawer-source-text";
          span.textContent = src.label || "자료 출처";
          li.appendChild(span);
        }

        if (src.checked_at) {
          const dateSpan = document.createElement("span");
          dateSpan.className = "drawer-source-date";
          dateSpan.textContent = ` (확인일: ${src.checked_at})`;
          li.appendChild(dateSpan);
        }

        list.appendChild(li);
      });
      container.appendChild(list);
    }
  }

  showDrawer() {
    this.isOpen = true;
    document.body.classList.add("drawer-open");

    this.backdrop.style.display = "block";
    this.drawer.style.display = "flex";
    this.drawer.setAttribute("aria-hidden", "false");
    this.backdrop.setAttribute("aria-hidden", "false");

    // 강제 리플로우 후 active 클래스 적용하여 부드러운 애니메이션 발동
    void this.drawer.offsetWidth;
    this.backdrop.classList.add("active");
    this.drawer.classList.add("active");

    this.drawerBody.scrollTop = 0;
    this.closeBtn.focus();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;

    this.backdrop.classList.remove("active");
    this.drawer.classList.remove("active");
    this.drawer.setAttribute("aria-hidden", "true");
    this.backdrop.setAttribute("aria-hidden", "true");

    setTimeout(() => {
      if (!this.isOpen) {
        this.backdrop.style.display = "none";
        this.drawer.style.display = "none";
        document.body.classList.remove("drawer-open");
      }
    }, 250);

    // 로고 영역 초기화
    this.clearOrgLogo("dp-org-logo-container", "dp-org-logo-img");
    this.clearOrgLogo("do-org-logo-container", "do-org-logo-img");

    // 포커스 복원
    if (this.lastTriggerElement && typeof this.lastTriggerElement.focus === "function") {
      this.lastTriggerElement.focus();
    }
  }

  /**
   * 로고 영역 초기화 (즉시 숨김 및 잔상 제거)
   */
  clearOrgLogo(containerId, imgId) {
    const container = document.getElementById(containerId);
    const imgEl = document.getElementById(imgId);
    if (container) {
      container.style.display = "none";
      container.dataset.pendingRequest = "";
    }
    if (imgEl) {
      imgEl.onload = null;
      imgEl.onerror = null;
      imgEl.src = "";
      imgEl.alt = "";
    }
  }

  /**
   * 조직 로고 안전 바인딩
   * - 로고가 없거나 로딩 실패 시 영역 숨김
   * - 비동기 이미지 로딩 시 이전 기업 잔상 및 레이스 컨디션 방지
   * - 한글, 특수문자, 공백 안전 URL 인코딩 처리
   */
  bindOrgLogo(containerId, imgId, orgId, orgDisplayName) {
    const container = document.getElementById(containerId);
    const imgEl = document.getElementById(imgId);
    if (!container || !imgEl) return;

    // 1. 기존 상태 즉시 초기화 (잔상 제거)
    this.clearOrgLogo(containerId, imgId);

    // 2. 로고 매핑 존재 여부 검사
    if (!orgId || !ORG_LOGOS || !ORG_LOGOS[orgId]) {
      return;
    }

    const filename = ORG_LOGOS[orgId];
    // index.html 기준 상대 경로 (encodeURIComponent로 공백 및 특수문자 안전 인코딩)
    const encodedSrc = `./logos-asset/${encodeURIComponent(filename)}`;

    // 3. 레이스 컨디션 방지 토큰 (연속 클릭 시 이전 요청 무시)
    const requestId = `${containerId}_${orgId}_${Date.now()}`;
    container.dataset.pendingRequest = requestId;

    // 4. 사전 로드 이미지로 검증 후 표시
    const loader = new Image();
    loader.onload = () => {
      // 최신 요청과 일치할 때만 실제 DOM에 반영
      if (container.dataset.pendingRequest === requestId) {
        imgEl.src = encodedSrc;
        imgEl.alt = `${orgDisplayName || ""} 로고`;
        container.style.display = "flex";
      }
    };
    loader.onerror = () => {
      // 로딩 실패 시 영역 숨김 유지
      if (container.dataset.pendingRequest === requestId) {
        this.clearOrgLogo(containerId, imgId);
      }
    };
    loader.src = encodedSrc;
  }
}
