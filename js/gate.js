/**
 * 시연용 비밀번호 게이트 제어 모듈 (site_new/js/gate.js)
 * - APP_CONFIG.GATE_ENABLED 옵션에 따른 온/오프
 * - Pure JS SHA-256 + 솔트 결합 해시 검증 (HTTP 비보안 환경 및 HTTPS 전 환경 호환)
 * - sessionStorage 기반 세션 유지
 */

import { APP_CONFIG } from "./config.js";

// NIST 표준 SHA-256 라운드 상수 (64개)
const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

/**
 * Pure JavaScript SHA-256 함수
 * (브라우저의 crypto.subtle은 비보안 HTTP/IP 환경에서 undefined로 차단되므로 순수 JS 구현체 사용)
 */
export function sha256(str) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }

  // UTF-8 바이트 변환
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0xd800 || code >= 0xe000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      i++;
      code = 0x10000 + (((code & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }

  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) {
    bytes.push(0);
  }

  const words = [];
  for (let i = 0; i < bytes.length; i += 4) {
    words.push((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]);
  }
  words.push(Math.floor(bitLength / 0x100000000));
  words.push(bitLength | 0);

  let H0 = 0x6a09e667, H1 = 0xbb67ae85, H2 = 0x3c6ef372, H3 = 0xa54ff53a;
  let H4 = 0x510e527f, H5 = 0x9b05688c, H6 = 0x1f83d9ab, H7 = 0x5be0cd19;

  const W = new Int32Array(64);

  for (let i = 0; i < words.length; i += 16) {
    for (let t = 0; t < 16; t++) {
      W[t] = words[i + t];
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rightRotate(W[t - 15], 7) ^ rightRotate(W[t - 15], 18) ^ (W[t - 15] >>> 3);
      const s1 = rightRotate(W[t - 2], 17) ^ rightRotate(W[t - 2], 19) ^ (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
    }

    let a = H0, b = H1, c = H2, d = H3;
    let e = H4, f = H5, g = H6, h = H7;

    for (let t = 0; t < 64; t++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + W[t]) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    H0 = (H0 + a) | 0;
    H1 = (H1 + b) | 0;
    H2 = (H2 + c) | 0;
    H3 = (H3 + d) | 0;
    H4 = (H4 + e) | 0;
    H5 = (H5 + f) | 0;
    H6 = (H6 + g) | 0;
    H7 = (H7 + h) | 0;
  }

  const toHex = (n) => (n >>> 0).toString(16).padStart(8, "0");
  return toHex(H0) + toHex(H1) + toHex(H2) + toHex(H3) + toHex(H4) + toHex(H5) + toHex(H6) + toHex(H7);
}

export function initGate() {
  const overlay = document.getElementById("gate-overlay");
  const form = document.getElementById("gate-form");
  const pwdInput = document.getElementById("gate-password");
  const errorMsg = document.getElementById("gate-error");

  // 1. 게이트가 비활성화된 경우 바로 본문 표시
  if (!APP_CONFIG.GATE_ENABLED) {
    if (overlay) overlay.style.display = "none";
    return Promise.resolve(true);
  }

  // 2. 이미 현재 브라우저 세션에서 인증을 완료한 경우
  const isUnlocked = sessionStorage.getItem("agentic_map_auth") === "unlocked";
  if (isUnlocked) {
    if (overlay) overlay.style.display = "none";
    return Promise.resolve(true);
  }

  // 3. 인증 필요 상태 -> 게이트 표시
  if (overlay) overlay.style.display = "flex";
  if (pwdInput) pwdInput.focus();

  return new Promise((resolve) => {
    if (!form) {
      resolve(true);
      return;
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      try {
        const enteredPassword = pwdInput.value.trim();
        if (!enteredPassword) return;

        const salt = APP_CONFIG.SALT || "";
        const combined = enteredPassword + salt;
        const calculatedHash = sha256(combined);

        if (calculatedHash.toLowerCase() === (APP_CONFIG.PASSWORD_HASH || "").toLowerCase()) {
          // 인증 성공
          sessionStorage.setItem("agentic_map_auth", "unlocked");
          if (overlay) overlay.style.display = "none";
          resolve(true);
        } else {
          // 인증 실패
          if (errorMsg) {
            errorMsg.textContent = "비밀번호가 올바르지 않습니다. 다시 입력해 주세요.";
            errorMsg.style.display = "block";
          }
          pwdInput.select();
        }
      } catch (err) {
        console.error("게이트 검증 오류:", err);
        if (errorMsg) {
          errorMsg.textContent = "인증 중 오류가 발생했습니다: " + err.message;
          errorMsg.style.display = "block";
        }
      }
    });
  });
}