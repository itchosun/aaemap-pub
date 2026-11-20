/**
 * 데이터 로더 및 지형도 데이터 처리 모듈 (site_new/js/landscape.js)
 * - no-store 캐시 방지 fetch
 * - 실시간 동적 통계 계산 및 meta 불일치 콘솔 경고
 * - 초성 추출 및 4단계 정렬 엔진
 */

// 기술 분류 표시명 UI 오버라이드 (원본 JSON 코드 및 값은 유지)
export const TECHNOLOGY_LABEL_OVERRIDES = {
  domain_specific_agent_service: "에이전트 애플리케이션·서비스"
};

/**
 * 기술 도메인의 표시명을 반환합니다.
 */
export function getTechnologyLabel(code, originalLabel) {
  return TECHNOLOGY_LABEL_OVERRIDES[code] || originalLabel || code;
}

// 한글 초성 목록
const CHOSEONG_LIST = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"
];

// 초성 그룹 매핑 (된소리를 기본 초성으로 묶음)
const CHOSEONG_GROUP_MAP = {
  "ㄲ": "ㄱ",
  "ㄸ": "ㄷ",
  "ㅃ": "ㅂ",
  "ㅆ": "ㅅ",
  "ㅉ": "ㅈ"
};

/**
 * 문자열의 첫 글자에서 초성 또는 대표 문자를 추출합니다.
 */
export function getChoseong(str) {
  if (!str) return "기타";
  // 앞단의 (주), (사) 등의 특수 표기 제거 후 판별
  const clean = str.replace(/^[\(\[\{][^\)\]\}]+[\)\]\}]\s*/, "").trim();
  const char = clean[0] || str[0] || "";
  const code = char.charCodeAt(0);

  // 1. 한글 음절 (가 ~ 힣)
  if (code >= 0xAC00 && code <= 0xD7A3) {
    const choseongIndex = Math.floor((code - 0xAC00) / (21 * 28));
    const ch = CHOSEONG_LIST[choseongIndex] || "기타";
    return CHOSEONG_GROUP_MAP[ch] || ch;
  }

  // 2. 영문 대소문자
  if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
    return char.toUpperCase();
  }

  // 3. 숫자 및 특수문자
  return "기타";
}

/**
 * 조직명에서 36x36 이니셜 뱃지용 텍스트를 추출합니다.
 */
export function getOrgInitial(name) {
  if (!name) return "·";
  const clean = name.replace(/^[\(\[\{][^\)\]\}]+[\)\]\}]\s*/, "").trim();
  const char = clean[0] || name[0] || "·";
  return char.toUpperCase();
}

/**
 * 4단계 정렬 기준 (표시 항목용):
 * 1. 조직 표시명 가나다·영문 오름차순
 * 2. 동일 조직 안에서는 제품명 가나다·영문 오름차순
 * 3. 조직 표시명이 같으면 org_id 오름차순
 * 4. 제품명도 같으면 entry_id / product_id 오름차순
 */
export function sortDisplayEntries(entriesList) {
  return [...entriesList].sort((a, b) => {
    // 1. 조직 표시명
    const orgA = a.org?.display_name || "";
    const orgB = b.org?.display_name || "";
    const orgCompare = orgA.localeCompare(orgB, "ko-KR");
    if (orgCompare !== 0) return orgCompare;

    // 2. 제품명 가나다순 (제품이 있는 경우 우선 정렬)
    const nameA = a.name || "";
    const nameB = b.name || "";
    const nameCompare = nameA.localeCompare(nameB, "ko-KR");
    if (nameCompare !== 0) return nameCompare;

    // 3. org_id
    const orgIdA = a.org?.org_id || "";
    const orgIdB = b.org?.org_id || "";
    const orgIdCompare = orgIdA.localeCompare(orgIdB);
    if (orgIdCompare !== 0) return orgIdCompare;

    // 4. entry_id 또는 product_id
    const idA = a.product_id || a.entry_id || "";
    const idB = b.product_id || b.entry_id || "";
    return idA.localeCompare(idB);
  });
}

/**
 * 4단계 정렬 기준 (제품 전용):
 * 1. 조직 표시명 가나다·영문 오름차순
 * 2. 동일 조직 안에서는 제품명 가나다·영문 오름차순
 * 3. 조직 표시명이 같으면 org_id 오름차순
 * 4. 제품명도 같으면 product_id 오름차순
 */
export function sortProducts(productList) {
  return sortDisplayEntries(productList);
}

/**
 * JSON 마스터 데이터를 로드하고 인덱싱합니다.
 */
