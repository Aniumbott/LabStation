# LabStation - Project Audit Report

**Date:** 2026-02-23
**Scope:** Full codebase analysis - bugs, security, performance, code quality, and improvements

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Critical Issues](#2-critical-issues)
3. [High Severity Issues](#3-high-severity-issues)
4. [Medium Severity Issues](#4-medium-severity-issues)
5. [Low Severity Issues](#5-low-severity-issues)
6. [Summary Matrix](#6-summary-matrix)
7. [Recommended Action Plan](#7-recommended-action-plan)

---

## 1. Project Overview

**LabStation** is a full-stack laboratory resource management system built with:

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15.3.2 (App Router, Turbopack) |
| Frontend | React 18.3.1, TypeScript 5.x, TailwindCSS 3.4.1 |
| UI Library | shadcn/ui (Radix UI primitives) |
| Backend/DB | Firebase 11.8.1 (Firestore, Auth), Firebase Admin 12.7.0 |
| Forms | React Hook Form 7.54.2 + Zod 3.24.2 |
| State | TanStack Query 5.66.0, React Context |

**Key features:** Role-based access (Admin/Technician/Researcher), resource booking with conflict detection, lab membership management, maintenance requests, audit logging, notifications.

**File count:** ~85 TypeScript/TSX files across 13+ pages, 30+ UI components, 20+ custom components.

---

## 2. Critical Issues

### C-01: No Server-Side API Layer - All Firestore Operations Are Client-Side

**Files:** `src/lib/firestore-helpers.ts`, `src/app/bookings/page.tsx`, `src/app/admin/users/page.tsx`

All database mutations are performed directly from client-side code using the Firebase client SDK. There are no Next.js API routes or server actions protecting data operations.

**Example** (`src/app/admin/users/page.tsx:167-184`):
```typescript
const userDocRef = doc(db, "users", newUserId);
await setDoc(userDocRef, {
  name: data.name,
  email: data.email,
  role: data.role,    // No backend validation
  status: 'active',
  createdAt: serverTimestamp(),
});
```

**Impact:** Firestore security rules are the only defense. A determined attacker can bypass all client-side validation.

**Fix:** Create dedicated API routes or Next.js server actions with authentication middleware for all write operations.

---

### C-02: Client-Side Role-Based Access Control Only

**File:** `src/components/layout/app-layout.tsx:91-102`

Admin page protection relies entirely on client-side role checks. Navigation items are filtered in the browser, but admin pages at `/admin/*` can be accessed via direct URL.

```typescript
const visibleNavItems = useMemo(() => {
  return navItems.filter(item => {
    if (item.adminOnly) return currentUser.role === 'Admin';
    return true;
  });
}, [currentUser]);
```

The user's role is stored in `localStorage` (`src/components/auth-context.tsx:61`) and can be tampered with.

**Fix:** Implement server-side middleware or layout guards that verify the user's role from Firestore/Firebase Auth custom claims before rendering admin pages.

---

### C-03: Race Condition in Booking Conflict Detection

**File:** `src/app/bookings/page.tsx:565-576`

Between checking for conflicts and creating a booking, another booking can be inserted by a different user. The check-then-act pattern is not atomic.

```typescript
// Step 1: Query for conflicts
const existingBookingsSnapshot = await getDocs(q);
// GAP: Another user could create a booking here
// Step 2: Create the booking
const result = await createBooking_SA(...);
```

**Impact:** Two overlapping bookings can be created for the same resource, defeating the conflict detection system.

**Fix:** Use Firestore transactions to make conflict-check + booking-creation atomic.

---

### C-04: Missing Authorization on Booking Mutations

**File:** `src/app/bookings/page.tsx:631-643`

Booking updates don't verify that the current user owns the booking or is an Admin. Status can be changed from `Pending` to `Confirmed` by any authenticated user.

```typescript
const bookingDataToUpdate: any = {
  resourceId: formData.resourceId!,
  status: formData.status || 'Pending',  // Can be set to 'Confirmed'
};
await updateDoc(bookingDocRef, bookingDataToUpdate);
```

The cancellation check at line 662 only guards one code path, not all status transitions.

**Fix:** Server-side validation: only Admins can transition to `Confirmed`; users can only cancel their own bookings.

---

### C-05: Mock Password Change in Production

**File:** `src/app/profile/page.tsx:103-111`

The password change functionality is a mock implementation with a fake delay:

```typescript
const handleChangePassword = async () => {
  setIsSavingPassword(true);
  await new Promise(resolve => setTimeout(resolve, 1000)); // Mock delay
  setPasswordChangeSuccess("Password changed successfully (mock).");
  toast({ title: "Password Changed (Mock)" });
};
```

**Impact:** Users think their password was changed, but it wasn't. Security vulnerability if users are trying to rotate compromised credentials.

**Fix:** Implement actual password change using Firebase Auth `updatePassword()` or `reauthenticateWithCredential()` + `updatePassword()`.

---

## 3. High Severity Issues

### H-01: Memory Leak - Unclean Async Operations on Unmount

**Files:** `src/app/dashboard/page.tsx:147-171`, `src/app/bookings/page.tsx:131-167`

Multiple `Promise.all()` calls fetch data without cancellation support. If the component unmounts before promises resolve, state setters fire on unmounted components.

```typescript
const fetchedBookingsPromises = bookingsSnapshot.docs.map(async (docSnap) => {
  const userDoc = await getDoc(doc(db, 'users', data.userId));
  // No abort controller, no mounted check
});
let resolvedBookings = await Promise.all(fetchedBookingsPromises);
setAllBookings(resolvedBookings); // May fire after unmount
```

**Fix:** Use `AbortController` or a `useRef(true)` mounted flag to guard state updates.

---

### H-02: N+1 Query Pattern in Bookings

**File:** `src/app/bookings/page.tsx:131-167`

For each booking, if the user isn't in the local cache, an individual Firestore `getDoc` is performed:

```typescript
const userFromList = allUsersForFilter.find(u => u.id === data.userId);
if (!userFromList) {
  const userDoc = await getDoc(doc(db, 'users', data.userId)); // Individual read per booking
}
```

**Impact:** With 100 bookings and a cold cache, this triggers 100+ Firestore reads. Slow, expensive, and may hit rate limits.

**Fix:** Pre-fetch all referenced users in a single batch query, or denormalize user names onto booking documents.

---

### H-03: Fire-and-Forget Promises in Notifications

**Files:** `src/lib/firestore-helpers.ts:422-430, 506-514`, `src/components/auth-context.tsx:169`

Notification promises are not awaited, meaning failures are silently swallowed:

```typescript
adminSnapshot.forEach(adminDoc => {
  addNotification(adminDoc.id, ...); // NOT awaited
});
```

**Fix:** Collect promises and use `Promise.allSettled()`:
```typescript
const promises = adminSnapshot.docs.map(d => addNotification(d.id, ...));
await Promise.allSettled(promises);
```

---

### H-04: `use-toast.ts` Listener Memory Leak

**File:** `src/hooks/use-toast.ts:174-185`

The `useEffect` depends on `[state]`, causing it to re-run on every state change. Each run adds a new listener and removes the old, but the timing can cause listener accumulation:

```typescript
React.useEffect(() => {
  listeners.push(setState);
  return () => {
    const index = listeners.indexOf(setState);
    if (index > -1) listeners.splice(index, 1);
  };
}, [state]); // Should be []
```

**Fix:** Change dependency array to `[]`.

---

### H-05: Signup Fails if Admin Notification Fails

**File:** `src/components/auth-context.tsx:178-190`

`Promise.all()` is used for admin notifications during signup. If any single notification fails, the entire signup process fails:

```typescript
const notificationPromises = adminUsersSnapshot.docs.map(adminDoc => {
  return addNotification(adminDoc.id, 'New Signup Request', ...);
});
await Promise.all(notificationPromises); // One failure = all fail
```

**Fix:** Use `Promise.allSettled()` so signup succeeds even if notifications fail.

---

### H-06: User Deletion Without Referential Integrity

**File:** `src/app/admin/users/page.tsx:212-219`

User deletion removes the user and their lab memberships but doesn't handle:
- Active bookings referencing the deleted user
- Maintenance requests assigned to the user
- Notifications referencing the user
- Audit log entries (these should remain, but display will break)

**Fix:** Check for and handle active references before deletion, or soft-delete users instead.

---

### H-07: Missing Input Validation on User Creation

**File:** `src/app/admin/users/page.tsx:167-184`

Admin-created users bypass email uniqueness checks, role validation, and field length limits:

```typescript
const newUserId = `admin_created_${Date.now()}_${Math.random()...}`;
await setDoc(userDocRef, {
  name: data.name,     // No length limit
  email: data.email,   // No uniqueness check
  role: data.role,     // No enum validation server-side
});
```

**Fix:** Add server-side validation (Zod schema) and check email uniqueness against existing users.

---

### H-08: Race Condition in AdminDataContext

**File:** `src/contexts/AdminDataContext.tsx:28-73`

Multiple rapid `currentUser` changes trigger concurrent `fetchData()` calls with no abort mechanism. The last response wins, but intermediate responses may set stale data.

**Fix:** Add an `AbortController` or request ID to discard stale responses.

---

### H-09: Unsafe `form.reset` in useEffect Dependencies

**File:** `src/components/bookings/log-usage-form-dialog.tsx:82-92`

```typescript
useEffect(() => {
  if (open) form.reset({...});
}, [open, booking, form.reset]); // form.reset changes every render
```

`form.reset` is a new function reference on every render, causing the effect to fire continuously.

**Fix:** Remove `form.reset` from dependencies; use `form` object or wrap in `useCallback`.

---

### H-10: Dangerous Direct Form Control Mutation

**File:** `src/app/signup/page.tsx:53`

```typescript
form.control.disabled = true;  // Direct mutation
// ...
if (!successMessage) form.control.disabled = false;
```

**Fix:** Use `formState.isSubmitting` or a separate `isDisabled` state variable.

---

## 4. Medium Severity Issues

### M-01: 30+ State Variables in Bookings Page

**File:** `src/app/bookings/page.tsx:72-102`

The bookings page manages 30+ independent `useState` calls, causing cascading re-renders on every filter change.

**Fix:** Consolidate related state into `useReducer` or split into sub-components with their own state.

---

### M-02: Missing Debounce on Search Inputs

**File:** `src/app/bookings/page.tsx:793`

Every keystroke in the search input triggers immediate state update and filter recalculation:

```typescript
<Input value={tempSearchTerm} onChange={(e) => setTempSearchTerm(e.target.value)} />
```

**Fix:** Add debounce (300-500ms) using `useDeferredValue` or a debounce utility.

---

### M-03: Broad Exception Catching with `any` Type

**Files:** `src/lib/firestore-helpers.ts` (7 instances), `src/components/auth-context.tsx` (4 instances)

```typescript
catch (error: any) {
  console.error(error.message);
}
```

**Fix:** Use typed error handling:
```typescript
catch (error) {
  if (error instanceof FirebaseError) { /* handle */ }
  else if (error instanceof Error) { /* handle */ }
}
```

---

### M-04: `safeConvertToDate` Silently Masks Data Corruption

**File:** `src/app/dashboard/page.tsx:31-60`

Falls back to `new Date()` when timestamp data is invalid, masking data corruption:

```typescript
console.error(`CRITICAL: Unexpected data type...`);
return new Date(); // Silently returns now instead of surfacing the error
```

**Fix:** Return `null` and handle missing dates upstream, or throw to surface data issues.

---

### M-05: Unsafe Type Assertions on Firestore Data

**Files:** `src/lib/firestore-helpers.ts:137-138`, `src/contexts/AdminDataContext.tsx:47-54`

```typescript
const time = (data.startTime as Timestamp).toDate(); // Crashes if not Timestamp
```

```typescript
return { id: doc.id, ...data } as User; // Bypasses validation
```

**Fix:** Use `instanceof` checks before casting; validate required fields exist.

---

### M-06: Unsafe Error Message Exposure to Users

**File:** `src/app/bookings/page.tsx:685`

```typescript
if ((error as any).message) userMessage = `Could not cancel: ${(error as any).message}`;
```

Firebase internal error messages may leak implementation details.

**Fix:** Map known error codes to user-friendly messages; never expose raw error messages.

---

### M-07: Missing `window` Check in `useIsMobile`

**File:** `src/hooks/use-mobile.tsx:9-14`

`window.matchMedia()` accessed without SSR guard inside `useEffect` (safe in practice since effects only run client-side, but fragile if code is refactored):

```typescript
const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
```

**Fix:** Add `typeof window !== 'undefined'` guard for defensive coding.

---

### M-08: Inconsistent Audit Logging

**Files:** `src/app/admin/users/page.tsx`, `src/lib/firestore-helpers.ts`

Some operations await audit log creation, others fire-and-forget, and some skip logging entirely. Critical operations like role changes and resource deletions should always be logged synchronously.

**Fix:** Standardize: all write operations should `await addAuditLog(...)` inside the same try-catch.

---

### M-09: Missing Lab/Resource Existence Validation

**File:** `src/lib/firestore-helpers.ts:386-437`

`requestLabAccess_SA` and `manageLabMembership_SA` don't verify that the referenced lab or user actually exists before creating memberships.

**Fix:** Validate referenced documents exist before mutations.

---

### M-10: Hardcoded Time Slots

**File:** `src/app/bookings/page.tsx:963-967`

Booking time slots are hardcoded to 8:00 AM - 5:00 PM in 30-minute increments:

```typescript
const hour = 8 + Math.floor(i / 2);  // Hardcoded start
if (hour > 17 || (hour === 17 && minute !== '00')) return null;  // Hardcoded end
```

**Fix:** Make configurable per-lab via lab settings.

---

### M-11: Hardcoded Placeholder Images

**Files:** `src/app/dashboard/page.tsx:122,303`, `src/app/admin/users/page.tsx`

```typescript
imageUrl: data.imageUrl || 'https://placehold.co/600x400.png'
```

Duplicated across multiple files.

**Fix:** Extract to a constant in `src/lib/app-constants.ts`.

---

## 5. Low Severity Issues

### L-01: Missing Loading Skeletons

**File:** `src/app/dashboard/page.tsx:282-284`

Pages show a spinner instead of skeleton placeholders during loading, causing layout shift.

**Fix:** Use `<Skeleton />` components (already available in UI library) for progressive loading.

---

### L-02: Inconsistent Naming Conventions

**File:** `src/app/bookings/page.tsx`

Mixed patterns: `BookingsPageContent` vs `BookingForm`, `isLoadingBookings` vs `authIsLoading`, `tempSearchTerm` vs `activeSearchTerm`.

**Fix:** Adopt consistent naming: `isXxxLoading` for booleans, `XxxPage`/`XxxForm` for components.

---

### L-03: Missing Accessibility Labels

**Files:** `src/components/layout/MobileSidebarToggle.tsx:26-29`, `src/app/bookings/page.tsx:1075`

- Mobile sidebar toggle wrapped in non-semantic `<div>` without ARIA label.
- Calendar disabled dates have no explanation for screen readers.

**Fix:** Add `aria-label` and use semantic elements.

---

### L-04: Unused `useEffect` Import in Signup

**File:** `src/app/signup/page.tsx:3-4`

`useEffect` is imported but serves minimal purpose (only for message clearing that could be handled in `onSubmit`).

**Fix:** Remove if not needed or consolidate logic.

---

### L-05: Unsafe `localStorage` Access Without Try-Catch

**File:** `src/components/auth-context.tsx` (multiple locations)

```typescript
localStorage.setItem('labstation_user', JSON.stringify(appUser));
```

Can throw in private browsing or when quota is exceeded.

**Fix:** Wrap in try-catch.

---

### L-06: Inefficient Array Operations in Toast Listeners

**File:** `src/hooks/use-toast.ts:180`

Uses `indexOf` + `splice` (O(n)) for listener management.

**Fix:** Use a `Set` for O(1) add/delete.

---

### L-07: Inconsistent Error Logging Format

**File:** `src/lib/firestore-helpers.ts` (throughout)

Mixed prefixes: `!!! CRITICAL ERROR !!!`, `[functionName]`, `!!! FIRESTORE ERROR !!!`.

**Fix:** Standardize to `[moduleName:functionName]` format.

---

### L-08: Redundant Array Copy in `useMemo`

**File:** `src/app/bookings/page.tsx:366-400`

```typescript
const bookingsToDisplay = useMemo(() => {
  return [...allBookingsDataSource].filter(...); // Unnecessary spread
}, [...]);
```

The spread creates a copy that `filter` already creates anyway.

**Fix:** Remove the spread: `allBookingsDataSource.filter(...)`.

---

### L-09: `next.config.ts` Ignoring Build Errors

**File:** `next.config.ts`

```typescript
typescript: { ignoreBuildErrors: true },
eslint: { ignoreDuringBuilds: true },
```

This masks type errors and lint issues in production builds.

**Fix:** Enable build-time checks, especially before production deployment.

---

## 6. Summary Matrix

| ID | Issue | Severity | Category |
|----|-------|----------|----------|
| C-01 | No server-side API layer | Critical | Architecture |
| C-02 | Client-side RBAC only | Critical | Security |
| C-03 | Non-atomic booking conflict detection | Critical | Race Condition |
| C-04 | Missing authorization on booking mutations | Critical | Security |
| C-05 | Mock password change in production | Critical | Functionality |
| H-01 | Memory leak from unclean async | High | Memory Leak |
| H-02 | N+1 query pattern in bookings | High | Performance |
| H-03 | Fire-and-forget notification promises | High | Error Handling |
| H-04 | Toast listener memory leak | High | Memory Leak |
| H-05 | Signup fails if notification fails | High | Error Handling |
| H-06 | User deletion without referential integrity | High | Data Integrity |
| H-07 | Missing server-side input validation | High | Validation |
| H-08 | Race condition in AdminDataContext | High | Race Condition |
| H-09 | Unsafe form.reset in useEffect deps | High | Bug |
| H-10 | Direct form control mutation | High | Bug |
| M-01 | 30+ state variables in one component | Medium | Performance |
| M-02 | Missing search debounce | Medium | Performance |
| M-03 | Broad `any` exception catching | Medium | Type Safety |
| M-04 | Silent date corruption masking | Medium | Data Integrity |
| M-05 | Unsafe Firestore type assertions | Medium | Type Safety |
| M-06 | Error message exposure to users | Medium | Security |
| M-07 | Missing SSR window guard | Medium | Compatibility |
| M-08 | Inconsistent audit logging | Medium | Observability |
| M-09 | Missing entity existence validation | Medium | Validation |
| M-10 | Hardcoded time slots | Medium | Flexibility |
| M-11 | Hardcoded placeholder images | Medium | Maintainability |
| L-01 | Missing loading skeletons | Low | UX |
| L-02 | Inconsistent naming conventions | Low | Code Quality |
| L-03 | Missing accessibility labels | Low | Accessibility |
| L-04 | Unused import in signup | Low | Code Quality |
| L-05 | Unsafe localStorage access | Low | Robustness |
| L-06 | Inefficient toast listener ops | Low | Performance |
| L-07 | Inconsistent error log format | Low | Code Quality |
| L-08 | Redundant array copy in useMemo | Low | Performance |
| L-09 | Build errors ignored in config | Low | Build Safety |

**Totals:** 5 Critical, 10 High, 11 Medium, 9 Low = **35 issues**

---

## 7. Recommended Action Plan

### Phase 1: Security and Critical Bugs (Immediate)

1. **Implement actual password change** (C-05) - Replace mock with Firebase Auth `updatePassword()`
2. **Add server-side route guards** (C-02) - Middleware or layout-level role verification from Firestore
3. **Use Firestore transactions for bookings** (C-03) - Atomic conflict detection + creation
4. **Add authorization to booking mutations** (C-04) - Verify ownership/role before status changes
5. **Plan API layer migration** (C-01) - Start moving critical write operations to server actions

### Phase 2: Stability and Data Integrity (1-2 weeks)

6. **Fix memory leaks** (H-01, H-04) - Add AbortController, fix toast listener deps
7. **Fix form bugs** (H-09, H-10) - Remove form.reset from deps, stop mutating form.control
8. **Use Promise.allSettled for notifications** (H-03, H-05) - Non-critical side effects should not block main flow
9. **Add referential integrity checks** (H-06) - Validate no active references before user deletion
10. **Add server-side input validation** (H-07) - Zod schemas on all write paths

### Phase 3: Performance and Quality (2-4 weeks)

11. **Fix N+1 queries** (H-02) - Batch user lookups or denormalize
12. **Add AbortController to AdminDataContext** (H-08) - Cancel stale requests
13. **Consolidate bookings page state** (M-01) - useReducer or component decomposition
14. **Add search debounce** (M-02) - useDeferredValue or debounce utility
15. **Fix type safety issues** (M-03, M-05) - Replace `any` catches, add instanceof checks
16. **Standardize audit logging** (M-08) - All writes must await audit log
17. **Extract constants** (M-10, M-11) - Time slots and placeholder URLs to config

### Phase 4: Polish (Ongoing)

18. Fix accessibility gaps (L-03)
19. Add loading skeletons (L-01)
20. Standardize naming and logging (L-02, L-07)
21. Enable build-time type checking (L-09)
22. Minor cleanups (L-04 through L-08)
