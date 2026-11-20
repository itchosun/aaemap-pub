// 에이전틱 AI 생태계 지도 웹사이트 설정 파일
// (자동 생성 도구: scripts/manage-gate.py)

export const APP_CONFIG = {
  // true: 비밀번호 잠금 활성화 / false: 전체 공개 전환
  GATE_ENABLED: true,

  // 솔트 키 (레인보우 테이블 및 사전 공격 무력화)
  SALT: "itchosun*",

  // 비밀번호 + 솔트의 SHA-256 해시값
  PASSWORD_HASH: "de3fb2e7480bee99aa8f452a53e4c26273352a9719169c8217a399ec64fe3907",
};

export const ADMIN_CONFIG = {
  // 관리자 모드 솔트 키
  SALT: "itchosun_admin*",

  // 비밀번호("itchosun") + 솔트의 SHA-256 해시값
  PASSWORD_HASH: "374bffd1e84206c6bff91c123decdd8c08e3eca5d1938c4affae3c8c0a8bf977",
};

export const CONTACT_CONFIG = {
  // 문의 안내 문구 접두사
  prefixText: "문의 또는 업데이트 사항이 있으실 땐, ",

  // 링크 표시명 (이메일 주소 또는 추후 폼 명칭)
  linkText: "aitech@chosunbiz.com",

  // 링크 주소 (현재: mailto:, 추후: 구글폼 등 URL로 교체 가능)
  linkUrl: "mailto:aitech@chosunbiz.com",

  // 문의 안내 문구 접미사
  suffixText: "으로 연락주세요.",
};