export async function loadLandscapeData() {
  const response = await fetch("./data/agentic-ai-landscape-public.json", {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`데이터 로딩 실패: HTTP ${response.status}`);
  }

  const raw = await response.json();

  const rawOrgs = raw.organizations || [];
  const rawEntries = raw.display_entries || [];
  const taxonomies = raw.taxonomies || {};

  // taxonomies order 기준 정렬
  const techDomains = [...(taxonomies.technology_domains || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  const bizDomains = [...(taxonomies.business_domains || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  const operatingModels = [...(taxonomies.operating_models || [])].sort((a, b) => (a.order || 0) - (b.order || 0));

  // 1. organizations에 들어 있는 모든 parent_org_id를 수집해 parentOrgIds 집합 생성
  const parentOrgIds = new Set(
    rawOrgs
      .map(o => o.parent_org_id || o.parent_organization?.org_id)
      .filter(Boolean)
  );

  // 원본 전체 조직 맵 보존 (하위 조직의 parent_organization 조회 및 원본 관계 보존)
  const allOrgMap = new Map();
  rawOrgs.forEach(org => allOrgMap.set(org.org_id, org));

  // 최상위 조직 목록 중 parentOrgIds에 포함된 상위 조직은 공개 화면 표시 대상에서 제외
  const orgs = rawOrgs.filter(org => !parentOrgIds.has(org.org_id));

  // 2. 실데이터 기반 통계 계산 (상위 조직 제외된 공개 대상 기준)
  const totalOrgs = orgs.length;
  let totalPrds = 0;
  let classifiedOrgs = 0;
  let unclassifiedOrgs = 0;
  let totalEditorialProfiles = 0;
  let totalCompanyIntros = 0;

  const orgMap = new Map();
  const productMap = new Map();
  const allProducts = [];

  orgs.forEach(org => {
    orgMap.set(org.org_id, org);

    if (org.classification_status === "classified") {
      classifiedOrgs++;
    } else {
      unclassifiedOrgs++;
    }

    if (org.editorial_profile) {
      totalEditorialProfiles++;
    }

    if (org.company_profile && org.company_profile.summary) {
      totalCompanyIntros++;
    }

    if (Array.isArray(org.products)) {
      org.products.forEach(prod => {
        totalPrds++;
        const enhancedProd = {
          ...prod,
          org: org,
          entry_type: "product",
          source_type: "survey",
          entry_id: `product:${prod.product_id}`,
          company_summary: org.company_profile?.summary || null
        };
        allProducts.push(enhancedProd);
        productMap.set(prod.product_id, enhancedProd);
      });
    }
  });

  // 3. display_entries 기반 통합 표시 항목 생성 (제외된 상위 조직 엔트리 제외)
  const allDisplayEntries = [];
  const displayEntryMap = new Map();

  if (rawEntries.length > 0) {
    rawEntries.forEach(entry => {
      // 제외된 상위 조직에 속한 제품·조직소개 엔트리는 지형도에 표시하지 않음
      if (parentOrgIds.has(entry.org_id)) return;

      const org = orgMap.get(entry.org_id);
      if (!org) return;

      if (entry.entry_type === "product") {
        const prod = productMap.get(entry.product_id);
        if (prod) {
          const item = {
            ...prod,
            entry_id: entry.entry_id || `product:${entry.product_id}`,
            company_summary: org.company_profile?.summary || null
          };
          allDisplayEntries.push(item);
          displayEntryMap.set(item.entry_id, item);
        }
      } else if (entry.entry_type === "organization_profile") {
        const ep = org.editorial_profile || {};
        const cp = org.company_profile || {};
        const summary = cp.summary || ep.summary || ep.registration_summary || "";
        const item = {
          entry_id: entry.entry_id || `organization:${entry.org_id}`,
          entry_type: "organization_profile",
          profile_id: entry.profile_id || ep.profile_id,
          org: org,
          name: "",
          description: summary,
          company_summary: summary,
          technology_domains: ep.technology_domains || [],
          business_domains: ep.business_domains || [],
          operating_models: ep.operating_models || [],
          source_type: ep.source_type || "editorial_research",
          company_confirmed: Boolean(ep.company_confirmed),
          sources: ep.sources || cp.sources || [],
          summary_source_ids: ep.summary_source_ids || [],
          registration_source_id: ep.registration_source_id || null,
          classification_provenance: ep.classification_provenance || []
        };
        allDisplayEntries.push(item);
        displayEntryMap.set(item.entry_id, item);
      }
    });
  } else {
    // display_entries가 없을 때 폴백
    allProducts.forEach(p => allDisplayEntries.push(p));
  }

  // meta 통계 (상위 조직 중복 제외 반영)
  const meta = raw.meta || {};
  const excludedParentsCount = rawOrgs.filter(o => parentOrgIds.has(o.org_id)).length;
  const expectedTotalOrgs = (meta.total_organizations || 0) - excludedParentsCount;
  if ((meta.total_organizations && meta.total_organizations !== totalOrgs && expectedTotalOrgs !== totalOrgs) ||
      (meta.total_products && meta.total_products !== totalPrds)) {
    console.warn("[데이터 정합성 경고] JSON meta 통계와 실제 계산 결과가 다릅니다:", {
      meta: {
        total_organizations: meta.total_organizations,
        total_products: meta.total_products,
        classified: meta.classified_organizations,
        unclassified: meta.unclassified_organizations
      },
      calculated: {
        total_organizations: totalOrgs,
        total_products: totalPrds,
        classified: classifiedOrgs,
        unclassified: unclassifiedOrgs
      }
    });
  }

  return {
    raw,
    stats: {
      total_organizations: totalOrgs,
      total_products: totalPrds,
      total_company_introductions: meta.total_company_introductions || totalCompanyIntros,
      missing_company_introductions: meta.missing_company_introductions || 4,
      total_editorial_profiles: totalEditorialProfiles,
      total_display_entries: allDisplayEntries.length,
      classified_organizations: classifiedOrgs,
      unclassified_organizations: unclassifiedOrgs
    },
    taxonomies: {
      technology_domains: techDomains,
      business_domains: bizDomains,
      operating_models: operatingModels
    },
    organizations: orgs,
    allProducts,
    allDisplayEntries,
    orgMap,
    allOrgMap,
    parentOrgIds,
    productMap,
    displayEntryMap
  };
}
