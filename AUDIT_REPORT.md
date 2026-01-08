# Inoia Backend Audit Report

**Date:** 2026-01-08  
**Auditor:** Trae AI Agent  
**Target:** Inoia Backend Codebase  

## 1. Executive Summary

**Overall Health Score: 8/10**

The Inoia backend demonstrates a strong foundation in security and architecture. It uses modern NestJS practices, robust authentication mechanisms (Argon2, JWT), and standard security middleware (Helmet, Throttler). However, it is not yet "production-ready" due to one critical data leak, missing deployment configuration (Dockerfile), and significant feature gaps for a mental health platform (Search, Public Profiles, Real-time).

### Key Findings
- **Critical Security Issue**: `verificationToken` is leaked in the `signup` API response.
- **Architecture**: Clean, modular, and scalable NestJS implementation.
- **Features**: Core features (Auth, Forum, Reporting) are present but minimal.

---

## 2. Security Audit

### 2.1 OWASP Top 10 Compliance
| Category | Status | Notes |
| :--- | :--- | :--- |
| **A01: Broken Access Control** | ✅ **Pass** | `AtGuard` and `RolesGuard` applied globally. Refresh token rotation implemented. |
| **A02: Cryptographic Failures** | ✅ **Pass** | Passwords and tokens hashed with Argon2. `verificationToken` is hashed in DB. |
| **A03: Injection** | ✅ **Pass** | Prisma ORM prevents SQL injection. Input validation via `class-validator`. |
| **A04: Insecure Design** | ⚠️ **Warning** | `verificationToken` returned in API response (see Critical Finding 2.1.1). |
| **A05: Security Misconfig** | ✅ **Pass** | `Helmet` enabled. `CORS` configured (defaults to `true` if env missing, safe for dev). |
| **A07: Identification Failures** | ✅ **Pass** | Strong password policies and token expiry (15m AT, 7d RT). |

### 2.1.1 Critical Finding: Data Leak in Signup
**Location**: `src/auth/auth.service.ts` (Lines 50-54)  
**Issue**: The `signup` method returns the plain-text `verificationToken` in the response body.  
**Risk**: If intercepted or logged by a client, this allows email verification bypass.  
**Remediation**: Remove the token from the response. Ensure it is only sent via email (mocked or real).

### 2.2 Dependency Audit
- **Status**: ✅ **Healthy**
- **Major Libraries**:
    - `@nestjs/common`: ^11.0.1 (Current)
    - `prisma`: ^6.19.1 (Current)
    - `argon2`: ^0.44.0 (Secure)
    - `helmet`: ^8.1.0 (Secure)
- **Note**: `npm audit` was not run in this environment, but versions are recent and actively maintained.

---

## 3. Feature Gap Analysis

To meet the standard of a "Production Mental Health Platform", the following are missing:

### 3.1 Search Functionality (High Priority)
- **Current**: Pagination only.
- **Missing**: Keyword search for Forum Posts and Users.
- **Impact**: Users cannot find relevant support topics or therapists.

### 3.2 Public Profiles (Medium Priority)
- **Current**: `/users/me` allows self-view.
- **Missing**: `/users/:username` or `/therapists/:id` to view public details of others.
- **Impact**: Limits community interaction and therapist verification visibility.

### 3.3 Real-Time Capabilities (Medium Priority)
- **Current**: API polling for notifications.
- **Missing**: WebSockets (Gateway) or Server-Sent Events (SSE).
- **Impact**: Chat and Notifications are not instant, degrading user experience.

---

## 4. Best Practices & Deployment Review

### 4.1 Code Structure
- **Strengths**: Follows official NestJS module structure. Use of DTOs and decorators is consistent.
- **Weaknesses**: Some controllers rely on implicit behavior (e.g., `signup` returning token for testing convenience).

### 4.2 Deployment Readiness
- **Docker**: `docker-compose.yml` exists for Database only.
- **Missing**: **No `Dockerfile`** for the Node.js application itself.
- **CI/CD**: No pipeline configuration (`.github/workflows` or similar) found.

### 4.3 Testing
- **Status**: E2E testing framework is set up (`test/*.e2e-spec.ts`).
- **Recommendation**: Ensure unit test coverage for complex logic in `AuthService` and `ForumService`.

---

## 5. Recommendations

### Immediate Actions (Critical)
1.  **Fix Security Leak**: Modify `AuthService.signup` to remove `verificationToken` from the return object.
2.  **Add Dockerfile**: Create a multi-stage `Dockerfile` to containerize the NestJS application for production.

### Short-Term Improvements (High Value)
3.  **Implement Search**: Add full-text search (Postgres `tsvector` or simple `contains`) to `ForumService`.
4.  **Profile Endpoint**: Create `UsersController.getProfile(username)` with restricted data exposure.

### Long-Term Goals
5.  **Real-Time**: Implement `Socket.io` gateway for `AiChat` and `Notification`.
