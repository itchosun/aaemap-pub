/**
 * 관리자 모드 제어 모듈 (site/js/admin.js)
 * - sessionStorage 기반 활성 상태 관리 ('agentic_ai_admin_mode')
 * - Pure JS SHA-256 + 솔트 검증
 * - 모달 다이얼로그 (포커스 트랩, ESC/Enter 지원)
 * - 상단 상태 배너 및 하단 진입/종료 버튼 관리
 * - 모드 전환 시 실시간 UI 갱신 이벤트 콜백
 */

import { ADMIN_CONFIG } from "./config.js";
import { sha256 } from "./gate.js";

const SESSION_KEY = "agentic_ai_admin_mode";

export class AdminManager {
  constructor(onModeChange = null) {
    this.onModeChange = onModeChange;
    this.modal = document.getElementById("admin-modal");
    this.form = document.getElementById("admin-modal-form");
    this.pwdInput = document.getElementById("admin-password-input");
    this.errorMsg = document.getElementById("admin-error-msg");
    this.cancelBtn = document.getElementById("admin-modal-cancel-btn");
    this.toggleBtn = document.getElementById("admin-mode-toggle-btn");
    this.statusBanner = document.getElementById("admin-status-banner");
    this.exitBannerBtn = document.getElementById("admin-mode-exit-btn");

    this.isAdmin = this.loadState();
    this.initEvents();
    this.applyState(false); // 초기 로딩 시 적용 (콜백 트리거 방지)
  }

  loadState() {
    try {
      return sessionStorage.getItem(SESSION_KEY) === "true";
    } catch {
      return false;
    }
  }

  saveState(active) {
    try {
      if (active) {
        sessionStorage.setItem(SESSION_KEY, "true");
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
    } catch (e) {
      console.warn("sessionStorage 접근 실패:", e);
    }
    this.isAdmin = active;
  }

  initEvents() {
    // 1. 하단 진입/종료 토글 버튼
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener("click", () => {
        if (this.isAdmin) {
          this.exitAdminMode();
        } else {
          this.openModal();
        }
      });
    }

    // 2. 상단 배너 종료 버튼
    if (this.exitBannerBtn) {
      this.exitBannerBtn.addEventListener("click", () => {
        this.exitAdminMode();
      });
    }

    // 3. 모달 취소 버튼
    if (this.cancelBtn) {
      this.cancelBtn.addEventListener("click", () => {
        this.closeModal();
      });
    }

    // 4. 모달 배경 클릭 시 닫기
    if (this.modal) {
      this.modal.addEventListener("click", (e) => {
        if (e.target === this.modal) {
          this.closeModal();
        }
      });
    }

    // 5. 모달 키보드 이벤트 (ESC 닫기)
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isModalOpen()) {
        e.preventDefault();
        this.closeModal();
      }
    });

    // 6. 폼 제출 (비밀번호 검증)
    if (this.form) {
      this.form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.verifyPassword();
      });
    }
  }

  isModalOpen() {
    return this.modal && this.modal.style.display !== "none";
  }

  openModal() {
    if (!this.modal) return;
    this.modal.style.display = "flex";
    if (this.errorMsg) {
      this.errorMsg.style.display = "none";
      this.errorMsg.textContent = "";
    }
    if (this.pwdInput) {
      this.pwdInput.value = "";
      setTimeout(() => this.pwdInput.focus(), 50);
    }
  }

  closeModal() {
    if (!this.modal) return;
    this.modal.style.display = "none";
    if (this.pwdInput) this.pwdInput.value = "";
    if (this.errorMsg) {
      this.errorMsg.style.display = "none";
      this.errorMsg.textContent = "";
    }
    if (this.toggleBtn) this.toggleBtn.focus();
  }

  verifyPassword() {
    const entered = (this.pwdInput?.value || "").trim();
    if (!entered) {
      this.showError("비밀번호를 입력해 주세요.");
      return;
    }

    const salt = ADMIN_CONFIG.SALT || "";
    const combined = entered + salt;
    const hash = sha256(combined);

    if (hash.toLowerCase() === (ADMIN_CONFIG.PASSWORD_HASH || "").toLowerCase()) {
      // 인증 성공
      this.closeModal();
      this.enterAdminMode();
    } else {
      // 인증 실패
      this.showError("비밀번호가 올바르지 않습니다.");
      if (this.pwdInput) {
        this.pwdInput.select();
      }
    }
  }

  showError(msg) {
    if (this.errorMsg) {
      this.errorMsg.textContent = msg;
      this.errorMsg.style.display = "block";
    }
  }

  enterAdminMode() {
    this.saveState(true);
    this.applyState(true);
  }

  exitAdminMode() {
    this.saveState(false);
    this.applyState(true);
  }

  applyState(triggerCallback = true) {
    if (this.isAdmin) {
      document.body.classList.add("admin-mode");
      if (this.statusBanner) this.statusBanner.style.display = "block";
      if (this.toggleBtn) {
        this.toggleBtn.textContent = "관리자 모드 종료";
        this.toggleBtn.classList.add("active");
        this.toggleBtn.title = "현재 관리자 모드 활성 중 (클릭 시 종료)";
      }
    } else {
      document.body.classList.remove("admin-mode");
      if (this.statusBanner) this.statusBanner.style.display = "none";
      if (this.toggleBtn) {
        this.toggleBtn.textContent = "관리자 모드";
        this.toggleBtn.classList.remove("active");
        this.toggleBtn.title = "관리자 모드로 전환";
      }
    }

    if (triggerCallback && typeof this.onModeChange === "function") {
      this.onModeChange(this.isAdmin);
    }
  }
}
