import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.store'

import LoginPage from '../pages/LoginPage.vue'
import RegisterPage from '../pages/RegisterPage.vue'
import VerifyEmailPage from '../pages/VerifyEmailPage.vue'
import DashboardRedirectPage from '../pages/DashboardRedirectPage.vue'
import PatientDentistsPage from '../pages/PatientDentistsPage.vue'
import DentistDashboardPage from '../pages/DentistDashboardPage.vue'
import AdminDashboardPage from '../pages/AdminDashboardPage.vue'
import PatientAppointmentsPage from '../pages/PatientAppointmentsPage.vue'
import PatientHistoryPage from '../pages/PatientHistoryPage.vue'
import DentistAgendaPage from '../pages/DentistAgendaPage.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/dashboard',
    },
    {
      path: '/login',
      component: LoginPage,
      meta: { public: true },
    },
    {
      path: '/register',
      component: RegisterPage,
      meta: { public: true },
    },
    {
      path: '/verify-email',
      component: VerifyEmailPage,
      meta: { public: true },
    },
    {
      path: '/dashboard',
      component: DashboardRedirectPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/patient/dentists',
      component: PatientDentistsPage,
      meta: { requiresAuth: true, roles: ['PATIENT'] },
    },
    {
      path: '/dentist/dashboard',
      component: DentistDashboardPage,
      meta: { requiresAuth: true, roles: ['DENTIST'] },
    },
    {
      path: '/admin/dashboard',
      component: AdminDashboardPage,
      meta: { requiresAuth: true, roles: ['ADMIN'] },
    },
    {
      path: '/patient/appointments',
      component: PatientAppointmentsPage,
      meta: { requiresAuth: true, roles: ['PATIENT'] },
    },
    {
      path: '/patient/history',
      component: PatientHistoryPage,
      meta: { requiresAuth: true, roles: ['PATIENT'] },
    },
    {
      path: '/dentist/agenda',
      component: DentistAgendaPage,
      meta: { requiresAuth: true, roles: ['DENTIST'] },
    },
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return '/login'
  }

  if (to.meta.public && authStore.isAuthenticated) {
    return '/dashboard'
  }

  const allowedRoles = to.meta.roles as string[] | undefined

  if (allowedRoles && authStore.role && !allowedRoles.includes(authStore.role)) {
    return '/dashboard'
  }

  return true
})