// 에이전틱 AI 생태계 지도 웹사이트 설정 파일
// (자동 생성 도구: scripts/manage-gate.py)

export const APP_CONFIG = {
  // true: 비밀번호 잠금 활성화 / false: 전체 공개 전환
  GATE_ENABLED: false,

  // 솔트 키 (레인보우 테이블 및 사전 공격 무력화)
  SALT: "admin*",

  // 비밀번호 + 솔트의 SHA-256 해시값
  PASSWORD_HASH: "da046314241ff9e1df9ab31db0c7d2247576cf99c95fcb0176f8bd72408d6421",
};

export const ADMIN_CONFIG = {
  // 데이터 출처 보기 솔트 키
  SALT: "administrator*",

  // 비밀번호 + 솔트의 SHA-256 해시값
  PASSWORD_HASH: "1c6c6e9f911e4c64af41b288ed0aa883e6e5e6e5ae7f57e1903f49f9f2796d7d",
};

export const CONTACT_CONFIG = {
  // 문의 안내 문구 접두사
  prefixText: "문의 또는 업데이트 사항이 있으실 땐, ",

  // 링크 표시명 (이메일 주소 또는 추후 폼 명칭)
  linkText: "문의 접수 폼",

  // 링크 주소 (현재: mailto:, 추후: 구글폼 등 URL로 교체 가능)
  linkUrl: "https://forms.gle/45khxgLhxoGPPxtb6",

  // 문의 안내 문구 접미사
  suffixText: "을 이용해 주세요.",
};


